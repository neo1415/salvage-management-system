import { kv } from '@vercel/kv';

/**
 * Vercel KV (Redis) client
 * 
 * This module exports the Vercel KV client for Redis operations.
 * The client is configured using environment variables:
 * - KV_REST_API_URL
 * - KV_REST_API_TOKEN
 * - KV_REST_API_READ_ONLY_TOKEN
 * 
 * Usage:
 * ```typescript
 * import { redis } from '@/lib/redis/client';
 * 
 * // Set a value with expiry
 * await redis.set('key', 'value', { ex: 3600 });
 * 
 * // Get a value
 * const value = await redis.get('key');
 * 
 * // Delete a value
 * await redis.del('key');
 * ```
 */

export const redis = kv;

/**
 * Cache utilities for common operations
 */
export const cache = {
  /**
   * Get cached value or compute and cache it
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    expirySeconds: number = 300
  ): Promise<T> {
    // Try to get from cache
    const cached = await redis.get<T>(key);
    
    if (cached !== null) {
      return cached;
    }

    // Compute value
    const value = await fetcher();

    // Cache the value
    await redis.set(key, JSON.stringify(value), { ex: expirySeconds });

    return value;
  },

  /**
   * Invalidate cache by key pattern
   */
  async invalidatePattern(_pattern: string): Promise<void> {
    // Note: Vercel KV doesn't support SCAN, so we need to track keys manually
    // For now, we'll just delete specific keys
    // In production, consider using a key tracking mechanism
    console.warn('Pattern invalidation not fully supported with Vercel KV');
  },

  /**
   * Set cache with TTL
   */
  async set(key: string, value: unknown, expirySeconds: number = 300): Promise<void> {
    await redis.set(key, JSON.stringify(value), { ex: expirySeconds });
  },

  /**
   * Get cache value
   */
  async get<T>(key: string): Promise<T | null> {
    const value = await redis.get<string>(key);
    
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  },

  /**
   * Delete cache key
   */
  async del(key: string): Promise<void> {
    await redis.del(key);
  },

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const value = await redis.get(key);
    return value !== null;
  },

  /**
   * Increment counter
   */
  async incr(key: string): Promise<number> {
    return await redis.incr(key);
  },

  /**
   * Decrement counter
   */
  async decr(key: string): Promise<number> {
    return await redis.decr(key);
  },

  /**
   * Set expiry on existing key
   */
  async expire(key: string, seconds: number): Promise<void> {
    await redis.expire(key, seconds);
  },
};

/**
 * Cache TTL constants (in seconds)
 */
export const CACHE_TTL = {
  SESSION_MOBILE: 2 * 60 * 60, // 2 hours for mobile
  SESSION_DESKTOP: 24 * 60 * 60, // 24 hours for desktop
  AUCTION_DATA: 5 * 60, // 5 minutes for auction data
  OTP: 5 * 60, // 5 minutes for OTP
  RATE_LIMIT: 30 * 60, // 30 minutes for rate limiting
  USER_PROFILE: 15 * 60, // 15 minutes for user profile
  VENDOR_DATA: 10 * 60, // 10 minutes for vendor data
  CASE_DATA: 10 * 60, // 10 minutes for case data
} as const;

/**
 * Session cache utilities with device-specific TTL
 */
export const sessionCache = {
  /**
   * Store session data with device-specific TTL
   * @param userId - User ID
   * @param sessionData - Session data to store
   * @param deviceType - Device type ('mobile' | 'desktop' | 'tablet')
   */
  async set(
    userId: string,
    sessionData: Record<string, unknown>,
    deviceType: 'mobile' | 'desktop' | 'tablet' = 'desktop'
  ): Promise<void> {
    const key = `session:${userId}`;
    const ttl = deviceType === 'mobile' ? CACHE_TTL.SESSION_MOBILE : CACHE_TTL.SESSION_DESKTOP;
    await cache.set(key, sessionData, ttl);
  },

  /**
   * Get session data
   */
  async get(userId: string): Promise<Record<string, unknown> | null> {
    const key = `session:${userId}`;
    return await cache.get(key);
  },

  /**
   * Delete session
   */
  async del(userId: string): Promise<void> {
    const key = `session:${userId}`;
    await cache.del(key);
  },

  /**
   * Check if session exists
   */
  async exists(userId: string): Promise<boolean> {
    const key = `session:${userId}`;
    return await cache.exists(key);
  },

  /**
   * Refresh session TTL
   */
  async refresh(userId: string, deviceType: 'mobile' | 'desktop' | 'tablet' = 'desktop'): Promise<void> {
    const key = `session:${userId}`;
    const ttl = deviceType === 'mobile' ? CACHE_TTL.SESSION_MOBILE : CACHE_TTL.SESSION_DESKTOP;
    await cache.expire(key, ttl);
  },
};

/**
 * OTP cache utilities
 */
class OTPCache {
  private getKey(phone: string): string {
    return `otp:${phone}`;
  }

  async set(phone: string, otp: string): Promise<void> {
    const key = this.getKey(phone);
    await cache.set(key, { otp, attempts: 0 }, CACHE_TTL.OTP);
  }

