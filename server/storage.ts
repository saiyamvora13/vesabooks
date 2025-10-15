import { type Storybook, type InsertStorybook, type StoryGenerationProgress, storybooks, users, type User, type UpsertUser, type Purchase, type InsertPurchase, purchases, passwordResetTokens, type PasswordResetToken, type AdminUser, type InsertAdminUser, adminUsers, type SiteSetting, siteSettings, type HeroStorybookSlot, type InsertHeroStorybookSlot, heroStorybookSlots, type FeaturedStorybook, type InsertFeaturedStorybook, featuredStorybooks, type AdminAuditLog, type InsertAdminAuditLog, adminAuditLogs, type SamplePrompt, type InsertSamplePrompt, samplePrompts, type AnalyticsEvent, type InsertAnalyticsEvent, analyticsEvents, type StoryRating, type InsertStoryRating, storyRatings, type AudioSettings, audioSettings } from "@shared/schema";
import { db } from "./db";
import { eq, desc, count, countDistinct, isNull, and, lt, sql } from "drizzle-orm";
import { normalizeEmail } from "./auth";

export interface IStorage {
  // Replit Auth: User operations (mandatory)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  getUserByFacebookId(facebookId: string): Promise<User | undefined>;
  getUserByAppleId(appleId: string): Promise<User | undefined>;
  createUser(userData: UpsertUser): Promise<User>;
  
  // Storybook operations
  createStorybook(storybook: InsertStorybook): Promise<Storybook>;
  getStorybook(id: string): Promise<Storybook | undefined>;
  getStorybookByShareUrl(shareUrl: string): Promise<Storybook | undefined>;
  getUserStorybooks(userId: string): Promise<Storybook[]>;
  getAllStorybooks(): Promise<Storybook[]>;
  getExampleStorybooks(limit: number): Promise<Storybook[]>;
  updateStorybookShareUrl(id: string, shareUrl: string): Promise<void>;
  updateStorybookImages(id: string, coverImageUrl: string, pages: Storybook['pages']): Promise<void>;
  updatePage(storybookId: string, pageNumber: number, pageData: { text: string; imageUrl: string; imagePrompt: string }): Promise<void>;
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
  
  // Password reset operations
  createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | null>;
  deletePasswordResetToken(token: string): Promise<void>;
  deleteExpiredPasswordResetTokens(): Promise<void>;
  updateUserPassword(userId: string, hashedPassword: string): Promise<void>;
  
  // Admin user operations
  getAdminUser(id: string): Promise<AdminUser | undefined>;
  getAdminUserByEmail(email: string): Promise<AdminUser | undefined>;
  createAdminUser(userData: InsertAdminUser): Promise<AdminUser>;
  
  // Settings operations
  getSetting(key: string): Promise<SiteSetting | undefined>;
  updateSetting(key: string, value: string, updatedBy: string): Promise<void>;
  getAllSettings(): Promise<SiteSetting[]>;
  
  // Hero slots operations
  getHeroSlots(): Promise<HeroStorybookSlot[]>;
  updateHeroSlot(slotNumber: number, data: Partial<InsertHeroStorybookSlot>): Promise<void>;
  
  // Featured storybooks operations
  getFeaturedStorybooks(): Promise<FeaturedStorybook[]>;
  addFeaturedStorybook(storybookId: string, rank: number, updatedBy: string): Promise<FeaturedStorybook>;
  removeFeaturedStorybook(id: string): Promise<void>;
  updateFeaturedRank(id: string, rank: number): Promise<void>;
  
  // Audit logging
  createAuditLog(log: InsertAdminAuditLog): Promise<void>;
  getAuditLogs(adminId?: string, limit?: number): Promise<AdminAuditLog[]>;
  
  // Sample prompts operations
  getAllSamplePrompts(): Promise<SamplePrompt[]>;
  getActiveSamplePrompts(): Promise<SamplePrompt[]>;
  getSamplePrompt(id: string): Promise<SamplePrompt | undefined>;
  createSamplePrompt(data: InsertSamplePrompt): Promise<SamplePrompt>;
  updateSamplePrompt(id: string, data: Partial<InsertSamplePrompt>): Promise<SamplePrompt>;
  deleteSamplePrompt(id: string): Promise<void>;
  
