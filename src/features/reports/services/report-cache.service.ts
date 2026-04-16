/**
 * Report Cache Service
 * 
 * Handles caching of report data for performance optimization
 * Task 3: Core Report Engine Foundation
 */

import { db } from '@/lib/db/drizzle';
import { reportCache } from '@/lib/db/schema/reports';
import { eq, lt } from 'drizzle-orm';
import { createHash } from 'crypto';

export class ReportCacheService {
  /**
   * Default cache TTL in minutes
   */
  private static readonly DEFAULT_TTL_MINUTES = 15;

  /**
   * Generate cache key from report type and filters
   */
  private static generateCacheKey(reportType: string, filters: any): string {
    const filterString = JSON.stringify(filters || {});
    const hash = createHash('md5').update(`${reportType}:${filterString}`).digest('hex');
    return hash;
  }

  /**
   * Get cached report data
   */
  static async getCachedReport(reportType: string, filters: any): Promise<any | null> {
    try {
      const key = this.generateCacheKey(reportType, filters);
      const now = new Date();

      const cached = await db
        .select()
        .from(reportCache)
        .where(eq(reportCache.reportKey, key))
        .limit(1);

      if (cached.length === 0) {
        return null;
      }

      const entry = cached[0];

      // Check if expired
      if (entry.expiresAt < now) {
        // Delete expired entry
        await db.delete(reportCache).where(eq(reportCache.reportKey, key));
        return null;
      }

      return entry.reportData;
    } catch (error: any) {
      // Handle database connection timeouts gracefully
      if (error?.code === 'CONNECT_TIMEOUT' || error?.errno === 'CONNECT_TIMEOUT') {
        console.warn('Database connection timeout - skipping cache lookup');
        return null;
      }
      console.error('Error getting cached report:', error);
      return null;
    }
  }

  /**
   * Cache report data
   */
  static async cacheReport(
    reportType: string,
    filters: any,
    data: any,
    ttlMinutes: number = this.DEFAULT_TTL_MINUTES
  ): Promise<void> {
    try {
      const key = this.generateCacheKey(reportType, filters);
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

      // Upsert cache entry
      await db
        .insert(reportCache)
        .values({
          reportKey: key,
          reportType,
          filters,
          reportData: data,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: reportCache.reportKey,
          set: {
            reportData: data,
            expiresAt,
          },
        });
    } catch (error: any) {
      // Handle database connection timeouts gracefully
      if (error?.code === 'CONNECT_TIMEOUT' || error?.errno === 'CONNECT_TIMEOUT') {
        console.warn('Database connection timeout - skipping cache write');
        return;
      }
      console.error('Error caching report:', error);
      // Don't throw - caching failure shouldn't break report generation
    }
  }

  /**
   * Invalidate cache for specific report type
   */
  static async invalidateReportType(reportType: string): Promise<void> {
    try {
      await db.delete(reportCache).where(eq(reportCache.reportType, reportType));
    } catch (error) {
      console.error('Error invalidating report cache:', error);
    }
  }

  /**
   * Invalidate specific cache entry
   */
  static async invalidateCache(reportType: string, filters: any): Promise<void> {
    try {
      const key = this.generateCacheKey(reportType, filters);
      await db.delete(reportCache).where(eq(reportCache.reportKey, key));
    } catch (error) {
      console.error('Error invalidating cache:', error);
    }
  }

  /**
   * Clean up expired cache entries
   */
  static async cleanupExpiredCache(): Promise<number> {
    try {
      const now = new Date();
      const result = await db.delete(reportCache).where(lt(reportCache.expiresAt, now));
      return result.rowCount || 0;
    } catch (error) {
      console.error('Error cleaning up expired cache:', error);
      return 0;
    }
  }

  /**
   * Clear all cache
   */
  static async clearAllCache(): Promise<void> {
    try {
      await db.delete(reportCache);
    } catch (error) {
      console.error('Error clearing all cache:', error);
    }
  }
}
