import express, { type Express } from 'express';
import { vi } from 'vitest';
import { registerRoutes } from '@server/routes';

// Note: We're not mocking storage module - tests will use the real storage
// To avoid conflicts, tests should use unique identifiers (timestamps, UUIDs, etc.)

// Mock external services before importing routes
vi.mock('@server/services/gemini', () => ({
  generateStoryFromPrompt: vi.fn(async (prompt: string, inspirationImages: string[], pagesPerBook: number) => ({
    title: 'Test Story Title',
    author: 'AI Storybook',
    coverImagePrompt: 'A beautiful story cover with the main character',
    mainCharacterDescription: 'A brave young adventurer with bright eyes and a curious smile',
    defaultClothing: 'Red jacket and blue jeans',
    storyArc: 'Discovery, challenge, and growth',
    artStyle: 'custom',
    pages: Array.from({ length: pagesPerBook }, (_, i) => ({
      pageNumber: i + 1,
      text: `This is page ${i + 1} of the story.`,
      imagePrompt: `Scene showing the character in situation ${i + 1}`,
    })),
  })),
  generateIllustration: vi.fn(async (prompt: string) => {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  }),
  optimizeImageForWeb: vi.fn(async (imageBuffer: Buffer) => imageBuffer),
}));

vi.mock('stripe', () => {
  const mockStripe = {
    paymentIntents: {
      create: vi.fn(async (params: any) => ({
        id: `pi_test_${Date.now()}`,
        object: 'payment_intent',
        amount: params.amount,
        currency: params.currency || 'usd',
        status: 'requires_payment_method',
        client_secret: `pi_test_secret_${Date.now()}`,
        metadata: params.metadata || {},
      })),
      retrieve: vi.fn(async (id: string) => ({
        id,
        object: 'payment_intent',
        amount: 399,
        currency: 'usd',
        status: 'succeeded',
        client_secret: `${id}_secret`,
      })),
      update: vi.fn(async (id: string, params: any) => ({
        id,
        object: 'payment_intent',
        amount: params.amount || 399,
        currency: 'usd',
        status: params.status || 'succeeded',
        metadata: params.metadata || {},
      })),
    },
    checkout: {
      sessions: {
        create: vi.fn(async (params: any) => ({
          id: `cs_test_${Date.now()}`,
          url: 'https://checkout.stripe.com/test',
          payment_status: 'unpaid',
          metadata: params.metadata || {},
        })),
      },
    },
    customers: {
      create: vi.fn(async (params: any) => ({
        id: `cus_test_${Date.now()}`,
        email: params.email,
        metadata: params.metadata || {},
      })),
    },
    webhooks: {
      constructEvent: vi.fn((payload: any, signature: string, secret: string) => ({
        id: `evt_test_${Date.now()}`,
        type: 'payment_intent.succeeded',
        data: { object: payload },
      })),
    },
  };
  
  return {
    default: vi.fn(() => mockStripe),
  };
});

vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: vi.fn(async (params: any) => ({
        id: `email_${Date.now()}`,
        from: params.from,
        to: params.to,
        subject: params.subject,
      })),
    },
  })),
}));

// Mock Replit Auth to avoid OIDC setup in tests
vi.mock('@server/replitAuth', () => ({
  setupAuth: vi.fn(async (app: Express) => {
    // Minimal session setup for testing
    const session = (await import('express-session')).default;
    const MemoryStore = (await import('memorystore')).default(session);
    
    app.use(session({
      secret: 'test-secret',
      store: new MemoryStore({
        checkPeriod: 86400000
      }),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: false, // Allow testing without HTTPS
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }));
    
    const passport = (await import('passport')).default;
    
    // Setup passport serialization for tests
    passport.serializeUser((user: any, done) => {
      done(null, user.id);
    });
    
    passport.deserializeUser(async (id: string, done) => {
      try {
        const { storage } = await import('@server/storage');
        const user = await storage.getUser(id);
        done(null, user);
      } catch (error) {
        done(error, null);
      }
    });
    
    app.use(passport.initialize());
    app.use(passport.session());
  }),
  isAuthenticated: (req: any, res: any, next: any) => {
    // Mock middleware that checks for test user
    if (req.user) {
      return next();
    }
    return res.status(401).json({ message: 'Unauthorized' });
  },
}));

// Create test app instance
export async function createTestApp(): Promise<Express> {
  const app = express();
  
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  
  // Register all routes with mocked services
  await registerRoutes(app);
  
  return app;
}