  // Analytics operations
  trackEvent(event: InsertAnalyticsEvent): Promise<void>;
  getEventsByType(eventType: string, limit?: number): Promise<AnalyticsEvent[]>;
  getEventsByUser(userId: string, limit?: number): Promise<AnalyticsEvent[]>;
  getCompletionRate(): Promise<number>;
  getPopularPrompts(limit: number): Promise<Array<{ prompt: string; count: number }>>;
  
  // Rating operations
  createRating(rating: InsertStoryRating): Promise<StoryRating>;
  updateRating(id: string, rating: number, feedback?: string): Promise<void>;
  getRating(storybookId: string, userId: string): Promise<StoryRating | null>;
  getStorybookRatings(storybookId: string): Promise<StoryRating[]>;
  getAverageRating(storybookId: string): Promise<number | null>;
  
  // Social features
  togglePublicStatus(storybookId: string, userId: string): Promise<boolean>;
  incrementShareCount(storybookId: string): Promise<void>;
  incrementViewCount(storybookId: string): Promise<void>;
  getPublicStorybooks(limit: number, offset: number): Promise<Storybook[]>;
  getPublicStorybookCount(): Promise<number>;
  
  // Audio settings
  getAudioSettings(storybookId: string): Promise<AudioSettings | null>;
  updateAudioSettings(storybookId: string, settings: Partial<AudioSettings>): Promise<AudioSettings>;
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
    const normalizedUserData = {
      ...userData,
      email: userData.email ? normalizeEmail(userData.email) : userData.email,
    };

