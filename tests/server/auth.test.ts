import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import supertest from 'supertest';
import type { Express } from 'express';
import { createTestApp } from './app';
import { TestStorage, uniqueEmail } from './helpers';
import { testUsers, testCredentials } from '../shared/fixtures';
import { storage } from '@server/storage';

describe('Auth API Integration Tests', () => {
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
  });

  describe('POST /api/auth/signup', () => {
    it('should create a new user with valid credentials', async () => {
      const { password, firstName, lastName } = testCredentials.newUser;
      const email = uniqueEmail('newuser');
      
      const response = await request
        .post('/api/auth/signup')
        .send({ email, password, firstName, lastName })
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.email).toBe(email.toLowerCase());
      expect(response.body.firstName).toBe(firstName);
      expect(response.body.lastName).toBe(lastName);
      expect(response.body.password).toBeUndefined(); // Password should not be returned
      expect(response.body.authProvider).toBe('email');
      expect(response.body.id).toBeDefined();
    });

    it('should reject signup with invalid email format', async () => {
      const invalidEmail = 'notanemail';
      
      const response = await request
        .post('/api/auth/signup')
        .send({
          email: invalidEmail,
          password: 'validPassword123',
          firstName: 'Test',
          lastName: 'User'
        })
        .expect(400);

      expect(response.body.message).toContain('Invalid email format');
    });

    it('should reject signup with short password', async () => {
      const response = await request
        .post('/api/auth/signup')
        .send({
          email: uniqueEmail('short-password'),
          password: '1234567', // 7 characters
          firstName: 'Test',
          lastName: 'User'
        })
        .expect(400);

      expect(response.body.message).toContain('at least 8 characters');
    });

    it('should prevent duplicate email registration', async () => {
      const userData = {
        email: uniqueEmail('duplicate'),
        password: 'password123',
        firstName: 'Test',
        lastName: 'User'
      };

      // First signup should succeed
      await request
        .post('/api/auth/signup')
        .send(userData)
        .expect(201);

      // Second signup with same email should fail
      const response = await request
        .post('/api/auth/signup')
        .send(userData)
        .expect(409);

      expect(response.body.message).toContain('Email already exists');
    });

    it('should normalize email to lowercase', async () => {
      const email = uniqueEmail('normalize');
      const response = await request
        .post('/api/auth/signup')
        .send({
          email: email.toUpperCase(),
          password: 'password123',
          firstName: 'Test',
          lastName: 'User'
        })
        .expect(201);

      expect(response.body.email).toBe(email.toLowerCase());
    });

    it('should require email and password fields', async () => {
      const response = await request
        .post('/api/auth/signup')
        .send({
          firstName: 'Test',
          lastName: 'User'
        })
        .expect(400);

      expect(response.body.message).toContain('Email and password are required');
    });

    it('should automatically log in user after successful signup', async () => {
      const agent = supertest.agent(app);
      const email = uniqueEmail('autologin');
      
      const signupResponse = await agent
        .post('/api/auth/signup')
        .send({
          email: email,
          password: 'password123',
          firstName: 'New',
          lastName: 'User'
        })
        .expect(201);

      // Verify user is logged in by checking /api/auth/me endpoint
      const meResponse = await agent
        .get('/api/auth/me')
        .expect(200);

      expect(meResponse.body.id).toBe(signupResponse.body.id);
      expect(meResponse.body.email).toBe(email);
    });
  });

  describe('POST /api/auth/login', () => {
    let testEmail: string;
    const testPassword = testCredentials.valid.password;
    
    beforeEach(async () => {
      // Create a test user for login tests with unique email
      testEmail = uniqueEmail('login');
      await request
        .post('/api/auth/signup')
        .send({
          email: testEmail,
          password: testPassword,
          firstName: 'Test',
          lastName: 'User'
        })
        .expect(201);
    });

    it('should authenticate user with correct credentials', async () => {
      const agent = supertest.agent(app);
      
      const response = await agent
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: testPassword
        })
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.email).toBe(testEmail);
      expect(response.body.password).toBeUndefined(); // Password should not be returned
      
      // Verify session is created
      const meResponse = await agent
        .get('/api/auth/me')
        .expect(200);

      expect(meResponse.body.email).toBe(testEmail);
    });

    it('should reject login with incorrect password', async () => {
      const response = await request
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.message).toBeDefined();
    });

    it('should reject login with non-existent email', async () => {
      const response = await request
        .post('/api/auth/login')
        .send({
          email: uniqueEmail('nonexistent'),
          password: 'password123'
        })
        .expect(401);

      expect(response.body.message).toBeDefined();
    });

    it('should handle case-insensitive email login', async () => {
      const upperCaseEmail = testEmail.toUpperCase();
      
      const response = await request
        .post('/api/auth/login')
        .send({
          email: upperCaseEmail,
          password: testPassword
        })
        .expect(200);

      expect(response.body.email).toBe(testEmail);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should successfully logout authenticated user', async () => {
      const agent = supertest.agent(app);
      
      // First login
      await agent
        .post('/api/auth/signup')
        .send({
          email: uniqueEmail('logout'),
          password: 'password123',
          firstName: 'Logout',
          lastName: 'Test'
        })
        .expect(201);

      // Verify logged in
      await agent
        .get('/api/auth/me')
        .expect(200);

      // Logout
      const logoutResponse = await agent
        .post('/api/auth/logout')
        .expect(200);

      expect(logoutResponse.body.message).toBe('Logout successful');

      // Verify logged out
      await agent
        .get('/api/auth/me')
        .expect(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current authenticated user', async () => {
      const agent = supertest.agent(app);
      const email = uniqueEmail('me');
      
      const signupResponse = await agent
        .post('/api/auth/signup')
        .send({
          email: email,
          password: 'password123',
          firstName: 'Me',
          lastName: 'Test'
        })
        .expect(201);

      const meResponse = await agent
        .get('/api/auth/me')
        .expect(200);

      expect(meResponse.body.id).toBe(signupResponse.body.id);
      expect(meResponse.body.email).toBe(email);
      expect(meResponse.body.password).toBeUndefined();
    });

    it('should return 401 for unauthenticated user', async () => {
      await request
        .get('/api/auth/me')
        .expect(401);
    });
  });

  describe('Password Reset Flow', () => {
    it('should accept password reset request for existing user', async () => {
      // Create user first
      const email = uniqueEmail('reset');
      await request
        .post('/api/auth/signup')
        .send({
          email: email,
          password: 'oldPassword123',
          firstName: 'Reset',
          lastName: 'Test'
        })
        .expect(201);

      // Request password reset
      const response = await request
        .post('/api/auth/forgot-password')
        .send({ email: email })
        .expect(200);

      expect(response.body.message).toContain('If an account exists');
    });

    it('should return same message for non-existent user (security)', async () => {
      const response = await request
        .post('/api/auth/forgot-password')
        .send({ email: uniqueEmail('nonexistent-reset') })
        .expect(200);

      expect(response.body.message).toContain('If an account exists');
    });

    it('should require email for password reset', async () => {
      const response = await request
        .post('/api/auth/forgot-password')
        .send({})
        .expect(400);

      expect(response.body.message).toContain('Email is required');
    });
  });
});
