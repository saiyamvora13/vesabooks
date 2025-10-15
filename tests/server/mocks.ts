import { vi } from 'vitest';
import type { GeneratedStory } from '@server/services/gemini';

// Mock Gemini AI service
export const mockGemini = {
  generateStoryFromPrompt: vi.fn(async (
    prompt: string,
    inspirationImages: string[],
    pagesPerBook: number = 3
  ): Promise<GeneratedStory> => {
    return {
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
    };
  }),

  generateIllustration: vi.fn(async (prompt: string): Promise<string> => {
    // Return a mock base64 image data
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  }),

  optimizeImageForWeb: vi.fn(async (imageBuffer: Buffer): Promise<Buffer> => {
    // Return the same buffer for testing
    return imageBuffer;
  }),
};

// Mock Stripe service
export const mockStripe = {
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

  customers: {
    create: vi.fn(async (params: any) => ({
      id: `cus_test_${Date.now()}`,
      email: params.email,
      metadata: params.metadata || {},
    })),
  },

  webhooks: {
    constructEvent: vi.fn((payload: any, signature: string, secret: string) => {
      return {
        id: `evt_test_${Date.now()}`,
        type: 'payment_intent.succeeded',
        data: {
          object: payload,
        },
      };
    }),
  },
};

// Mock Resend email service
export const mockResend = {
  emails: {
    send: vi.fn(async (params: any) => ({
      id: `email_${Date.now()}`,
      from: params.from,
      to: params.to,
      subject: params.subject,
    })),
  },
};

// Setup mocks for modules
export function setupMocks() {
  // Mock Gemini service
  vi.mock('@server/services/gemini', () => ({
    generateStoryFromPrompt: mockGemini.generateStoryFromPrompt,
    generateIllustration: mockGemini.generateIllustration,
    optimizeImageForWeb: mockGemini.optimizeImageForWeb,
  }));

  // Mock Stripe
  vi.mock('stripe', () => ({
    default: vi.fn(() => mockStripe),
  }));

  // Mock Resend
  vi.mock('resend', () => ({
    Resend: vi.fn(() => mockResend),
  }));
}
