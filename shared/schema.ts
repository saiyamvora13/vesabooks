import { sql } from "drizzle-orm";
import { pgTable, text, varchar, json, timestamp, index, jsonb, numeric, unique, boolean } from "drizzle-orm/pg-core";
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
// Note: Email uniqueness is enforced by case-insensitive index: users_email_lower_unique
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  password: varchar("password"),
  authProvider: varchar("auth_provider").notNull().default('email'),
  emailVerified: boolean("email_verified").notNull().default(false),
  googleId: varchar("google_id").unique(),
  facebookId: varchar("facebook_id").unique(),
  appleId: varchar("apple_id").unique(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const storybooks = pgTable("storybooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  author: text("author"),
  prompt: text("prompt").notNull(),
  pages: json("pages").$type<Array<{
    pageNumber: number;
    text: string;
    imageUrl: string;
    imagePrompt: string;
  }>>().notNull(),
  inspirationImages: json("inspiration_images").$type<string[]>().notNull().default([]),
  coverImageUrl: text("cover_image_url"),
  backCoverImageUrl: text("back_cover_image_url"),
  mainCharacterDescription: text("main_character_description"),
  defaultClothing: text("default_clothing"),
  storyArc: text("story_arc"),
  isPublic: boolean("is_public").notNull().default(false),
  shareCount: numeric("share_count").notNull().default('0'),
  viewCount: numeric("view_count").notNull().default('0'),
  createdAt: timestamp("created_at").defaultNow(),
  shareUrl: text("share_url"),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("idx_storybooks_user_deleted").on(table.userId, table.deletedAt),
  index("idx_storybooks_public").on(table.isPublic, table.createdAt),
]);

export const insertStorybookSchema = createInsertSchema(storybooks).omit({
  id: true,
  createdAt: true,
  shareUrl: true,
  deletedAt: true,
  isPublic: true,
  shareCount: true,
  viewCount: true,
});

export const createStorybookSchema = z.object({
  prompt: z.string().min(10, "Story prompt must be at least 10 characters"),
  author: z.string().optional(),
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

export const purchases = pgTable("purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  storybookId: varchar("storybook_id").notNull().references(() => storybooks.id, { onDelete: 'cascade' }),
  type: text("type").notNull(),
  price: numeric("price").notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id").notNull(),
  status: text("status").notNull().default('pending'),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_purchases_user").on(table.userId),
  index("idx_purchases_storybook").on(table.storybookId),
  unique().on(table.stripePaymentIntentId, table.storybookId, table.type),
]);

export const insertPurchaseSchema = createInsertSchema(purchases).omit({
  id: true,
  createdAt: true,
});

export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;
export type Purchase = typeof purchases.$inferSelect;

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_password_reset_tokens_user").on(table.userId),
  index("idx_password_reset_tokens_token").on(table.token),
  index("idx_password_reset_tokens_expires").on(table.expiresAt),
]);

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
});

export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// Admin Users table - separate from regular users for security
export const adminUsers = pgTable("admin_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull().unique(),
  password: varchar("password").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = typeof adminUsers.$inferInsert;

// Site Settings table - flexible key-value store for configuration
export const siteSettings = pgTable("site_settings", {
  key: varchar("key").primaryKey(),
  value: text("value").notNull(),
  description: text("description"),
  updatedBy: varchar("updated_by").references(() => adminUsers.id),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type SiteSetting = typeof siteSettings.$inferSelect;
export type InsertSiteSetting = typeof siteSettings.$inferInsert;

// Hero Storybook Slots - control which storybooks appear on homepage
export const heroStorybookSlots = pgTable("hero_storybook_slots", {
  slotNumber: numeric("slot_number").primaryKey(),
  storybookId: varchar("storybook_id").references(() => storybooks.id, { onDelete: 'set null' }),
  headline: text("headline"),
  ctaText: text("cta_text"),
  isActive: boolean("is_active").notNull().default(true),
  updatedBy: varchar("updated_by").references(() => adminUsers.id),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type HeroStorybookSlot = typeof heroStorybookSlots.$inferSelect;
export type InsertHeroStorybookSlot = typeof heroStorybookSlots.$inferInsert;

// Featured Storybooks - curated featured content with ranking
export const featuredStorybooks = pgTable("featured_storybooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storybookId: varchar("storybook_id").notNull().references(() => storybooks.id, { onDelete: 'cascade' }),
  rank: numeric("rank").notNull(),
  featuredFrom: timestamp("featured_from").defaultNow(),
  featuredTo: timestamp("featured_to"),
  isActive: boolean("is_active").notNull().default(true),
  updatedBy: varchar("updated_by").references(() => adminUsers.id),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_featured_storybooks_active").on(table.isActive, table.rank),
  unique().on(table.storybookId),
]);

export type FeaturedStorybook = typeof featuredStorybooks.$inferSelect;
export type InsertFeaturedStorybook = typeof featuredStorybooks.$inferInsert;

// Admin Audit Logs - track all admin actions for security
export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id").notNull().references(() => adminUsers.id, { onDelete: 'cascade' }),
  action: text("action").notNull(),
  resourceType: text("resource_type"),
  resourceId: varchar("resource_id"),
  changes: jsonb("changes"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_admin_audit_logs_admin").on(table.adminId),
  index("idx_admin_audit_logs_created").on(table.createdAt),
]);

export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;
export type InsertAdminAuditLog = typeof adminAuditLogs.$inferInsert;

// Sample Prompts - pre-made story ideas for users to get started
export const samplePrompts = pgTable("sample_prompts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  prompt: text("prompt").notNull(),
  ageRange: varchar("age_range").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  displayOrder: numeric("display_order").notNull().default('0'),
  updatedBy: varchar("updated_by").references(() => adminUsers.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_sample_prompts_active_order").on(table.isActive, table.displayOrder),
]);

export const insertSamplePromptSchema = createInsertSchema(samplePrompts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SamplePrompt = typeof samplePrompts.$inferSelect;
export type InsertSamplePrompt = z.infer<typeof insertSamplePromptSchema>;

// Analytics Events - track user actions and engagement
export const analyticsEvents = pgTable("analytics_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }),
  storybookId: varchar("storybook_id").references(() => storybooks.id, { onDelete: 'cascade' }),
  eventType: varchar("event_type").notNull(),
  eventData: jsonb("event_data"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_analytics_events_user").on(table.userId),
  index("idx_analytics_events_type").on(table.eventType),
  index("idx_analytics_events_storybook").on(table.storybookId),
  index("idx_analytics_events_created").on(table.createdAt),
]);

export const insertAnalyticsEventSchema = createInsertSchema(analyticsEvents).omit({
  id: true,
  createdAt: true,
});

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;

// Story Ratings - user feedback and ratings
export const storyRatings = pgTable("story_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storybookId: varchar("storybook_id").notNull().references(() => storybooks.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  rating: numeric("rating").notNull(),
  feedback: text("feedback"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_story_ratings_storybook").on(table.storybookId),
  index("idx_story_ratings_user").on(table.userId),
  unique().on(table.storybookId, table.userId),
]);

export const insertStoryRatingSchema = createInsertSchema(storyRatings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type StoryRating = typeof storyRatings.$inferSelect;
export type InsertStoryRating = z.infer<typeof insertStoryRatingSchema>;
