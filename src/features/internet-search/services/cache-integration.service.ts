/**
 * Cache Integration Service for Internet Search System
 * 
 * Integrates with existing cache infrastructure to provide intelligent caching
 * for internet search results, reducing API calls and improving performance.
 */

import { redis } from '@/lib/redis/client';
import { createHash } from 'crypto';
import type { ItemIdentifier } from './query-builder.service';
import type { PriceExtractionResult } from './price-extraction.service';
import type { MarketPriceResult, PartPriceResult } from './internet-search.service';

export interface CachedSearchResult {
  /** Unique identifier for the cached result */
  id: string;
  /** Search query that generated this result */
  query: string;
  /** Item identifier that was searched */
  item: ItemIdentifier;
  /** Extracted price data */
  priceData: PriceExtractionResult;
  /** Number of search results processed */
  resultsProcessed: number;
  /** Search execution time in milliseconds */
  executionTime: number;
  /** When this result was cached */
  cachedAt: Date;
  /** When this cache entry expires */
  expiresAt: Date;
  /** Cache hit count for popularity tracking */
  hitCount: number;
}

export interface CachedPartResult {
  /** Unique identifier for the cached result */
  id: string;
  /** Search query that generated this result */
  query: string;
  /** Item context */
  item: ItemIdentifier;
  /** Part name that was searched */
  partName: string;
  /** Damage type context */
  damageType?: string;
  /** Extracted price data */
  priceData: PriceExtractionResult;
  /** When this result was cached */
  cachedAt: Date;
  /** When this cache entry expires */
  expiresAt: Date;
  /** Cache hit count for popularity tracking */
  hitCount: number;
}

export interface CacheMetrics {
  /** Total cache hits */
  totalHits: number;
  /** Total cache misses */
  totalMisses: number;
  /** Cache hit rate percentage */
  hitRate: number;
  /** Number of cached entries */
  entryCount: number;
  /** Most popular queries */
  popularQueries: Array<{ query: string; hits: number }>;
}

export class CacheIntegrationService {
  private readonly CACHE_VERSION = 'v2'; // Increment to invalidate old cache
  private readonly CACHE_TTL = 24 * 60 * 60; // 24 hours in seconds
  private readonly METRICS_TTL = 7 * 24 * 60 * 60; // 7 days for metrics
  
  // Cache key prefixes
  private readonly SEARCH_CACHE_PREFIX = `internet_search:${this.CACHE_VERSION}:market:`;
  private readonly PART_CACHE_PREFIX = `internet_search:${this.CACHE_VERSION}:part:`;
  private readonly METRICS_KEY = 'internet_search:metrics';
  private readonly POPULAR_QUERIES_KEY = 'internet_search:popular_queries';
  /**
   * Generate cache key for market price search
   */
  private generateMarketCacheKey(item: ItemIdentifier): string {
    const normalized = this.normalizeItemIdentifier(item);
    const hash = createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
    return `${this.SEARCH_CACHE_PREFIX}${hash}`;
  }

  /**
   * Generate cache key for part price search
   */
  private generatePartCacheKey(item: ItemIdentifier, partName: string, damageType?: string): string {
    const normalized = {
      item: this.normalizeItemIdentifier(item),
      partName: partName.toLowerCase().trim(),
      damageType: damageType?.toLowerCase().trim()
    };
    const hash = createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
    return `${this.PART_CACHE_PREFIX}${hash}`;
  }

