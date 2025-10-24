// Replit Auth integration using OpenID Connect
import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import crypto from "crypto";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

function getSessionSecret(): string {
  // In production/deployment, SESSION_SECRET is required
  if (process.env.REPLIT_DEPLOYMENT === '1') {
    if (!process.env.SESSION_SECRET) {
      throw new Error(
        'SESSION_SECRET environment variable is required for production deployments. ' +
        'Please add it to your Replit Secrets before deploying.'
      );
    }
    return process.env.SESSION_SECRET;
  }
  
  // In development, auto-generate a secure secret if not provided
  if (!process.env.SESSION_SECRET) {
    const generatedSecret = crypto.randomBytes(32).toString('base64');
    console.warn(
      '⚠️  WARNING: Using auto-generated SESSION_SECRET for development. ' +
      'For production, please add SESSION_SECRET to your Replit Secrets.'
    );
    return generatedSecret;
  }
  
  return process.env.SESSION_SECRET;
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: getSessionSecret(),
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  return await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    // Upsert user and get the actual user from database
    const dbUser = await upsertUser(tokens.claims());
    // Create session with full token data
    const user: any = {};
    updateUserSession(user, tokens);
    // Override the id with the database user's ID to preserve foreign key relationships
    user.id = dbUser.id;
    verified(null, user);
  };

  const domains = process.env.REPLIT_DOMAINS!.split(",");
  const primaryDomain = domains[0];

  for (const domain of domains) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => {
    const userObj = user as any;
    if (userObj.claims) {
      cb(null, user);
    } else if (userObj.isAdminUser) {
      // Admin user - serialize with flag
      cb(null, { id: userObj.id, isAdminUser: true });
    } else {
      // Regular user
      cb(null, userObj.id);
    }
  });
  
  passport.deserializeUser(async (data: any, cb) => {
    if (typeof data === 'string') {
      // Regular user ID
      try {
        const user = await storage.getUser(data);
        if (!user) {
          return cb(null, false);
        }
        cb(null, user);
      } catch (error) {
        cb(error);
      }
    } else if (data?.isAdminUser) {
      // Admin user
      try {
        const admin = await storage.getAdminUser(data.id);
        if (!admin) {
          return cb(null, false);
        }
        cb(null, { ...admin, isAdminUser: true });
      } catch (error) {
        cb(error);
      }
    } else {
      // OIDC user with claims
      cb(null, data);
    }
  });

  app.get("/api/login", (req, res, next) => {
    passport.authenticate(`replitauth:${primaryDomain}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    passport.authenticate(`replitauth:${primaryDomain}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = req.user as any;

  if (!user.expires_at) {
    return next();
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
