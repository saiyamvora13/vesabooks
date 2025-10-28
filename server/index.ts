import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { bootstrapAdminUser } from "./services/adminBootstrap";
import { checkAndCancelStuckOrders } from "./services/stuck-orders";
import { logger } from "./utils/logger";
import { env } from "./config/env";

const app = express();

// Trust proxy for correct IP addresses and HTTPS protocol detection behind Replit proxy
app.set('trust proxy', true);

// Security headers middleware
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Strict Transport Security (only in production with HTTPS)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://api.stripe.com https://www.google.com;"
  );
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy
  res.setHeader('Permissions-Policy', 
    'camera=(), microphone=(), geolocation=(), payment=()'
  );
  
  next();
});

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

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    
    // Log the full error for debugging (server-side only)
    logger.error('Request error occurred', {
      message: err.message,
      stack: err.stack,
      status,
      url: req.url,
      method: req.method,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    // Only send safe error message to client
    let message = "Internal Server Error";
    
    if (status < 500) {
      // For client errors (4xx), it's safe to send the message
      message = err.message || "Bad Request";
    }
    
    res.status(status).json({ message });
    
    // Don't re-throw the error to prevent stack trace exposure
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
  const port = parseInt(env.PORT, 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
