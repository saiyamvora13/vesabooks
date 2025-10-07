import { type Storybook, type InsertStorybook, type StoryGenerationProgress } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  createStorybook(storybook: InsertStorybook): Promise<Storybook>;
  getStorybook(id: string): Promise<Storybook | undefined>;
  getStorybookByShareUrl(shareUrl: string): Promise<Storybook | undefined>;
  updateStorybookShareUrl(id: string, shareUrl: string): Promise<void>;
  
  // Progress tracking
  setGenerationProgress(sessionId: string, progress: StoryGenerationProgress): Promise<void>;
  getGenerationProgress(sessionId: string): Promise<StoryGenerationProgress | undefined>;
  clearGenerationProgress(sessionId: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private storybooks: Map<string, Storybook>;
  private generationProgress: Map<string, StoryGenerationProgress>;

  constructor() {
    this.storybooks = new Map();
    this.generationProgress = new Map();
  }

  async createStorybook(insertStorybook: InsertStorybook): Promise<Storybook> {
    const id = randomUUID();
    const storybook: Storybook = {
      ...insertStorybook,
      id,
      createdAt: new Date(),
      shareUrl: null,
    };
    this.storybooks.set(id, storybook);
    return storybook;
  }

  async getStorybook(id: string): Promise<Storybook | undefined> {
    return this.storybooks.get(id);
  }

  async getStorybookByShareUrl(shareUrl: string): Promise<Storybook | undefined> {
    return Array.from(this.storybooks.values()).find(
      (storybook) => storybook.shareUrl === shareUrl
    );
  }

  async updateStorybookShareUrl(id: string, shareUrl: string): Promise<void> {
    const storybook = this.storybooks.get(id);
    if (storybook) {
      storybook.shareUrl = shareUrl;
      this.storybooks.set(id, storybook);
    }
  }

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

export const storage = new MemStorage();
