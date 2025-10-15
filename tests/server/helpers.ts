import { Request, Response } from 'express';
import { vi } from 'vitest';
import type { User, Storybook, Purchase } from '@shared/schema';

// Helper to generate unique test email
export function uniqueEmail(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
}

// In-memory storage implementation for tests
export class TestStorage {
  private users: Map<string, User> = new Map();
  private storybooks: Map<string, Storybook> = new Map();
  private purchases: Map<string, Purchase> = new Map();
  private passwordResetTokens: Map<string, any> = new Map();

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      u => u.email?.toLowerCase() === email.toLowerCase()
    );
  }

  async createUser(userData: any): Promise<User> {
    const user = { ...userData, id: userData.id || `user-${Date.now()}` };
    this.users.set(user.id, user);
    return user;
  }

  async upsertUser(userData: any): Promise<User> {
    const existing = await this.getUserByEmail(userData.email);
    if (existing) {
      const updated = { ...existing, ...userData };
      this.users.set(existing.id, updated);
      return updated;
    }
    return this.createUser(userData);
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.password = hashedPassword;
      this.users.set(userId, user);
    }
  }

  // Storybook methods
  async createStorybook(data: any): Promise<Storybook> {
    const storybook = { ...data, id: data.id || `story-${Date.now()}` };
    this.storybooks.set(storybook.id, storybook);
    return storybook;
  }

  async getStorybook(id: string): Promise<Storybook | undefined> {
    return this.storybooks.get(id);
  }

  async getUserStorybooks(userId: string): Promise<Storybook[]> {
    return Array.from(this.storybooks.values()).filter(s => s.userId === userId);
  }

  // Purchase methods
  async createPurchase(data: any): Promise<Purchase> {
    const purchase = { ...data, id: data.id || `purchase-${Date.now()}` };
    this.purchases.set(purchase.id, purchase);
    return purchase;
  }

  async getUserPurchases(userId: string): Promise<Purchase[]> {
    return Array.from(this.purchases.values()).filter(p => p.userId === userId);
  }

  async getStorybookPurchase(userId: string, storybookId: string, type: string): Promise<Purchase | null> {
    return Array.from(this.purchases.values()).find(
      p => p.userId === userId && p.storybookId === storybookId && p.type === type
    ) || null;
  }

  async updatePurchaseStatus(id: string, status: string, stripePaymentIntentId?: string): Promise<Purchase> {
    const purchase = this.purchases.get(id);
    if (!purchase) throw new Error('Purchase not found');
    purchase.status = status;
    if (stripePaymentIntentId) {
      purchase.stripePaymentIntentId = stripePaymentIntentId;
    }
    this.purchases.set(id, purchase);
    return purchase;
  }

  // Password reset methods
  async createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<any> {
    const resetToken = { userId, token, expiresAt };
    this.passwordResetTokens.set(token, resetToken);
    return resetToken;
  }

  async getPasswordResetToken(token: string): Promise<any> {
    return this.passwordResetTokens.get(token) || null;
  }

  async deletePasswordResetToken(token: string): Promise<void> {
    this.passwordResetTokens.delete(token);
  }

  // Cleanup
  clear() {
    this.users.clear();
    this.storybooks.clear();
    this.purchases.clear();
    this.passwordResetTokens.clear();
  }

  // Stub methods for unused interfaces
  async getUserByGoogleId(): Promise<User | undefined> { return undefined; }
  async getUserByFacebookId(): Promise<User | undefined> { return undefined; }
  async getUserByAppleId(): Promise<User | undefined> { return undefined; }
  async getStorybookByShareUrl(): Promise<Storybook | undefined> { return undefined; }
  async getAllStorybooks(): Promise<Storybook[]> { return []; }
  async getExampleStorybooks(): Promise<Storybook[]> { return []; }
  async updateStorybookShareUrl(): Promise<void> {}
  async updateStorybookImages(): Promise<void> {}
  async deleteStorybook(): Promise<void> {}
  async setGenerationProgress(): Promise<void> {}
  async getGenerationProgress(): Promise<any> { return undefined; }
  async clearGenerationProgress(): Promise<void> {}
  async getMetrics(): Promise<any> { return { storiesCreated: 0, activeUsers: 0 }; }
  async deleteExpiredPasswordResetTokens(): Promise<void> {}
  async getAdminUser(): Promise<any> { return undefined; }
  async getAdminUserByEmail(): Promise<any> { return undefined; }
  async createAdminUser(): Promise<any> { throw new Error('Not implemented'); }
  async getSetting(): Promise<any> { return undefined; }
  async updateSetting(): Promise<void> {}
  async getAllSettings(): Promise<any[]> { return []; }
  async getHeroSlots(): Promise<any[]> { return []; }
  async updateHeroSlot(): Promise<void> {}
  async getFeaturedStorybooks(): Promise<any[]> { return []; }
  async addFeaturedStorybook(): Promise<any> { throw new Error('Not implemented'); }
  async removeFeaturedStorybook(): Promise<void> {}
  async updateFeaturedRank(): Promise<void> {}
  async createAuditLog(): Promise<void> {}
  async getAuditLogs(): Promise<any[]> { return []; }
  async getAllSamplePrompts(): Promise<any[]> { return []; }
  async getActiveSamplePrompts(): Promise<any[]> { return []; }
  async getSamplePrompt(): Promise<any> { return undefined; }
  async createSamplePrompt(): Promise<any> { throw new Error('Not implemented'); }
  async updateSamplePrompt(): Promise<any> { throw new Error('Not implemented'); }
  async deleteSamplePrompt(): Promise<void> {}
}

// Mock Express request
export function createMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    session: {} as any,
    user: undefined,
    isAuthenticated: vi.fn(() => false) as any,
    login: vi.fn((user, callback) => callback?.(null)),
    logout: vi.fn((callback) => callback?.(null)),
    ...overrides,
  };
}

// Mock Express response
export function createMockResponse(): Partial<Response> {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    sendStatus: vi.fn().mockReturnThis(),
    redirect: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
  };
  return res;
}

// Create authenticated request
export function createAuthenticatedRequest(user: User, overrides: Partial<Request> = {}): Partial<Request> {
  return createMockRequest({
    user,
    isAuthenticated: vi.fn(() => true) as any,
    ...overrides,
  });
}
