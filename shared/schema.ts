import { sql } from "drizzle-orm";
import { pgTable, text, varchar, json, timestamp, index, jsonb, numeric, unique, boolean, integer } from "drizzle-orm/pg-core";
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
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  author: text("author"),
  age: text("age"),
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
  artStyle: text("art_style"),
  orientation: text("orientation").default('portrait'),
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
  age: z.enum(["3-5", "6-8", "9-12"]).optional(),
  illustrationStyle: z.string().optional(),
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
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }),
  storybookId: varchar("storybook_id").notNull().references(() => storybooks.id, { onDelete: 'cascade' }),
  type: text("type").notNull(),
  price: numeric("price").notNull(),
  orderReference: text("order_reference"), // Clean order ID like ORDER-ABC12345
  stripePaymentIntentId: text("stripe_payment_intent_id").notNull(),
  status: text("status").notNull().default('pending'),
  bookSize: text("book_size").default('a5-portrait'),
  spineText: text("spine_text"),
  spineTextColor: text("spine_text_color").default('#000000'),
  spineBackgroundColor: text("spine_background_color").default('#FFFFFF'),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_purchases_user_created").on(table.userId, table.createdAt),
  index("idx_purchases_storybook").on(table.storybookId),
  index("idx_purchases_order_reference").on(table.orderReference),
  unique().on(table.stripePaymentIntentId, table.storybookId, table.type),
  unique("uq_purchases_order_reference").on(table.orderReference),
]);

export const insertPurchaseSchema = createInsertSchema(purchases).omit({
  id: true,
  createdAt: true,
});

export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;
export type Purchase = typeof purchases.$inferSelect;

// Shopping Cart Items table
export const cartItems = pgTable("cart_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }),
  storybookId: varchar("storybook_id").notNull().references(() => storybooks.id, { onDelete: 'cascade' }),
  productType: text("product_type").notNull(), // 'digital' | 'print'
  bookSize: text("book_size"), // Only for print items (a5-portrait, a4-landscape, etc.)
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_cart_items_user").on(table.userId),
  index("idx_cart_items_storybook").on(table.storybookId),
  // Prevent duplicate items: same user + storybook + product type + book size
  unique().on(table.userId, table.storybookId, table.productType, table.bookSize),
]);

export const insertCartItemSchema = createInsertSchema(cartItems).omit({
  id: true,
  createdAt: true,
});

export type InsertCartItem = z.infer<typeof insertCartItemSchema>;
export type CartItem = typeof cartItems.$inferSelect;

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

// Saved Storybooks table - tracks which users have saved which public storybooks from the gallery
export const savedStorybooks = pgTable("saved_storybooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  storybookId: varchar("storybook_id").notNull().references(() => storybooks.id, { onDelete: 'cascade' }),
  savedAt: timestamp("saved_at").defaultNow(),
}, (table) => [
  index("idx_saved_storybooks_user").on(table.userId),
  index("idx_saved_storybooks_storybook").on(table.storybookId),
  unique().on(table.userId, table.storybookId), // Prevent duplicate saves
]);

export const insertSavedStorybookSchema = createInsertSchema(savedStorybooks).omit({
  id: true,
  savedAt: true,
});

export type InsertSavedStorybook = z.infer<typeof insertSavedStorybookSchema>;
export type SavedStorybook = typeof savedStorybooks.$inferSelect;

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

// Audio Settings - storybook-specific audio preferences
export const audioSettings = pgTable("audio_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storybookId: varchar("storybook_id").notNull().references(() => storybooks.id, { onDelete: 'cascade' }),
  musicEnabled: boolean("music_enabled").notNull().default(true),
  soundEffectsEnabled: boolean("sound_effects_enabled").notNull().default(true),
  musicVolume: numeric("music_volume").notNull().default('70'),
  effectsVolume: numeric("effects_volume").notNull().default('80'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_audio_settings_storybook").on(table.storybookId),
  unique().on(table.storybookId),
]);

export const insertAudioSettingsSchema = createInsertSchema(audioSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AudioSettings = typeof audioSettings.$inferSelect;
export type InsertAudioSettings = z.infer<typeof insertAudioSettingsSchema>;

// IP Rate Limiting - track story creation by IP address
export const ipRateLimits = pgTable("ip_rate_limits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ipAddress: varchar("ip_address").notNull(),
  storyCount: numeric("story_count").notNull().default('0'),
  resetAt: timestamp("reset_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_ip_rate_limits_ip").on(table.ipAddress),
  unique().on(table.ipAddress),
]);

export const insertIpRateLimitSchema = createInsertSchema(ipRateLimits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type IpRateLimit = typeof ipRateLimits.$inferSelect;
export type InsertIpRateLimit = z.infer<typeof insertIpRateLimitSchema>;

// Download Verifications - email verification for PDF/EPUB downloads
export const downloadVerifications = pgTable("download_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storybookId: varchar("storybook_id").notNull().references(() => storybooks.id, { onDelete: 'cascade' }),
  email: varchar("email").notNull(),
  verificationCode: varchar("verification_code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_download_verifications_storybook").on(table.storybookId),
  index("idx_download_verifications_email").on(table.email),
]);

export const insertDownloadVerificationSchema = createInsertSchema(downloadVerifications).omit({
  id: true,
  createdAt: true,
});

