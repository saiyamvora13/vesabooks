import type { Express, Request } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateStoryFromPrompt, generateIllustration } from "./services/gemini";
import { createStorybookSchema, type StoryGenerationProgress } from "@shared/schema";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import multer from "multer";
import { setupAuth, isAuthenticated } from "./replitAuth";

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
      // Use req.user.id which is set from the database user (not OIDC sub)
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Create storybook (requires authentication)
  app.post("/api/storybooks", isAuthenticated, upload.array("images", 5), async (req: any, res) => {
    try {
      const { prompt } = req.body;
      const files = req.files as Express.Multer.File[] | undefined;
      const userId = req.user.id;

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
      const userId = req.user.id;
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
