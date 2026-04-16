/**
 * Notification Rate Limiter
 * Task 8.2.4: Implement notification rate limiting (5 per day per vendor)
 * 
 * Prevents notification spam by limiting the number of notifications per vendor per day.
 */

import { redis } from '@/lib/cache/redis';

export class NotificationRateLimiter {
  private static readonly MAX_NOTIFICATIONS_PER_DAY = 5;
  private static readonly CACHE_PREFIX = 'notification:count:';
  private static readonly TTL_SECONDS = 86400; // 24 hours

  /**
   * Check if vendor can receive notification
   * 
   * @param vendorId - Vendor UUID
   * @returns Whether notification can be sent
   */
  static async canSendNotification(vendorId: string): Promise<boolean> {
    const key = `${this.CACHE_PREFIX}${vendorId}`;
    
    try {
      const count = await redis.get<string>(key);
      
      if (!count || count === null) {
        // First notification today
        await redis.set(key, 1, { ex: this.TTL_SECONDS });
        console.log(`✅ First notification for vendor ${vendorId} today (1/${this.MAX_NOTIFICATIONS_PER_DAY})`);
        return true;
      }
      
      const currentCount = typeof count === 'string' ? parseInt(count) : Number(count);
      
      if (currentCount >= this.MAX_NOTIFICATIONS_PER_DAY) {
        console.log(`⚠️ Rate limit exceeded for vendor ${vendorId} (${currentCount}/${this.MAX_NOTIFICATIONS_PER_DAY})`);
        return false; // Rate limit exceeded
      }
      
      await redis.incr(key);
      console.log(`✅ Notification allowed for vendor ${vendorId} (${currentCount + 1}/${this.MAX_NOTIFICATIONS_PER_DAY})`);
      return true;
    } catch (error) {
      console.error(`❌ Error checking notification rate limit for ${vendorId}:`, error);
      // Allow notification on error to avoid blocking
      return true;
    }
  }

  /**
   * Get current notification count for vendor
   * 
   * @param vendorId - Vendor UUID
   * @returns Current notification count
   */
  static async getNotificationCount(vendorId: string): Promise<number> {
    const key = `${this.CACHE_PREFIX}${vendorId}`;
    
    try {
      const count = await redis.get<string>(key);
      if (!count || count === null) return 0;
      return typeof count === 'string' ? parseInt(count) : Number(count);
    } catch (error) {
      console.error(`❌ Error getting notification count for ${vendorId}:`, error);
      return 0;
    }
  }

  /**
   * Get remaining notifications for vendor today
   * 
   * @param vendorId - Vendor UUID
   * @returns Number of remaining notifications
   */
  static async getRemainingNotifications(vendorId: string): Promise<number> {
    const currentCount = await this.getNotificationCount(vendorId);
    return Math.max(0, this.MAX_NOTIFICATIONS_PER_DAY - currentCount);
  }

  /**
   * Reset notification count for vendor (admin override)
   * 
   * @param vendorId - Vendor UUID
   */
  static async resetNotificationCount(vendorId: string): Promise<void> {
    const key = `${this.CACHE_PREFIX}${vendorId}`;
    
    try {
      await redis.del(key);
      console.log(`✅ Notification count reset for vendor ${vendorId}`);
    } catch (error) {
      console.error(`❌ Error resetting notification count for ${vendorId}:`, error);
    }
  }

  /**
   * Manually increment notification count (for testing)
   * 
   * @param vendorId - Vendor UUID
   */
  static async incrementNotificationCount(vendorId: string): Promise<void> {
    const key = `${this.CACHE_PREFIX}${vendorId}`;
    
    try {
      // Use incr which creates the key if it doesn't exist
      const newCount = await redis.incr(key);
      
      // Set TTL if this is the first increment
      if (newCount === 1) {
        await redis.expire(key, this.TTL_SECONDS);
      }
      
      console.log(`✅ Notification count incremented for vendor ${vendorId} (now: ${newCount})`);
    } catch (error) {
      console.error(`❌ Error incrementing notification count for ${vendorId}:`, error);
    }
  }

  /**
   * Get TTL for notification count
   * 
   * @param vendorId - Vendor UUID
   * @returns TTL in seconds, or -1 if not set
   */
  static async getCountTTL(vendorId: string): Promise<number> {
    const key = `${this.CACHE_PREFIX}${vendorId}`;
    
    try {
      const ttl = await redis.ttl(key);
      return ttl;
    } catch (error) {
      console.error(`❌ Error getting count TTL for ${vendorId}:`, error);
      return -1;
    }
  }
}
