import { type Storybook, type InsertStorybook, type StoryGenerationProgress, storybooks, users, type User, type UpsertUser, type Purchase, type InsertPurchase, purchases, type CartItem, type InsertCartItem, cartItems, passwordResetTokens, type PasswordResetToken, type AdminUser, type InsertAdminUser, adminUsers, type SiteSetting, siteSettings, type HeroStorybookSlot, type InsertHeroStorybookSlot, heroStorybookSlots, type FeaturedStorybook, type InsertFeaturedStorybook, featuredStorybooks, type AdminAuditLog, type InsertAdminAuditLog, adminAuditLogs, type SamplePrompt, type InsertSamplePrompt, samplePrompts, type AnalyticsEvent, type InsertAnalyticsEvent, analyticsEvents, type StoryRating, type InsertStoryRating, storyRatings, type AudioSettings, audioSettings, type IpRateLimit, type InsertIpRateLimit, ipRateLimits, type DownloadVerification, type InsertDownloadVerification, downloadVerifications, type SavedStorybook, type InsertSavedStorybook, savedStorybooks, type PrintOrder, type InsertPrintOrder, printOrders, type UserShippingAddress, type InsertUserShippingAddress, userShippingAddresses, type UserPaymentMethod, type InsertUserPaymentMethod, userPaymentMethods, type OrderNote, type InsertOrderNote, orderNotes, type OrderStatusHistory, type InsertOrderStatusHistory, orderStatusHistory } from "@shared/schema";
import { db } from "./db";
import { eq, desc, count, countDistinct, isNull, and, lt, gt, sql, inArray, asc, ilike, or, gte, lte } from "drizzle-orm";
import { normalizeEmail } from "./auth";

export interface OrderSearchFilters {
  orderReference?: string;
  email?: string;
  storybookTitle?: string;
  stripePaymentIntentId?: string;
  prodigiOrderId?: string;
  status?: string;
  productType?: 'digital' | 'print';
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export interface OrderSearchResult {
  id: string;
  orderReference: string | null;
  userId: string | null;
  storybookId: string;
  type: string;
  price: string;
  status: string;
  bookSize: string | null;
  stripePaymentIntentId: string;
  createdAt: Date | null;
  user: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
  storybook: {
    id: string;
    title: string;
    coverImageUrl: string | null;
  } | null;
  printOrder: {
    id: string;
    prodigiOrderId: string | null;
    status: string;
    trackingNumber: string | null;
  } | null;
}

export interface OrderDetails {
  purchases: Array<Purchase & {
    user: User | null;
    storybook: Storybook | null;
    printOrder: PrintOrder | null;
  }>;
  customerStats: {
    totalOrders: number;
    totalSpent: number;
  } | null;
  shippingAddress: {
    fullName: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    stateProvince: string;
    postalCode: string;
    country: string;
    phoneNumber: string | null;
  } | null;
  paymentMethod: {
    cardBrand: string;
    cardLast4: string;
    cardExpMonth: number;
    cardExpYear: number;
  } | null;
  notes: OrderNote[];
  statusHistory: OrderStatusHistory[];
}

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
  getStorybooksBatch(ids: string[]): Promise<Storybook[]>;
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
  checkStorybookPurchasesBatch(userId: string, storybookIds: string[], type: 'digital' | 'print'): Promise<Record<string, boolean>>;
  updatePurchaseStatus(id: string, status: string, stripePaymentIntentId?: string): Promise<Purchase>;
  
  // Shopping Cart operations
  addToCart(userId: string, storybookId: string, productType: 'digital' | 'print', bookSize?: string, quantity?: number): Promise<CartItem>;
  getCartItems(userId: string): Promise<CartItem[]>;
  updateCartItemQuantity(id: string, userId: string, quantity: number): Promise<CartItem | null>;
  updateCartItem(id: string, userId: string, updates: { productType?: 'digital' | 'print'; bookSize?: string | null; quantity?: number }): Promise<CartItem | null>;
  removeFromCart(id: string, userId: string): Promise<boolean>;
  clearCart(userId: string): Promise<void>;
  getCartItem(userId: string, storybookId: string, productType: string, bookSize?: string | null): Promise<CartItem | null>;
  
  // Password reset operations
  createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | null>;
  deletePasswordResetToken(token: string): Promise<void>;
  deleteExpiredPasswordResetTokens(): Promise<void>;
  updateUserPassword(userId: string, hashedPassword: string): Promise<void>;
  
