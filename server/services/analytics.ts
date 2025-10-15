import { storage } from "../storage";
import type { InsertAnalyticsEvent } from "@shared/schema";

export async function trackStoryStarted(
  userId: string,
  prompt: string,
  inspirationImages: string[]
): Promise<void> {
  const event: InsertAnalyticsEvent = {
    userId,
    eventType: 'story_started',
    eventData: {
      prompt,
      inspirationImageCount: inspirationImages.length,
      timestamp: new Date().toISOString(),
    },
  };

  await storage.trackEvent(event);
}

export async function trackStoryCompleted(
  userId: string,
  storybookId: string,
  pageCount?: number
): Promise<void> {
  const event: InsertAnalyticsEvent = {
    userId,
    storybookId,
    eventType: 'story_completed',
    eventData: {
      pageCount,
      timestamp: new Date().toISOString(),
    },
  };

  await storage.trackEvent(event);
}

export async function trackPageRegenerated(
  userId: string,
  storybookId: string,
  pageNumber: number
): Promise<void> {
  const event: InsertAnalyticsEvent = {
    userId,
    storybookId,
    eventType: 'page_regenerated',
    eventData: {
      pageNumber,
      timestamp: new Date().toISOString(),
    },
  };

  await storage.trackEvent(event);
}

export async function trackShare(
  userId: string,
  storybookId: string,
  platform?: string
): Promise<void> {
  const event: InsertAnalyticsEvent = {
    userId,
    storybookId,
    eventType: 'share_clicked',
    eventData: {
      platform,
      timestamp: new Date().toISOString(),
    },
  };

  await storage.trackEvent(event);
}

export async function trackView(
  storybookId: string,
  userId?: string
): Promise<void> {
  const event: InsertAnalyticsEvent = {
    userId: userId || null,
    storybookId,
    eventType: 'story_viewed',
    eventData: {
      timestamp: new Date().toISOString(),
    },
  };

  await storage.trackEvent(event);
}