  /**
   * Normalize item identifier for consistent caching
   */
  private normalizeItemIdentifier(item: ItemIdentifier): Record<string, any> {
    const normalized: Record<string, any> = {
      type: item.type
    };

    if (item.type === 'vehicle') {
      if (item.make) normalized.make = item.make.toLowerCase().trim();
      if (item.model) normalized.model = item.model.toLowerCase().trim();
      if (item.year) normalized.year = item.year;
      if (item.condition) normalized.condition = item.condition.toLowerCase().trim();
    } else if (item.type === 'electronics') {
      if (item.brand) normalized.brand = item.brand.toLowerCase().trim();
      if (item.model) normalized.model = item.model.toLowerCase().trim();
      if (item.storage) normalized.storage = item.storage.toLowerCase().trim();
      if (item.condition) normalized.condition = item.condition.toLowerCase().trim();
    } else if (item.type === 'appliance') {
      if (item.brand) normalized.brand = item.brand.toLowerCase().trim();
      if (item.model) normalized.model = item.model.toLowerCase().trim();
      if (item.size) normalized.size = item.size.toLowerCase().trim();
      if (item.condition) normalized.condition = item.condition.toLowerCase().trim();
    } else if (item.type === 'property') {
      if (item.propertyType) normalized.propertyType = item.propertyType.toLowerCase().trim();
      if (item.location) normalized.location = item.location.toLowerCase().trim();
      if (item.bedrooms) normalized.bedrooms = item.bedrooms;
      if (item.condition) normalized.condition = item.condition.toLowerCase().trim();
    } else if (item.type === 'jewelry') {
      if (item.jewelryType) normalized.jewelryType = item.jewelryType.toLowerCase().trim();
      if (item.brand) normalized.brand = item.brand.toLowerCase().trim();
      if (item.material) normalized.material = item.material.toLowerCase().trim();
      if (item.weight) normalized.weight = item.weight.toLowerCase().trim();
      if (item.condition) normalized.condition = item.condition.toLowerCase().trim();
    } else if (item.type === 'furniture') {
      if (item.furnitureType) normalized.furnitureType = item.furnitureType.toLowerCase().trim();
      if (item.brand) normalized.brand = item.brand.toLowerCase().trim();
      if (item.material) normalized.material = item.material.toLowerCase().trim();
      if (item.size) normalized.size = item.size;
      if (item.condition) normalized.condition = item.condition.toLowerCase().trim();
    } else if (item.type === 'machinery') {
      if (item.brand) normalized.brand = item.brand.toLowerCase().trim();
      if (item.machineryType) normalized.machineryType = item.machineryType.toLowerCase().trim();
      if (item.model) normalized.model = item.model.toLowerCase().trim();
      if (item.year) normalized.year = item.year;
      if (item.condition) normalized.condition = item.condition.toLowerCase().trim();
    }

    return normalized;
  }