  async get(phone: string): Promise<{ otp: string; attempts: number } | null> {
    const key = this.getKey(phone);
    return await cache.get(key);
  }

  async incrementAttempts(phone: string): Promise<number> {
    const key = this.getKey(phone);
    const data = await this.get(phone);
    
    if (!data) {
      return 0;
    }

    const newAttempts = data.attempts + 1;
    await cache.set(key, { ...data, attempts: newAttempts }, CACHE_TTL.OTP);
    
    return newAttempts;
  }

  async del(phone: string): Promise<void> {
    const key = this.getKey(phone);
    await cache.del(key);
  }
}

export const otpCache = new OTPCache();

/**
 * Rate limiting utilities
 */
export const rateLimiter = {
  /**
   * Check if rate limit exceeded
   * Returns true if limit exceeded
   */
  async isLimited(key: string, maxAttempts: number, windowSeconds: number): Promise<boolean> {
    const attempts = await redis.incr(key);
    
    if (attempts === 1) {
      await redis.expire(key, windowSeconds);
    }

    return attempts > maxAttempts;
  },

  /**
   * Reset rate limit
   */
  async reset(key: string): Promise<void> {
    await redis.del(key);
  },
};

/**
 * Auction cache utilities
 */
export const auctionCache = {
  /**
   * Cache auction data with 5-minute TTL
   */
  async set(auctionId: string, auctionData: Record<string, unknown>): Promise<void> {
    const key = `auction:${auctionId}`;
    await cache.set(key, auctionData, CACHE_TTL.AUCTION_DATA);
  },

  /**
   * Get cached auction data
   */
  async get(auctionId: string): Promise<Record<string, unknown> | null> {
    const key = `auction:${auctionId}`;
    return await cache.get(key);
  },

  /**
   * Delete auction cache
   */
  async del(auctionId: string): Promise<void> {
    const key = `auction:${auctionId}`;
    await cache.del(key);
  },

  /**
   * Cache active auctions list
   */
  async setActiveList(auctions: Record<string, unknown>[]): Promise<void> {
    const key = 'auctions:active';
    await cache.set(key, auctions, CACHE_TTL.AUCTION_DATA);
  },

  /**
   * Get cached active auctions list
   */
  async getActiveList(): Promise<Record<string, unknown>[] | null> {
    const key = 'auctions:active';
    return await cache.get(key);
  },

  /**
   * Invalidate all auction caches
   */
  async invalidateAll(): Promise<void> {
    // Note: This is a simplified implementation
    // In production, consider maintaining a set of active auction keys
    await cache.del('auctions:active');
  },
};

/**
 * User profile cache utilities
 */
export const userCache = {
  /**
   * Cache user profile data
   */
  async set(userId: string, userData: Record<string, unknown>): Promise<void> {
    const key = `user:${userId}`;
    await cache.set(key, userData, CACHE_TTL.USER_PROFILE);
  },

  /**
   * Get cached user profile
   */
  async get(userId: string): Promise<Record<string, unknown> | null> {
    const key = `user:${userId}`;
    return await cache.get(key);
  },

  /**
   * Delete user cache
   */
  async del(userId: string): Promise<void> {
    const key = `user:${userId}`;
    await cache.del(key);
  },
};

/**
 * Vendor cache utilities
 */
export const vendorCache = {
  /**
   * Cache vendor data
   */
  async set(vendorId: string, vendorData: Record<string, unknown>): Promise<void> {
    const key = `vendor:${vendorId}`;
    await cache.set(key, vendorData, CACHE_TTL.VENDOR_DATA);
  },

  /**
   * Get cached vendor data
   */
  async get(vendorId: string): Promise<Record<string, unknown> | null> {
    const key = `vendor:${vendorId}`;
    return await cache.get(key);
  },

  /**
   * Delete vendor cache
   */
  async del(vendorId: string): Promise<void> {
    const key = `vendor:${vendorId}`;
    await cache.del(key);
  },

  /**
   * Cache vendor tier status
   */
  async setTier(vendorId: string, tier: string): Promise<void> {
    const key = `vendor:${vendorId}:tier`;
    await cache.set(key, tier, CACHE_TTL.VENDOR_DATA);
  },

  /**
   * Get cached vendor tier
   */
  async getTier(vendorId: string): Promise<string | null> {
    const key = `vendor:${vendorId}:tier`;
    return await cache.get(key);
  },
};

/**
 * Case cache utilities
 */
export const caseCache = {
  /**
   * Cache case data
   */
  async set(caseId: string, caseData: Record<string, unknown>): Promise<void> {
    const key = `case:${caseId}`;
    await cache.set(key, caseData, CACHE_TTL.CASE_DATA);
  },

  /**
   * Get cached case data
   */
  async get(caseId: string): Promise<Record<string, unknown> | null> {
    const key = `case:${caseId}`;
    return await cache.get(key);
  },

  /**
   * Delete case cache
   */
  async del(caseId: string): Promise<void> {
    const key = `case:${caseId}`;
    await cache.del(key);
  },
};
