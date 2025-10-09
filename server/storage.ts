import { type Storybook, type InsertStorybook, type StoryGenerationProgress, storybooks, users, type User, type UpsertUser, type Purchase, type InsertPurchase, purchases } from "@shared/schema";
import { db } from "./db";
import { eq, desc, count, countDistinct, isNull, and } from "drizzle-orm";

export interface IStorage {
  // Replit Auth: User operations (mandatory)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Storybook operations
  createStorybook(storybook: InsertStorybook): Promise<Storybook>;
  getStorybook(id: string): Promise<Storybook | undefined>;
  getStorybookByShareUrl(shareUrl: string): Promise<Storybook | undefined>;
  getUserStorybooks(userId: string): Promise<Storybook[]>;
  getAllStorybooks(): Promise<Storybook[]>;
  updateStorybookShareUrl(id: string, shareUrl: string): Promise<void>;
  updateStorybookImages(id: string, coverImageUrl: string, pages: Storybook['pages']): Promise<void>;
  deleteStorybook(id: string): Promise<void>;
  
  // Progress tracking (kept in-memory for real-time updates)
  setGenerationProgress(sessionId: string, progress: StoryGenerationProgress): Promise<void>;
  getGenerationProgress(sessionId: string): Promise<StoryGenerationProgress | undefined>;
  clearGenerationProgress(sessionId: string): Promise<void>;
  
  // Metrics
  getMetrics(): Promise<{ storiesCreated: number; activeUsers: number }>;
  
  // Purchase operations
  createPurchase(purchase: InsertPurchase): Promise<Purchase>;
  getUserPurchases(userId: string): Promise<Purchase[]>;
  getStorybookPurchase(userId: string, storybookId: string, type: 'digital' | 'print'): Promise<Purchase | null>;
  updatePurchaseStatus(id: string, status: string, stripePaymentIntentId?: string): Promise<Purchase>;
}

// Database storage for persistent data
export class DatabaseStorage implements IStorage {
  private generationProgress: Map<string, StoryGenerationProgress>;

  constructor() {
    this.generationProgress = new Map();
  }

  // Replit Auth: User operations (mandatory)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    try {
      // Try to insert or update based on ID (primary key)
      const [user] = await db
        .insert(users)
        .values(userData)
        .onConflictDoUpdate({
          target: users.id,
          set: {
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            profileImageUrl: userData.profileImageUrl,
            updatedAt: new Date(),
          },
        })
        .returning();
      
      return user;
    } catch (error: any) {
      // Handle email conflict (different ID but same email)
      if (error.message?.includes('users_email_unique')) {
        // Email already exists with different ID - update that user's profile
        // This preserves existing storybooks and foreign key relationships
        const [user] = await db
          .update(users)
          .set({
            firstName: userData.firstName,
            lastName: userData.lastName,
            profileImageUrl: userData.profileImageUrl,
            updatedAt: new Date(),
          })
          .where(eq(users.email, userData.email!))
          .returning();
        
        return user;
      }
      throw error;
    }
  }

  // Storybook operations
  async createStorybook(insertStorybook: InsertStorybook): Promise<Storybook> {
    const [storybook] = await db
      .insert(storybooks)
      .values([insertStorybook])
      .returning();
    return storybook;
  }

  async getStorybook(id: string): Promise<Storybook | undefined> {
    const [storybook] = await db
      .select()
      .from(storybooks)
      .where(and(eq(storybooks.id, id), isNull(storybooks.deletedAt)));
    return storybook || undefined;
  }

  async getStorybookByShareUrl(shareUrl: string): Promise<Storybook | undefined> {
    const [storybook] = await db
      .select()
      .from(storybooks)
      .where(and(eq(storybooks.shareUrl, shareUrl), isNull(storybooks.deletedAt)));
    return storybook || undefined;
  }

  async getUserStorybooks(userId: string): Promise<Storybook[]> {
    const userStorybooks = await db
      .select()
      .from(storybooks)
      .where(and(eq(storybooks.userId, userId), isNull(storybooks.deletedAt)))
      .orderBy(desc(storybooks.createdAt));
    return userStorybooks;
  }

  async updateStorybookShareUrl(id: string, shareUrl: string): Promise<void> {
    await db
      .update(storybooks)
      .set({ shareUrl })
      .where(eq(storybooks.id, id));
  }

  async getAllStorybooks(): Promise<Storybook[]> {
    const allStorybooks = await db
      .select()
      .from(storybooks)
      .orderBy(desc(storybooks.createdAt));
    return allStorybooks;
  }

  async updateStorybookImages(id: string, coverImageUrl: string, pages: Storybook['pages']): Promise<void> {
    await db
      .update(storybooks)
      .set({ coverImageUrl, pages })
      .where(eq(storybooks.id, id));
  }

  async deleteStorybook(id: string): Promise<void> {
    await db
      .update(storybooks)
      .set({ deletedAt: new Date() })
      .where(eq(storybooks.id, id));
  }

  // Progress tracking remains in-memory for real-time updates
  async setGenerationProgress(sessionId: string, progress: StoryGenerationProgress): Promise<void> {
    this.generationProgress.set(sessionId, progress);
  }

  async getGenerationProgress(sessionId: string): Promise<StoryGenerationProgress | undefined> {
    return this.generationProgress.get(sessionId);
  }

  async clearGenerationProgress(sessionId: string): Promise<void> {
    this.generationProgress.delete(sessionId);
  }

  // Metrics
  async getMetrics(): Promise<{ storiesCreated: number; activeUsers: number }> {
    // Get total count of ALL storybooks (including soft-deleted ones)
    const [storiesResult] = await db
      .select({ count: count() })
      .from(storybooks);
    
    // Get count of distinct users who have created at least 1 non-deleted storybook
    const [usersResult] = await db
      .select({ count: countDistinct(storybooks.userId) })
      .from(storybooks)
      .where(isNull(storybooks.deletedAt));
    
    return {
      storiesCreated: storiesResult?.count || 0,
      activeUsers: usersResult?.count || 0,
    };
  }

  // Purchase operations
  async createPurchase(purchase: InsertPurchase): Promise<Purchase> {
    const [newPurchase] = await db
      .insert(purchases)
      .values(purchase)
      .returning();
    return newPurchase;
  }

  async getUserPurchases(userId: string): Promise<Purchase[]> {
    const userPurchases = await db
      .select()
      .from(purchases)
      .where(eq(purchases.userId, userId))
      .orderBy(desc(purchases.createdAt));
    return userPurchases;
  }

  async getStorybookPurchase(userId: string, storybookId: string, type: 'digital' | 'print'): Promise<Purchase | null> {
    const [purchase] = await db
      .select()
      .from(purchases)
      .where(
        and(
          eq(purchases.userId, userId),
          eq(purchases.storybookId, storybookId),
          eq(purchases.type, type)
        )
      );
    return purchase || null;
  }

  async updatePurchaseStatus(id: string, status: string, stripePaymentIntentId?: string): Promise<Purchase> {
    const updateData: any = { status };
    if (stripePaymentIntentId) {
      updateData.stripePaymentIntentId = stripePaymentIntentId;
    }
    
    const [updatedPurchase] = await db
      .update(purchases)
      .set(updateData)
      .where(eq(purchases.id, id))
      .returning();
    return updatedPurchase;
  }
}

export const storage = new DatabaseStorage();