  // Admin user operations
  getAdminUser(id: string): Promise<AdminUser | undefined>;
  getAdminUserByEmail(email: string): Promise<AdminUser | undefined>;
  getAllAdminUsers(): Promise<AdminUser[]>;
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
  
  // IP Rate Limiting
  checkIpRateLimit(ipAddress: string): Promise<{ allowed: boolean; remaining: number }>;
  incrementIpStoryCount(ipAddress: string): Promise<void>;
  getOrCreateIpRateLimit(ipAddress: string): Promise<IpRateLimit>;
  
  // Email Verification for Downloads
  createDownloadVerification(storybookId: string, email: string): Promise<{ code: string; expiresAt: Date }>;
  verifyDownloadCode(storybookId: string, email: string, code: string): Promise<boolean>;
  isDownloadVerified(storybookId: string, email: string): Promise<boolean>;
  
  // Saved Storybooks operations
  saveStorybook(userId: string, storybookId: string): Promise<SavedStorybook>;
  unsaveStorybook(userId: string, storybookId: string): Promise<void>;
  getSavedStorybooks(userId: string): Promise<Storybook[]>;
  isSaved(userId: string, storybookId: string): Promise<boolean>;
  claimStorybook(storybookId: string, userId: string): Promise<boolean>;
  
  // Print Order operations
  createPrintOrder(printOrder: InsertPrintOrder): Promise<PrintOrder>;
  getPrintOrder(id: string): Promise<PrintOrder | null>;
  getPrintOrderByPurchaseId(purchaseId: string): Promise<PrintOrder | null>;
  getPrintOrderByProdigiId(prodigiOrderId: string): Promise<PrintOrder | null>;
  getPrintOrdersByProdigiId(prodigiOrderId: string): Promise<PrintOrder[]>;
  getPrintOrderWithDetails(printOrderId: string): Promise<{ printOrder: PrintOrder; purchase: Purchase; storybook: Storybook; user: User } | null>;
  updatePrintOrder(id: string, data: Partial<PrintOrder>): Promise<PrintOrder>;
  updatePrintOrderStatus(printOrderId: string, updates: Partial<PrintOrder>): Promise<PrintOrder>;
  atomicUpdatePrintOrderStatus(printOrderId: string, fromStatus: string, toStatus: string): Promise<boolean>;
  getAllPrintOrders(limit?: number): Promise<PrintOrder[]>;
  getUserPrintOrders(userId: string): Promise<Array<PrintOrder & { purchase: Purchase; storybook: Storybook }>>;
  
  // User Shipping Address operations
  createShippingAddress(userId: string, address: InsertUserShippingAddress): Promise<UserShippingAddress>;
  getUserShippingAddresses(userId: string): Promise<UserShippingAddress[]>;
  getShippingAddress(id: string, userId: string): Promise<UserShippingAddress | null>;
  updateShippingAddress(id: string, userId: string, updates: Partial<InsertUserShippingAddress>): Promise<UserShippingAddress>;
  deleteShippingAddress(id: string, userId: string): Promise<boolean>;
  setDefaultShippingAddress(id: string, userId: string): Promise<void>;
  
  // User Payment Method operations
  createPaymentMethod(userId: string, paymentMethod: InsertUserPaymentMethod): Promise<UserPaymentMethod>;
  getUserPaymentMethods(userId: string): Promise<UserPaymentMethod[]>;
  getPaymentMethod(id: string, userId: string): Promise<UserPaymentMethod | null>;
  deletePaymentMethod(id: string, userId: string): Promise<boolean>;
  setDefaultPaymentMethod(id: string, userId: string): Promise<void>;
  
  // Order Management operations (Admin)
  searchOrders(filters: OrderSearchFilters): Promise<{ orders: OrderSearchResult[]; total: number }>;
  getOrderDetails(orderReference: string): Promise<OrderDetails | null>;
  addOrderNote(data: InsertOrderNote): Promise<OrderNote>;
  getOrderNotes(orderReference: string): Promise<OrderNote[]>;
  addOrderStatusHistory(data: InsertOrderStatusHistory): Promise<OrderStatusHistory>;
  getOrderStatusHistory(orderReference: string): Promise<OrderStatusHistory[]>;
  getUserOrderHistory(userId: string): Promise<Purchase[]>;
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