  /**
   * Get cached market price result
   */
  async getCachedMarketPrice(item: ItemIdentifier): Promise<CachedSearchResult | null> {
    try {
      const cacheKey = this.generateMarketCacheKey(item);
      const cached = await redis.get<CachedSearchResult>(cacheKey);
      
      if (!cached) {
        await this.recordCacheMiss('market');
        return null;
      }

      // Check if cache has expired
      const now = new Date();
      if (now > new Date(cached.expiresAt)) {
        await redis.del(cacheKey);
        await this.recordCacheMiss('market');
        return null;
      }

      // Update hit count and record cache hit
      cached.hitCount++;
      await redis.set(cacheKey, cached, { ex: this.CACHE_TTL });
      await this.recordCacheHit('market', cached.query);
      
      return cached;
    } catch (error) {
      console.error('[CacheIntegrationService] Error getting cached market price:', error);
      return null;
    }
  }
  /**
   * Cache market price search result
   */
  async setCachedMarketPrice(
    item: ItemIdentifier,
    result: MarketPriceResult
  ): Promise<void> {
    try {
      const cacheKey = this.generateMarketCacheKey(item);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.CACHE_TTL * 1000);

      const cachedResult: CachedSearchResult = {
        id: createHash('sha256').update(`${cacheKey}_${now.getTime()}`).digest('hex'),
        query: result.query,
        item,
        priceData: result.priceData,
        resultsProcessed: result.resultsProcessed,
        executionTime: result.executionTime,
        cachedAt: now,
        expiresAt,
        hitCount: 0
      };

      await redis.set(cacheKey, cachedResult, { ex: this.CACHE_TTL });
    } catch (error) {
      console.error('[CacheIntegrationService] Error caching market price:', error);
    }
  }

  /**
   * Get cached part price result
   */
  async getCachedPartPrice(
    item: ItemIdentifier,
    partName: string,
    damageType?: string
  ): Promise<CachedPartResult | null> {
    try {
      const cacheKey = this.generatePartCacheKey(item, partName, damageType);
      const cached = await redis.get<CachedPartResult>(cacheKey);
      
      if (!cached) {
        await this.recordCacheMiss('part');
        return null;
      }

      // Check if cache has expired
      const now = new Date();
      if (now > new Date(cached.expiresAt)) {
        await redis.del(cacheKey);
        await this.recordCacheMiss('part');
        return null;
      }

      // Update hit count and record cache hit
      cached.hitCount++;
      await redis.set(cacheKey, cached, { ex: this.CACHE_TTL });
      await this.recordCacheHit('part', cached.query);
      
      return cached;
    } catch (error) {
      console.error('[CacheIntegrationService] Error getting cached part price:', error);
      return null;
    }
  }

  /**
   * Cache part price search result
   */
  async setCachedPartPrice(
    item: ItemIdentifier,
    result: PartPriceResult
  ): Promise<void> {
    try {
      const cacheKey = this.generatePartCacheKey(item, result.partName);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.CACHE_TTL * 1000);

      const cachedResult: CachedPartResult = {
        id: createHash('sha256').update(`${cacheKey}_${now.getTime()}`).digest('hex'),
        query: result.query,
        item,
        partName: result.partName,
        priceData: result.priceData,
        cachedAt: now,
        expiresAt,
        hitCount: 0
      };

      await redis.set(cacheKey, cachedResult, { ex: this.CACHE_TTL });
    } catch (error) {
      console.error('[CacheIntegrationService] Error caching part price:', error);
    }
  }
  /**
   * Record cache hit for metrics
   */
  private async recordCacheHit(type: 'market' | 'part', query: string): Promise<void> {
    try {
      // Update overall metrics
      const metrics = await this.getMetrics();
      metrics.totalHits++;
      await redis.set(this.METRICS_KEY, metrics, { ex: this.METRICS_TTL });

      // Update popular queries
      await this.updatePopularQuery(query);
    } catch (error) {
      console.error('[CacheIntegrationService] Error recording cache hit:', error);
    }
  }

  /**
   * Record cache miss for metrics
   */
  private async recordCacheMiss(type: 'market' | 'part'): Promise<void> {
    try {
      const metrics = await this.getMetrics();
      metrics.totalMisses++;
      await redis.set(this.METRICS_KEY, metrics, { ex: this.METRICS_TTL });
    } catch (error) {
      console.error('[CacheIntegrationService] Error recording cache miss:', error);
    }
  }

  /**
   * Update popular query tracking
   */
  private async updatePopularQuery(query: string): Promise<void> {
    try {
      const popularQueries = await redis.get<Record<string, number>>(this.POPULAR_QUERIES_KEY) || {};
      popularQueries[query] = (popularQueries[query] || 0) + 1;
      await redis.set(this.POPULAR_QUERIES_KEY, popularQueries, { ex: this.METRICS_TTL });
    } catch (error) {
      console.error('[CacheIntegrationService] Error updating popular query:', error);
    }
  }

  /**
   * Get cache metrics
   */
  async getMetrics(): Promise<CacheMetrics> {
    try {
      const metrics = await redis.get<CacheMetrics>(this.METRICS_KEY);
      
      if (metrics) {
        // Calculate hit rate
        const total = metrics.totalHits + metrics.totalMisses;
        metrics.hitRate = total > 0 ? Math.round((metrics.totalHits / total) * 100) : 0;
        return metrics;
      }

      // Return default metrics
      return {
        totalHits: 0,
        totalMisses: 0,
        hitRate: 0,
        entryCount: 0,
        popularQueries: []
      };
    } catch (error) {
      console.error('[CacheIntegrationService] Error getting metrics:', error);
      return {
        totalHits: 0,
        totalMisses: 0,
        hitRate: 0,
        entryCount: 0,
        popularQueries: []
      };
    }
  }

  /**
   * Get popular queries with hit counts
   */
  async getPopularQueries(limit: number = 10): Promise<Array<{ query: string; hits: number }>> {
    try {
      const popularQueries = await redis.get<Record<string, number>>(this.POPULAR_QUERIES_KEY) || {};
      
      return Object.entries(popularQueries)
        .map(([query, hits]) => ({ query, hits }))
        .sort((a, b) => b.hits - a.hits)
        .slice(0, limit);
    } catch (error) {
      console.error('[CacheIntegrationService] Error getting popular queries:', error);
      return [];
    }
  }
  /**
   * Warm cache for popular queries
   * This method can be called periodically to refresh popular search results
   */
  async warmCache(
    popularItems: ItemIdentifier[],
    searchFunction: (item: ItemIdentifier) => Promise<MarketPriceResult>
  ): Promise<void> {
    console.log(`[CacheIntegrationService] Warming cache for ${popularItems.length} items...`);
    
    const promises = popularItems.map(async (item) => {
      try {
        // Check if already cached and not expired
        const cached = await this.getCachedMarketPrice(item);
        if (cached) {
          return; // Already cached
        }

        // Perform search and cache result
        const result = await searchFunction(item);
        if (result.success) {
          await this.setCachedMarketPrice(item, result);
        }
      } catch (error) {
        console.error(`[CacheIntegrationService] Error warming cache for item:`, item, error);
      }
    });

    await Promise.allSettled(promises);
    console.log(`[CacheIntegrationService] Cache warming completed`);
  }

  /**
   * Clear expired cache entries
   * This method can be called periodically to clean up expired entries
   */
  async clearExpiredEntries(): Promise<number> {
    // Note: Redis automatically handles TTL expiration, but we can implement
    // additional cleanup logic here if needed for custom expiration rules
    console.log('[CacheIntegrationService] Redis handles TTL expiration automatically');
    return 0;
  }

  /**
   * Clear all internet search cache entries
   */
  async clearAllCache(): Promise<void> {
    try {
      // Note: Vercel KV doesn't support KEYS command, so we'd need to track
      // cache keys separately for bulk deletion. For now, we clear metrics.
      await redis.del(this.METRICS_KEY);
      await redis.del(this.POPULAR_QUERIES_KEY);
      
      console.log('[CacheIntegrationService] Cleared cache metrics and popular queries');
    } catch (error) {
      console.error('[CacheIntegrationService] Error clearing cache:', error);
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  async getCacheStats(): Promise<{
    metrics: CacheMetrics;
    popularQueries: Array<{ query: string; hits: number }>;
    cacheHealth: 'healthy' | 'degraded' | 'unhealthy';
  }> {
    try {
      const metrics = await this.getMetrics();
      const popularQueries = await this.getPopularQueries(10);
      
      // Determine cache health based on hit rate
      let cacheHealth: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (metrics.hitRate < 30) {
        cacheHealth = 'unhealthy';
      } else if (metrics.hitRate < 60) {
        cacheHealth = 'degraded';
      }

      return {
        metrics,
        popularQueries,
        cacheHealth
      };
    } catch (error) {
      console.error('[CacheIntegrationService] Error getting cache stats:', error);
      return {
        metrics: {
          totalHits: 0,
          totalMisses: 0,
          hitRate: 0,
          entryCount: 0,
          popularQueries: []
        },
        popularQueries: [],
        cacheHealth: 'unhealthy'
      };
    }
  }

  /**
   * Validate cache entry integrity
   */
  private validateCacheEntry(entry: CachedSearchResult | CachedPartResult): boolean {
    if (!entry.id || !entry.query || !entry.item || !entry.priceData) {
      return false;
    }

    if (!entry.cachedAt || !entry.expiresAt) {
      return false;
    }

    return true;
  }
}

// Export singleton instance
export const cacheIntegrationService = new CacheIntegrationService();