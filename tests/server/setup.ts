import { beforeAll, afterAll, afterEach, vi } from 'vitest';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret';

// Mock external API keys
if (!process.env.GEMINI_API_KEY) {
  process.env.GEMINI_API_KEY = 'test-gemini-key';
}
if (!process.env.STRIPE_SECRET_KEY) {
  process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
}
if (!process.env.RESEND_API_KEY) {
  process.env.RESEND_API_KEY = 'test-resend-key';
}

// Mock rate limiters to avoid delays in tests
vi.mock('express-rate-limit', () => ({
  default: () => (req: any, res: any, next: any) => next(),
}));

// Global test setup
beforeAll(async () => {
  // Additional setup if needed
});

// Cleanup after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Global teardown
afterAll(async () => {
  // Clean up any test resources
});