    try {
      // Try to insert or update based on ID (primary key)
      const [user] = await db
        .insert(users)
        .values(normalizedUserData)
        .onConflictDoUpdate({
          target: users.id,
          set: {
            email: normalizedUserData.email,
            firstName: normalizedUserData.firstName,
            lastName: normalizedUserData.lastName,
            profileImageUrl: normalizedUserData.profileImageUrl,
            updatedAt: new Date(),
          },
        })
        .returning();
      
      return user;
    } catch (error: any) {
      // Handle email conflict (different ID but same email)
      // Check for both old constraint name and new case-insensitive constraint name
      if (error.message?.includes('users_email_unique') || error.message?.includes('users_email_lower_unique')) {
        // Email already exists with different ID - update that user's profile
        // This preserves existing storybooks and foreign key relationships
        const [user] = await db
          .update(users)
          .set({
            firstName: normalizedUserData.firstName,
            lastName: normalizedUserData.lastName,
            profileImageUrl: normalizedUserData.profileImageUrl,
            updatedAt: new Date(),
          })
          .where(eq(users.email, normalizedUserData.email!))
          .returning();
        
        return user;
      }
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const normalizedEmail = normalizeEmail(email);
    const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail));
    return user || undefined;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user || undefined;
  }

  async getUserByFacebookId(facebookId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.facebookId, facebookId));
    return user || undefined;
  }

  async getUserByAppleId(appleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.appleId, appleId));
    return user || undefined;
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const normalizedUserData = {
      ...userData,
      email: userData.email ? normalizeEmail(userData.email) : userData.email,
    };

    const [user] = await db
      .insert(users)
      .values(normalizedUserData)
      .returning();
    return user;
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

  async getExampleStorybooks(limit: number): Promise<Storybook[]> {
    const examples = await db
      .select()
      .from(storybooks)
      .where(isNull(storybooks.deletedAt))
      .orderBy(desc(storybooks.createdAt))
      .limit(limit);
    return examples;
  }

  async updateStorybookImages(id: string, coverImageUrl: string, pages: Storybook['pages']): Promise<void> {
    await db
      .update(storybooks)
      .set({ coverImageUrl, pages })
      .where(eq(storybooks.id, id));
  }

  async updatePage(storybookId: string, pageNumber: number, pageData: { text: string; imageUrl: string; imagePrompt: string }): Promise<void> {
    const storybook = await this.getStorybook(storybookId);
    if (!storybook) {
      throw new Error('Storybook not found');
    }

    const updatedPages = storybook.pages.map(page => 
      page.pageNumber === pageNumber 
        ? { ...page, ...pageData }
        : page
    );

    await db
      .update(storybooks)
      .set({ pages: updatedPages })
      .where(eq(storybooks.id, storybookId));
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

  // Password reset operations
  async createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken> {
    const [resetToken] = await db
      .insert(passwordResetTokens)
      .values({
        userId,
        token,
        expiresAt,
      })
      .returning();
    return resetToken;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | null> {
    const now = new Date();
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token)
        )
      );
    
    // Check if token exists and is not expired
    if (!resetToken || resetToken.expiresAt < now) {
      return null;
    }
    
    return resetToken;
  }

  async deletePasswordResetToken(token: string): Promise<void> {
    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
  }

  async deleteExpiredPasswordResetTokens(): Promise<void> {
    const now = new Date();
    const expiredTokens = await db
      .select()
      .from(passwordResetTokens)
      .where(lt(passwordResetTokens.expiresAt, now));
    
    if (expiredTokens.length > 0) {
      await db
        .delete(passwordResetTokens)
        .where(lt(passwordResetTokens.expiresAt, now));
    }
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
    await db
      .update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  // Admin user operations
  async getAdminUser(id: string): Promise<AdminUser | undefined> {
    const [admin] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.id, id));
    return admin || undefined;
  }

  async getAdminUserByEmail(email: string): Promise<AdminUser | undefined> {
    const [admin] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, email.toLowerCase().trim()));
    return admin || undefined;
  }

  async createAdminUser(userData: InsertAdminUser): Promise<AdminUser> {
    const [admin] = await db
      .insert(adminUsers)
      .values(userData)
      .returning();
    return admin;
  }

  // Settings operations
  async getSetting(key: string): Promise<SiteSetting | undefined> {
    const [setting] = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.key, key));
    return setting || undefined;
  }

  async updateSetting(key: string, value: string, updatedBy: string): Promise<void> {
    await db
      .update(siteSettings)
      .set({ 
        value, 
        updatedBy, 
        updatedAt: new Date() 
      })
      .where(eq(siteSettings.key, key));
  }

  async getAllSettings(): Promise<SiteSetting[]> {
    const settings = await db
      .select()
      .from(siteSettings);
    return settings;
  }

  // Hero slots operations
  async getHeroSlots(): Promise<HeroStorybookSlot[]> {
    const slots = await db
      .select()
      .from(heroStorybookSlots)
      .orderBy(heroStorybookSlots.slotNumber);
    return slots;
  }

  async updateHeroSlot(slotNumber: number, data: Partial<InsertHeroStorybookSlot>): Promise<void> {
    await db
      .update(heroStorybookSlots)
      .set({ 
        ...data, 
        updatedAt: new Date() 
      })
      .where(eq(heroStorybookSlots.slotNumber, slotNumber.toString()));
  }

  // Featured storybooks operations
  async getFeaturedStorybooks(): Promise<FeaturedStorybook[]> {
    const featured = await db
      .select()
      .from(featuredStorybooks)
      .orderBy(featuredStorybooks.rank);
    return featured;
  }

  async addFeaturedStorybook(storybookId: string, rank: number, updatedBy: string): Promise<FeaturedStorybook> {
    const [featured] = await db
      .insert(featuredStorybooks)
      .values({
        storybookId,
        rank: rank.toString(),
        updatedBy,
      })
      .returning();
    return featured;
  }

  async removeFeaturedStorybook(id: string): Promise<void> {
    await db
      .delete(featuredStorybooks)
      .where(eq(featuredStorybooks.id, id));
  }

  async updateFeaturedRank(id: string, rank: number): Promise<void> {
    await db
      .update(featuredStorybooks)
      .set({ 
        rank: rank.toString(), 
        updatedAt: new Date() 
      })
      .where(eq(featuredStorybooks.id, id));
  }

  // Audit logging
  async createAuditLog(log: InsertAdminAuditLog): Promise<void> {
    await db
      .insert(adminAuditLogs)
      .values(log);
  }

  async getAuditLogs(adminId?: string, limit: number = 100): Promise<AdminAuditLog[]> {
    if (adminId) {
      const logs = await db
        .select()
        .from(adminAuditLogs)
        .where(eq(adminAuditLogs.adminId, adminId))
        .orderBy(desc(adminAuditLogs.createdAt))
        .limit(limit);
      return logs;
    } else {
      const logs = await db
        .select()
        .from(adminAuditLogs)
        .orderBy(desc(adminAuditLogs.createdAt))
        .limit(limit);
      return logs;
    }
  }

  // Sample prompts operations
  async getAllSamplePrompts(): Promise<SamplePrompt[]> {
    const prompts = await db
      .select()
      .from(samplePrompts)
      .orderBy(samplePrompts.displayOrder);
    return prompts;
  }

  async getActiveSamplePrompts(): Promise<SamplePrompt[]> {
    const prompts = await db
      .select()
      .from(samplePrompts)
      .where(eq(samplePrompts.isActive, true))
      .orderBy(samplePrompts.displayOrder);
    return prompts;
  }

  async getSamplePrompt(id: string): Promise<SamplePrompt | undefined> {
    const [prompt] = await db
      .select()
      .from(samplePrompts)
      .where(eq(samplePrompts.id, id));
    return prompt || undefined;
  }

  async createSamplePrompt(data: InsertSamplePrompt): Promise<SamplePrompt> {
    const [prompt] = await db
      .insert(samplePrompts)
      .values(data)
      .returning();
    return prompt;
  }

  async updateSamplePrompt(id: string, data: Partial<InsertSamplePrompt>): Promise<SamplePrompt> {
    const [prompt] = await db
      .update(samplePrompts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(samplePrompts.id, id))
      .returning();
    return prompt;
  }

  async deleteSamplePrompt(id: string): Promise<void> {
    await db
      .delete(samplePrompts)
      .where(eq(samplePrompts.id, id));
  }

  // Analytics operations
  async trackEvent(event: InsertAnalyticsEvent): Promise<void> {
    try {
      await db
        .insert(analyticsEvents)
        .values(event);
    } catch (error) {
      console.error('Error tracking analytics event:', error);
    }
  }

  async getEventsByType(eventType: string, limit: number = 100): Promise<AnalyticsEvent[]> {
    const events = await db
      .select()
      .from(analyticsEvents)
      .where(eq(analyticsEvents.eventType, eventType))
      .orderBy(desc(analyticsEvents.createdAt))
      .limit(limit);
    return events;
  }

  async getEventsByUser(userId: string, limit: number = 100): Promise<AnalyticsEvent[]> {
    const events = await db
      .select()
      .from(analyticsEvents)
      .where(eq(analyticsEvents.userId, userId))
      .orderBy(desc(analyticsEvents.createdAt))
      .limit(limit);
    return events;
  }

  async getCompletionRate(): Promise<number> {
    const [startedResult] = await db
      .select({ count: count() })
      .from(analyticsEvents)
      .where(eq(analyticsEvents.eventType, 'story_started'));
    
    const [completedResult] = await db
      .select({ count: count() })
      .from(analyticsEvents)
      .where(eq(analyticsEvents.eventType, 'story_completed'));
    
    const started = startedResult?.count || 0;
    const completed = completedResult?.count || 0;
    
    if (started === 0) return 0;
    return (completed / started) * 100;
  }

  async getPopularPrompts(limit: number): Promise<Array<{ prompt: string; count: number }>> {
    const results = await db
      .select({
        prompt: sql<string>`event_data->>'prompt'`,
        count: count(),
      })
      .from(analyticsEvents)
      .where(eq(analyticsEvents.eventType, 'story_started'))
      .groupBy(sql`event_data->>'prompt'`)
      .orderBy(desc(count()))
      .limit(limit);
    
    return results.map(r => ({
      prompt: r.prompt,
      count: Number(r.count),
    }));
  }

  // Rating operations
  async createRating(rating: InsertStoryRating): Promise<StoryRating> {
    const [newRating] = await db
      .insert(storyRatings)
      .values(rating)
      .onConflictDoUpdate({
        target: [storyRatings.storybookId, storyRatings.userId],
        set: {
          rating: rating.rating,
          feedback: rating.feedback,
          updatedAt: new Date(),
        },
      })
      .returning();
    return newRating;
  }

  async updateRating(id: string, rating: number, feedback?: string): Promise<void> {
    await db
      .update(storyRatings)
      .set({
        rating: rating.toString(),
        feedback,
        updatedAt: new Date(),
      })
      .where(eq(storyRatings.id, id));
  }

  async getRating(storybookId: string, userId: string): Promise<StoryRating | null> {
    const [rating] = await db
      .select()
      .from(storyRatings)
      .where(
        and(
          eq(storyRatings.storybookId, storybookId),
          eq(storyRatings.userId, userId)
        )
      );
    return rating || null;
  }

  async getStorybookRatings(storybookId: string): Promise<StoryRating[]> {
    const ratings = await db
      .select()
      .from(storyRatings)
      .where(eq(storyRatings.storybookId, storybookId))
      .orderBy(desc(storyRatings.createdAt));
    return ratings;
  }

  async getAverageRating(storybookId: string): Promise<number | null> {
    const [result] = await db
      .select({
        avg: sql<string>`AVG(CAST(${storyRatings.rating} AS DECIMAL))`,
      })
      .from(storyRatings)
      .where(eq(storyRatings.storybookId, storybookId));
    
    if (!result?.avg) return null;
    return parseFloat(result.avg);
  }

  // Social features
  async togglePublicStatus(storybookId: string, userId: string): Promise<boolean> {
    // Verify ownership
    const storybook = await this.getStorybook(storybookId);
    if (!storybook || storybook.userId !== userId) {
      throw new Error('Unauthorized');
    }

    const newStatus = !storybook.isPublic;
    await db
      .update(storybooks)
      .set({ isPublic: newStatus })
      .where(eq(storybooks.id, storybookId));
    
    return newStatus;
  }

  async incrementShareCount(storybookId: string): Promise<void> {
    await db
      .update(storybooks)
      .set({ shareCount: sql`CAST(${storybooks.shareCount} AS INTEGER) + 1` })
      .where(eq(storybooks.id, storybookId));
  }

  async incrementViewCount(storybookId: string): Promise<void> {
    await db
      .update(storybooks)
      .set({ viewCount: sql`CAST(${storybooks.viewCount} AS INTEGER) + 1` })
      .where(eq(storybooks.id, storybookId));
  }

  async getPublicStorybooks(limit: number, offset: number): Promise<Storybook[]> {
    const publicStorybooks = await db
      .select()
      .from(storybooks)
      .where(and(eq(storybooks.isPublic, true), isNull(storybooks.deletedAt)))
      .orderBy(desc(storybooks.createdAt))
      .limit(limit)
      .offset(offset);
    return publicStorybooks;
  }

  async getPublicStorybookCount(): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(storybooks)
      .where(and(eq(storybooks.isPublic, true), isNull(storybooks.deletedAt)));
    return result?.count || 0;
  }

  // Audio settings
  async getAudioSettings(storybookId: string): Promise<AudioSettings | null> {
    const [settings] = await db
      .select()
      .from(audioSettings)
      .where(eq(audioSettings.storybookId, storybookId));
    return settings || null;
  }

  async updateAudioSettings(storybookId: string, settings: Partial<AudioSettings>): Promise<AudioSettings> {
    // Try to find existing settings
    const existing = await this.getAudioSettings(storybookId);
    
    if (existing) {
      // Update existing settings
      const [updated] = await db
        .update(audioSettings)
        .set({
          ...settings,
          updatedAt: new Date(),
        })
        .where(eq(audioSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new settings with storybook ID
      const [newSettings] = await db
        .insert(audioSettings)
        .values({
          storybookId,
          musicEnabled: settings.musicEnabled ?? true,
          soundEffectsEnabled: settings.soundEffectsEnabled ?? true,
          musicVolume: settings.musicVolume ?? '70',
          effectsVolume: settings.effectsVolume ?? '80',
        })
        .returning();
      return newSettings;
    }
  }
}

export const storage = new DatabaseStorage();