  async getStorybooksBatch(ids: string[]): Promise<Storybook[]> {
    if (ids.length === 0) return [];
    const storybooksResult = await db
      .select()
      .from(storybooks)
      .where(and(inArray(storybooks.id, ids), isNull(storybooks.deletedAt)));
    return storybooksResult;
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

  async checkStorybookPurchasesBatch(userId: string, storybookIds: string[], type: 'digital' | 'print'): Promise<Record<string, boolean>> {
    if (storybookIds.length === 0) {
      return {};
    }

    // Query all purchases for this user and type that match any of the storybook IDs
    const userPurchases = await db
      .select()
      .from(purchases)
      .where(
        and(
          eq(purchases.userId, userId),
          eq(purchases.type, type),
          inArray(purchases.storybookId, storybookIds)
        )
      );

    // Create a map of storybookId -> true for owned books
    const ownedMap: Record<string, boolean> = {};
    
    // Initialize all as false
    storybookIds.forEach(id => {
      ownedMap[id] = false;
    });
    
    // Mark owned ones as true
    userPurchases.forEach(purchase => {
      ownedMap[purchase.storybookId] = true;
    });

    return ownedMap;
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

  // Shopping Cart operations
  async addToCart(userId: string, storybookId: string, productType: 'digital' | 'print', bookSize?: string, quantity: number = 1): Promise<CartItem> {
    // Check if item already exists
    const existing = await this.getCartItem(userId, storybookId, productType, bookSize);
    
    if (existing) {
      // Update quantity instead of creating duplicate
      const updated = await this.updateCartItemQuantity(existing.id, userId, existing.quantity + quantity);
      if (!updated) {
        throw new Error('Failed to update cart item quantity');
      }
      return updated;
    }
    
    // Create new cart item
    const [cartItem] = await db
      .insert(cartItems)
      .values({
        userId,
        storybookId,
        productType,
        bookSize: bookSize || null,
        quantity,
      })
      .returning();
    return cartItem;
  }

  async getCartItems(userId: string): Promise<CartItem[]> {
    return await db
      .select()
      .from(cartItems)
      .where(eq(cartItems.userId, userId))
      .orderBy(desc(cartItems.createdAt));
  }

  async updateCartItemQuantity(id: string, userId: string, quantity: number): Promise<CartItem | null> {
    const [updated] = await db
      .update(cartItems)
      .set({ quantity })
      .where(and(eq(cartItems.id, id), eq(cartItems.userId, userId)))
      .returning();
    return updated || null;
  }

  async updateCartItem(id: string, userId: string, updates: { productType?: 'digital' | 'print'; bookSize?: string | null; quantity?: number }): Promise<CartItem | null> {
    const updateData: any = {};
    if (updates.productType !== undefined) {
      updateData.productType = updates.productType;
    }
    if (updates.bookSize !== undefined) {
      updateData.bookSize = updates.bookSize;
    }
    if (updates.quantity !== undefined) {
      updateData.quantity = updates.quantity;
    }

    if (Object.keys(updateData).length === 0) {
      // No updates to apply
      const [item] = await db
        .select()
        .from(cartItems)
        .where(and(eq(cartItems.id, id), eq(cartItems.userId, userId)));
      return item || null;
    }

    const [updated] = await db
      .update(cartItems)
      .set(updateData)
      .where(and(eq(cartItems.id, id), eq(cartItems.userId, userId)))
      .returning();
    return updated || null;
  }

  async removeFromCart(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(cartItems)
      .where(and(eq(cartItems.id, id), eq(cartItems.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async clearCart(userId: string): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.userId, userId));
  }

  async getCartItem(userId: string, storybookId: string, productType: string, bookSize?: string | null): Promise<CartItem | null> {
    const conditions = [
      eq(cartItems.userId, userId),
      eq(cartItems.storybookId, storybookId),
      eq(cartItems.productType, productType),
    ];
    
    // Handle bookSize - null values need special handling
    if (bookSize === null || bookSize === undefined) {
      conditions.push(isNull(cartItems.bookSize));
    } else {
      conditions.push(eq(cartItems.bookSize, bookSize));
    }
    
    const [item] = await db
      .select()
      .from(cartItems)
      .where(and(...conditions));
    
    return item || null;
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

  async getAllAdminUsers(): Promise<AdminUser[]> {
    const admins = await db.select().from(adminUsers);
    return admins;
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
      .insert(siteSettings)
      .values({
        key,
        value,
        updatedBy,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: {
          value,
          updatedBy,
          updatedAt: new Date()
        }
      });
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

  // IP Rate Limiting operations
  async getOrCreateIpRateLimit(ipAddress: string): Promise<IpRateLimit> {
    const [existing] = await db
      .select()
      .from(ipRateLimits)
      .where(eq(ipRateLimits.ipAddress, ipAddress));
    
    if (existing) {
      const now = new Date();
      if (existing.resetAt <= now) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const [reset] = await db
          .update(ipRateLimits)
          .set({
            storyCount: '0',
            resetAt: tomorrow,
            updatedAt: new Date(),
          })
          .where(eq(ipRateLimits.ipAddress, ipAddress))
          .returning();
        return reset;
      }
      return existing;
    }
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const [newLimit] = await db
      .insert(ipRateLimits)
      .values({
        ipAddress,
        storyCount: '0',
        resetAt: tomorrow,
      })
      .returning();
    return newLimit;
  }

  async checkIpRateLimit(ipAddress: string): Promise<{ allowed: boolean; remaining: number }> {
    const limit = await this.getOrCreateIpRateLimit(ipAddress);
    const currentCount = parseInt(limit.storyCount);
    const maxCount = 3;
    const remaining = Math.max(0, maxCount - currentCount);
    
    return {
      allowed: currentCount < maxCount,
      remaining,
    };
  }

  async incrementIpStoryCount(ipAddress: string): Promise<void> {
    await this.getOrCreateIpRateLimit(ipAddress);
    
    await db
      .update(ipRateLimits)
      .set({
        storyCount: sql`CAST(${ipRateLimits.storyCount} AS INTEGER) + 1`,
        updatedAt: new Date(),
      })
      .where(eq(ipRateLimits.ipAddress, ipAddress));
  }

  // Email Verification operations
  async createDownloadVerification(storybookId: string, email: string): Promise<{ code: string; expiresAt: Date }> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);
    
    await db
      .insert(downloadVerifications)
      .values({
        storybookId,
        email: normalizeEmail(email),
        verificationCode: code,
        expiresAt,
      });
    
    return { code, expiresAt };
  }

  async verifyDownloadCode(storybookId: string, email: string, code: string): Promise<boolean> {
    const normalizedEmail = normalizeEmail(email);
    const now = new Date();
    
    const [verification] = await db
      .select()
      .from(downloadVerifications)
      .where(
        and(
          eq(downloadVerifications.storybookId, storybookId),
          eq(downloadVerifications.email, normalizedEmail),
          eq(downloadVerifications.verificationCode, code),
          gt(downloadVerifications.expiresAt, now),
          isNull(downloadVerifications.verifiedAt)
        )
      )
      .orderBy(desc(downloadVerifications.createdAt))
      .limit(1);
    
    if (!verification) {
      return false;
    }
    
    await db
      .update(downloadVerifications)
      .set({ verifiedAt: new Date() })
      .where(eq(downloadVerifications.id, verification.id));
    
    return true;
  }

  async isDownloadVerified(storybookId: string, email: string): Promise<boolean> {
    const normalizedEmail = normalizeEmail(email);
    
    const verifications = await db
      .select()
      .from(downloadVerifications)
      .where(
        and(
          eq(downloadVerifications.storybookId, storybookId),
          eq(downloadVerifications.email, normalizedEmail)
        )
      )
      .orderBy(desc(downloadVerifications.createdAt));
    
    const verified = verifications.find(v => v.verifiedAt !== null);
    return verified !== undefined;
  }

  // Saved Storybooks operations
  async saveStorybook(userId: string, storybookId: string): Promise<SavedStorybook> {
    const [saved] = await db
      .insert(savedStorybooks)
      .values({ userId, storybookId })
      .onConflictDoNothing()
      .returning();
    return saved;
  }

  async unsaveStorybook(userId: string, storybookId: string): Promise<void> {
    await db
      .delete(savedStorybooks)
      .where(
        and(
          eq(savedStorybooks.userId, userId),
          eq(savedStorybooks.storybookId, storybookId)
        )
      );
  }

  async getSavedStorybooks(userId: string): Promise<Storybook[]> {
    const saved = await db
      .select({
        storybook: storybooks
      })
      .from(savedStorybooks)
      .innerJoin(storybooks, eq(savedStorybooks.storybookId, storybooks.id))
      .where(
        and(
          eq(savedStorybooks.userId, userId),
          isNull(storybooks.deletedAt)
        )
      )
      .orderBy(desc(savedStorybooks.savedAt));
    
    return saved.map(s => s.storybook);
  }

  async isSaved(userId: string, storybookId: string): Promise<boolean> {
    const [saved] = await db
      .select()
      .from(savedStorybooks)
      .where(
        and(
          eq(savedStorybooks.userId, userId),
          eq(savedStorybooks.storybookId, storybookId)
        )
      )
      .limit(1);
    
    return saved !== undefined;
  }

  async claimStorybook(storybookId: string, userId: string): Promise<boolean> {
    const result = await db
      .update(storybooks)
      .set({ userId })
      .where(
        and(
          eq(storybooks.id, storybookId),
          isNull(storybooks.userId)
        )
      )
      .returning({ id: storybooks.id });
    
    return result.length > 0;
  }

  // Print Order operations
  async createPrintOrder(printOrder: InsertPrintOrder): Promise<PrintOrder> {
    const [newPrintOrder] = await db
      .insert(printOrders)
      .values(printOrder)
      .returning();
    return newPrintOrder;
  }

  async getPrintOrder(id: string): Promise<PrintOrder | null> {
    const [printOrder] = await db
      .select()
      .from(printOrders)
      .where(eq(printOrders.id, id));
    return printOrder || null;
  }

  async getPrintOrderByPurchaseId(purchaseId: string): Promise<PrintOrder | null> {
    const [printOrder] = await db
      .select()
      .from(printOrders)
      .where(eq(printOrders.purchaseId, purchaseId));
    return printOrder || null;
  }

  async getPrintOrderByProdigiId(prodigiOrderId: string): Promise<PrintOrder | null> {
    const [printOrder] = await db
      .select()
      .from(printOrders)
      .where(eq(printOrders.prodigiOrderId, prodigiOrderId));
    return printOrder || null;
  }

  async getPrintOrdersByProdigiId(prodigiOrderId: string): Promise<PrintOrder[]> {
    const orders = await db
      .select()
      .from(printOrders)
      .where(eq(printOrders.prodigiOrderId, prodigiOrderId));
    return orders;
  }

  async getPrintOrderWithDetails(printOrderId: string): Promise<{ printOrder: PrintOrder; purchase: Purchase; storybook: Storybook; user: User } | null> {
    const [result] = await db
      .select()
      .from(printOrders)
      .innerJoin(purchases, eq(printOrders.purchaseId, purchases.id))
      .innerJoin(storybooks, eq(purchases.storybookId, storybooks.id))
      .innerJoin(users, eq(purchases.userId, users.id))
      .where(eq(printOrders.id, printOrderId));

    if (!result) {
      return null;
    }

    return {
      printOrder: result.print_orders,
      purchase: result.purchases,
      storybook: result.storybooks,
      user: result.users,
    };
  }

  async updatePrintOrder(id: string, data: Partial<PrintOrder>): Promise<PrintOrder> {
    const [updatedPrintOrder] = await db
      .update(printOrders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(printOrders.id, id))
      .returning();
    return updatedPrintOrder;
  }

  async updatePrintOrderStatus(printOrderId: string, updates: Partial<PrintOrder>): Promise<PrintOrder> {
    const [updatedPrintOrder] = await db
      .update(printOrders)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(printOrders.id, printOrderId))
      .returning();
    return updatedPrintOrder;
  }

  // Atomic status update - prevents race conditions by only updating if current status matches
  // Returns true if update succeeded, false if status didn't match (another process already updated)
  async atomicUpdatePrintOrderStatus(printOrderId: string, fromStatus: string, toStatus: string): Promise<boolean> {
    const result = await db
      .update(printOrders)
      .set({ status: toStatus, updatedAt: new Date() })
      .where(and(
        eq(printOrders.id, printOrderId),
        eq(printOrders.status, fromStatus) // CRITICAL: Only update if current status matches
      ))
      .returning();
    
    // Return true if exactly one row was updated
    return result.length === 1;
  }

  async getAllPrintOrders(limit: number = 100): Promise<PrintOrder[]> {
    const orders = await db
      .select()
      .from(printOrders)
      .orderBy(desc(printOrders.createdAt))
      .limit(limit);
    return orders;
  }

  async getUserPrintOrders(userId: string): Promise<Array<PrintOrder & { purchase: Purchase; storybook: Storybook }>> {
    const orders = await db
      .select()
      .from(printOrders)
      .innerJoin(purchases, eq(printOrders.purchaseId, purchases.id))
      .innerJoin(storybooks, eq(purchases.storybookId, storybooks.id))
      .where(eq(purchases.userId, userId))
      .orderBy(desc(printOrders.createdAt));

    return orders.map(row => ({
      ...row.print_orders,
      purchase: row.purchases,
      storybook: row.storybooks,
    }));
  }

  // User Shipping Address operations
  async createShippingAddress(userId: string, address: InsertUserShippingAddress): Promise<UserShippingAddress> {
    const [newAddress] = await db
      .insert(userShippingAddresses)
      .values({ ...address, userId })
      .returning();
    return newAddress;
  }

  async getUserShippingAddresses(userId: string): Promise<UserShippingAddress[]> {
    const addresses = await db
      .select()
      .from(userShippingAddresses)
      .where(eq(userShippingAddresses.userId, userId))
      .orderBy(desc(userShippingAddresses.isDefault), desc(userShippingAddresses.createdAt));
    return addresses;
  }

  async getShippingAddress(id: string, userId: string): Promise<UserShippingAddress | null> {
    const [address] = await db
      .select()
      .from(userShippingAddresses)
      .where(and(
        eq(userShippingAddresses.id, id),
        eq(userShippingAddresses.userId, userId)
      ));
    return address || null;
  }

  async updateShippingAddress(id: string, userId: string, updates: Partial<InsertUserShippingAddress>): Promise<UserShippingAddress> {
    const [updatedAddress] = await db
      .update(userShippingAddresses)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(userShippingAddresses.id, id),
        eq(userShippingAddresses.userId, userId)
      ))
      .returning();
    return updatedAddress;
  }

  async deleteShippingAddress(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(userShippingAddresses)
      .where(and(
        eq(userShippingAddresses.id, id),
        eq(userShippingAddresses.userId, userId)
      ))
      .returning();
    return result.length > 0;
  }

  async setDefaultShippingAddress(id: string, userId: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(userShippingAddresses)
        .set({ isDefault: false })
        .where(eq(userShippingAddresses.userId, userId));
      
      await tx
        .update(userShippingAddresses)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(and(
          eq(userShippingAddresses.id, id),
          eq(userShippingAddresses.userId, userId)
        ));
    });
  }

  // User Payment Method operations
  async createPaymentMethod(userId: string, paymentMethod: InsertUserPaymentMethod): Promise<UserPaymentMethod> {
    const [newPaymentMethod] = await db
      .insert(userPaymentMethods)
      .values({ ...paymentMethod, userId })
      .returning();
    return newPaymentMethod;
  }

  async getUserPaymentMethods(userId: string): Promise<UserPaymentMethod[]> {
    const methods = await db
      .select()
      .from(userPaymentMethods)
      .where(eq(userPaymentMethods.userId, userId))
      .orderBy(desc(userPaymentMethods.isDefault), desc(userPaymentMethods.createdAt));
    return methods;
  }

  async getPaymentMethod(id: string, userId: string): Promise<UserPaymentMethod | null> {
    const [method] = await db
      .select()
      .from(userPaymentMethods)
      .where(and(
        eq(userPaymentMethods.id, id),
        eq(userPaymentMethods.userId, userId)
      ));
    return method || null;
  }

  async deletePaymentMethod(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(userPaymentMethods)
      .where(and(
        eq(userPaymentMethods.id, id),
        eq(userPaymentMethods.userId, userId)
      ))
      .returning();
    return result.length > 0;
  }

  async setDefaultPaymentMethod(id: string, userId: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(userPaymentMethods)
        .set({ isDefault: false })
        .where(eq(userPaymentMethods.userId, userId));
      
      await tx
        .update(userPaymentMethods)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(and(
          eq(userPaymentMethods.id, id),
          eq(userPaymentMethods.userId, userId)
        ));
    });
  }

  // Order Management operations (Admin)
  async searchOrders(filters: OrderSearchFilters): Promise<{ orders: OrderSearchResult[]; total: number }> {
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    // Build WHERE conditions
    const conditions = [];

    if (filters.orderReference) {
      conditions.push(ilike(purchases.orderReference, `%${filters.orderReference}%`));
    }

    if (filters.email) {
      conditions.push(ilike(users.email, `%${filters.email}%`));
    }

    if (filters.storybookTitle) {
      conditions.push(ilike(storybooks.title, `%${filters.storybookTitle}%`));
    }

    if (filters.stripePaymentIntentId) {
      conditions.push(ilike(purchases.stripePaymentIntentId, `%${filters.stripePaymentIntentId}%`));
    }

    if (filters.prodigiOrderId) {
      conditions.push(ilike(printOrders.prodigiOrderId, `%${filters.prodigiOrderId}%`));
    }

    if (filters.status) {
      conditions.push(eq(purchases.status, filters.status));
    }

    if (filters.productType) {
      conditions.push(eq(purchases.type, filters.productType));
    }

    if (filters.dateFrom) {
      conditions.push(gte(purchases.createdAt, filters.dateFrom));
    }

    if (filters.dateTo) {
      conditions.push(lte(purchases.createdAt, filters.dateTo));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countQuery = db
      .select({ count: count() })
      .from(purchases)
      .leftJoin(users, eq(purchases.userId, users.id))
      .leftJoin(storybooks, eq(purchases.storybookId, storybooks.id))
      .leftJoin(printOrders, eq(printOrders.purchaseId, purchases.id));

    if (whereClause) {
      countQuery.where(whereClause);
    }

    const [countResult] = await countQuery;
    const total = countResult?.count || 0;

    // Get paginated results with joins
    const query = db
      .select({
        purchase: purchases,
        user: users,
        storybook: storybooks,
        printOrder: printOrders,
      })
      .from(purchases)
      .leftJoin(users, eq(purchases.userId, users.id))
      .leftJoin(storybooks, eq(purchases.storybookId, storybooks.id))
      .leftJoin(printOrders, eq(printOrders.purchaseId, purchases.id))
      .orderBy(desc(purchases.createdAt))
      .limit(limit)
      .offset(offset);

    if (whereClause) {
      query.where(whereClause);
    }

    const results = await query;

    const orders: OrderSearchResult[] = results.map(row => ({
      id: row.purchase.id,
      orderReference: row.purchase.orderReference,
      userId: row.purchase.userId,
      storybookId: row.purchase.storybookId,
      type: row.purchase.type,
      price: row.purchase.price,
      status: row.purchase.status,
      bookSize: row.purchase.bookSize,
      stripePaymentIntentId: row.purchase.stripePaymentIntentId,
      createdAt: row.purchase.createdAt,
      user: row.user ? {
        id: row.user.id,
        email: row.user.email,
        firstName: row.user.firstName,
        lastName: row.user.lastName,
      } : null,
      storybook: row.storybook ? {
        id: row.storybook.id,
        title: row.storybook.title,
        coverImageUrl: row.storybook.coverImageUrl,
      } : null,
      printOrder: row.printOrder ? {
        id: row.printOrder.id,
        prodigiOrderId: row.printOrder.prodigiOrderId,
        status: row.printOrder.status,
        trackingNumber: row.printOrder.trackingNumber,
      } : null,
    }));

    return { orders, total };
  }

  async getOrderDetails(orderReference: string): Promise<OrderDetails | null> {
    // Fetch all purchases with this orderReference
    const purchasesData = await db
      .select({
        purchase: purchases,
        user: users,
        storybook: storybooks,
        printOrder: printOrders,
      })
      .from(purchases)
      .leftJoin(users, eq(purchases.userId, users.id))
      .leftJoin(storybooks, eq(purchases.storybookId, storybooks.id))
      .leftJoin(printOrders, eq(printOrders.purchaseId, purchases.id))
      .where(eq(purchases.orderReference, orderReference));

    if (purchasesData.length === 0) {
      return null;
    }

    // Get userId from first purchase
    const userId = purchasesData[0].purchase.userId;
    
    let customerStats = null;
    let shippingAddress = null;
    let paymentMethod = null;

    if (userId) {
      // Calculate customer statistics (exclude 'creating' status)
      const [statsResult] = await db
        .select({
          totalOrders: count(),
          totalSpent: sql<string>`COALESCE(SUM(CAST(${purchases.price} AS DECIMAL)), 0)`,
        })
        .from(purchases)
        .where(
          and(
            eq(purchases.userId, userId),
            sql`${purchases.status} != 'creating'`
          )
        );
      
      if (statsResult) {
        customerStats = {
          totalOrders: Number(statsResult.totalOrders),
          totalSpent: Number(statsResult.totalSpent),
        };
      }

      // Get shipping address - prioritize default address, fall back to most recent
      const [addressResult] = await db
        .select()
        .from(userShippingAddresses)
        .where(eq(userShippingAddresses.userId, userId))
        .orderBy(desc(userShippingAddresses.isDefault), desc(userShippingAddresses.createdAt))
        .limit(1);
      
      if (addressResult) {
        shippingAddress = {
          fullName: addressResult.fullName,
          addressLine1: addressResult.addressLine1,
          addressLine2: addressResult.addressLine2,
          city: addressResult.city,
          stateProvince: addressResult.stateProvince,
          postalCode: addressResult.postalCode,
          country: addressResult.country,
          phoneNumber: addressResult.phoneNumber,
        };
      }

      // Get payment method - first try to match by stripePaymentMethodId from print order
      const printOrder = purchasesData.find(p => p.printOrder)?.printOrder;
      const stripePaymentMethodId = printOrder?.stripePaymentMethodId;
      
      if (stripePaymentMethodId) {
        const [paymentResult] = await db
          .select()
          .from(userPaymentMethods)
          .where(eq(userPaymentMethods.stripePaymentMethodId, stripePaymentMethodId))
          .limit(1);
        
        if (paymentResult) {
          paymentMethod = {
            cardBrand: paymentResult.cardBrand,
            cardLast4: paymentResult.cardLast4,
            cardExpMonth: paymentResult.cardExpMonth,
            cardExpYear: paymentResult.cardExpYear,
          };
        }
      }
      
      // If no payment method found via stripe payment method id, get default or most recent
      if (!paymentMethod) {
        const [paymentResult] = await db
          .select()
          .from(userPaymentMethods)
          .where(eq(userPaymentMethods.userId, userId))
          .orderBy(desc(userPaymentMethods.isDefault), desc(userPaymentMethods.createdAt))
          .limit(1);
        
        if (paymentResult) {
          paymentMethod = {
            cardBrand: paymentResult.cardBrand,
            cardLast4: paymentResult.cardLast4,
            cardExpMonth: paymentResult.cardExpMonth,
            cardExpYear: paymentResult.cardExpYear,
          };
        }
      }
    }

    // Fetch notes
    const notes = await this.getOrderNotes(orderReference);

    // Fetch status history
    const statusHistory = await this.getOrderStatusHistory(orderReference);

    const purchasesList = purchasesData.map(row => ({
      ...row.purchase,
      user: row.user,
      storybook: row.storybook,
      printOrder: row.printOrder,
    }));

    return {
      purchases: purchasesList,
      customerStats,
      shippingAddress,
      paymentMethod,
      notes,
      statusHistory,
    };
  }

  async addOrderNote(data: InsertOrderNote): Promise<OrderNote> {
    const [note] = await db
      .insert(orderNotes)
      .values(data)
      .returning();
    return note;
  }

  async getOrderNotes(orderReference: string): Promise<OrderNote[]> {
    const notes = await db
      .select()
      .from(orderNotes)
      .where(eq(orderNotes.orderReference, orderReference))
      .orderBy(desc(orderNotes.createdAt));
    return notes;
  }

  async addOrderStatusHistory(data: InsertOrderStatusHistory): Promise<OrderStatusHistory> {
    const [history] = await db
      .insert(orderStatusHistory)
      .values(data)
      .returning();
    return history;
  }

  async getOrderStatusHistory(orderReference: string): Promise<OrderStatusHistory[]> {
    const history = await db
      .select()
      .from(orderStatusHistory)
      .where(eq(orderStatusHistory.orderReference, orderReference))
      .orderBy(asc(orderStatusHistory.createdAt));
    return history;
  }

  async getUserOrderHistory(userId: string): Promise<Purchase[]> {
    const userPurchases = await db
      .select()
      .from(purchases)
      .where(eq(purchases.userId, userId))
      .orderBy(desc(purchases.createdAt));
    return userPurchases;
  }
}

export const storage = new DatabaseStorage();
