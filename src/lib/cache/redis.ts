/**
 * Redis Cache Client
 * 
 * Provides caching infrastructure for AI Marketplace Intelligence features.
 * Uses Upstash Redis for serverless-compatible caching.
 * 
 * @module cache/redis
 */

import { Redis } from '@upstash/redis';

// Initialize Redis client
// Use REST API URL for Upstash Redis (not TCP rediss:// URL)
const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

/**
 * Cache key prefixes for different data types
 */
export const CACHE_KEYS = {
  PREDICTION: 'prediction',
  RECOMMENDATION: 'recommendations',
  VENDOR_PROFILE: 'vendor_profile',
  MARKET_CONDITIONS: 'market_conditions',
} as const;

/**
 * Cache TTL values in seconds
 */
export const CACHE_TTL = {
  PREDICTION: 300, // 5 minutes
  RECOMMENDATION: 900, // 15 minutes
  VENDOR_PROFILE: 1800, // 30 minutes
  MARKET_CONDITIONS: 3600, // 1 hour
} as const;

/**
 * Get cached value
 */
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const value = await redis.get<T>(key);
    return value;
  } catch (error) {
    console.error(`Redis GET error for key ${key}:`, error);
    return null; // Fail gracefully
  }
}

/**
 * Set cached value with TTL
 */
export async function setCached<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<boolean> {
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Redis SET error for key ${key}:`, error);
    return false; // Fail gracefully
  }
}

/**
 * Delete cached value
 */
export async function deleteCached(key: string): Promise<boolean> {
  try {
    await redis.del(key);
    return true;
  } catch (error) {
    console.error(`Redis DEL error for key ${key}:`, error);
    return false;
  }
}

/**
 * Delete multiple cached values by pattern
 */
export async function deleteCachedPattern(pattern: string): Promise<number> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return 0;
    
    await redis.del(...keys);
    return keys.length;
  } catch (error) {
    console.error(`Redis DEL pattern error for ${pattern}:`, error);
    return 0;
  }
}

/**
 * Check if key exists
 */
export async function existsCached(key: string): Promise<boolean> {
  try {
    const exists = await redis.exists(key);
    return exists === 1;
  } catch (error) {
    console.error(`Redis EXISTS error for key ${key}:`, error);
    return false;
  }
}

/**
 * Increment counter
 */
export async function incrementCached(key: string): Promise<number> {
  try {
    return await redis.incr(key);
  } catch (error) {
    console.error(`Redis INCR error for key ${key}:`, error);
    return 0;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  predictions: number;
  recommendations: number;
  vendorProfiles: number;
  marketConditions: number;
}> {
  try {
    const [predictions, recommendations, vendorProfiles, marketConditions] = await Promise.all([
      redis.keys(`${CACHE_KEYS.PREDICTION}:*`).then(keys => keys.length),
      redis.keys(`${CACHE_KEYS.RECOMMENDATION}:*`).then(keys => keys.length),
      redis.keys(`${CACHE_KEYS.VENDOR_PROFILE}:*`).then(keys => keys.length),
      redis.keys(`${CACHE_KEYS.MARKET_CONDITIONS}:*`).then(keys => keys.length),
    ]);

    return {
      predictions,
      recommendations,
      vendorProfiles,
      marketConditions,
    };
  } catch (error) {
    console.error('Redis stats error:', error);
    return {
      predictions: 0,
      recommendations: 0,
      vendorProfiles: 0,
      marketConditions: 0,
    };
  }
}

export { redis };
