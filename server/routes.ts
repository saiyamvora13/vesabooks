import type { Express, Request } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateStoryFromPrompt, generateIllustration, optimizeImageForWeb } from "./services/gemini";
import { createStorybookSchema, type StoryGenerationProgress, type Purchase, type InsertPurchase, type User, type AdminUser } from "@shared/schema";
import { randomUUID, randomBytes } from "crypto";
import * as fs from "fs";
import * as path from "path";
import multer from "multer";
import { setupAuth, isAuthenticated } from "./replitAuth";
import passport, { normalizeEmail, validateEmail, hashPassword } from "./auth";
import { isAdmin } from "./adminAuth";
import Stripe from "stripe";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import * as analytics from "./services/analytics";
import { verifyRecaptcha } from "./middleware/recaptcha";
import { createIpRateLimitMiddleware } from "./middleware/ipRateLimit";
import { buildFinalImagePrompt } from "./utils/imagePromptBuilder";
import sharp from "sharp";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: "2025-09-30.clover",
});

// Rate limiting configurations for authentication endpoints
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    const timestamp = new Date().toISOString();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const endpoint = req.path;
    const userAgent = req.get('user-agent') || 'unknown';
    console.log(`[RATE LIMIT EXCEEDED] ${timestamp} | Endpoint: ${endpoint} | IP: ${ip} | User-Agent: ${userAgent} | Limit: 5 requests/15min`);
    res.status(429).json({ message: 'Too many authentication attempts, please try again later' });
  },
});

const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset requests per hour
  message: 'Too many password reset attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const timestamp = new Date().toISOString();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const endpoint = req.path;
    const userAgent = req.get('user-agent') || 'unknown';
    console.log(`[RATE LIMIT EXCEEDED] ${timestamp} | Endpoint: ${endpoint} | IP: ${ip} | User-Agent: ${userAgent} | Limit: 3 requests/1hour`);
    res.status(429).json({ message: 'Too many password reset attempts, please try again later' });
  },
});

// Price constants - server is the source of truth for pricing
const PRICES = {
  digital: 399,  // $3.99 in cents
  print: 2499    // $24.99 in cents
};

