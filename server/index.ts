import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { bootstrapAdminUser } from "./services/adminBootstrap";
import { checkAndCancelStuckOrders } from "./services/stuck-orders";

const app = express();

// Trust proxy for correct IP addresses and HTTPS protocol detection behind Replit proxy
app.set('trust proxy', true);

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
  type: ['application/json', 'application/cloudevents+json']
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Bootstrap first admin user from environment variables (if needed)
  await bootstrapAdminUser();

  // Start hourly cron job to check for stuck print orders
  // Runs every hour to detect orders where Prodigi hasn't started downloading files
  const ONE_HOUR_MS = 60 * 60 * 1000;
  
  // Run initial check after 5 minutes (gives app time to start up)
  setTimeout(async () => {
    try {
      log('[Stuck Orders] Running initial check...');
      await checkAndCancelStuckOrders();
    } catch (error) {
      console.error('[Stuck Orders] Initial check failed:', error);
    }
  }, 5 * 60 * 1000);
  
  // Then run every hour
  setInterval(async () => {
    try {
      await checkAndCancelStuckOrders();
    } catch (error) {
      console.error('[Stuck Orders] Hourly check failed:', error);
    }
  }, ONE_HOUR_MS);
  
  log('[Stuck Orders] Hourly checker initialized - will run every 60 minutes');

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