export type DownloadVerification = typeof downloadVerifications.$inferSelect;
export type InsertDownloadVerification = z.infer<typeof insertDownloadVerificationSchema>;

// User Shipping Addresses - saved shipping addresses for quick checkout
export const userShippingAddresses = pgTable("user_shipping_addresses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  fullName: varchar("full_name").notNull(),
  addressLine1: varchar("address_line_1").notNull(),
  addressLine2: varchar("address_line_2"),
  city: varchar("city").notNull(),
  stateProvince: varchar("state_province").notNull(),
  postalCode: varchar("postal_code").notNull(),
  country: varchar("country").notNull().default('US'),
  phoneNumber: varchar("phone_number"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_shipping_addresses_user").on(table.userId),
  index("idx_user_shipping_addresses_default").on(table.userId, table.isDefault),
]);

export const insertUserShippingAddressSchema = createInsertSchema(userShippingAddresses).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export type UserShippingAddress = typeof userShippingAddresses.$inferSelect;
export type InsertUserShippingAddress = z.infer<typeof insertUserShippingAddressSchema>;

// User Payment Methods - saved payment methods (Stripe) for quick checkout
export const userPaymentMethods = pgTable("user_payment_methods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  stripePaymentMethodId: varchar("stripe_payment_method_id").notNull().unique(),
  cardBrand: varchar("card_brand").notNull(),
  cardLast4: varchar("card_last4").notNull(),
  cardExpMonth: integer("card_exp_month").notNull(),
  cardExpYear: integer("card_exp_year").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_payment_methods_user").on(table.userId),
  index("idx_user_payment_methods_default").on(table.userId, table.isDefault),
]);

export const insertUserPaymentMethodSchema = createInsertSchema(userPaymentMethods).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export type UserPaymentMethod = typeof userPaymentMethods.$inferSelect;
export type InsertUserPaymentMethod = z.infer<typeof insertUserPaymentMethodSchema>;

// Print Orders - track Prodigi print order fulfillment
// Status flow: creating -> pending -> in_progress -> shipped -> delivered | cancelled
export const printOrders = pgTable("print_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  purchaseId: varchar("purchase_id").notNull().references(() => purchases.id, { onDelete: 'cascade' }),
  prodigiOrderId: varchar("prodigi_order_id"),
  status: varchar("status").notNull().default('creating'),
  stripePaymentMethodId: varchar("stripe_payment_method_id"),
  trackingNumber: varchar("tracking_number"),
  trackingUrl: varchar("tracking_url"),
  carrier: varchar("carrier"),
  carrierService: varchar("carrier_service"),
  shipmentStatus: varchar("shipment_status"),
  dispatchDate: timestamp("dispatch_date"),
  estimatedDelivery: timestamp("estimated_delivery"),
  webhookData: jsonb("webhook_data"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_print_orders_purchase").on(table.purchaseId),
  index("idx_print_orders_prodigi").on(table.prodigiOrderId),
  index("idx_print_orders_status_created").on(table.status, table.createdAt),
]);

export const insertPrintOrderSchema = createInsertSchema(printOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PrintOrder = typeof printOrders.$inferSelect;
export type InsertPrintOrder = z.infer<typeof insertPrintOrderSchema>;

// Order Notes - internal notes for customer support and troubleshooting
export const orderNotes = pgTable("order_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderReference: text("order_reference").notNull(), // Links to purchase.orderReference
  noteType: varchar("note_type").notNull().default('general'), // general, support, technical, refund
  content: text("content").notNull(),
  createdBy: varchar("created_by").references(() => adminUsers.id),
  isInternal: boolean("is_internal").notNull().default(true), // If false, customer can see it
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_order_notes_order_reference").on(table.orderReference),
  index("idx_order_notes_created_by").on(table.createdBy),
  index("idx_order_notes_created_at").on(table.createdAt),
]);

export const insertOrderNoteSchema = createInsertSchema(orderNotes).omit({
  id: true,
  createdAt: true,
});

export type OrderNote = typeof orderNotes.$inferSelect;
export type InsertOrderNote = z.infer<typeof insertOrderNoteSchema>;

// Order Status History - track all status changes for orders
export const orderStatusHistory = pgTable("order_status_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderReference: text("order_reference").notNull(), // Links to purchase.orderReference
  entityType: varchar("entity_type").notNull(), // 'purchase' or 'print_order'
  entityId: varchar("entity_id").notNull(), // ID of the purchase or print_order
  previousStatus: varchar("previous_status"),
  newStatus: varchar("new_status").notNull(),
  changedBy: varchar("changed_by"), // Admin user ID if manual, null if automatic
  changeReason: text("change_reason"), // Why status changed
  metadata: jsonb("metadata"), // Additional context (error details, webhook data, etc.)
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_order_status_history_order_reference").on(table.orderReference),
  index("idx_order_status_history_entity").on(table.entityType, table.entityId),
  index("idx_order_status_history_created_at").on(table.createdAt),
]);

export const insertOrderStatusHistorySchema = createInsertSchema(orderStatusHistory).omit({
  id: true,
  createdAt: true,
});

export type OrderStatusHistory = typeof orderStatusHistory.$inferSelect;
export type InsertOrderStatusHistory = z.infer<typeof insertOrderStatusHistorySchema>;
