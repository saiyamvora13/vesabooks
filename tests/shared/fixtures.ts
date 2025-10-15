import type { User, Storybook, Purchase } from '@shared/schema';

// Test user fixtures
export const testUsers = {
  validUser: {
    id: 'test-user-1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    authProvider: 'email',
    password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYmP.VC.JIe', // "password123"
    emailVerified: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  } as User,
  
  anotherUser: {
    id: 'test-user-2',
    email: 'another@example.com',
    firstName: 'Another',
    lastName: 'User',
    authProvider: 'email',
    password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYmP.VC.JIe', // "password123"
    emailVerified: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  } as User,

  unverifiedUser: {
    id: 'test-user-3',
    email: 'unverified@example.com',
    firstName: 'Unverified',
    lastName: 'User',
    authProvider: 'email',
    password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYmP.VC.JIe',
    emailVerified: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  } as User,
};

// Test storybook fixtures
export const testStorybooks = {
  simpleStory: {
    id: 'story-1',
    userId: 'test-user-1',
    title: 'The Magic Garden',
    author: 'Test Author',
    prompt: 'A story about a child discovering a magical garden',
    pages: [
      {
        pageNumber: 1,
        text: 'Once upon a time, there was a magical garden.',
        imageUrl: '/test/page1.png',
        imagePrompt: 'A child discovering a magical garden',
      },
      {
        pageNumber: 2,
        text: 'The garden was full of wonder.',
        imageUrl: '/test/page2.png',
        imagePrompt: 'Magical flowers and creatures',
      },
    ],
    inspirationImages: [],
    coverImageUrl: '/test/cover.png',
    backCoverImageUrl: null,
    mainCharacterDescription: 'A curious 8-year-old with brown hair and green eyes',
    defaultClothing: 'Blue t-shirt and jeans',
    storyArc: 'Discovery and wonder',
    createdAt: new Date('2024-01-01'),
    shareUrl: 'magic-garden-abc123',
    deletedAt: null,
  } as Storybook,

  longStory: {
    id: 'story-2',
    userId: 'test-user-1',
    title: 'The Great Adventure',
    author: 'Test Author',
    prompt: 'An epic adventure story with multiple chapters',
    pages: Array.from({ length: 10 }, (_, i) => ({
      pageNumber: i + 1,
      text: `Page ${i + 1} text`,
      imageUrl: `/test/page${i + 1}.png`,
      imagePrompt: `Scene ${i + 1}`,
    })),
    inspirationImages: [],
    coverImageUrl: '/test/cover2.png',
    backCoverImageUrl: null,
    mainCharacterDescription: 'A brave young hero',
    defaultClothing: 'Adventure gear',
    storyArc: 'Hero\'s journey',
    createdAt: new Date('2024-01-02'),
    shareUrl: null,
    deletedAt: null,
  } as Storybook,
};

// Test purchase fixtures
export const testPurchases = {
  digitalPurchase: {
    id: 'purchase-1',
    userId: 'test-user-1',
    storybookId: 'story-1',
    type: 'digital',
    price: '3.99',
    stripePaymentIntentId: 'pi_test_123',
    status: 'completed',
    createdAt: new Date('2024-01-03'),
  } as Purchase,

  printPurchase: {
    id: 'purchase-2',
    userId: 'test-user-1',
    storybookId: 'story-1',
    type: 'print',
    price: '24.99',
    stripePaymentIntentId: 'pi_test_456',
    status: 'completed',
    createdAt: new Date('2024-01-04'),
  } as Purchase,

  pendingPurchase: {
    id: 'purchase-3',
    userId: 'test-user-2',
    storybookId: 'story-2',
    type: 'digital',
    price: '3.99',
    stripePaymentIntentId: 'pi_test_789',
    status: 'pending',
    createdAt: new Date('2024-01-05'),
  } as Purchase,
};

// Test credentials
export const testCredentials = {
  valid: {
    email: 'test@example.com',
    password: 'password123',
  },
  invalid: {
    email: 'wrong@example.com',
    password: 'wrongpassword',
  },
  newUser: {
    email: 'newuser@example.com',
    password: 'securePassword123',
    firstName: 'New',
    lastName: 'User',
  },
};

// Story generation test data
export const testGenerationData = {
  simplePrompt: 'A story about a brave little mouse who saves the day',
  detailedPrompt: 'Create a story about Luna, a 7-year-old girl with curly red hair who discovers she can talk to animals',
  
  mockGeneratedStory: {
    title: 'Luna and the Animal Friends',
    author: 'AI Storybook',
    coverImagePrompt: 'A young girl with red curly hair surrounded by woodland animals',
    mainCharacterDescription: '7-year-old girl with curly red hair, bright green eyes, freckles across her nose',
    defaultClothing: 'Yellow sundress with white sneakers',
    storyArc: 'Discovery of magical ability, using it to help others, learning responsibility',
    pages: [
      {
        pageNumber: 1,
        text: 'Luna discovered something amazing in the forest.',
        imagePrompt: 'Girl in yellow dress in a magical forest clearing',
      },
      {
        pageNumber: 2,
        text: 'She could understand what the animals were saying!',
        imagePrompt: 'Girl talking with a wise old owl and friendly rabbits',
      },
      {
        pageNumber: 3,
        text: 'Together they helped save the forest.',
        imagePrompt: 'Girl and animals working together to clean up the forest',
      },
    ],
  },
};

// Stripe test data
export const testStripeData = {
  paymentIntent: {
    id: 'pi_test_123456',
    object: 'payment_intent',
    amount: 399,
    currency: 'usd',
    status: 'succeeded',
    client_secret: 'pi_test_secret_123',
  },
  
  customer: {
    id: 'cus_test_123',
    email: 'test@example.com',
  },
};
