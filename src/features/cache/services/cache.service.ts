/**
 * Cache Service
 * 
 * Manages offline caching for auctions, documents, and wallet data.
 * Provides automatic expiry and cleanup functionality.
 */

import {
  cacheAuction,
  getCachedAuction,
  getAllCachedAuctions,
  cacheDocument,
  getCachedDocument,
  getCachedDocumentsByAuction,
  cacheWallet,
  getCachedWallet,
  clearExpiredCache,
  getCacheStorageUsage,
  type CachedAuction,
  type CachedDocument,
  type CachedWallet,
} from '@/lib/db/indexeddb';

export interface CacheConfig {
  maxAge: number; // milliseconds
  maxSize: number; // bytes
  autoCleanup: boolean;
}

export interface CachedItem<T> {
  data: T;
  cachedAt: Date;
  expiresAt: Date;
  size: number;
}

class CacheServiceClass {
  private readonly DEFAULT_AUCTION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
  private readonly DEFAULT_DOCUMENT_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
  private readonly DEFAULT_WALLET_MAX_AGE = 60 * 60 * 1000; // 1 hour
  private readonly MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB

  // Generic cache storage for non-specific data types
  private genericCache: Map<string, CachedItem<unknown>> = new Map();

  constructor() {
    // Bind all methods to ensure 'this' context is preserved
    this.get = this.get.bind(this);
    this.set = this.set.bind(this);
    this.cacheAuction = this.cacheAuction.bind(this);
    this.getCachedAuction = this.getCachedAuction.bind(this);
    this.getCachedAuctions = this.getCachedAuctions.bind(this);
    this.cacheDocument = this.cacheDocument.bind(this);
    this.getCachedDocument = this.getCachedDocument.bind(this);
    this.getCachedDocuments = this.getCachedDocuments.bind(this);
    this.getAllCachedDocuments = this.getAllCachedDocuments.bind(this);
    this.getAllCachedWallets = this.getAllCachedWallets.bind(this);
    this.clearAll = this.clearAll.bind(this);
    this.cacheWallet = this.cacheWallet.bind(this);
    this.getCachedWallet = this.getCachedWallet.bind(this);
    this.clearExpired = this.clearExpired.bind(this);
    this.getStorageUsage = this.getStorageUsage.bind(this);
    this.getDetailedStorageUsage = this.getDetailedStorageUsage.bind(this);
    this.isWithinSizeLimit = this.isWithinSizeLimit.bind(this);
    this.autoCleanup = this.autoCleanup.bind(this);
  }

  /**
   * Generic get method for cached data
   */
  async get<T = unknown>(key: string): Promise<CachedItem<T> | null> {
    const cached = this.genericCache.get(key);
    if (!cached) return null;

    // Check if expired
    if (new Date() > cached.expiresAt) {
      this.genericCache.delete(key);
      return null;
    }

    return cached as CachedItem<T>;
  }

  /**
   * Generic set method for caching data
   */
  async set<T = unknown>(key: string, data: T, maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + maxAge);
    const size = JSON.stringify(data).length;

