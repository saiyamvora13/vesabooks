import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import supertest from 'supertest';
import type { Express } from 'express';
import { createTestApp } from './app';
import { TestStorage, uniqueEmail } from './helpers';
import { testUsers, testGenerationData, testStorybooks } from '../shared/fixtures';
import { generateStoryFromPrompt, generateIllustration } from '@server/services/gemini';

describe('Story Generation Integration Tests', () => {
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

  describe('POST /api/storybooks - Story Generation Endpoint', () => {
    let agent: supertest.SuperAgent;
    let testUser: any;

    beforeEach(async () => {
      // Create authenticated agent
      agent = supertest.agent(app);
      
      // Create and login user
      const signupResponse = await agent
        .post('/api/auth/signup')
        .send({
          email: uniqueEmail('storyteller'),
          password: 'password123',
          firstName: 'Story',
          lastName: 'Teller'
        })
        .expect(201);
      
      testUser = signupResponse.body;
    });

    it('should generate storybook from prompt and return session ID', async () => {
      const response = await agent
        .post('/api/storybooks')
        .send({
          prompt: testGenerationData.simplePrompt,
          author: 'Test Author'
        })
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.sessionId).toBeDefined();
      expect(typeof response.body.sessionId).toBe('string');
    });

    it('should validate prompt is required', async () => {
      const response = await agent
        .post('/api/storybooks')
        .send({
          author: 'Test Author'
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should require authentication', async () => {
      const response = await request
        .post('/api/storybooks')
        .send({
          prompt: testGenerationData.simplePrompt,
          author: 'Test Author'
        })
        .expect(401);

      expect(response.body.message).toBe('Unauthorized');
    });

    it('should handle prompt with inspiration images', async () => {
      // Note: In real tests, you'd upload actual files using multipart/form-data
      const response = await agent
        .post('/api/storybooks')
        .field('prompt', testGenerationData.detailedPrompt)
        .field('author', 'Test Author')
        .expect(200);

      expect(response.body.sessionId).toBeDefined();
    });

    it('should use default author if not provided', async () => {
      const response = await agent
        .post('/api/storybooks')
        .send({
          prompt: testGenerationData.simplePrompt
        })
        .expect(200);

      expect(response.body.sessionId).toBeDefined();
    });

    it('should handle different prompt lengths', async () => {
      const longPrompt = testGenerationData.detailedPrompt;
      
      const response = await agent
        .post('/api/storybooks')
        .send({
          prompt: longPrompt,
          author: 'Test Author'
        })
        .expect(200);

      expect(response.body.sessionId).toBeDefined();
    });
  });

  describe('GET /api/generation/:sessionId/progress - Progress Tracking', () => {
    let agent: supertest.SuperAgent;
    let sessionId: string;

    beforeEach(async () => {
      agent = supertest.agent(app);
      
      await agent
        .post('/api/auth/signup')
        .send({
          email: uniqueEmail('progress'),
          password: 'password123',
          firstName: 'Progress',
          lastName: 'Test'
        })
        .expect(201);

      // Create a generation session
      const genResponse = await agent
        .post('/api/storybooks')
        .send({
          prompt: testGenerationData.simplePrompt,
          author: 'Test Author'
        })
        .expect(200);

      sessionId = genResponse.body.sessionId;
    });

    it('should return progress for valid session', async () => {
      // Need to wait a bit for async generation to start
      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await request
        .get(`/api/generation/${sessionId}/progress`)
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request
        .get('/api/generation/non-existent-session/progress')
        .expect(404);

      expect(response.body.message).toContain('Session not found');
    });
  });

  describe('GET /api/storybooks - User Storybooks', () => {
    let agent: supertest.SuperAgent;
    let testUser: any;

    beforeEach(async () => {
      agent = supertest.agent(app);
      
      const signupResponse = await agent
        .post('/api/auth/signup')
        .send({
          email: uniqueEmail('library'),
          password: 'password123',
          firstName: 'Library',
          lastName: 'Test'
        })
        .expect(201);
      
      testUser = signupResponse.body;
    });

    it('should return user storybooks', async () => {
      // Create some storybooks for the user
      await testStorage.createStorybook({
        ...testStorybooks.simpleStory,
        userId: testUser.id,
      });

      const response = await agent
        .get('/api/storybooks')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should require authentication', async () => {
      await request
        .get('/api/storybooks')
        .expect(401);
    });

    it('should return empty array for user with no storybooks', async () => {
      const response = await agent
        .get('/api/storybooks')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Character Consistency and Story Quality', () => {
    it('should generate story with main character description', async () => {
      const story = await generateStoryFromPrompt(
        testGenerationData.detailedPrompt,
        [],
        3
      );

      expect(story.mainCharacterDescription).toBeTruthy();
      expect(story.mainCharacterDescription.length).toBeGreaterThan(10);
    });

    it('should generate story with default clothing', async () => {
      const story = await generateStoryFromPrompt(
        testGenerationData.simplePrompt,
        [],
        3
      );

      expect(story.defaultClothing).toBeTruthy();
      expect(story.defaultClothing.length).toBeGreaterThan(5);
    });

    it('should maintain story arc across pages', async () => {
      const story = await generateStoryFromPrompt(
        testGenerationData.detailedPrompt,
        [],
        5
      );

      expect(story.storyArc).toBeTruthy();
      expect(story.pages).toHaveLength(5);
      
      // Verify all pages are sequential
      story.pages.forEach((page, index) => {
        expect(page.pageNumber).toBe(index + 1);
        expect(page.text).toBeTruthy();
        expect(page.imagePrompt).toBeTruthy();
      });
    });

    it('should generate unique image prompts for each page', async () => {
      const story = await generateStoryFromPrompt(
        testGenerationData.simplePrompt,
        [],
        4
      );

      const imagePrompts = story.pages.map(p => p.imagePrompt);
      const uniquePrompts = new Set(imagePrompts);
      
      // All prompts should be unique (in mock, they are different)
      expect(uniquePrompts.size).toBe(imagePrompts.length);
    });

    it('should generate story with correct page count', async () => {
      const pagesPerBook = 3;
      const story = await generateStoryFromPrompt(
        testGenerationData.simplePrompt,
        [],
        pagesPerBook
      );

      expect(story.pages).toHaveLength(pagesPerBook);
    });

    it('should handle custom page count', async () => {
      const pagesPerBook = 7;
      const story = await generateStoryFromPrompt(
        testGenerationData.detailedPrompt,
        [],
        pagesPerBook
      );

      expect(story.pages).toHaveLength(pagesPerBook);
    });
  });

  describe('Image Generation Pipeline', () => {
    it('should generate illustration from prompt', async () => {
      const imagePrompt = 'A magical forest with sparkling trees';
      
      const imageData = await generateIllustration(imagePrompt);

      expect(imageData).toBeTruthy();
      expect(imageData).toContain('data:image');
    });

    it('should generate cover image for story', async () => {
      const story = await generateStoryFromPrompt(
        testGenerationData.simplePrompt,
        [],
        3
      );

      expect(story.coverImagePrompt).toBeTruthy();
      
      const coverImage = await generateIllustration(story.coverImagePrompt);
      expect(coverImage).toBeTruthy();
    });

    it('should generate all page images', async () => {
      const story = await generateStoryFromPrompt(
        testGenerationData.detailedPrompt,
        [],
        3
      );

      const imagePromises = story.pages.map(page => 
        generateIllustration(page.imagePrompt)
      );

      const images = await Promise.all(imagePromises);
      
      expect(images).toHaveLength(3);
      images.forEach(image => {
        expect(image).toBeTruthy();
        expect(typeof image).toBe('string');
      });
    });
  });

  describe('Storybook Storage and Retrieval', () => {
    it('should store generated storybook', async () => {
      const story = await generateStoryFromPrompt(
        testGenerationData.simplePrompt,
        [],
        3
      );

      const storybook = await testStorage.createStorybook({
        userId: testUsers.validUser.id,
        title: story.title,
        author: story.author,
        prompt: testGenerationData.simplePrompt,
        pages: story.pages.map(p => ({
          ...p,
          imageUrl: `/generated/${p.pageNumber}.png`,
        })),
        inspirationImages: [],
        coverImageUrl: '/generated/cover.png',
        mainCharacterDescription: story.mainCharacterDescription,
        defaultClothing: story.defaultClothing,
        storyArc: story.storyArc,
      });

      expect(storybook).toBeDefined();
      expect(storybook.userId).toBe(testUsers.validUser.id);
      expect(storybook.title).toBe(story.title);
      expect(storybook.pages).toHaveLength(3);
    });

    it('should retrieve storybook by ID', async () => {
      const storybook = await testStorage.createStorybook({
        ...testStorybooks.simpleStory,
        userId: testUsers.validUser.id,
      });

      const retrieved = await testStorage.getStorybook(storybook.id);
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(storybook.id);
      expect(retrieved?.title).toBe(storybook.title);
    });
  });

  describe('GET /api/storybooks/examples - Example Storybooks', () => {
    it('should return example storybooks for homepage', async () => {
      const response = await request
        .get('/api/storybooks/examples')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should not require authentication', async () => {
      // Should work without authentication
      const response = await request
        .get('/api/storybooks/examples')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors', async () => {
      const agent = supertest.agent(app);
      
      await agent
        .post('/api/auth/signup')
        .send({
          email: uniqueEmail('error'),
          password: 'password123',
          firstName: 'Error',
          lastName: 'Test'
        })
        .expect(201);

      // Test with invalid data
      const response = await agent
        .post('/api/storybooks')
        .send({
          // Missing prompt
          author: 'Test'
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });
  });
});
