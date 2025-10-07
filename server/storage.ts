import { type Storybook, type InsertStorybook, type StoryGenerationProgress, storybooks, users, type User, type UpsertUser } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Replit Auth: User operations (mandatory)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Storybook operations
  createStorybook(storybook: InsertStorybook): Promise<Storybook>;
  getStorybook(id: string): Promise<Storybook | undefined>;
  getStorybookByShareUrl(shareUrl: string): Promise<Storybook | undefined>;
  updateStorybookShareUrl(id: string, shareUrl: string): Promise<void>;
  
  // Progress tracking (kept in-memory for real-time updates)
  setGenerationProgress(sessionId: string, progress: StoryGenerationProgress): Promise<void>;
  getGenerationProgress(sessionId: string): Promise<StoryGenerationProgress | undefined>;
  clearGenerationProgress(sessionId: string): Promise<void>;
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
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Storybook operations
  async createStorybook(insertStorybook: InsertStorybook): Promise<Storybook> {
    const [storybook] = await db
      .insert(storybooks)
      .values(insertStorybook)
      .returning();
    return storybook;
  }

  async getStorybook(id: string): Promise<Storybook | undefined> {
    const [storybook] = await db
      .select()
      .from(storybooks)
      .where(eq(storybooks.id, id));
    return storybook || undefined;
  }

  async getStorybookByShareUrl(shareUrl: string): Promise<Storybook | undefined> {
    const [storybook] = await db
      .select()
      .from(storybooks)
      .where(eq(storybooks.shareUrl, shareUrl));
    return storybook || undefined;
  }

  async updateStorybookShareUrl(id: string, shareUrl: string): Promise<void> {
    await db
      .update(storybooks)
      .set({ shareUrl })
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
}

export const storage = new DatabaseStorage();
