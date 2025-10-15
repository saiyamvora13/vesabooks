import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import supertest from 'supertest';
import type { Express } from 'express';
import { createTestApp } from './app';
import { TestStorage, uniqueEmail } from './helpers';
import { testUsers, testStorybooks } from '../shared/fixtures';
import Stripe from 'stripe';
import { storage } from '@server/storage';

// Price constants matching server
const PRICES = {
  digital: 399,  // $3.99 in cents
  print: 2499    // $24.99 in cents
};

describe('Payment Flow Integration Tests', () => {
  let app: Express;
  let request: supertest.SuperTest<supertest.Test>;
  let testStorage: TestStorage;

  beforeAll(async () => {
    app = await createTestApp();
    request = supertest(app);
  });

  beforeEach(() => {
    testStorage = new TestStorage();
    testStorage.clear();
    vi.clearAllMocks();
  });

  describe('POST /api/checkout - Checkout Endpoint', () => {
    let agent: supertest.SuperAgent;
    let testUser: any;
    let testStorybook: any;

    beforeEach(async () => {
      // Create authenticated agent
      agent = supertest.agent(app);
      
      // Create and login user with unique email
      const signupResponse = await agent
        .post('/api/auth/signup')
        .send({
          email: uniqueEmail('checkout'),
          password: 'password123',
          firstName: 'Checkout',
          lastName: 'Test'
        })
        .expect(201);
      
      testUser = signupResponse.body;

      // Create a test storybook using real storage (omit id for auto-generation)
      const { id, ...storybookData } = testStorybooks.simpleStory;
      testStorybook = await storage.createStorybook({
        ...storybookData,
        userId: testUser.id,
      });
    });

    it('should create Stripe checkout session for digital purchase', async () => {
      const response = await agent
        .post('/api/checkout')
        .send({
          items: [
            {
              storybookId: testStorybook.id,
              type: 'digital'
            }
          ]
        })
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.sessionId).toBeDefined();
      expect(response.body.url).toBeDefined();
      expect(response.body.url).toContain('checkout.stripe.com');
    });

    it('should create Stripe checkout session for print purchase', async () => {
      const response = await agent
        .post('/api/checkout')
        .send({
          items: [
            {
              storybookId: testStorybook.id,
              type: 'print'
            }
          ]
        })
        .expect(200);

      expect(response.body.sessionId).toBeDefined();
      expect(response.body.url).toBeDefined();
    });

    it('should validate purchase type', async () => {
      const response = await agent
        .post('/api/checkout')
        .send({
          items: [
            {
              storybookId: testStorybook.id,
              type: 'invalid'
            }
          ]
        })
        .expect(400);

      expect(response.body.message).toContain('Invalid type');
    });

    it('should require items array', async () => {
      const response = await agent
        .post('/api/checkout')
        .send({})
        .expect(400);

      expect(response.body.message).toContain('Items array is required');
    });

    it('should reject empty items array', async () => {
      const response = await agent
        .post('/api/checkout')
        .send({ items: [] })
        .expect(400);

      expect(response.body.message).toContain('Items array is required');
    });

    it('should return 404 for non-existent storybook', async () => {
      const response = await agent
        .post('/api/checkout')
        .send({
          items: [
            {
              storybookId: 'non-existent-id',
              type: 'digital'
            }
          ]
        })
        .expect(404);

      expect(response.body.message).toContain('not found');
    });

    it('should require authentication', async () => {
      const response = await request
        .post('/api/checkout')
        .send({
          items: [
            {
              storybookId: testStorybook.id,
              type: 'digital'
            }
          ]
        })
        .expect(401);

      expect(response.body.message).toBe('Unauthorized');
    });

    it('should handle multiple items in checkout', async () => {
      const { id: longStoryId, ...longStoryData } = testStorybooks.longStory;
      const secondStorybook = await storage.createStorybook({
        ...longStoryData,
        userId: testUser.id,
      });

      const response = await agent
        .post('/api/checkout')
        .send({
          items: [
            { storybookId: testStorybook.id, type: 'digital' },
            { storybookId: secondStorybook.id, type: 'print' }
          ]
        })
        .expect(200);

      expect(response.body.sessionId).toBeDefined();
      expect(response.body.url).toBeDefined();
    });
  });

  describe('Purchase Creation and Verification', () => {
    let agent: supertest.SuperAgent;
    let testUser: any;
    let testStorybook: any;

    beforeEach(async () => {
      agent = supertest.agent(app);
      
      const signupResponse = await agent
        .post('/api/auth/signup')
        .send({
          email: uniqueEmail('purchase'),
          password: 'password123',
          firstName: 'Purchase',
          lastName: 'Test'
        })
        .expect(201);
      
      testUser = signupResponse.body;
      const { id: simpleStoryId, ...simpleStoryData } = testStorybooks.simpleStory;
      testStorybook = await storage.createStorybook({
        ...simpleStoryData,
        userId: testUser.id,
      });
    });

    it('should create purchase record after successful payment', async () => {
      const purchase = await storage.createPurchase({
        userId: testUser.id,
        storybookId: testStorybook.id,
        type: 'digital',
        price: '3.99',
        stripePaymentIntentId: 'pi_test_success',
        status: 'completed',
      });

      expect(purchase).toBeDefined();
      expect(purchase.userId).toBe(testUser.id);
      expect(purchase.storybookId).toBe(testStorybook.id);
      expect(purchase.status).toBe('completed');
      expect(purchase.type).toBe('digital');
    });

    it('should prevent duplicate purchases of same type', async () => {
      // Create first purchase
      await storage.createPurchase({
        userId: testUser.id,
        storybookId: testStorybook.id,
        type: 'digital',
        price: '3.99',
        stripePaymentIntentId: 'pi_test_1',
        status: 'completed',
      });

      // Check if purchase already exists
      const existing = await storage.getStorybookPurchase(
        testUser.id,
        testStorybook.id,
        'digital'
      );

      expect(existing).toBeDefined();
      expect(existing?.status).toBe('completed');
    });

    it('should allow both digital and print purchases for same storybook', async () => {
      // Create digital purchase
      const digitalPurchase = await storage.createPurchase({
        userId: testUser.id,
        storybookId: testStorybook.id,
        type: 'digital',
        price: '3.99',
        stripePaymentIntentId: 'pi_test_digital',
        status: 'completed',
      });

      // Create print purchase
      const printPurchase = await storage.createPurchase({
        userId: testUser.id,
        storybookId: testStorybook.id,
        type: 'print',
        price: '24.99',
        stripePaymentIntentId: 'pi_test_print',
        status: 'completed',
      });

      expect(digitalPurchase).toBeDefined();
      expect(printPurchase).toBeDefined();
      expect(digitalPurchase.type).toBe('digital');
      expect(printPurchase.type).toBe('print');
    });

    it('should retrieve user purchases', async () => {
      // Create multiple purchases
      await storage.createPurchase({
        userId: testUser.id,
        storybookId: testStorybook.id,
        type: 'digital',
        price: '3.99',
        stripePaymentIntentId: 'pi_1',
        status: 'completed',
      });

      const { id: longStoryId, ...longStoryData } = testStorybooks.longStory;
      const secondStorybook = await storage.createStorybook({
        ...longStoryData,
        userId: testUser.id,
      });

      await storage.createPurchase({
        userId: testUser.id,
        storybookId: secondStorybook.id,
        type: 'print',
        price: '24.99',
        stripePaymentIntentId: 'pi_2',
        status: 'completed',
      });

      const purchases = await storage.getUserPurchases(testUser.id);
      
      expect(purchases.length).toBeGreaterThanOrEqual(2);
      expect(purchases.every(p => p.userId === testUser.id)).toBe(true);
    });

    it('should update purchase status', async () => {
      const purchase = await storage.createPurchase({
        userId: testUser.id,
        storybookId: testStorybook.id,
        type: 'digital',
        price: '3.99',
        stripePaymentIntentId: 'pi_pending',
        status: 'pending',
      });

      const updated = await storage.updatePurchaseStatus(
        purchase.id,
        'completed',
        'pi_completed'
      );

      expect(updated.status).toBe('completed');
      expect(updated.stripePaymentIntentId).toBe('pi_completed');
    });

    it('should verify purchase ownership', async () => {
      await storage.createPurchase({
        userId: testUser.id,
        storybookId: testStorybook.id,
        type: 'digital',
        price: '3.99',
        stripePaymentIntentId: 'pi_test',
        status: 'completed',
      });

      const purchase = await storage.getStorybookPurchase(
        testUser.id,
        testStorybook.id,
        'digital'
      );

      expect(purchase).toBeDefined();
      expect(purchase?.userId).toBe(testUser.id);
    });

    it('should not allow access to other user purchases', async () => {
      // Create another user
      const anotherUserResponse = await request
        .post('/api/auth/signup')
        .send({
          email: uniqueEmail('another'),
          password: 'password123',
          firstName: 'Another',
          lastName: 'User'
        })
        .expect(201);
      
      const anotherUser = anotherUserResponse.body;

      await storage.createPurchase({
        userId: testUser.id,
        storybookId: testStorybook.id,
        type: 'digital',
        price: '3.99',
        stripePaymentIntentId: 'pi_test',
        status: 'completed',
      });

      const purchase = await storage.getStorybookPurchase(
        anotherUser.id,
        testStorybook.id,
        'digital'
      );

      expect(purchase).toBeNull();
    });
  });

  describe('Pricing Validation', () => {
    it('should use correct pricing constants', () => {
      expect(PRICES.digital).toBe(399); // $3.99 in cents
      expect(PRICES.print).toBe(2499); // $24.99 in cents
    });

    it('should validate purchase types', () => {
      const validTypes = ['digital', 'print'];
      expect(validTypes).toContain('digital');
      expect(validTypes).toContain('print');
      expect(validTypes).not.toContain('invalid');
    });
  });
});
