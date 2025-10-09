import type { Express, Request } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateStoryFromPrompt, generateIllustration } from "./services/gemini";
import { createStorybookSchema, type StoryGenerationProgress, type Purchase, type InsertPurchase } from "@shared/schema";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import multer from "multer";
import { setupAuth, isAuthenticated } from "./replitAuth";
import Stripe from "stripe";
import { z } from "zod";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: "2025-09-30.clover",
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

  // Replit Auth: Get authenticated user
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      // Use req.user.id if available (from auth changes), fallback to claims.sub for compatibility
      const userId = req.user.id || req.user.claims?.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Get metrics (public - no auth required)
  app.get('/api/metrics', async (req, res) => {
    try {
      const metrics = await storage.getMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching metrics:", error);
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

  // Create storybook (requires authentication)
  app.post("/api/storybooks", isAuthenticated, upload.array("images", 5), async (req: any, res) => {
    try {
      const { prompt } = req.body;
      const files = req.files as Express.Multer.File[] | undefined;
      // Use req.user.id if available (from auth changes), fallback to claims.sub for compatibility
      const userId = req.user.id || req.user.claims?.sub;

      // Images are now optional - handle empty or undefined files
      const imagePaths = files ? files.map(f => f.path) : [];
      const imageFilenames = files ? files.map(f => f.filename) : [];

      // Validate request
      const validationResult = createStorybookSchema.safeParse({
        prompt,
        inspirationImages: imageFilenames,
      });

      if (!validationResult.success) {
        return res.status(400).json({ message: validationResult.error.message });
      }

      const sessionId = randomUUID();

      // Start generation in background with userId
      generateStorybookAsync(sessionId, userId, prompt, imagePaths)
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

      res.json({ sessionId });
    } catch (error) {
      console.error("Create storybook error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

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
        // URL format: "/api/storage/filename.png"
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

  // Generate share URL
  app.post("/api/storybooks/:id/share", async (req, res) => {
    try {
      const { id } = req.params;
      const storybook = await storage.getStorybook(id);
      
      if (!storybook) {
        return res.status(404).json({ message: "Storybook not found" });
      }

      const shareUrl = randomUUID().replace(/-/g, '').substring(0, 12);
      await storage.updateStorybookShareUrl(id, shareUrl);

      res.json({ shareUrl: `${req.protocol}://${req.get('host')}/shared/${shareUrl}` });
    } catch (error) {
      console.error("Generate share URL error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Download storybook as EPUB
  app.get("/api/storybooks/:id/epub", async (req, res) => {
    try {
      const { id } = req.params;
      const storybook = await storage.getStorybook(id);
      
      if (!storybook) {
        return res.status(404).json({ message: "Storybook not found" });
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

  // Serve images from Object Storage
  app.get("/api/storage/:filename", async (req, res) => {
    try {
      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorage = new ObjectStorageService();
      
      const file = await objectStorage.searchPublicObject(req.params.filename);
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
        const { storybookId, type, price } = item;

        try {
          const purchase = await storage.createPurchase({
            userId,
            storybookId,
            type,
            price: price.toString(),
            stripePaymentIntentId: paymentIntent.id,
            status: 'completed',
          });
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

      // Handle print orders - send PDFs via email
      const printOrders = items.filter((item: any) => item.type === 'print');

      if (printOrders.length > 0) {
        const user = await storage.getUser(userId);

        if (user && user.email) {
          for (const printOrder of printOrders) {
            try {
              const storybook = await storage.getStorybook(printOrder.storybookId);

              if (storybook) {
                const { generateStorybookPDF } = await import("./services/pdf");
                const pdfBuffer = await generateStorybookPDF(storybook);

                const { sendPrintOrderEmail } = await import("./services/resend-email");
                await sendPrintOrderEmail(user.email, storybook, pdfBuffer);

                console.log(`Print order email sent for storybook ${storybook.id} to ${user.email}`);
              }
            } catch (emailError) {
              console.error(`Failed to send print order email for storybook ${printOrder.storybookId}:`, emailError);
            }
          }
        }
      }

      // Send invoice email for all purchases
      try {
        const user = await storage.getUser(userId);
        
        if (user && user.email) {
          const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Customer';
          const { sendInvoiceEmail } = await import("./services/resend-email");
          await sendInvoiceEmail(user.email, userName, createdPurchases, paymentIntent.id);
          
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
        const serverPrice = PRICES[type as 'digital' | 'print'];

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

      let total = 0;
      const processedItems = [];

      for (const item of items) {
        const { storybookId, type } = item;
        
        // Validate type
        if (type !== 'digital' && type !== 'print') {
          return res.status(400).json({ message: `Invalid type: ${type}. Must be 'digital' or 'print'` });
        }

        // Verify storybook exists
        const storybook = await storage.getStorybook(storybookId);
        if (!storybook) {
          return res.status(404).json({ message: `Storybook ${storybookId} not found` });
        }

        // SECURITY: Calculate price server-side using PRICES constants
        const serverPrice = PRICES[type as 'digital' | 'print'];
        total += serverPrice;

        processedItems.push({
          storybookId,
          type,
          price: serverPrice,
        });
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
          const { storybookId, type, price } = item;
          
          try {
            const purchase = await storage.createPurchase({
              userId,
              storybookId,
              type,
              price: price.toString(),
              stripePaymentIntentId: session.payment_intent as string,
              status: 'completed',
            });
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

        // Handle print orders - send PDFs via email
        const printOrders = items.filter((item: any) => item.type === 'print');
        
        if (printOrders.length > 0) {
          // Get user email
          const user = await storage.getUser(userId);
          
          if (user && user.email) {
            // Process each print order
            for (const printOrder of printOrders) {
              try {
                // Get storybook details
                const storybook = await storage.getStorybook(printOrder.storybookId);
                
                if (storybook) {
                  // Generate PDF
                  const { generateStorybookPDF } = await import("./services/pdf");
                  const pdfBuffer = await generateStorybookPDF(storybook);
                  
                  // Send email with PDF attachment
                  const { sendPrintOrderEmail } = await import("./services/resend-email");
                  await sendPrintOrderEmail(user.email, storybook, pdfBuffer);
                  
                  console.log(`Print order email sent for storybook ${storybook.id} to ${user.email}`);
                }
              } catch (emailError) {
                // Log error but don't fail the webhook
                console.error(`Failed to send print order email for storybook ${printOrder.storybookId}:`, emailError);
              }
            }
          }
        }

        // Send invoice email for all purchases
        try {
          const user = await storage.getUser(userId);
          
          if (user && user.email && createdPurchases.length > 0) {
            const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Customer';
            const { sendInvoiceEmail } = await import("./services/resend-email");
            await sendInvoiceEmail(user.email, userName, createdPurchases, session.payment_intent as string);
            
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
          const { storybookId, type, price } = item;
          
          try {
            const purchase = await storage.createPurchase({
              userId,
              storybookId,
              type,
              price: price.toString(),
              stripePaymentIntentId: paymentIntent.id,
              status: 'completed',
            });
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

        // Handle print orders - send PDFs via email
        const printOrders = items.filter((item: any) => item.type === 'print');
        
        if (printOrders.length > 0) {
          // Get user email
          const user = await storage.getUser(userId);
          
          if (user && user.email) {
            // Process each print order
            for (const printOrder of printOrders) {
              try {
                // Get storybook details
                const storybook = await storage.getStorybook(printOrder.storybookId);
                
                if (storybook) {
                  // Generate PDF
                  const { generateStorybookPDF } = await import("./services/pdf");
                  const pdfBuffer = await generateStorybookPDF(storybook);
                  
                  // Send email with PDF attachment
                  const { sendPrintOrderEmail } = await import("./services/resend-email");
                  await sendPrintOrderEmail(user.email, storybook, pdfBuffer);
                  
                  console.log(`Print order email sent for storybook ${storybook.id} to ${user.email}`);
                }
              } catch (emailError) {
                // Log error but don't fail the webhook
                console.error(`Failed to send print order email for storybook ${printOrder.storybookId}:`, emailError);
              }
            }
          }
        }

        // Send invoice email for all purchases
        try {
          const user = await storage.getUser(userId);
          
          if (user && user.email && createdPurchases.length > 0) {
            const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Customer';
            const { sendInvoiceEmail } = await import("./services/resend-email");
            await sendInvoiceEmail(user.email, userName, createdPurchases, paymentIntent.id);
            
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

  const httpServer = createServer(app);
  return httpServer;
}

async function generateStorybookAsync(
  sessionId: string,
  userId: string,
  prompt: string,
  imagePaths: string[]
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
      message: 'Generating story outline...',
    });

    const generatedStory = await generateStoryFromPrompt(prompt, imagePaths);

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

    // Use the first inspiration image as the base for all generated images (if available)
    const baseImagePath = imagePaths.length > 0 ? imagePaths[0] : undefined;
    
    // Generate cover image
    const coverImageFileName = `${sessionId}_cover.png`;
    const coverImagePath = path.join(generatedDir, coverImageFileName);
    await generateIllustration(generatedStory.coverImagePrompt, coverImagePath, baseImagePath);
    
    // Upload cover image to Object Storage
    const coverImageUrl = await objectStorage.uploadFile(coverImagePath, coverImageFileName);
    
    // Clean up local cover image
    if (fs.existsSync(coverImagePath)) {
      fs.unlinkSync(coverImagePath);
    }

    const pages = [];
    for (let i = 0; i < generatedStory.pages.length; i++) {
      const page = generatedStory.pages[i];
      const imageFileName = `${sessionId}_page_${page.pageNumber}.png`;
      const imagePath = path.join(generatedDir, imageFileName);

      // Generate illustration for this page using the base image (if available)
      await generateIllustration(page.imagePrompt, imagePath, baseImagePath);

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
      });

      // Update progress
      const progressPercent = 50 + (i + 1) * (40 / generatedStory.pages.length);
      await storage.setGenerationProgress(sessionId, {
        step: 'generating_illustrations',
        progress: progressPercent,
        message: `Generated illustration ${i + 1} of ${generatedStory.pages.length}`,
      });
    }

    // Step 4: Finalize
    await storage.setGenerationProgress(sessionId, {
      step: 'finalizing',
      progress: 95,
      message: 'Finalizing your storybook...',
    });

    // Save to storage with userId, including cover image URL
    const storybook = await storage.createStorybook({
      userId,
      title: generatedStory.title,
      prompt,
      pages,
      inspirationImages: [],
      coverImageUrl,
    });

    // Complete
    await storage.setGenerationProgress(sessionId, {
      step: 'finalizing',
      progress: 100,
      message: `Complete! Your storybook "${generatedStory.title}" is ready.`,
    });

    // Store the storybook ID in progress for retrieval
    await storage.setGenerationProgress(sessionId, {
      step: 'finalizing',
      progress: 100,
      message: storybook.id, // Store ID in message for retrieval
    });

    // Clean up uploaded files
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