// Configure multer for image uploads
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5,
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG and PNG files are allowed"));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Replit Auth: Setup authentication middleware
  await setupAuth(app);

  // Sitemap.xml for SEO
  app.get('/sitemap.xml', (req, res) => {
    const baseUrl = req.protocol + '://' + req.get('host');
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/create</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/login</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${baseUrl}/signup</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${baseUrl}/forgot-password</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
</urlset>`;
    
    res.header('Content-Type', 'application/xml');
    res.send(sitemap);
  });

  // Robots.txt for SEO
  app.get('/robots.txt', (req, res) => {
    const baseUrl = req.protocol + '://' + req.get('host');
    const robots = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /library
Disallow: /cart
Disallow: /checkout
Disallow: /purchases

Sitemap: ${baseUrl}/sitemap.xml`;
    
    res.header('Content-Type', 'text/plain');
    res.send(robots);
  });

  // Get authenticated user (or null for anonymous users)
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      // Return null for anonymous/unauthenticated users
      if (!req.isAuthenticated() || !req.user) {
        return res.json(null);
      }

      // Use req.user.id if available (from auth changes), fallback to claims.sub for compatibility
      const userId = req.user.id || req.user.claims?.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Traditional Email/Password Authentication Endpoints

  // POST /api/auth/signup - Create new user account
  app.post('/api/auth/signup', authRateLimiter, async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      // Validate required fields
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      // Normalize and validate email
      const normalizedEmail = normalizeEmail(email);
      if (!validateEmail(normalizedEmail)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }

      // Validate password length (minimum 8 characters)
      if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters long' });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(409).json({ message: 'Email already exists' });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create user
      const user = await storage.createUser({
        email: normalizedEmail,
        password: hashedPassword,
        authProvider: 'email',
        firstName,
        lastName,
        emailVerified: false,
      });

      // Automatically log in the user after signup
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error('Auto-login after signup error:', loginErr);
          return res.status(500).json({ message: 'Account created but login failed' });
        }

        // Return user without password
        const { password: _, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // POST /api/auth/login - Login with email and password
  app.post('/api/auth/login', authRateLimiter, (req, res, next) => {
    passport.authenticate('local', (err: any, user: User | false, info: any) => {
      if (err) {
        console.error('Login error:', err);
        return res.status(500).json({ message: 'Internal server error' });
      }
      
      if (!user) {
        return res.status(401).json({ message: info?.message || 'Invalid credentials' });
      }

      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error('Login session error:', loginErr);
          return res.status(500).json({ message: 'Internal server error' });
        }

        // Return user without password
        const { password: _, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
      });
    })(req, res, next);
  });

  // POST /api/auth/logout - Logout current user
  app.post('/api/auth/logout', (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ message: 'Internal server error' });
      }

      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          console.error('Session destroy error:', destroyErr);
          return res.status(500).json({ message: 'Failed to destroy session' });
        }

        res.json({ message: 'Logout successful' });
      });
    });
  });

  // GET /api/auth/me - Get current authenticated user
  app.get('/api/auth/me', (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = req.user as User;
    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  });

  // POST /api/auth/forgot-password - Request password reset
  app.post('/api/auth/forgot-password', passwordResetRateLimiter, async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      // Normalize email
      const normalizedEmail = normalizeEmail(email);

      // Find user by email
      const user = await storage.getUserByEmail(normalizedEmail);

      // Always return success to prevent email enumeration
      // Even if user doesn't exist, we return the same message
      if (user) {
        // Generate secure token
        const resetToken = randomBytes(32).toString('hex');

        // Create token with 1 hour expiration
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await storage.createPasswordResetToken(user.id, resetToken, expiresAt);

        // Detect language from Accept-Language header
        const language = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';

        // Send password reset email
        const { sendPasswordResetEmail } = await import('./services/resend-email');
        const userName = user.firstName || user.email || 'User';
        await sendPasswordResetEmail(user.email!, resetToken, userName, language);
      }

      // Always return success message (security best practice)
      res.json({ 
        message: 'If an account exists with this email, you will receive a password reset link' 
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // POST /api/auth/reset-password - Reset password with token
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token and new password are required' });
      }

      // Validate password length
      if (newPassword.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters long' });
      }

      // Get and validate token
      const resetToken = await storage.getPasswordResetToken(token);

      if (!resetToken) {
        return res.status(400).json({ message: 'Invalid or expired reset token' });
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);

      // Update user password
      await storage.updateUserPassword(resetToken.userId, hashedPassword);

      // Delete used token (single-use)
      await storage.deletePasswordResetToken(token);

      res.json({ message: 'Password reset successful' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // GET /api/auth/verify-reset-token/:token - Verify reset token validity
  app.get('/api/auth/verify-reset-token/:token', async (req, res) => {
    try {
      const { token } = req.params;

      if (!token) {
        return res.json({ valid: false });
      }

      // Check if token exists and is not expired
      const resetToken = await storage.getPasswordResetToken(token);

      res.json({ valid: !!resetToken });
    } catch (error) {
      console.error('Verify reset token error:', error);
      res.json({ valid: false });
    }
  });

  // Admin validation schemas
  const updateSettingSchema = z.object({
    value: z.string()
  });

  const updateHeroSlotSchema = z.object({
    storybookId: z.string().optional(),
    headline: z.string().optional(),
    ctaText: z.string().optional(),
    isActive: z.boolean().optional()
  });

  const addFeaturedStorybookSchema = z.object({
    storybookId: z.string(),
    rank: z.number()
  });

  // Helper function for audit logging
  async function logAdminAction(
    adminId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    changes: any,
    req: Request
  ) {
    await storage.createAuditLog({
      adminId,
      action,
      resourceType,
      resourceId,
      changes,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });
  }

  // Admin API Routes

  // POST /api/admin/login - Admin login
  app.post('/api/admin/login', authRateLimiter, (req, res, next) => {
    passport.authenticate('admin-local', (err: any, admin: AdminUser | false, info: any) => {
      if (err) {
        console.error('Admin login error:', err);
        return res.status(500).json({ message: 'Internal server error' });
      }
      
      if (!admin) {
        return res.status(401).json({ message: info?.message || 'Invalid credentials' });
      }

      req.logIn({ ...admin, isAdminUser: true }, (loginErr) => {
        if (loginErr) {
          console.error('Admin login session error:', loginErr);
          return res.status(500).json({ message: 'Internal server error' });
        }

        // Set admin flag in session
        (req.session as any).isAdminUser = true;

        // Return admin without password
        const { password: _, ...adminWithoutPassword } = admin;
        res.json(adminWithoutPassword);
      });
    })(req, res, next);
  });

  // POST /api/admin/logout - Admin logout
  app.post('/api/admin/logout', (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error('Admin logout error:', err);
        return res.status(500).json({ message: 'Internal server error' });
      }

      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          console.error('Admin session destroy error:', destroyErr);
          return res.status(500).json({ message: 'Failed to destroy session' });
        }

        res.json({ message: 'Logout successful' });
      });
    });
  });

  // GET /api/admin/me - Get current admin user
  app.get('/api/admin/me', isAdmin, async (req, res) => {
    try {
      const admin = req.user as AdminUser;
      const { password: _, ...adminWithoutPassword } = admin;
      res.json(adminWithoutPassword);
    } catch (error) {
      console.error('Get admin user error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // GET /api/admin/settings - Get all settings
  app.get('/api/admin/settings', isAdmin, async (req, res) => {
    try {
      const settings = await storage.getAllSettings();
      res.json(settings);
    } catch (error) {
      console.error('Get settings error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // GET /api/settings/pricing - Get public pricing settings (no auth required)
  app.get('/api/settings/pricing', async (req, res) => {
    try {
      const digitalPriceSetting = await storage.getSetting('digital_price');
      const printPriceSetting = await storage.getSetting('print_price');
      
      res.json({
        digital_price: digitalPriceSetting?.value || '399',
        print_price: printPriceSetting?.value || '2499',
      });
    } catch (error) {
      console.error('Get pricing settings error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // PUT /api/admin/settings/:key - Update setting
  app.put('/api/admin/settings/:key', isAdmin, async (req, res) => {
    try {
      const { key } = req.params;
      const admin = req.user as AdminUser;
      
      const validation = updateSettingSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: 'Invalid request body', errors: validation.error.errors });
      }

      const { value } = validation.data;
      
      // Get old value for audit log
      const oldSetting = await storage.getSetting(key);
      
      // Update setting
      await storage.updateSetting(key, value, admin.id);
      
      // Log action
      await logAdminAction(
        admin.id,
        'update_setting',
        'setting',
        key,
        { key, oldValue: oldSetting?.value, newValue: value },
        req
      );
      
      res.json({ message: 'Setting updated successfully' });
    } catch (error) {
      console.error('Update setting error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // GET /api/admin/hero-slots - Get hero slots
  app.get('/api/admin/hero-slots', isAdmin, async (req, res) => {
    try {
      const slots = await storage.getHeroSlots();
      res.json(slots);
    } catch (error) {
      console.error('Get hero slots error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // PUT /api/admin/hero-slots/:slotNumber - Update hero slot
  app.put('/api/admin/hero-slots/:slotNumber', isAdmin, async (req, res) => {
    try {
      const { slotNumber } = req.params;
      const admin = req.user as AdminUser;
      
      const validation = updateHeroSlotSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: 'Invalid request body', errors: validation.error.errors });
      }

      const data = validation.data;
      
      // Update slot
      await storage.updateHeroSlot(parseInt(slotNumber), {
        ...data,
        updatedBy: admin.id
      });
      
      // Log action
      await logAdminAction(
        admin.id,
        'update_hero_slot',
        'hero_slot',
        slotNumber,
        { slotNumber, ...data },
        req
      );
      
      res.json({ message: 'Hero slot updated successfully' });
    } catch (error) {
      console.error('Update hero slot error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // GET /api/admin/featured - Get featured storybooks
  app.get('/api/admin/featured', isAdmin, async (req, res) => {
    try {
      const featured = await storage.getFeaturedStorybooks();
      res.json(featured);
    } catch (error) {
      console.error('Get featured storybooks error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // POST /api/admin/featured - Add featured storybook
  app.post('/api/admin/featured', isAdmin, async (req, res) => {
    try {
      const admin = req.user as AdminUser;
      
      const validation = addFeaturedStorybookSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: 'Invalid request body', errors: validation.error.errors });
      }

      const { storybookId, rank } = validation.data;
      
      // Add featured storybook
      const featured = await storage.addFeaturedStorybook(storybookId, rank, admin.id);
      
      // Log action
      await logAdminAction(
        admin.id,
        'add_featured_storybook',
        'featured_storybook',
        featured.id,
        { storybookId, rank },
        req
      );
      
      res.json(featured);
    } catch (error) {
      console.error('Add featured storybook error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // DELETE /api/admin/featured/:id - Remove featured storybook
  app.delete('/api/admin/featured/:id', isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const admin = req.user as AdminUser;
      
      // Remove featured storybook
      await storage.removeFeaturedStorybook(id);
      
      // Log action
      await logAdminAction(
        admin.id,
        'remove_featured_storybook',
        'featured_storybook',
        id,
        { id },
        req
      );
      
      res.json({ message: 'Featured storybook removed successfully' });
    } catch (error) {
      console.error('Remove featured storybook error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // GET /api/admin/audit-logs - Get audit logs (super admin only)
  app.get('/api/admin/audit-logs', isAdmin, async (req, res) => {
    try {
      const admin = req.user as AdminUser;
      
      // Check if super admin
      if (!admin.isSuperAdmin) {
        return res.status(403).json({ message: 'Super admin access required' });
      }
      
      const { adminId, limit } = req.query;
      const logs = await storage.getAuditLogs(
        adminId as string | undefined,
        limit ? parseInt(limit as string) : undefined
      );
      
      res.json(logs);
    } catch (error) {
      console.error('Get audit logs error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // GET /api/admin/storage-analysis - Analyze object storage files
  app.get('/api/admin/storage-analysis', isAdmin, async (req, res) => {
    try {
      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorage = new ObjectStorageService();
      
      const allFiles = await objectStorage.listAllFiles();
      
      // Analyze files
      const largeFiles = allFiles.filter(f => f.size > 1.5 * 1024 * 1024); // Over 1.5MB
      const pngFiles = allFiles.filter(f => f.name.endsWith('.png'));
      const jpgFiles = allFiles.filter(f => f.name.endsWith('.jpg') || f.name.endsWith('.jpeg'));
      
      // Find potential duplicates (same base name but different extensions)
      const duplicates: Array<{ png: string; jpg: string }> = [];
      for (const png of pngFiles) {
        const baseName = png.name.replace('.png', '');
        const matchingJpg = jpgFiles.find(jpg => 
          jpg.name.replace(/\.(jpg|jpeg)$/, '') === baseName ||
          jpg.name.includes(baseName.split('/').pop() || '')
        );
        if (matchingJpg) {
          duplicates.push({ png: png.name, jpg: matchingJpg.name });
        }
      }
      
      const totalSize = allFiles.reduce((sum, f) => sum + f.size, 0);
      const pngSize = pngFiles.reduce((sum, f) => sum + f.size, 0);
      const jpgSize = jpgFiles.reduce((sum, f) => sum + f.size, 0);
      
      res.json({
        summary: {
          totalFiles: allFiles.length,
          totalSize: totalSize,
          totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
          pngCount: pngFiles.length,
          pngSizeMB: (pngSize / (1024 * 1024)).toFixed(2),
          jpgCount: jpgFiles.length,
          jpgSizeMB: (jpgSize / (1024 * 1024)).toFixed(2),
          largeFilesCount: largeFiles.length,
          potentialDuplicates: duplicates.length,
        },
        largeFiles: largeFiles.map(f => ({
          name: f.name,
          sizeMB: (f.size / (1024 * 1024)).toFixed(2),
          contentType: f.contentType,
        })),
        duplicates: duplicates,
        pngFiles: pngFiles.map(f => ({
          name: f.name,
          sizeMB: (f.size / (1024 * 1024)).toFixed(2),
        })),
      });
    } catch (error) {
      console.error('Storage analysis error:', error);
      res.status(500).json({ message: 'Internal server error', error: String(error) });
    }
  });

  // POST /api/admin/migrate-images - Migrate PNG images to optimized JPEG (test on 2 books)
  app.post('/api/admin/migrate-images', isAdmin, async (req, res) => {
    try {
      const admin = req.user as AdminUser;
      
      // Get first 2 storybooks to test migration
      const allStorybooks = await storage.getAllStorybooks();
      const storybooksToMigrate = allStorybooks.slice(0, 2);
      
      if (storybooksToMigrate.length === 0) {
        return res.json({ 
          message: 'No storybooks to migrate',
          migratedBooks: 0,
          migratedImages: 0 
        });
      }

      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorage = new ObjectStorageService();
      const generatedDir = path.join(process.cwd(), "generated");
      if (!fs.existsSync(generatedDir)) {
        fs.mkdirSync(generatedDir, { recursive: true });
      }

      let totalMigratedImages = 0;
      const results = [];

      for (const storybook of storybooksToMigrate) {
        const migratedImages: string[] = [];
        const filesToDelete: string[] = [];
        let migrationFailed = false;
        let failureReason = '';

        // Track all successful migrations before updating database
        let newCoverUrl = storybook.coverImageUrl;
        let newBackCoverUrl = storybook.backCoverImageUrl;
        const updatedPages = [...storybook.pages];

        const uploadedNewFiles: string[] = [];
        
        try {
          // Use storybook's creation date for organizing migrated images
          const createdAt = storybook.createdAt || new Date();
          
          // Migrate cover image
          if (storybook.coverImageUrl?.endsWith('.png')) {
            const oldFilename = storybook.coverImageUrl.split('/').pop()!;
            const newFilename = oldFilename.replace('.png', '.jpg');
            
            const imageBuffer = await objectStorage.getFileBuffer(oldFilename);
            const optimizedBuffer = await optimizeImageForWeb(imageBuffer);
            
            const tempPath = path.join(generatedDir, newFilename);
            fs.writeFileSync(tempPath, optimizedBuffer);
            
            newCoverUrl = await objectStorage.uploadFile(tempPath, newFilename, true, createdAt);
            // Track the full path for potential rollback
            const uploadedPath = newCoverUrl.replace('/api/storage/', '');
            uploadedNewFiles.push(uploadedPath);
            fs.unlinkSync(tempPath);
            
            filesToDelete.push(oldFilename);
            migratedImages.push(`Cover: ${oldFilename} → ${newFilename}`);
          }

          // Migrate back cover image
          if (storybook.backCoverImageUrl?.endsWith('.png')) {
            const oldFilename = storybook.backCoverImageUrl.split('/').pop()!;
            const newFilename = oldFilename.replace('.png', '.jpg');
            
            const imageBuffer = await objectStorage.getFileBuffer(oldFilename);
            const optimizedBuffer = await optimizeImageForWeb(imageBuffer);
            
            const tempPath = path.join(generatedDir, newFilename);
            fs.writeFileSync(tempPath, optimizedBuffer);
            
            newBackCoverUrl = await objectStorage.uploadFile(tempPath, newFilename, true, createdAt);
            const uploadedPath = newBackCoverUrl.replace('/api/storage/', '');
            uploadedNewFiles.push(uploadedPath);
            fs.unlinkSync(tempPath);
            
            filesToDelete.push(oldFilename);
            migratedImages.push(`Back Cover: ${oldFilename} → ${newFilename}`);
          }

          // Migrate page images
          for (let i = 0; i < storybook.pages.length; i++) {
            const page = storybook.pages[i];
            if (page.imageUrl?.endsWith('.png')) {
              const oldFilename = page.imageUrl.split('/').pop()!;
              const newFilename = oldFilename.replace('.png', '.jpg');
              
              const imageBuffer = await objectStorage.getFileBuffer(oldFilename);
              const optimizedBuffer = await optimizeImageForWeb(imageBuffer);
              
              const tempPath = path.join(generatedDir, newFilename);
              fs.writeFileSync(tempPath, optimizedBuffer);
              
              const newUrl = await objectStorage.uploadFile(tempPath, newFilename, true, createdAt);
              const uploadedPath = newUrl.replace('/api/storage/', '');
              uploadedNewFiles.push(uploadedPath);
              fs.unlinkSync(tempPath);
              
              filesToDelete.push(oldFilename);
              updatedPages[i] = { ...page, imageUrl: newUrl };
              migratedImages.push(`Page ${page.pageNumber}: ${oldFilename} → ${newFilename}`);
            }
          }

          // Only update database if ALL uploads succeeded
          if (migratedImages.length > 0) {
            // Update both cover/pages and back cover atomically
            const { db } = await import('./db');
            const { storybooks } = await import('@shared/schema');
            const { eq } = await import('drizzle-orm');
            
            await db.update(storybooks)
              .set({ 
                coverImageUrl: newCoverUrl,
                backCoverImageUrl: newBackCoverUrl,
                pages: updatedPages
              })
              .where(eq(storybooks.id, storybook.id));

            // Track successful migration count
            totalMigratedImages += migratedImages.length;

            // Delete old PNG files after successful DB update (non-blocking)
            for (const oldFile of filesToDelete) {
              try {
                await objectStorage.deleteFile(oldFile);
              } catch (deleteError) {
                console.error(`Failed to delete old file ${oldFile}, but migration succeeded:`, deleteError);
              }
            }
          }
        } catch (error) {
          migrationFailed = true;
          failureReason = String(error);
          console.error(`Failed to migrate storybook ${storybook.id}:`, error);
          
          // Clean up uploaded new files on failure
          for (const newFile of uploadedNewFiles) {
            try {
              await objectStorage.deleteFile(newFile);
            } catch (cleanupError) {
              console.error(`Failed to cleanup uploaded file ${newFile}:`, cleanupError);
            }
          }
        }

        results.push({
          storybookId: storybook.id,
          title: storybook.title,
          migratedImages: migrationFailed ? [] : migratedImages,
          count: migrationFailed ? 0 : migratedImages.length,
          failed: migrationFailed,
          failureReason: migrationFailed ? failureReason : undefined
        });
      }

      // Log action
      await logAdminAction(
        admin.id,
        'migrate_images',
        'storybook',
        'migration_test',
        { 
          booksProcessed: storybooksToMigrate.length,
          totalImages: totalMigratedImages,
          results 
        },
        req
      );

      res.json({
        message: `Successfully migrated ${totalMigratedImages} images from ${storybooksToMigrate.length} books`,
        migratedBooks: storybooksToMigrate.length,
        migratedImages: totalMigratedImages,
        details: results
      });
    } catch (error) {
      console.error('Image migration error:', error);
      res.status(500).json({ message: 'Internal server error', error: String(error) });
    }
  });

  // POST /api/admin/migrate-all-images - Migrate ALL PNG images to optimized JPEG
  app.post('/api/admin/migrate-all-images', isAdmin, async (req, res) => {
    try {
      const admin = req.user as AdminUser;
      
      // Get ALL storybooks with PNG images
      const allStorybooks = await storage.getAllStorybooks();
      const storybooksToMigrate = allStorybooks.filter(sb => 
        sb.coverImageUrl?.endsWith('.png') || 
        sb.backCoverImageUrl?.endsWith('.png') ||
        sb.pages.some(p => p.imageUrl?.endsWith('.png'))
      );
      
      if (storybooksToMigrate.length === 0) {
        return res.json({ 
          message: 'No PNG images to migrate',
          migratedBooks: 0,
          migratedImages: 0 
        });
      }

      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorage = new ObjectStorageService();
      const generatedDir = path.join(process.cwd(), "generated");
      if (!fs.existsSync(generatedDir)) {
        fs.mkdirSync(generatedDir, { recursive: true });
      }

      let totalMigratedImages = 0;
      const results = [];
      const deletionLog: string[] = [];

      for (const storybook of storybooksToMigrate) {
        const migratedImages: string[] = [];
        const filesToDelete: string[] = [];
        let migrationFailed = false;
        let failureReason = '';

        let newCoverUrl = storybook.coverImageUrl;
        let newBackCoverUrl = storybook.backCoverImageUrl;
        const updatedPages = [...storybook.pages];
        const uploadedNewFiles: string[] = [];
        
        try {
          const createdAt = storybook.createdAt || new Date();
          
          // Migrate cover image
          if (storybook.coverImageUrl?.endsWith('.png')) {
            const oldFilename = storybook.coverImageUrl.split('/').pop()!;
            const newFilename = oldFilename.replace('.png', '.jpg');
            
            const imageBuffer = await objectStorage.getFileBuffer(oldFilename);
            const optimizedBuffer = await optimizeImageForWeb(imageBuffer);
            
            const tempPath = path.join(generatedDir, newFilename);
            fs.writeFileSync(tempPath, optimizedBuffer);
            
            newCoverUrl = await objectStorage.uploadFile(tempPath, newFilename, true, createdAt);
            const uploadedPath = newCoverUrl.replace('/api/storage/', '');
            uploadedNewFiles.push(uploadedPath);
            fs.unlinkSync(tempPath);
            
            filesToDelete.push(oldFilename);
            migratedImages.push(`Cover: ${oldFilename} → ${newFilename}`);
          }

          // Migrate back cover image
          if (storybook.backCoverImageUrl?.endsWith('.png')) {
            const oldFilename = storybook.backCoverImageUrl.split('/').pop()!;
            const newFilename = oldFilename.replace('.png', '.jpg');
            
            const imageBuffer = await objectStorage.getFileBuffer(oldFilename);
            const optimizedBuffer = await optimizeImageForWeb(imageBuffer);
            
            const tempPath = path.join(generatedDir, newFilename);
            fs.writeFileSync(tempPath, optimizedBuffer);
            
            newBackCoverUrl = await objectStorage.uploadFile(tempPath, newFilename, true, createdAt);
            const uploadedPath = newBackCoverUrl.replace('/api/storage/', '');
            uploadedNewFiles.push(uploadedPath);
            fs.unlinkSync(tempPath);
            
            filesToDelete.push(oldFilename);
            migratedImages.push(`Back Cover: ${oldFilename} → ${newFilename}`);
          }

          // Migrate page images
          for (let i = 0; i < storybook.pages.length; i++) {
            const page = storybook.pages[i];
            if (page.imageUrl?.endsWith('.png')) {
              const oldFilename = page.imageUrl.split('/').pop()!;
              const newFilename = oldFilename.replace('.png', '.jpg');
              
              const imageBuffer = await objectStorage.getFileBuffer(oldFilename);
              const optimizedBuffer = await optimizeImageForWeb(imageBuffer);
              
              const tempPath = path.join(generatedDir, newFilename);
              fs.writeFileSync(tempPath, optimizedBuffer);
              
              const newUrl = await objectStorage.uploadFile(tempPath, newFilename, true, createdAt);
              const uploadedPath = newUrl.replace('/api/storage/', '');
              uploadedNewFiles.push(uploadedPath);
              fs.unlinkSync(tempPath);
              
              filesToDelete.push(oldFilename);
              updatedPages[i] = { ...page, imageUrl: newUrl };
              migratedImages.push(`Page ${page.pageNumber}: ${oldFilename} → ${newFilename}`);
            }
          }

          // Only update database if ALL uploads succeeded
          if (migratedImages.length > 0) {
            const { db } = await import('./db');
            const { storybooks } = await import('@shared/schema');
            const { eq } = await import('drizzle-orm');
            
            await db.update(storybooks)
              .set({ 
                coverImageUrl: newCoverUrl,
                backCoverImageUrl: newBackCoverUrl,
                pages: updatedPages
              })
              .where(eq(storybooks.id, storybook.id));

            totalMigratedImages += migratedImages.length;

            // Delete old PNG files after successful DB update
            for (const oldFile of filesToDelete) {
              try {
                await objectStorage.deleteFile(oldFile);
                deletionLog.push(`✓ Deleted: ${oldFile}`);
              } catch (deleteError) {
                const errMsg = `✗ Failed to delete ${oldFile}: ${String(deleteError)}`;
                deletionLog.push(errMsg);
                console.error(errMsg);
              }
            }
          }
        } catch (error) {
          migrationFailed = true;
          failureReason = String(error);
          console.error(`Failed to migrate storybook ${storybook.id}:`, error);
          
          // Clean up uploaded new files on failure
          for (const newFile of uploadedNewFiles) {
            try {
              await objectStorage.deleteFile(newFile);
            } catch (cleanupError) {
              console.error(`Failed to cleanup uploaded file ${newFile}:`, cleanupError);
            }
          }
        }

        results.push({
          storybookId: storybook.id,
          title: storybook.title,
          migratedImages: migrationFailed ? [] : migratedImages,
          count: migrationFailed ? 0 : migratedImages.length,
          failed: migrationFailed,
          failureReason: migrationFailed ? failureReason : undefined
        });
      }

      // Log action
      await logAdminAction(
        admin.id,
        'migrate_all_images',
        'storybook',
        'full_migration',
        { 
          booksProcessed: storybooksToMigrate.length,
          totalImages: totalMigratedImages,
          deletionLog,
          results 
        },
        req
      );

      res.json({
        message: `Successfully migrated ${totalMigratedImages} images from ${storybooksToMigrate.length} books`,
        migratedBooks: storybooksToMigrate.length,
        migratedImages: totalMigratedImages,
        deletionLog,
        details: results
      });
    } catch (error) {
      console.error('Full image migration error:', error);
      res.status(500).json({ message: 'Internal server error', error: String(error) });
    }
  });

  // POST /api/admin/cleanup-orphaned-pngs - Delete orphaned PNG files
  app.post('/api/admin/cleanup-orphaned-pngs', isAdmin, async (req, res) => {
    try {
      const admin = req.user as AdminUser;
      
      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorage = new ObjectStorageService();
      
      // Get all files from storage
      const allFiles = await objectStorage.listAllFiles();
      const pngFiles = allFiles.filter(f => f.name.endsWith('.png'));
      
      if (pngFiles.length === 0) {
        return res.json({ 
          message: 'No PNG files found in storage',
          deletedCount: 0 
        });
      }

      // Get all storybooks to check what's in the database
      const allStorybooks = await storage.getAllStorybooks();
      const dbPngUrls = new Set<string>();
      
      // Collect all PNG URLs from database
      for (const sb of allStorybooks) {
        if (sb.coverImageUrl?.endsWith('.png')) {
          const filename = sb.coverImageUrl.split('/').pop()!;
          dbPngUrls.add(filename);
        }
        if (sb.backCoverImageUrl?.endsWith('.png')) {
          const filename = sb.backCoverImageUrl.split('/').pop()!;
          dbPngUrls.add(filename);
        }
        for (const page of sb.pages) {
          if (page.imageUrl?.endsWith('.png')) {
            const filename = page.imageUrl.split('/').pop()!;
            dbPngUrls.add(filename);
          }
        }
      }

      const deletionResults: Array<{ file: string; status: 'deleted' | 'in_use' | 'error'; message?: string }> = [];
      let deletedCount = 0;

      // Check each PNG file
      for (const pngFile of pngFiles) {
        const filename = pngFile.name.split('/').pop() || pngFile.name;
        
        // If file is still referenced in database, don't delete
        if (dbPngUrls.has(filename)) {
          deletionResults.push({
            file: pngFile.name,
            status: 'in_use',
            message: 'Still referenced in database'
          });
          continue;
        }

        // File is orphaned, safe to delete
        try {
          await objectStorage.deleteFile(pngFile.name);
          deletedCount++;
          deletionResults.push({
            file: pngFile.name,
            status: 'deleted',
            message: `Deleted orphaned PNG (${(pngFile.size / (1024 * 1024)).toFixed(2)}MB)`
          });
        } catch (error) {
          deletionResults.push({
            file: pngFile.name,
            status: 'error',
            message: String(error)
          });
        }
      }

      // Log action
      await logAdminAction(
        admin.id,
        'cleanup_orphaned_pngs',
        'storage',
        'cleanup',
        { 
          totalPngs: pngFiles.length,
          deletedCount,
          results: deletionResults
        },
        req
      );

      res.json({
        message: `Cleaned up ${deletedCount} orphaned PNG files`,
        totalPngsFound: pngFiles.length,
        deletedCount,
        details: deletionResults
      });
    } catch (error) {
      console.error('Cleanup orphaned PNGs error:', error);
      res.status(500).json({ message: 'Internal server error', error: String(error) });
    }
  });

  // Sample Prompts API Routes
  
  // Validation schema for sample prompts
  const samplePromptSchema = z.object({
    title: z.string().min(1, "Title is required"),
    prompt: z.string().min(10, "Prompt must be at least 10 characters"),
    ageRange: z.string().min(1, "Age range is required"),
    isActive: z.boolean().optional().default(true),
    displayOrder: z.string().optional().default('0')
  });

  // GET /api/sample-prompts - Get active sample prompts (public, no auth required)
  app.get('/api/sample-prompts', async (req, res) => {
    try {
      const prompts = await storage.getActiveSamplePrompts();
      res.json(prompts);
    } catch (error) {
      console.error('Get active sample prompts error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // GET /api/admin/sample-prompts - Get all sample prompts (admin only)
  app.get('/api/admin/sample-prompts', isAdmin, async (req, res) => {
    try {
      const prompts = await storage.getAllSamplePrompts();
      res.json(prompts);
    } catch (error) {
      console.error('Get all sample prompts error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // POST /api/admin/sample-prompts - Create new sample prompt (admin only)
  app.post('/api/admin/sample-prompts', isAdmin, async (req, res) => {
    try {
      const admin = req.user as AdminUser;
      
      const validation = samplePromptSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: 'Invalid request body', errors: validation.error.errors });
      }

      const { title, prompt, ageRange, isActive, displayOrder } = validation.data;
      
      const newPrompt = await storage.createSamplePrompt({
        title,
        prompt,
        ageRange,
        isActive: isActive ?? true,
        displayOrder: displayOrder ?? 0,
        updatedBy: admin.id
      });
      
      await logAdminAction(
        admin.id,
        'create_sample_prompt',
        'sample_prompt',
        newPrompt.id,
        { title, ageRange, isActive, displayOrder },
        req
      );
      
      res.json(newPrompt);
    } catch (error) {
      console.error('Create sample prompt error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // PUT /api/admin/sample-prompts/:id - Update sample prompt (admin only)
  app.put('/api/admin/sample-prompts/:id', isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const admin = req.user as AdminUser;
      
      const validation = samplePromptSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: 'Invalid request body', errors: validation.error.errors });
      }

      const data = validation.data;
      
      const oldPrompt = await storage.getSamplePrompt(id);
      if (!oldPrompt) {
        return res.status(404).json({ message: 'Sample prompt not found' });
      }
      
      const updatedPrompt = await storage.updateSamplePrompt(id, {
        ...data,
        updatedBy: admin.id
      });
      
      await logAdminAction(
        admin.id,
        'update_sample_prompt',
        'sample_prompt',
        id,
        { old: oldPrompt, new: data },
        req
      );
      
      res.json(updatedPrompt);
    } catch (error) {
      console.error('Update sample prompt error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // DELETE /api/admin/sample-prompts/:id - Delete sample prompt (admin only)
  app.delete('/api/admin/sample-prompts/:id', isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const admin = req.user as AdminUser;
      
      const prompt = await storage.getSamplePrompt(id);
      if (!prompt) {
        return res.status(404).json({ message: 'Sample prompt not found' });
      }
      
      await storage.deleteSamplePrompt(id);
      
      await logAdminAction(
        admin.id,
        'delete_sample_prompt',
        'sample_prompt',
        id,
        { title: prompt.title },
        req
      );
      
      res.json({ message: 'Sample prompt deleted successfully' });
    } catch (error) {
      console.error('Delete sample prompt error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // GET /api/analytics/completion-rate - Get story completion rate (admin only)
  app.get('/api/analytics/completion-rate', isAdmin, async (req, res) => {
    try {
      const completionRate = await storage.getCompletionRate();
      res.json({ completionRate });
    } catch (error) {
      console.error('Get completion rate error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // GET /api/analytics/popular-prompts - Get popular prompts (admin only)
  app.get('/api/analytics/popular-prompts', isAdmin, async (req, res) => {
    try {
      const { limit } = req.query;
      const parsedLimit = limit ? parseInt(limit as string) : 10;
      const popularPrompts = await storage.getPopularPrompts(parsedLimit);
      res.json(popularPrompts);
    } catch (error) {
      console.error('Get popular prompts error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // GET /api/admin/analytics/overview - Get overview metrics (admin only)
  app.get('/api/admin/analytics/overview', isAdmin, async (req, res) => {
    try {
      const { db } = await import('./db');
      const { purchases, storybooks, users, storyRatings } = await import('@shared/schema');
      const { sql, sum, countDistinct, count, avg, isNull } = await import('drizzle-orm');

      // Get total revenue and revenue by type
      const revenueResult = await db
        .select({
          totalRevenue: sum(purchases.price),
          type: purchases.type
        })
        .from(purchases)
        .where(sql`${purchases.status} = 'completed'`)
        .groupBy(purchases.type);

      const totalRevenue = revenueResult.reduce((acc, r) => acc + Number(r.totalRevenue || 0), 0);
      const digitalRevenue = revenueResult.find(r => r.type === 'digital')?.totalRevenue || 0;
      const printRevenue = revenueResult.find(r => r.type === 'print')?.totalRevenue || 0;

      // Get total stories created (excluding deleted)
      const [storiesResult] = await db
        .select({ count: count() })
        .from(storybooks)
        .where(isNull(storybooks.deletedAt));

      // Get total active users (users with storybooks)
      const [activeUsersResult] = await db
        .select({ count: countDistinct(storybooks.userId) })
        .from(storybooks)
        .where(isNull(storybooks.deletedAt));

      // Get completion rate from existing analytics
      const completionRate = await storage.getCompletionRate();

      // Get average rating across all storybooks
      const [avgRatingResult] = await db
        .select({ avgRating: avg(storyRatings.rating) })
        .from(storyRatings);

      res.json({
        totalRevenue: Number(totalRevenue) / 100, // Convert cents to dollars
        revenueByType: {
          digital: Number(digitalRevenue) / 100,
          print: Number(printRevenue) / 100
        },
        totalStories: storiesResult.count,
        activeUsers: activeUsersResult.count,
        completionRate,
        averageRating: avgRatingResult.avgRating ? Number(avgRatingResult.avgRating) : null
      });
    } catch (error) {
      console.error('Get analytics overview error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // GET /api/admin/analytics/revenue-trends - Revenue over time (admin only)
  app.get('/api/admin/analytics/revenue-trends', isAdmin, async (req, res) => {
    try {
      const { db } = await import('./db');
      const { purchases } = await import('@shared/schema');
      const { sql } = await import('drizzle-orm');

      // Get revenue for last 30 days grouped by date
      const trends = await db.execute(sql`
        SELECT 
          DATE(created_at) as date,
          type,
          SUM(CAST(price AS NUMERIC)) as revenue
        FROM ${purchases}
        WHERE created_at >= NOW() - INTERVAL '30 days'
          AND status = 'completed'
        GROUP BY DATE(created_at), type
        ORDER BY DATE(created_at) ASC
      `);

      res.json(trends.rows);
    } catch (error) {
      console.error('Get revenue trends error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // GET /api/admin/analytics/popular-themes - Popular themes/styles (admin only)
  app.get('/api/admin/analytics/popular-themes', isAdmin, async (req, res) => {
    try {
      const { db } = await import('./db');
      const { storybooks } = await import('@shared/schema');
      const { isNull } = await import('drizzle-orm');

      // Get all prompts
      const allStorybooks = await db
        .select({ prompt: storybooks.prompt })
        .from(storybooks)
        .where(isNull(storybooks.deletedAt));

      // Simple keyword extraction
      const keywords = [
        'princess', 'prince', 'dragon', 'fairy', 'magic', 'adventure', 
        'space', 'robot', 'dinosaur', 'pirate', 'unicorn', 'superhero',
        'ocean', 'forest', 'castle', 'treasure', 'monster', 'friendship',
        'family', 'school', 'animal', 'pet', 'car', 'train'
      ];

      const themeCount: Record<string, number> = {};
      keywords.forEach(keyword => themeCount[keyword] = 0);

      allStorybooks.forEach(story => {
        const promptLower = story.prompt.toLowerCase();
        keywords.forEach(keyword => {
          if (promptLower.includes(keyword)) {
            themeCount[keyword]++;
          }
        });
      });

      // Convert to array and sort by count
      const themes = Object.entries(themeCount)
        .map(([theme, count]) => ({ theme, count }))
        .filter(t => t.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      res.json(themes);
    } catch (error) {
      console.error('Get popular themes error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // GET /api/admin/analytics/user-retention - User retention (admin only)
  app.get('/api/admin/analytics/user-retention', isAdmin, async (req, res) => {
    try {
      const { db } = await import('./db');
      const { users, storybooks } = await import('@shared/schema');
      const { sql, count } = await import('drizzle-orm');

      // Get new users per day for last 30 days
      const newUsersTrend = await db.execute(sql`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as new_users
        FROM ${users}
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at) ASC
      `);

      // Get returning users (users with multiple storybooks)
      const returningUsersResult = await db.execute(sql`
        SELECT COUNT(DISTINCT user_id) as returning_users
        FROM (
          SELECT user_id, COUNT(*) as story_count
          FROM ${storybooks}
          WHERE deleted_at IS NULL
          GROUP BY user_id
          HAVING COUNT(*) > 1
        ) as multi_story_users
      `);

      // Get total users
      const [totalUsersResult] = await db
        .select({ count: count() })
        .from(users);

      const returningUsersCount = Number(returningUsersResult.rows[0]?.returning_users || 0);
      const totalUsersCount = Number(totalUsersResult.count);
      
      res.json({
        newUsersTrend: newUsersTrend.rows,
        returningUsers: returningUsersCount,
        totalUsers: totalUsersCount,
        retentionRate: totalUsersCount > 0 
          ? (returningUsersCount / totalUsersCount) * 100 
          : 0
      });
    } catch (error) {
      console.error('Get user retention error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // GET /api/metrics (public - no auth required)
  app.get('/api/metrics', async (req, res) => {
    try {
      const metrics = await storage.getMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching metrics:", error);
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

  // Initialize IP rate limiter
  const ipRateLimiter = createIpRateLimitMiddleware(storage);

  // Create storybook (supports both authenticated and anonymous users)
  app.post("/api/storybooks", 
    upload.array("images", 5),
    async (req: any, res, next) => {
      // If user is authenticated, skip IP rate limiting and reCAPTCHA
      if (req.user) {
        return next();
      }
      // For anonymous users, check IP rate limit and verify reCAPTCHA
      ipRateLimiter(req, res, (err) => {
        if (err) return;
        verifyRecaptcha(req, res, next);
      });
    },
    async (req: any, res) => {
      try {
        const { prompt, author, age, illustrationStyle } = req.body;
        const files = req.files as Express.Multer.File[] | undefined;
        
        // Determine user ID (authenticated or null for anonymous)
        const userId = req.user ? (req.user.id || req.user.claims?.sub) : null;
        const isAnonymous = !userId;

        // Get user info for author fallback (authenticated users only)
        let authorName = author || 'Anonymous';
        if (userId) {
          const user = await storage.getUser(userId);
          authorName = author || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Anonymous';
        }

        // Images are now optional - handle empty or undefined files
        const imagePaths = files ? files.map(f => f.path) : [];
        const imageFilenames = files ? files.map(f => f.filename) : [];

        // Use provided illustration style or default
        const finalIllustrationStyle = illustrationStyle || "vibrant and colorful children's book illustration";

        // Validate request
        const validationResult = createStorybookSchema.safeParse({
          prompt,
          author: authorName,
          age,
          illustrationStyle: finalIllustrationStyle,
          inspirationImages: imageFilenames,
        });

        if (!validationResult.success) {
          return res.status(400).json({ message: validationResult.error.message });
        }

        // Fetch pages_per_book setting from admin settings
        const pagesSetting = await storage.getSetting('pages_per_book');
        const pagesPerBook = pagesSetting ? parseInt(pagesSetting.value) : 3;
        
        // Validate page count (minimum 1, maximum 10 for performance)
        const validatedPagesPerBook = Math.max(1, Math.min(10, pagesPerBook));

        const sessionId = randomUUID();

        // Track story generation start (non-blocking, only for authenticated users)
        if (userId) {
          analytics.trackStoryStarted(userId, prompt, imageFilenames).catch(err => {
            console.error('Failed to track story_started event:', err);
          });
        }

        // Increment IP story count for anonymous users
        if (isAnonymous) {
          const ipAddress = (req as any).ipAddress;
          await storage.incrementIpStoryCount(ipAddress);
        }

        // Start generation in background with userId (null for anonymous), author, age, pagesPerBook, and illustrationStyle
        generateStorybookAsync(sessionId, userId, prompt, authorName, age, imagePaths, validatedPagesPerBook, finalIllustrationStyle)
          .catch((error: unknown) => {
            console.error("Story generation failed:", error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            storage.setGenerationProgress(sessionId, {
              step: 'processing_images',
              progress: 0,
              message: `Generation failed: ${errorMessage}`,
              error: errorMessage,
            });
          });

        res.json({ 
          sessionId,
          isAnonymous,
          rateLimitRemaining: isAnonymous ? (req as any).rateLimitRemaining - 1 : null
        });
      } catch (error) {
        console.error("Create storybook error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  // Get generation progress
  app.get("/api/generation/:sessionId/progress", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const progress = await storage.getGenerationProgress(sessionId);
      
      if (!progress) {
        return res.status(404).json({ message: "Session not found" });
      }

      res.json(progress);
    } catch (error) {
      console.error("Get progress error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user's storybooks (requires authentication)
  app.get("/api/storybooks", isAuthenticated, async (req: any, res) => {
    try {
      // Use req.user.id if available (from auth changes), fallback to claims.sub for compatibility
      const userId = req.user.id || req.user.claims?.sub;
      const storybooks = await storage.getUserStorybooks(userId);
      res.json(storybooks);
    } catch (error) {
      console.error("Get user storybooks error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get example storybooks for homepage showcase (public)
  app.get("/api/storybooks/examples", async (req, res) => {
    try {
      // Try to fetch hero slots from admin settings
      const heroSlots = await storage.getHeroSlots();
      
      // Filter active slots that have a storybook assigned
      const activeSlots = heroSlots
        .filter(slot => slot.isActive && slot.storybookId)
        .sort((a, b) => Number(a.slotNumber) - Number(b.slotNumber));
      
      if (activeSlots.length > 0) {
        // Fetch storybooks for active hero slots
        const storybooks = [];
        for (const slot of activeSlots) {
          const storybook = await storage.getStorybook(slot.storybookId!);
          if (storybook) {
            storybooks.push(storybook);
          }
        }
        
        // If we found storybooks, return them
        if (storybooks.length > 0) {
          return res.json(storybooks);
        }
      }
      
      // Fallback to most recent storybooks if no hero slots configured
      const examples = await storage.getExampleStorybooks(3);
      res.json(examples);
    } catch (error) {
      console.error("Get example storybooks error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get storybook by ID
  app.get("/api/storybooks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const storybook = await storage.getStorybook(id);
      
      if (!storybook) {
        return res.status(404).json({ message: "Storybook not found" });
      }

      res.json(storybook);
    } catch (error) {
      console.error("Get storybook error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete storybook (requires authentication)
  app.delete("/api/storybooks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id || req.user.claims?.sub;

      // Get the storybook to verify ownership and access image URLs
      const storybook = await storage.getStorybook(id);
      
      if (!storybook) {
        return res.status(404).json({ message: "Storybook not found" });
      }

      // Verify ownership
      if (storybook.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this storybook" });
      }

      // Delete all images from Object Storage
      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorage = new ObjectStorageService();

      // Helper function to extract filename from URL
      const extractFilename = (url: string): string => {
        // URL format: "/api/storage/filename.jpg"
        const parts = url.split('/');
        return parts[parts.length - 1];
      };

      // Delete cover image if exists
      if (storybook.coverImageUrl) {
        const coverFilename = extractFilename(storybook.coverImageUrl);
        await objectStorage.deleteFile(coverFilename);
      }

      // Delete all page images
      for (const page of storybook.pages) {
        if (page.imageUrl) {
          const pageFilename = extractFilename(page.imageUrl);
          await objectStorage.deleteFile(pageFilename);
        }
      }

      // Delete the storybook from database
      await storage.deleteStorybook(id);

      res.json({ message: "Storybook deleted successfully" });
    } catch (error) {
      console.error("Delete storybook error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Save a storybook to library (requires authentication)
  app.post("/api/storybooks/:id/save", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id || req.user.claims?.sub;

      // Verify the storybook exists and is public
      const storybook = await storage.getStorybook(id);
      if (!storybook) {
        return res.status(404).json({ message: "Storybook not found" });
      }

      // Check if it's already saved (to avoid duplicate errors)
      const alreadySaved = await storage.isSaved(userId, id);
      if (alreadySaved) {
        return res.json({ message: "Storybook already saved" });
      }

      await storage.saveStorybook(userId, id);
      res.json({ message: "Storybook saved to library" });
    } catch (error) {
      console.error("Save storybook error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Unsave a storybook from library (requires authentication)
  app.delete("/api/storybooks/:id/save", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id || req.user.claims?.sub;

      await storage.unsaveStorybook(userId, id);
      res.json({ message: "Storybook removed from library" });
    } catch (error) {
      console.error("Unsave storybook error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user's saved storybooks (requires authentication)
  app.get("/api/storybooks/saved", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      const savedStorybooks = await storage.getSavedStorybooks(userId);
      res.json(savedStorybooks);
    } catch (error) {
      console.error("Get saved storybooks error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get storybook by share URL
  app.get("/api/shared/:shareUrl", async (req, res) => {
    try {
      const { shareUrl } = req.params;
      const storybook = await storage.getStorybookByShareUrl(shareUrl);
      
      if (!storybook) {
        return res.status(404).json({ message: "Shared storybook not found" });
      }

      res.json(storybook);
    } catch (error) {
      console.error("Get shared storybook error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Generate share URL and track share event
  app.post("/api/storybooks/:id/share", async (req, res) => {
    try {
      const { id } = req.params;
      const { platform } = req.body; // Track which platform was used for sharing
      const storybook = await storage.getStorybook(id);
      
      if (!storybook) {
        return res.status(404).json({ message: "Storybook not found" });
      }

      // Generate share URL if it doesn't exist
      let shareUrl = storybook.shareUrl;
      if (!shareUrl) {
        shareUrl = randomUUID().replace(/-/g, '').substring(0, 12);
        await storage.updateStorybookShareUrl(id, shareUrl);
      }

      // Increment share count
      await storage.incrementShareCount(id);

      // Track share event with analytics
      await storage.trackEvent({
        userId: storybook.userId,
        storybookId: id,
        eventType: 'storybook_shared',
        eventData: {
          platform: platform || 'unknown',
          timestamp: new Date().toISOString(),
        },
      });

      res.json({ 
        shareUrl: `${req.protocol}://${req.get('host')}/shared/${shareUrl}`,
        shareCount: Number(storybook.shareCount) + 1
      });
    } catch (error) {
      console.error("Generate share URL error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Email verification for downloads (anonymous users)
  app.post("/api/storybooks/:id/request-download-code", async (req, res) => {
    try {
      const { id } = req.params;
      const { email } = req.body;

      if (!email || !validateEmail(email)) {
        return res.status(400).json({ message: "Valid email is required" });
      }

      const storybook = await storage.getStorybook(id);
      if (!storybook) {
        return res.status(404).json({ message: "Storybook not found" });
      }

      // Only allow email verification for anonymous storybooks
      if (storybook.userId) {
        return res.status(400).json({ 
          message: "This storybook requires authentication to download" 
        });
      }

      // Create verification code
      const { code, expiresAt } = await storage.createDownloadVerification(id, email);

      // TODO: Send email with verification code using Resend
      // For now, return code in response (remove in production)
      console.log(`Verification code for ${email}: ${code}`);
      
      res.json({ 
        message: "Verification code sent to your email",
        expiresIn: "15 minutes",
        // REMOVE IN PRODUCTION - for testing only
        code
      });
    } catch (error) {
      console.error("Request download code error:", error);
      res.status(500).json({ message: "Failed to send verification code" });
    }
  });

  app.post("/api/storybooks/:id/verify-download-code", async (req, res) => {
    try {
      const { id } = req.params;
      const { email, code } = req.body;

      if (!email || !code) {
        return res.status(400).json({ message: "Email and code are required" });
      }

      const isValid = await storage.verifyDownloadCode(id, email, code);
      
      if (!isValid) {
        return res.status(400).json({ 
          message: "Invalid or expired verification code" 
        });
      }

      res.json({ 
        message: "Email verified successfully",
        verified: true
      });
    } catch (error) {
      console.error("Verify download code error:", error);
      res.status(500).json({ message: "Failed to verify code" });
    }
  });

  // Download storybook as EPUB (requires email verification for anonymous stories)
  app.get("/api/storybooks/:id/epub", async (req, res) => {
    try {
      const { id } = req.params;
      const { email } = req.query;
      const storybook = await storage.getStorybook(id);
      
      if (!storybook) {
        return res.status(404).json({ message: "Storybook not found" });
      }

      // Check email verification for anonymous stories
      if (!storybook.userId && email) {
        const isVerified = await storage.isDownloadVerified(id, email as string);
        if (!isVerified) {
          return res.status(403).json({ 
            message: "Email verification required. Please verify your email first." 
          });
        }
      } else if (!storybook.userId && !email) {
        return res.status(400).json({ 
          message: "Email verification required for anonymous storybooks" 
        });
      }

      const { generateEpub } = await import("./services/epub");
      const epubBuffer = await generateEpub(storybook);
      
      // Set headers for file download
      const filename = `${storybook.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.epub`;
      res.setHeader('Content-Type', 'application/epub+zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', epubBuffer.length);
      
      res.send(epubBuffer);
    } catch (error) {
      console.error("EPUB generation error:", error);
      res.status(500).json({ message: "Failed to generate EPUB" });
    }
  });

  // Download print-ready PDF
  app.get('/api/storybooks/:id/download-print-pdf', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id || req.user.claims?.sub;
      const storybook = await storage.getStorybook(id);

      if (!storybook) {
        return res.status(404).json({ message: 'Storybook not found' });
      }

      // Check if user owns the storybook or has purchased any version (digital or print)
      const ownedByUser = storybook.userId === userId;
      const printPurchase = await storage.getStorybookPurchase(userId, id, 'print');
      const digitalPurchase = await storage.getStorybookPurchase(userId, id, 'digital');
      
      if (!ownedByUser && !printPurchase && !digitalPurchase) {
        return res.status(403).json({ message: 'You do not have access to download this print PDF' });
      }

      const { generatePrintReadyPDF } = await import('./services/printPdf');
      
      // Priority: query params > print purchase settings > defaults
      const bookSize = (req.query.bookSize as string) || printPurchase?.bookSize || 'a5-portrait';
      const spineText = (req.query.spineText as string) || printPurchase?.spineText || undefined;
      const spineTextColor = (req.query.spineTextColor as string) || printPurchase?.spineTextColor || undefined;
      const spineBackgroundColor = (req.query.spineBackgroundColor as string) || printPurchase?.spineBackgroundColor || undefined;
      
      const pdfBuffer = await generatePrintReadyPDF(storybook, bookSize, spineText, spineTextColor, spineBackgroundColor);

      const filename = `${storybook.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-print.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating print PDF:', error);
      res.status(500).json({ message: 'Failed to generate PDF' });
    }
  });

  // Rating Routes

  // Create or update a rating for a storybook (requires authentication)
  app.post("/api/storybooks/:id/rating", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id || req.user.claims?.sub;
      const { rating, feedback } = req.body;

      // Validate rating
      if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be a number between 1 and 5" });
      }

      // Check if storybook exists
      const storybook = await storage.getStorybook(id);
      if (!storybook) {
        return res.status(404).json({ message: "Storybook not found" });
      }

      // Create or update rating (upsert)
      const newRating = await storage.createRating({
        storybookId: id,
        userId,
        rating: rating.toString(),
        feedback: feedback || null,
      });

      // Track rating event with analytics
      await storage.trackEvent({
        userId,
        storybookId: id,
        eventType: 'rating_submitted',
        eventData: {
          rating,
          hasFeedback: !!feedback,
          timestamp: new Date().toISOString(),
        },
      });

      res.json(newRating);
    } catch (error) {
      console.error("Rating creation error:", error);
      res.status(500).json({ message: "Failed to create rating" });
    }
  });

  // Get user's rating for a storybook (requires authentication)
  app.get("/api/storybooks/:id/rating", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id || req.user.claims?.sub;

      const rating = await storage.getRating(id, userId);
      res.json(rating);
    } catch (error) {
      console.error("Get rating error:", error);
      res.status(500).json({ message: "Failed to get rating" });
    }
  });

  // Get all ratings for a storybook (public)
  app.get("/api/storybooks/:id/ratings", async (req, res) => {
    try {
      const { id } = req.params;

      const ratings = await storage.getStorybookRatings(id);
      res.json(ratings);
    } catch (error) {
      console.error("Get ratings error:", error);
      res.status(500).json({ message: "Failed to get ratings" });
    }
  });

  // Get average rating for a storybook (public)
  app.get("/api/storybooks/:id/average-rating", async (req, res) => {
    try {
      const { id } = req.params;

      const averageRating = await storage.getAverageRating(id);
      const ratings = await storage.getStorybookRatings(id);

      res.json({
        averageRating,
        count: ratings.length,
      });
    } catch (error) {
      console.error("Get average rating error:", error);
      res.status(500).json({ message: "Failed to get average rating" });
    }
  });

  // Social Features

  // Toggle public status of a storybook (requires authentication and ownership)
  app.post("/api/storybooks/:id/toggle-public", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id || req.user.claims?.sub;

      const newStatus = await storage.togglePublicStatus(id, userId);

      res.json({ isPublic: newStatus });
    } catch (error: any) {
      if (error.message === 'Unauthorized') {
        return res.status(403).json({ message: "You don't have permission to modify this storybook" });
      }
      console.error("Toggle public status error:", error);
      res.status(500).json({ message: "Failed to toggle public status" });
    }
  });

  // Regenerate a single page in a storybook (requires authentication and ownership)
  app.post("/api/storybooks/:id/regenerate-page", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { pageNumber } = req.body;
      const userId = req.user.id || req.user.claims?.sub;

      // Validate pageNumber
      if (!pageNumber || typeof pageNumber !== 'number') {
        return res.status(400).json({ message: "Valid page number is required" });
      }

      // Get the storybook
      const storybook = await storage.getStorybook(id);
      if (!storybook) {
        return res.status(404).json({ message: "Storybook not found" });
      }

      // Check ownership
      if (storybook.userId !== userId) {
        return res.status(403).json({ message: "You don't have permission to modify this storybook" });
      }

      // Validate that the page exists
      const pageExists = storybook.pages.some(p => p.pageNumber === pageNumber);
      if (!pageExists) {
        return res.status(400).json({ message: `Page ${pageNumber} does not exist in this storybook` });
      }

      // Generate new page content using Gemini
      const { regenerateSinglePage } = await import("./services/gemini");
      const newPageContent = await regenerateSinglePage({
        title: storybook.title,
        pages: storybook.pages,
        mainCharacterDescription: storybook.mainCharacterDescription || '',
        defaultClothing: storybook.defaultClothing || '',
        storyArc: storybook.storyArc || '',
      }, pageNumber);

      // Generate the image for the new page
      const { generateIllustration } = await import("./services/gemini");
      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorage = new ObjectStorageService();

      // Build the full image prompt using the centralized utility function
      const fullImagePrompt = buildFinalImagePrompt({
        mainCharacterDescription: storybook.mainCharacterDescription || undefined,
        defaultClothing: storybook.defaultClothing || undefined,
        scenePrompt: newPageContent.imagePrompt,
        artStyle: storybook.artStyle || undefined,
      });

      // Log the full prompt for debugging
      console.log(`[Page Regeneration] Page ${pageNumber} full prompt:`, fullImagePrompt);
      console.log(`[Page Regeneration] Art style:`, storybook.artStyle || 'default');

      // Generate image to temp location (generateIllustration already optimizes to JPG)
      const filename = `${randomUUID()}_page_${pageNumber}.jpg`;
      const tempImagePath = path.join("uploads", filename);
      
      // Download first inspiration image (user's photo) to use as reference for character consistency
      let inspirationImagePath: string | undefined;
      if (storybook.inspirationImages && storybook.inspirationImages.length > 0) {
        try {
          // Create a temp path for the inspiration image
          const inspirationFilename = `${randomUUID()}_inspiration_ref.jpg`;
          inspirationImagePath = path.join("uploads", inspirationFilename);
          
          // Download the first inspiration image from object storage
          const inspirationUrl = storybook.inspirationImages[0];
          const inspirationImageResponse = await fetch(`http://localhost:5000${inspirationUrl}`);
          if (inspirationImageResponse.ok) {
            const inspirationImageBuffer = await inspirationImageResponse.arrayBuffer();
            fs.writeFileSync(inspirationImagePath, Buffer.from(inspirationImageBuffer));
            console.log(`[Page Regeneration] Using uploaded photo as reference for consistency`);
          } else {
            console.warn(`[Page Regeneration] Could not download inspiration image: ${inspirationImageResponse.status}`);
            inspirationImagePath = undefined;
          }
        } catch (error) {
          console.warn(`[Page Regeneration] Error downloading inspiration image:`, error);
          inspirationImagePath = undefined;
        }
      }
      
      // Use art style from storybook if available
      const artStyle = storybook.artStyle || undefined;
      
      // Progressive visual reference chain: use inspiration image and cover image
      const regenerateReferences: string[] = [];
      if (inspirationImagePath) {
        regenerateReferences.push(inspirationImagePath);
      }
      
      // Also download the cover image to use as reference for consistency
      let coverImageRefPath: string | undefined;
      if (storybook.coverImageUrl) {
        try {
          const coverFilename = `${randomUUID()}_cover_ref.jpg`;
          coverImageRefPath = path.join("uploads", coverFilename);
          const coverImageResponse = await fetch(`http://localhost:5000${storybook.coverImageUrl}`);
          if (coverImageResponse.ok) {
            const coverImageBuffer = await coverImageResponse.arrayBuffer();
            fs.writeFileSync(coverImageRefPath, Buffer.from(coverImageBuffer));
            regenerateReferences.push(coverImageRefPath);
            console.log(`[Page Regeneration] Using cover image as reference for visual consistency`);
          } else {
            coverImageRefPath = undefined;
          }
        } catch (error) {
          console.warn(`[Page Regeneration] Error downloading cover image:`, error);
          coverImageRefPath = undefined;
        }
      }
      
      await generateIllustration(fullImagePrompt, tempImagePath, regenerateReferences.length > 0 ? regenerateReferences : undefined, artStyle);

      // Upload to object storage (uploadFile adds date-based path automatically)
      const imageUrl = await objectStorage.uploadFile(tempImagePath, filename, true, storybook.createdAt || new Date());

      // Clean up temp files
      try {
        fs.unlinkSync(tempImagePath);
        if (inspirationImagePath && fs.existsSync(inspirationImagePath)) {
          fs.unlinkSync(inspirationImagePath);
        }
        if (coverImageRefPath && fs.existsSync(coverImageRefPath)) {
          fs.unlinkSync(coverImageRefPath);
        }
      } catch (err) {
        console.warn("Failed to delete temp files:", err);
      }

      // Update the page in storage
      await storage.updatePage(id, pageNumber, {
        text: newPageContent.text,
        imageUrl,
        imagePrompt: newPageContent.imagePrompt,
      });

      // Track analytics
      await analytics.trackPageRegenerated(userId, id, pageNumber);

      // Get and return the updated storybook
      const updatedStorybook = await storage.getStorybook(id);
      res.json(updatedStorybook);
    } catch (error: any) {
      console.error("Regenerate page error:", error);
      res.status(500).json({ message: error.message || "Failed to regenerate page" });
    }
  });

  // Get public gallery of storybooks (public, paginated)
  app.get("/api/gallery", async (req: any, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = 20;
      const offset = (page - 1) * limit;

      // Check if user is authenticated (optional for gallery)
      const userId = req.user ? (req.user.id || req.user.claims?.sub) : null;

      const storybooks = await storage.getPublicStorybooks(limit, offset);
      const totalCount = await storage.getPublicStorybookCount();

      // Enrich with user info, rating data, and saved status
      const enrichedStorybooks = await Promise.all(
        storybooks.map(async (storybook) => {
          const user = storybook.userId ? await storage.getUser(storybook.userId) : null;
          const averageRating = await storage.getAverageRating(storybook.id);
          const ratings = await storage.getStorybookRatings(storybook.id);
          
          // Check if this storybook is saved by the current user (if authenticated)
          const isSaved = userId ? await storage.isSaved(userId, storybook.id) : false;

          return {
            ...storybook,
            author: user?.firstName || 'Unknown',
            averageRating,
            ratingCount: ratings.length,
            isSaved,
          };
        })
      );

      res.json({
        storybooks: enrichedStorybooks,
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
      });
    } catch (error) {
      console.error("Get gallery error:", error);
      res.status(500).json({ message: "Failed to get gallery" });
    }
  });

  // Get shareable preview image for a storybook (public)
  app.get("/api/storybooks/:id/preview", async (req, res) => {
    try {
      const { id } = req.params;
      const storybook = await storage.getStorybook(id);

      if (!storybook) {
        return res.status(404).json({ message: "Storybook not found" });
      }

      // Return the cover image URL for social preview
      // In a more advanced implementation, this could generate a custom social preview image
      if (storybook.coverImageUrl) {
        // Redirect to the actual cover image
        return res.redirect(storybook.coverImageUrl);
      }

      res.status(404).json({ message: "No preview image available" });
    } catch (error) {
      console.error("Get preview error:", error);
      res.status(500).json({ message: "Failed to get preview" });
    }
  });

  // Track view event for public storybooks
  app.post("/api/storybooks/:id/view", async (req, res) => {
    try {
      const { id } = req.params;
      const storybook = await storage.getStorybook(id);

      if (!storybook) {
        return res.status(404).json({ message: "Storybook not found" });
      }

      // Only track views for public storybooks
      if (storybook.isPublic) {
        await storage.incrementViewCount(id);

        // Track view event with analytics
        await storage.trackEvent({
          userId: storybook.userId,
          storybookId: id,
          eventType: 'storybook_viewed',
          eventData: {
            timestamp: new Date().toISOString(),
          },
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Track view error:", error);
      res.status(500).json({ message: "Failed to track view" });
    }
  });

  // Serve images from Object Storage
  app.get("/api/storage/*", async (req, res) => {
    try {
      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorage = new ObjectStorageService();
      
      // Extract path after /api/storage/
      const filePath = req.path.replace('/api/storage/', '');
      
      if (!filePath) {
        return res.status(400).json({ message: "No file path provided" });
      }
      
      const file = await objectStorage.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ message: "Image not found" });
      }
      
      await objectStorage.downloadObject(file, res);
    } catch (error) {
      console.error("Object storage error:", error);
      res.status(500).json({ message: "Failed to retrieve image" });
    }
  });

  // Legacy: Serve generated images from filesystem (for backward compatibility)
  app.use("/api/images", express.static(path.join(process.cwd(), "generated")));

  // Check if user owns a book (requires authentication)
  app.post("/api/purchases/check", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      const { storybookId, type } = req.body;

      if (!storybookId || !type) {
        return res.status(400).json({ message: "storybookId and type are required" });
      }

      const purchase = await storage.getStorybookPurchase(userId, storybookId, type);
      res.json({ owned: !!purchase });
    } catch (error) {
      console.error("Check purchase error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create purchase from payment intent (requires authentication)
  app.post("/api/purchases/create", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      const { paymentIntentId } = req.body;

      if (!paymentIntentId) {
        return res.status(400).json({ message: "paymentIntentId is required" });
      }

      // Fetch Payment Intent from Stripe to get metadata
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (!paymentIntent) {
        return res.status(404).json({ message: "Payment Intent not found" });
      }

      // Verify payment is successful
      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({ message: "Payment has not succeeded" });
      }

      const { userId: metadataUserId, items: itemsJson } = paymentIntent.metadata || {};

      if (!metadataUserId || !itemsJson) {
        return res.status(400).json({ message: "Missing metadata in payment intent" });
      }

      // Verify userId matches
      if (metadataUserId !== userId) {
        return res.status(403).json({ message: "Unauthorized - user mismatch" });
      }

      const items = JSON.parse(itemsJson);
      const createdPurchases = [];

      // Create purchase records with idempotency
      for (const item of items) {
        const { storybookId, type, price, bookSize, spineText, spineTextColor, spineBackgroundColor } = item;

        try {
          const purchaseData: any = {
            userId,
            storybookId,
            type,
            price: price.toString(),
            stripePaymentIntentId: paymentIntent.id,
            status: 'completed',
          };
          
          // Include book customization for print purchases
          if (type === 'print') {
            purchaseData.bookSize = bookSize || 'a5-portrait';
            purchaseData.spineText = spineText || '';
            purchaseData.spineTextColor = spineTextColor || '#000000';
            purchaseData.spineBackgroundColor = spineBackgroundColor || '#FFFFFF';
          }
          
          const purchase = await storage.createPurchase(purchaseData);
          createdPurchases.push(purchase);
        } catch (error: any) {
          // Handle duplicate purchase (unique constraint violation)
          if (error.message?.includes('unique') || error.code === '23505') {
            console.log(`Purchase already exists for payment intent ${paymentIntent.id}, storybookId ${storybookId}`);
            // Fetch existing purchase
            const existingPurchase = await storage.getStorybookPurchase(userId, storybookId, type);
            if (existingPurchase) {
              createdPurchases.push(existingPurchase);
            }
          } else {
            throw error;
          }
        }
      }

      // Auto-create digital purchases for print purchases
      const printPurchases = createdPurchases.filter(p => p.type === 'print');

      for (const printPurchase of printPurchases) {
        // Check if digital already exists
        const existingDigital = await storage.getStorybookPurchase(userId, printPurchase.storybookId, 'digital');
        
        if (!existingDigital) {
          try {
            const digitalPurchase = await storage.createPurchase({
              userId,
              storybookId: printPurchase.storybookId,
              type: 'digital',
              price: '0', // Free with print
              stripePaymentIntentId: paymentIntent.id,
              status: 'completed',
            });
            createdPurchases.push(digitalPurchase);
            console.log(`Auto-created free digital version for print purchase of ${printPurchase.storybookId}`);
          } catch (error: any) {
            // Ignore duplicates
            if (!(error.message?.includes('unique') || error.code === '23505')) {
              throw error;
            }
          }
        }
      }

      // Detect language from Accept-Language header
      const language = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'en';

      // Send invoice email for all purchases
      try {
        const user = await storage.getUser(userId);
        
        if (user && user.email) {
          const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Customer';
          const { sendInvoiceEmail } = await import("./services/resend-email");
          await sendInvoiceEmail(user.email, userName, createdPurchases, paymentIntent.id, language);
          
          console.log(`Invoice email sent for payment intent ${paymentIntent.id} to ${user.email}`);
        }
      } catch (invoiceError) {
        console.error(`Failed to send invoice email for payment intent ${paymentIntent.id}:`, invoiceError);
      }

      res.json({ purchases: createdPurchases });
    } catch (error) {
      console.error("Create purchase error:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: `Failed to create purchase: ${errorMessage}` });
    }
  });

  // Create Stripe checkout session (requires authentication)
  app.post("/api/checkout", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      const { items } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "Items array is required" });
      }

      // Fetch pricing from admin settings with fallback defaults
      const digitalPriceSetting = await storage.getSetting('digital_price');
      const printPriceSetting = await storage.getSetting('print_price');
      const digitalPrice = digitalPriceSetting ? parseInt(digitalPriceSetting.value) : 399;
      const printPrice = printPriceSetting ? parseInt(printPriceSetting.value) : 2499;

      const lineItems = [];
      const processedItems = [];
      
      for (const item of items) {
        const { storybookId, type } = item;
        
        // Validate type
        if (type !== 'digital' && type !== 'print') {
          return res.status(400).json({ message: `Invalid type: ${type}. Must be 'digital' or 'print'` });
        }
        
        const storybook = await storage.getStorybook(storybookId);
        if (!storybook) {
          return res.status(404).json({ message: `Storybook ${storybookId} not found` });
        }

        // SECURITY: Calculate price server-side, ignore client-provided price
        let serverPrice = type === 'digital' ? digitalPrice : printPrice;
        let discount = 0;
        let originalPrice = serverPrice;

        // Apply digital-to-print discount: if buying print and already owns digital, reduce price
        // Only apply discount for first-time print purchases, not repurchases
        if (type === 'print') {
          const existingDigitalPurchase = await storage.getStorybookPurchase(userId, storybookId, 'digital');
          const existingPrintPurchase = await storage.getStorybookPurchase(userId, storybookId, 'print');
          if (existingDigitalPurchase && !existingPrintPurchase) {
            discount = digitalPrice;
            serverPrice = Math.max(0, printPrice - digitalPrice); // Ensure price doesn't go negative
          }
        }

        lineItems.push({
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${storybook.title} - ${type === 'digital' ? 'Digital' : 'Print'} Edition`,
              description: type === 'digital' 
                ? 'Downloadable EPUB format' 
                : 'Professionally printed and bound storybook',
            },
            unit_amount: serverPrice,
          },
          quantity: 1,
        });

        // Store items with server-calculated prices for metadata
        processedItems.push({
          storybookId: item.storybookId,
          type: item.type,
          price: serverPrice,
          originalPrice,
          discount,
        });
      }

      const protocol = req.get('x-forwarded-proto') || req.protocol;
      const host = req.get('host');
      const baseUrl = `${protocol}://${host}`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: `${baseUrl}/purchases?success=true`,
        cancel_url: `${baseUrl}/cart?cancelled=true`,
        metadata: {
          userId,
          items: JSON.stringify(processedItems),
        },
      });

      res.json({ sessionId: session.id, url: session.url });
    } catch (error) {
      console.error("Checkout error:", error);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  // Create Payment Intent for embedded Stripe checkout (requires authentication)
  app.post("/api/create-payment-intent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      const { items } = req.body;

      // Validate items
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "Items array is required" });
      }

      // Fetch pricing from admin settings with fallback defaults
      const digitalPriceSetting = await storage.getSetting('digital_price');
      const printPriceSetting = await storage.getSetting('print_price');
      const digitalPrice = digitalPriceSetting ? parseInt(digitalPriceSetting.value) : 399;
      const printPrice = printPriceSetting ? parseInt(printPriceSetting.value) : 2499;

      let total = 0;
      const processedItems = [];

      for (const item of items) {
        const { storybookId, type, bookSize, spineText, spineTextColor, spineBackgroundColor } = item;
        
        // Validate type
        if (type !== 'digital' && type !== 'print') {
          return res.status(400).json({ message: `Invalid type: ${type}. Must be 'digital' or 'print'` });
        }

        // Verify storybook exists
        const storybook = await storage.getStorybook(storybookId);
        if (!storybook) {
          return res.status(404).json({ message: `Storybook ${storybookId} not found` });
        }

        // SECURITY: Calculate price server-side from admin settings
        let serverPrice = type === 'digital' ? digitalPrice : printPrice;
        let discount = 0;
        let originalPrice = serverPrice;

        // Apply digital-to-print discount: if buying print and already owns digital, reduce price
        // Only apply discount for first-time print purchases, not repurchases
        if (type === 'print') {
          const existingDigitalPurchase = await storage.getStorybookPurchase(userId, storybookId, 'digital');
          const existingPrintPurchase = await storage.getStorybookPurchase(userId, storybookId, 'print');
          if (existingDigitalPurchase && !existingPrintPurchase) {
            discount = digitalPrice;
            serverPrice = Math.max(0, printPrice - digitalPrice); // Ensure price doesn't go negative
          }
        }

        total += serverPrice;

        const processedItem: any = {
          storybookId,
          type,
          price: serverPrice,
          originalPrice,
          discount,
        };
        
        // Include book customization for print purchases
        if (type === 'print') {
          processedItem.bookSize = bookSize || 'a5-portrait';
          processedItem.spineText = spineText || '';
          processedItem.spineTextColor = spineTextColor || '#000000';
          processedItem.spineBackgroundColor = spineBackgroundColor || '#FFFFFF';
        }
        
        processedItems.push(processedItem);
      }

      // Create Stripe Payment Intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: total,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          userId,
          items: JSON.stringify(processedItems),
        },
      });

      res.json({ 
        clientSecret: paymentIntent.client_secret, 
        amount: total 
      });
    } catch (error) {
      console.error("Create payment intent error:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: `Failed to create payment intent: ${errorMessage}` });
    }
  });

  // Calculate cart pricing with discounts (requires authentication)
  app.post("/api/cart/calculate-pricing", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      const { items } = req.body;

      if (!items || !Array.isArray(items)) {
        return res.status(400).json({ message: "Items array is required" });
      }

      // Fetch pricing from admin settings with fallback defaults
      const digitalPriceSetting = await storage.getSetting('digital_price');
      const printPriceSetting = await storage.getSetting('print_price');
      const digitalPrice = digitalPriceSetting ? parseInt(digitalPriceSetting.value) : 399;
      const printPrice = printPriceSetting ? parseInt(printPriceSetting.value) : 2499;

      const pricedItems = [];

      for (const item of items) {
        const { storybookId, type } = item;
        
        // Calculate price with potential discount
        let price = type === 'digital' ? digitalPrice : printPrice;
        let discount = 0;
        let originalPrice = price;

        // Apply digital-to-print discount
        // Only apply discount for first-time print purchases, not repurchases
        if (type === 'print') {
          const existingDigitalPurchase = await storage.getStorybookPurchase(userId, storybookId, 'digital');
          const existingPrintPurchase = await storage.getStorybookPurchase(userId, storybookId, 'print');
          if (existingDigitalPurchase && !existingPrintPurchase) {
            discount = digitalPrice;
            price = Math.max(0, printPrice - digitalPrice);
          }
        }

        // Preserve all original item fields and override pricing
        pricedItems.push({
          ...item,
          price,
          originalPrice,
          discount,
        });
      }

      res.json({ items: pricedItems });
    } catch (error) {
      console.error("Calculate cart pricing error:", error);
      res.status(500).json({ message: "Failed to calculate pricing" });
    }
  });

  // Stripe webhook handler (no authentication required, uses signature verification)
  app.post("/api/webhook/stripe", async (req: any, res) => {
    const sig = req.headers['stripe-signature'];

    if (!sig) {
      return res.status(400).json({ message: "Missing stripe-signature header" });
    }

    try {
      const event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET || ''
      );

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        
        const { userId, items: itemsJson } = session.metadata || {};
        
        if (!userId || !itemsJson) {
          console.error("Missing metadata in session:", session.id);
          return res.status(400).json({ message: "Missing metadata" });
        }

        const items = JSON.parse(itemsJson);
        const createdPurchases = [];
        
        // Create purchase records with duplicate handling
        for (const item of items) {
          const { storybookId, type, price, bookSize, spineText, spineTextColor, spineBackgroundColor } = item;
          
          try {
            const purchaseData: any = {
              userId,
              storybookId,
              type,
              price: price.toString(),
              stripePaymentIntentId: session.payment_intent as string,
              status: 'completed',
            };
            
            // Include book customization for print purchases
            if (type === 'print') {
              purchaseData.bookSize = bookSize || 'a5-portrait';
              purchaseData.spineText = spineText || '';
              purchaseData.spineTextColor = spineTextColor || '#000000';
              purchaseData.spineBackgroundColor = spineBackgroundColor || '#FFFFFF';
            }
            
            const purchase = await storage.createPurchase(purchaseData);
            createdPurchases.push(purchase);
            console.log(`Webhook created purchase for payment intent ${session.payment_intent}, storybookId ${storybookId}`);
          } catch (error: any) {
            // Handle duplicate purchase (unique constraint violation)
            if (error.message?.includes('unique') || error.code === '23505') {
              console.log(`Purchase already exists for payment intent ${session.payment_intent}, storybookId ${storybookId} - skipping (created by client)`);
            } else {
              // Re-throw other errors
              throw error;
            }
          }
        }

        // Auto-create digital purchases for print purchases
        const printPurchases = createdPurchases.filter(p => p.type === 'print');

        for (const printPurchase of printPurchases) {
          // Check if digital already exists
          const existingDigital = await storage.getStorybookPurchase(userId, printPurchase.storybookId, 'digital');
          
          if (!existingDigital) {
            try {
              await storage.createPurchase({
                userId,
                storybookId: printPurchase.storybookId,
                type: 'digital',
                price: '0', // Free with print
                stripePaymentIntentId: session.payment_intent as string,
                status: 'completed',
              });
              console.log(`Auto-created free digital version for print purchase of ${printPurchase.storybookId}`);
            } catch (error: any) {
              // Ignore duplicates
              if (!(error.message?.includes('unique') || error.code === '23505')) {
                throw error;
              }
            }
          }
        }

        // Default to English for webhooks (no user context available)
        const language = 'en';

        // Send invoice email for all purchases
        try {
          const user = await storage.getUser(userId);
          
          if (user && user.email && createdPurchases.length > 0) {
            const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Customer';
            const { sendInvoiceEmail } = await import("./services/resend-email");
            await sendInvoiceEmail(user.email, userName, createdPurchases, session.payment_intent as string, language);
            
            console.log(`Invoice email sent for payment intent ${session.payment_intent} to ${user.email}`);
          }
        } catch (invoiceError) {
          console.error(`Failed to send invoice email for payment intent ${session.payment_intent}:`, invoiceError);
        }
      } else if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        const { userId, items: itemsJson } = paymentIntent.metadata || {};
        
        if (!userId || !itemsJson) {
          console.error("Missing metadata in payment intent:", paymentIntent.id);
          return res.status(400).json({ message: "Missing metadata" });
        }

        const items = JSON.parse(itemsJson);
        const createdPurchases = [];
        
        // Create purchase records with duplicate handling
        for (const item of items) {
          const { storybookId, type, price, bookSize, spineText, spineTextColor, spineBackgroundColor } = item;
          
          try {
            const purchaseData: any = {
              userId,
              storybookId,
              type,
              price: price.toString(),
              stripePaymentIntentId: paymentIntent.id,
              status: 'completed',
            };
            
            // Include book customization for print purchases
            if (type === 'print') {
              purchaseData.bookSize = bookSize || 'a5-portrait';
              purchaseData.spineText = spineText || '';
              purchaseData.spineTextColor = spineTextColor || '#000000';
              purchaseData.spineBackgroundColor = spineBackgroundColor || '#FFFFFF';
            }
            
            const purchase = await storage.createPurchase(purchaseData);
            createdPurchases.push(purchase);
            console.log(`Webhook created purchase for payment intent ${paymentIntent.id}, storybookId ${storybookId}`);
          } catch (error: any) {
            // Handle duplicate purchase (unique constraint violation)
            if (error.message?.includes('unique') || error.code === '23505') {
              console.log(`Purchase already exists for payment intent ${paymentIntent.id}, storybookId ${storybookId} - skipping (created by client)`);
            } else {
              // Re-throw other errors
              throw error;
            }
          }
        }

        // Auto-create digital purchases for print purchases
        const printPurchases = createdPurchases.filter(p => p.type === 'print');

        for (const printPurchase of printPurchases) {
          // Check if digital already exists
          const existingDigital = await storage.getStorybookPurchase(userId, printPurchase.storybookId, 'digital');
          
          if (!existingDigital) {
            try {
              await storage.createPurchase({
                userId,
                storybookId: printPurchase.storybookId,
                type: 'digital',
                price: '0', // Free with print
                stripePaymentIntentId: paymentIntent.id,
                status: 'completed',
              });
              console.log(`Auto-created free digital version for print purchase of ${printPurchase.storybookId}`);
            } catch (error: any) {
              // Ignore duplicates
              if (!(error.message?.includes('unique') || error.code === '23505')) {
                throw error;
              }
            }
          }
        }

        // Default to English for webhooks (no user context available)
        const language = 'en';

        // Send invoice email for all purchases
        try {
          const user = await storage.getUser(userId);
          
          if (user && user.email && createdPurchases.length > 0) {
            const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Customer';
            const { sendInvoiceEmail } = await import("./services/resend-email");
            await sendInvoiceEmail(user.email, userName, createdPurchases, paymentIntent.id, language);
            
            console.log(`Invoice email sent for payment intent ${paymentIntent.id} to ${user.email}`);
          }
        } catch (invoiceError) {
          console.error(`Failed to send invoice email for payment intent ${paymentIntent.id}:`, invoiceError);
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Webhook error:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ message: `Webhook Error: ${errorMessage}` });
    }
  });

  // Get user's purchases (requires authentication)
  app.get("/api/purchases", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      const purchases = await storage.getUserPurchases(userId);
      res.json(purchases);
    } catch (error) {
      console.error("Get purchases error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Prodigi Print API Routes

  // Validation schemas for Prodigi endpoints
  const quoteRequestSchema = z.object({
    bookSize: z.string().regex(/^(a5-portrait|a5-landscape|a4-portrait|a4-landscape|square-8|square-11)$/),
    destinationCountryCode: z.string().length(2).regex(/^[A-Z]{2}$/),
    shippingMethod: z.enum(['Budget', 'Standard', 'Express', 'Overnight']).optional(),
  });

  const recipientAddressSchema = z.object({
    line1: z.string().min(1).max(200),
    line2: z.string().max(200).optional(),
    postalOrZipCode: z.string().min(1).max(20),
    countryCode: z.string().length(2).regex(/^[A-Z]{2}$/),
    townOrCity: z.string().min(1).max(100),
    stateOrCounty: z.string().max(100).optional(),
  });

  const recipientDetailsSchema = z.object({
    name: z.string().min(1).max(200),
    email: z.string().email().optional(),
    phoneNumber: z.string().max(20).optional(),
    address: recipientAddressSchema,
  });

  const submitOrderRequestSchema = z.object({
    purchaseId: z.string().uuid(),
    recipientDetails: recipientDetailsSchema,
    shippingMethod: z.enum(['Budget', 'Standard', 'Express', 'Overnight']).optional(),
  });

  // Get quote for print order (requires authentication)
  app.post("/api/prodigi/quote", isAuthenticated, async (req: any, res) => {
    try {
      // Validate request body
      const validationResult = quoteRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request data", 
          errors: validationResult.error.errors 
        });
      }

      const { bookSize, destinationCountryCode, shippingMethod } = validationResult.data;

      const { prodigiService } = await import("./services/prodigi");
      
      // Get SKU based on book size (assuming 24 pages for photobooks)
      const sku = prodigiService.getProductSKU(bookSize, 24);

      const quoteRequest = {
        shippingMethod: shippingMethod || 'Standard',
        destinationCountryCode,
        items: [
          {
            sku,
            copies: 1,
          },
        ],
      };

      const quote = await prodigiService.getQuote(quoteRequest);
      res.json(quote);
    } catch (error) {
      console.error("Get quote error:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: `Failed to get quote: ${errorMessage}` });
    }
  });

  // Submit print order to Prodigi (requires authentication and completed purchase)
  app.post("/api/prodigi/submit-order", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      
      // Validate request body
      const validationResult = submitOrderRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request data", 
          errors: validationResult.error.errors 
        });
      }

      const { purchaseId, recipientDetails, shippingMethod } = validationResult.data;

      // Verify purchase exists and belongs to user
      const purchase = await storage.getUserPurchases(userId);
      const matchingPurchase = purchase.find(p => p.id === purchaseId);

      if (!matchingPurchase) {
        return res.status(404).json({ message: "Purchase not found" });
      }

      if (matchingPurchase.type !== 'print') {
        return res.status(400).json({ message: "Purchase is not a print order" });
      }

      if (matchingPurchase.status !== 'completed') {
        return res.status(400).json({ message: "Purchase payment not completed" });
      }

      // Check if print order already exists
      const existingPrintOrder = await storage.getPrintOrderByPurchaseId(purchaseId);
      if (existingPrintOrder) {
        return res.status(400).json({ message: "Print order already submitted", printOrder: existingPrintOrder });
      }

      // Get storybook details
      const storybook = await storage.getStorybook(matchingPurchase.storybookId);
      if (!storybook) {
        return res.status(404).json({ message: "Storybook not found" });
      }

      const { prodigiService } = await import("./services/prodigi");
      const { generatePrintReadyPDF } = await import("./services/printPdf");
      const { ObjectStorageService } = await import("./objectStorage");
      const { writeFileSync, unlinkSync } = await import("fs");
      const { join } = await import("path");
      const { tmpdir } = await import("os");

      // Generate print-ready PDF
      const pdfBuffer = await generatePrintReadyPDF(
        storybook, 
        matchingPurchase.bookSize || 'a5-portrait',
        matchingPurchase.spineText,
        matchingPurchase.spineTextColor,
        matchingPurchase.spineBackgroundColor
      );

      // Save PDF to temporary file
      const tempPdfPath = join(tmpdir(), `${storybook.id}-print.pdf`);
      writeFileSync(tempPdfPath, pdfBuffer);

      // Upload to object storage and get public URL
      const objectStorage = new ObjectStorageService();
      const storagePath = `print-pdfs/${storybook.id}.pdf`;
      const pdfUrl = await objectStorage.uploadFile(tempPdfPath, storagePath, false);
      
      // Clean up temp file
      unlinkSync(tempPdfPath);

      // Get SKU and create order
      const sku = prodigiService.getProductSKU(matchingPurchase.bookSize || 'a5-portrait', storybook.pages.length);

      const orderRequest = {
        merchantReference: `SB-${storybook.id}-${purchaseId}`,
        shippingMethod: shippingMethod || 'Standard',
        recipient: recipientDetails,
        items: [
          {
            sku,
            copies: 1,
            sizing: 'fillPrintArea',
            assets: [
              {
                printArea: 'default',
                url: pdfUrl,
              },
            ],
          },
        ],
        metadata: {
          storybookId: storybook.id,
          purchaseId,
          userId,
        },
      };

      const prodigiOrder = await prodigiService.createOrder(orderRequest);

      // Create print order record
      const printOrder = await storage.createPrintOrder({
        purchaseId,
        prodigiOrderId: prodigiOrder.id,
        status: prodigiOrder.status.stage,
        webhookData: prodigiOrder,
      });

      res.json({ printOrder, prodigiOrder });
    } catch (error) {
      console.error("Submit order error:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: `Failed to submit order: ${errorMessage}` });
    }
  });

  // Get print order status (requires authentication)
  app.get("/api/prodigi/order/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id || req.user.claims?.sub;
      const { id } = req.params;

      const printOrder = await storage.getPrintOrder(id);
      if (!printOrder) {
        return res.status(404).json({ message: "Print order not found" });
      }

      // Verify ownership through purchase
      const purchase = await storage.getUserPurchases(userId);
      const matchingPurchase = purchase.find(p => p.id === printOrder.purchaseId);

      if (!matchingPurchase) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Get latest status from Prodigi
      if (printOrder.prodigiOrderId) {
        const { prodigiService } = await import("./services/prodigi");
        const prodigiOrder = await prodigiService.getOrder(printOrder.prodigiOrderId);

        // Update local record
        await storage.updatePrintOrder(printOrder.id, {
          status: prodigiOrder.status.stage,
          webhookData: prodigiOrder,
          trackingNumber: prodigiOrder.shipments?.[0]?.tracking?.number,
          carrier: prodigiOrder.shipments?.[0]?.carrier?.name,
          estimatedDelivery: prodigiOrder.shipments?.[0]?.estimatedDeliveryDate 
            ? new Date(prodigiOrder.shipments[0].estimatedDeliveryDate) 
            : undefined,
        });

        res.json({ printOrder, prodigiOrder });
      } else {
        res.json({ printOrder });
      }
    } catch (error) {
      console.error("Get order status error:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: `Failed to get order status: ${errorMessage}` });
    }
  });

  // Webhook for Prodigi order updates (CloudEvents v1.0 format)
  app.post("/api/webhook/prodigi", async (req: any, res) => {
    try {
      // Verify webhook authenticity using shared secret or API key
      // Prodigi sends the X-API-Key header in webhook requests
      const apiKey = req.headers['x-api-key'];
      const expectedApiKey = process.env.PRODIGI_SANDBOX_API_KEY;

      if (!apiKey || apiKey !== expectedApiKey) {
        console.warn('Prodigi webhook authentication failed - invalid or missing API key');
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Validate CloudEvents v1.0 structure
      const cloudEventSchema = z.object({
        specversion: z.string(),
        type: z.string(),
        source: z.string(),
        id: z.string(),
        time: z.string(),
        datacontenttype: z.string(),
        data: z.object({
          order: z.object({
            id: z.string(),
            status: z.object({
              stage: z.string(),
              issues: z.array(z.any()).optional(),
              details: z.record(z.string()).optional(),
            }),
            shipments: z.array(z.object({
              carrier: z.object({
                name: z.string().optional(),
                service: z.string().optional(),
              }).optional(),
              tracking: z.object({
                number: z.string().optional(),
                url: z.string().optional(),
              }).optional(),
              dispatchDate: z.string().optional(),
              estimatedDeliveryDate: z.string().optional(),
            })).optional(),
            charges: z.array(z.any()).optional(),
          }),
        }),
      });

      const validationResult = cloudEventSchema.safeParse(req.body);
      if (!validationResult.success) {
        console.error('Invalid CloudEvents payload:', validationResult.error.errors);
        return res.status(400).json({ 
          message: "Invalid webhook payload", 
          errors: validationResult.error.errors 
        });
      }

      const { data } = validationResult.data;
      const order = data.order;

      const printOrder = await storage.getPrintOrderByProdigiId(order.id);
      if (!printOrder) {
        console.warn(`Received webhook for unknown Prodigi order: ${order.id}`);
        return res.json({ received: true });
      }

      // Extract tracking information from shipments
      const firstShipment = order.shipments?.[0];
      const trackingNumber = firstShipment?.tracking?.number;
      const carrier = firstShipment?.carrier?.name;
      const estimatedDelivery = firstShipment?.estimatedDeliveryDate 
        ? new Date(firstShipment.estimatedDeliveryDate) 
        : undefined;

      // Update print order with webhook data
      await storage.updatePrintOrder(printOrder.id, {
        status: order.status.stage,
        webhookData: req.body,
        trackingNumber,
        carrier,
        estimatedDelivery,
      });

      console.log(`[Prodigi Webhook] Updated order ${printOrder.id} - Stage: ${order.status.stage}${trackingNumber ? `, Tracking: ${trackingNumber}` : ''}`);
      res.json({ received: true });
    } catch (error) {
      console.error("Prodigi webhook error:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ message: `Webhook Error: ${errorMessage}` });
    }
  });

  // Audio Settings Routes

  // Get audio settings for a specific storybook (requires authentication and ownership)
  app.get("/api/storybooks/:id/audio-settings", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id || req.user.claims?.sub;

      // Verify storybook ownership
      const storybook = await storage.getStorybook(id);
      if (!storybook) {
        return res.status(404).json({ message: 'Storybook not found' });
      }

      if (storybook.userId !== userId) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      const settings = await storage.getAudioSettings(id);
      res.json(settings);
    } catch (error) {
      console.error("Get audio settings error:", error);
      res.status(500).json({ message: "Failed to get audio settings" });
    }
  });

  // Update audio settings for a specific storybook (requires authentication and ownership)
  app.put("/api/storybooks/:id/audio-settings", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id || req.user.claims?.sub;
      const { musicEnabled, soundEffectsEnabled, musicVolume, effectsVolume } = req.body;

      // Verify storybook ownership
      const storybook = await storage.getStorybook(id);
      if (!storybook) {
        return res.status(404).json({ message: 'Storybook not found' });
      }

      if (storybook.userId !== userId) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      const updatedSettings = await storage.updateAudioSettings(id, {
        musicEnabled,
        soundEffectsEnabled,
        musicVolume,
        effectsVolume,
      });

      res.json(updatedSettings);
    } catch (error) {
      console.error("Update audio settings error:", error);
      res.status(500).json({ message: "Failed to update audio settings" });
    }
  });

  // Analyze mood for existing storybook pages (requires authentication and ownership)
  app.post("/api/storybooks/:id/analyze-mood", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id || req.user.claims?.sub;

      // Get storybook and verify ownership
      const storybook = await storage.getStorybook(id);
      if (!storybook) {
        return res.status(404).json({ message: 'Storybook not found' });
      }

      if (storybook.userId !== userId) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      // Import mood detection function
      const { detectPageMood } = await import("./services/gemini");

      // Analyze mood for each page
      const updatedPages = await Promise.all(
        storybook.pages.map(async (page) => ({
          ...page,
          mood: await detectPageMood(page.text),
        }))
      );

      // Update the storybook with moods
      const { db } = await import('./db');
      const { storybooks } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      
      await db
        .update(storybooks)
        .set({ pages: updatedPages as any })
        .where(eq(storybooks.id, id));

      res.json({ message: 'Mood analysis completed', pages: updatedPages });
    } catch (error) {
      console.error("Analyze mood error:", error);
      res.status(500).json({ message: "Failed to analyze mood" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

async function generateStorybookAsync(
  sessionId: string,
  userId: string,
  prompt: string,
  author: string,
  age: string | undefined,
  imagePaths: string[],
  pagesPerBook: number = 3,
  illustrationStyle: string = "vibrant and colorful children's book illustration"
): Promise<void> {
  try {
    // Step 1: Processing images
    await storage.setGenerationProgress(sessionId, {
      step: 'processing_images',
      progress: 10,
      message: 'Processing inspiration images...',
    });

    // Step 2: Generate story
    await storage.setGenerationProgress(sessionId, {
      step: 'generating_story',
      progress: 30,
      message: `Generating ${pagesPerBook}-page story outline...`,
    });

    const generatedStory = await generateStoryFromPrompt(prompt, imagePaths, pagesPerBook, illustrationStyle, age, author);

    // Step 3: Generate illustrations
    await storage.setGenerationProgress(sessionId, {
      step: 'generating_illustrations',
      progress: 50,
      message: 'Creating beautiful illustrations...',
    });

    const generatedDir = path.join(process.cwd(), "generated");
    if (!fs.existsSync(generatedDir)) {
      fs.mkdirSync(generatedDir, { recursive: true });
    }

    // Initialize Object Storage service
    const { ObjectStorageService } = await import("./objectStorage");
    const objectStorage = new ObjectStorageService();

    // Upload inspiration images to Object Storage and save URLs for later use
    const inspirationImageUrls: string[] = [];
    for (let i = 0; i < imagePaths.length; i++) {
      const imagePath = imagePaths[i];
      const inspirationFileName = `${sessionId}_inspiration_${i}.jpg`;
      const inspirationUrl = await objectStorage.uploadFile(imagePath, inspirationFileName);
      inspirationImageUrls.push(inspirationUrl);
    }

    // Generate cover image
    const coverImageFileName = `${sessionId}_cover.jpg`;
    const coverImagePath = path.join(generatedDir, coverImageFileName);
    
    // Build the cover image prompt using the centralized utility function
    const coverPromptWithCharacter = buildFinalImagePrompt({
      mainCharacterDescription: generatedStory.mainCharacterDescription,
      defaultClothing: generatedStory.defaultClothing,
      scenePrompt: generatedStory.coverImagePrompt,
      artStyle: illustrationStyle,
    });
    
    // For cover image: use all uploaded inspiration images as references
    const coverReferences = imagePaths.length > 0 ? imagePaths : undefined;
    await generateIllustration(coverPromptWithCharacter, coverImagePath, coverReferences, illustrationStyle);
    
    // Upload cover image to Object Storage
    const coverImageUrl = await objectStorage.uploadFile(coverImagePath, coverImageFileName);
    
    // Detect orientation from cover image dimensions
    const metadata = await sharp(coverImagePath).metadata();
    const width = metadata.width || 1;
    const height = metadata.height || 1;
    const aspectRatio = width / height;
    
    let orientation: 'portrait' | 'landscape' | 'square';
    if (Math.abs(aspectRatio - 1) < 0.1) {
      orientation = 'square'; // Within 10% of 1:1
    } else if (aspectRatio > 1) {
      orientation = 'landscape';
    } else {
      orientation = 'portrait';
    }
    
    console.log(`📐 Detected book orientation: ${orientation} (${width}x${height}, AR: ${aspectRatio.toFixed(2)})`);
    
    // KEEP cover image locally to use as reference for character consistency in all page illustrations
    // It will be cleaned up after all pages are generated

    const pages = [];
    for (let i = 0; i < generatedStory.pages.length; i++) {
      const page = generatedStory.pages[i];
      const imageFileName = `${sessionId}_page_${page.pageNumber}.jpg`;
      const imagePath = path.join(generatedDir, imageFileName);

      // Build the page image prompt using the centralized utility function
      // The utility handles clothing logic automatically (skips default clothing if scene specifies different clothing)
      const pagePromptWithCharacter = buildFinalImagePrompt({
        mainCharacterDescription: generatedStory.mainCharacterDescription,
        defaultClothing: generatedStory.defaultClothing,
        scenePrompt: page.imagePrompt,
        artStyle: illustrationStyle,
      });
      
      // Progressive visual reference chain: use BOTH uploaded inspiration images AND cover image
      // This ensures each page sees both the original photo(s) and the established visual from the cover
      const pageReferences = [...imagePaths];
      if (fs.existsSync(coverImagePath)) {
        pageReferences.push(coverImagePath);
      }
      await generateIllustration(pagePromptWithCharacter, imagePath, pageReferences.length > 0 ? pageReferences : undefined, illustrationStyle);

      // Upload to Object Storage
      const imageUrl = await objectStorage.uploadFile(imagePath, imageFileName);
      
      // Clean up local image
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }

      pages.push({
        pageNumber: page.pageNumber,
        text: page.text,
        imageUrl,
        imagePrompt: page.imagePrompt,
      });

      // Update progress
      const progressPercent = 50 + (i + 1) * (40 / generatedStory.pages.length);
      await storage.setGenerationProgress(sessionId, {
        step: 'generating_illustrations',
        progress: progressPercent,
        message: `Generated illustration ${i + 1} of ${generatedStory.pages.length}`,
      });
    }

    // Step 4: Generate back cover
    await storage.setGenerationProgress(sessionId, {
      step: 'finalizing',
      progress: 92,
      message: 'Creating back cover illustration...',
    });

    // Generate back cover image
    const backCoverImageFileName = `${sessionId}_back_cover.jpg`;
    const backCoverImagePath = path.join(generatedDir, backCoverImageFileName);
    
    // Create back cover prompt that complements the front cover
    const backCoverBasePrompt = `Create a back cover illustration that complements the front cover. Show the character in a different scene that hints at the adventure without spoiling it.`;
    
    // Build the back cover image prompt using the centralized utility function
    const backCoverPromptWithCharacter = buildFinalImagePrompt({
      mainCharacterDescription: generatedStory.mainCharacterDescription,
      defaultClothing: generatedStory.defaultClothing,
      scenePrompt: backCoverBasePrompt,
      artStyle: illustrationStyle,
    });
    
    // Progressive visual reference chain: use BOTH uploaded inspiration images AND cover image for back cover
    const backCoverReferences = [...imagePaths];
    if (fs.existsSync(coverImagePath)) {
      backCoverReferences.push(coverImagePath);
    }
    await generateIllustration(backCoverPromptWithCharacter, backCoverImagePath, backCoverReferences.length > 0 ? backCoverReferences : undefined, illustrationStyle);
    
    // Upload back cover to Object Storage
    const backCoverImageUrl = await objectStorage.uploadFile(backCoverImagePath, backCoverImageFileName);
    
    // Clean up local back cover image
    if (fs.existsSync(backCoverImagePath)) {
      fs.unlinkSync(backCoverImagePath);
    }

    // Step 5: Finalize
    await storage.setGenerationProgress(sessionId, {
      step: 'finalizing',
      progress: 95,
      message: 'Finalizing your storybook...',
    });

    // Save to storage with userId, including cover image URL, back cover URL, author, age, and story metadata
    const storybook = await storage.createStorybook({
      userId,
      title: generatedStory.title,
      author,
      age,
      prompt,
      pages,
      inspirationImages: inspirationImageUrls,
      coverImageUrl,
      backCoverImageUrl,
      mainCharacterDescription: generatedStory.mainCharacterDescription,
      defaultClothing: generatedStory.defaultClothing,
      storyArc: generatedStory.storyArc,
      artStyle: illustrationStyle,
      orientation,
    });

    // Track story completion (non-blocking)
    analytics.trackStoryCompleted(userId, storybook.id, pages.length).catch(err => {
      console.error('Failed to track story_completed event:', err);
    });

    // Complete - Store the storybook ID in progress for retrieval
    await storage.setGenerationProgress(sessionId, {
      step: 'finalizing',
      progress: 100,
      message: storybook.id, // Frontend expects the storybook ID here
    });

    // Clean up cover image now that all pages are generated
    if (fs.existsSync(coverImagePath)) {
      fs.unlinkSync(coverImagePath);
    }

    // Clean up uploaded inspiration images
    imagePaths.forEach(imagePath => {
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await storage.setGenerationProgress(sessionId, {
      step: 'processing_images',
      progress: 0,
      message: `Generation failed: ${errorMessage}`,
      error: errorMessage,
    });
    throw error;
  }
}
