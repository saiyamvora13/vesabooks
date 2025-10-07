import { sql } from "drizzle-orm";
import { pgTable, text, varchar, json, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const storybooks = pgTable("storybooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  prompt: text("prompt").notNull(),
  pages: json("pages").$type<Array<{
    pageNumber: number;
    text: string;
    imageUrl: string;
  }>>().notNull(),
  inspirationImages: json("inspiration_images").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  shareUrl: text("share_url"),
});

export const insertStorybookSchema = createInsertSchema(storybooks).omit({
  id: true,
  createdAt: true,
  shareUrl: true,
});

export const createStorybookSchema = z.object({
  prompt: z.string().min(10, "Story prompt must be at least 10 characters"),
  inspirationImages: z.array(z.string()).min(1, "At least one inspiration image is required").max(5, "Maximum 5 images allowed"),
});

export type InsertStorybook = z.infer<typeof insertStorybookSchema>;
export type Storybook = typeof storybooks.$inferSelect;
export type CreateStorybookRequest = z.infer<typeof createStorybookSchema>;

export interface StoryGenerationProgress {
  step: 'processing_images' | 'generating_story' | 'generating_illustrations' | 'finalizing';
  progress: number;
  message: string;
}