    this.genericCache.set(key, {
      data,
      cachedAt: now,
      expiresAt,
      size,
    });
  }

  /**
   * Cache auction data
   */
  async cacheAuction(auction: Record<string, unknown>): Promise<void> {
    await cacheAuction(auction, this.DEFAULT_AUCTION_MAX_AGE);
  }

  /**
   * Get cached auction
   */
  async getCachedAuction(id: string): Promise<CachedItem<Record<string, unknown>> | null> {
    const cached = await getCachedAuction(id);
    if (!cached) return null;

    return {
      data: cached.data,
      cachedAt: cached.cachedAt,
      expiresAt: cached.expiresAt,
      size: cached.size,
    };
  }

  /**
   * Get all cached auctions
   */
  async getCachedAuctions(): Promise<CachedItem<Record<string, unknown>>[]> {
    const cached = await getAllCachedAuctions();
    return cached.map(c => ({
      data: c.data,
      cachedAt: c.cachedAt,
      expiresAt: c.expiresAt,
      size: c.size,
    }));
  }

  /**
   * Cache document data
   */
  async cacheDocument(document: Record<string, unknown>, auctionId: string): Promise<void> {
    await cacheDocument(document, auctionId, this.DEFAULT_DOCUMENT_MAX_AGE);
  }

  /**
   * Get cached document
   */
  async getCachedDocument(id: string): Promise<CachedItem<Record<string, unknown>> | null> {
    const cached = await getCachedDocument(id);
    if (!cached) return null;

    return {
      data: cached.data,
      cachedAt: cached.cachedAt,
      expiresAt: cached.expiresAt,
      size: cached.size,
    };
  }

  /**
   * Get cached documents by auction ID
   */
  async getCachedDocuments(auctionId: string): Promise<CachedItem<Record<string, unknown>>[]> {
    const cached = await getCachedDocumentsByAuction(auctionId);
    return cached.map(c => ({
      data: c.data,
      cachedAt: c.cachedAt,
      expiresAt: c.expiresAt,
      size: c.size,
    }));
  }

  /**
   * Get all cached documents (across all auctions)
   */
  async getAllCachedDocuments(): Promise<CachedItem<Record<string, unknown>>[]> {
    // This would require a new IndexedDB function, but for now we can return empty
    // In a real implementation, you'd add a getAllCachedDocuments function to indexeddb.ts
    return [];
  }

  /**
   * Get all cached wallets
   */
  async getAllCachedWallets(): Promise<CachedItem<{ balance: number; transactions: Array<Record<string, unknown>> }>[]> {
    // This would require a new IndexedDB function, but for now we can return empty
    // In a real implementation, you'd add a getAllCachedWallets function to indexeddb.ts
    return [];
  }

  /**
   * Clear all cache data
   */
  async clearAll(): Promise<void> {
    // Clear generic cache
    this.genericCache.clear();
    // Clear all cached data
    await clearExpiredCache();
    // In a real implementation, you'd add a clearAllCache function to indexeddb.ts
  }

  /**
   * Cache wallet data
   */
  async cacheWallet(userId: string, balance: number, transactions: Array<Record<string, unknown>>): Promise<void> {
    await cacheWallet(userId, balance, transactions, this.DEFAULT_WALLET_MAX_AGE);
  }

  /**
   * Get cached wallet
   */
  async getCachedWallet(userId: string): Promise<CachedItem<{ balance: number; transactions: Array<Record<string, unknown>> }> | null> {
    const cached = await getCachedWallet(userId);
    if (!cached) return null;

    return {
      data: {
        balance: cached.balance,
        transactions: cached.transactions,
      },
      cachedAt: cached.cachedAt,
      expiresAt: cached.expiresAt,
      size: cached.size,
    };
  }

  /**
   * Clear expired cache entries
   */
  async clearExpired(): Promise<number> {
    // Clear expired generic cache entries
    const now = new Date();
    let expiredCount = 0;
    
    for (const [key, cached] of this.genericCache.entries()) {
      if (now > cached.expiresAt) {
        this.genericCache.delete(key);
        expiredCount++;
      }
    }
    
    // Clear expired IndexedDB entries
    const dbExpiredCount = await clearExpiredCache();
    return expiredCount + dbExpiredCount;
  }

  /**
   * Get storage usage statistics
   */
  async getStorageUsage(): Promise<number> {
    const usage = await getCacheStorageUsage();
    
    // Add generic cache size
    let genericCacheSize = 0;
    for (const cached of this.genericCache.values()) {
      genericCacheSize += cached.size;
    }
    
    return usage.total + genericCacheSize;
  }

  /**
   * Get detailed storage statistics
   */
  async getDetailedStorageUsage() {
    return await getCacheStorageUsage();
  }

  /**
   * Check if cache size is within limits
   */
  async isWithinSizeLimit(): Promise<boolean> {
    const usage = await this.getStorageUsage();
    return usage < this.MAX_CACHE_SIZE;
  }

  /**
   * Auto-cleanup if needed
   */
  async autoCleanup(): Promise<void> {
    const isWithinLimit = await this.isWithinSizeLimit();
    if (!isWithinLimit) {
      await this.clearExpired();
    }
  }
}

// Export singleton instance
export const CacheService = new CacheServiceClass();
