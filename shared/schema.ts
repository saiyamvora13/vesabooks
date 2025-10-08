import { sql } from "drizzle-orm";
import { pgTable, text, varchar, json, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Replit Auth: Session storage table (mandatory)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Replit Auth: User storage table (mandatory)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const storybooks = pgTable("storybooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  prompt: text("prompt").notNull(),
  pages: json("pages").$type<Array<{
    pageNumber: number;
    text: string;
    imageUrl: string;
  }>>().notNull(),
  inspirationImages: json("inspiration_images").$type<string[]>().notNull().default([]),
  coverImageUrl: text("cover_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  shareUrl: text("share_url"),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("idx_storybooks_user_deleted").on(table.userId, table.deletedAt),
]);

export const insertStorybookSchema = createInsertSchema(storybooks).omit({
  id: true,
  createdAt: true,
  shareUrl: true,
  deletedAt: true,
});

export const createStorybookSchema = z.object({
  prompt: z.string().min(10, "Story prompt must be at least 10 characters"),
  inspirationImages: z.array(z.string()).min(0).max(5, "Maximum 5 images allowed"),
});

export type InsertStorybook = z.infer<typeof insertStorybookSchema>;
export type Storybook = typeof storybooks.$inferSelect;
export type CreateStorybookRequest = z.infer<typeof createStorybookSchema>;

export interface StoryGenerationProgress {
  step: 'processing_images' | 'generating_story' | 'generating_illustrations' | 'finalizing';
  progress: number;
  message: string;
  error?: string;
}
