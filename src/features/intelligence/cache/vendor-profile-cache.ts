/**
 * Vendor Profile Cache
 * Task 8.2.3: Implement vendor profile cache updates
 * 
 * Manages Redis caching for vendor profiles to improve performance.
 */

import { redis } from '@/lib/cache/redis';

export interface VendorProfile {
  vendorId: string;
  totalBids: number;
  winRate: number;
  avgBidAmount: number;
  preferredCategories: string[];
  priceRange: { min: number; max: number };
  lastActivity: Date;
  segment?: string;
}

export class VendorProfileCache {
  private static readonly CACHE_PREFIX = 'vendor:profile:';
  private static readonly TTL_SECONDS = 3600; // 1 hour

  /**
   * Update vendor profile in cache
   * 
   * @param vendorId - Vendor UUID
   * @param profile - Vendor profile data
   */
  static async updateVendorProfile(vendorId: string, profile: VendorProfile): Promise<void> {
    const key = `${this.CACHE_PREFIX}${vendorId}`;
    
    try {
      await redis.set(key, JSON.stringify(profile), { ex: this.TTL_SECONDS });
      console.log(`✅ Vendor profile cached for ${vendorId} (TTL: ${this.TTL_SECONDS}s)`);
    } catch (error) {
      console.error(`❌ Error caching vendor profile for ${vendorId}:`, error);
      // Don't throw - caching failure shouldn't break the application
    }
  }

  /**
   * Get vendor profile from cache
   * 
   * @param vendorId - Vendor UUID
   * @returns Vendor profile or null if not cached
   */
  static async getVendorProfile(vendorId: string): Promise<VendorProfile | null> {
    const key = `${this.CACHE_PREFIX}${vendorId}`;
    
    try {
      const cached = await redis.get<string>(key);
      
      if (!cached || cached === null) {
        console.log(`⚠️ Vendor profile cache miss for ${vendorId}`);
        return null;
      }
      
      console.log(`✅ Vendor profile cache hit for ${vendorId}`);
      const profile = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return profile as VendorProfile;
    } catch (error) {
      console.error(`❌ Error retrieving vendor profile from cache for ${vendorId}:`, error);
      return null;
    }
  }

  /**
   * Invalidate vendor profile cache
   * 
   * @param vendorId - Vendor UUID
   */
  static async invalidateVendorProfile(vendorId: string): Promise<void> {
    const key = `${this.CACHE_PREFIX}${vendorId}`;
    
    try {
      await redis.del(key);
      console.log(`✅ Vendor profile cache invalidated for ${vendorId}`);
    } catch (error) {
      console.error(`❌ Error invalidating vendor profile cache for ${vendorId}:`, error);
      // Don't throw - cache invalidation failure shouldn't break the application
    }
  }

  /**
   * Invalidate multiple vendor profiles
   * 
   * @param vendorIds - Array of vendor UUIDs
   */
  static async invalidateMultipleProfiles(vendorIds: string[]): Promise<void> {
    if (vendorIds.length === 0) {
      return;
    }
    
    try {
      const keys = vendorIds.map(id => `${this.CACHE_PREFIX}${id}`);
      await redis.del(...keys);
      console.log(`✅ Invalidated ${vendorIds.length} vendor profile caches`);
    } catch (error) {
      console.error(`❌ Error invalidating multiple vendor profiles:`, error);
      // Don't throw - cache invalidation failure shouldn't break the application
    }
  }

  /**
   * Check if vendor profile is cached
   * 
   * @param vendorId - Vendor UUID
   * @returns Whether profile is cached
   */
  static async isCached(vendorId: string): Promise<boolean> {
    const key = `${this.CACHE_PREFIX}${vendorId}`;
    
    try {
      const exists = await redis.exists(key);
      return exists === 1;
    } catch (error) {
      console.error(`❌ Error checking vendor profile cache for ${vendorId}:`, error);
      return false;
    }
  }

  /**
   * Get cache TTL for vendor profile
   * 
   * @param vendorId - Vendor UUID
   * @returns TTL in seconds, or -1 if not cached
   */
  static async getCacheTTL(vendorId: string): Promise<number> {
    const key = `${this.CACHE_PREFIX}${vendorId}`;
    
    try {
      const ttl = await redis.ttl(key);
      return ttl;
    } catch (error) {
      console.error(`❌ Error getting cache TTL for ${vendorId}:`, error);
      return -1;
    }
  }
}
