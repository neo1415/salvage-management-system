/**
 * Autocomplete Cache Service
 * 
 * Provides caching for vehicle autocomplete data (makes, models, years)
 * Uses Redis with 1-hour TTL for performance optimization
 */

import { redis } from '@/lib/redis/client';

export class AutocompleteCache {
  private readonly TTL = 3600; // 1 hour in seconds

  // Cache key constants
  private readonly MAKES_KEY = 'autocomplete:makes';
  private readonly MODELS_KEY_PREFIX = 'autocomplete:models:';
  private readonly YEARS_KEY_PREFIX = 'autocomplete:years:';

  /**
   * Get cached makes list
   */
  async getMakes(): Promise<string[] | null> {
    try {
      const cached = await redis.get<string[]>(this.MAKES_KEY);
      return cached;
    } catch (error) {
      console.error('[AutocompleteCache] Error getting makes from cache:', error);
      return null;
    }
  }

  /**
   * Set cached makes list
   */
  async setMakes(makes: string[]): Promise<void> {
    try {
      await redis.set(this.MAKES_KEY, makes, { ex: this.TTL });
    } catch (error) {
      console.error('[AutocompleteCache] Error setting makes in cache:', error);
    }
  }

  /**
   * Get cached models for a make
   */
  async getModels(make: string): Promise<string[] | null> {
    try {
      const key = `${this.MODELS_KEY_PREFIX}${make}`;
      const cached = await redis.get<string[]>(key);
      return cached;
    } catch (error) {
      console.error('[AutocompleteCache] Error getting models from cache:', error);
      return null;
    }
  }

  /**
   * Set cached models for a make
   */
  async setModels(make: string, models: string[]): Promise<void> {
    try {
      const key = `${this.MODELS_KEY_PREFIX}${make}`;
      await redis.set(key, models, { ex: this.TTL });
    } catch (error) {
      console.error('[AutocompleteCache] Error setting models in cache:', error);
    }
  }

  /**
   * Get cached years for make/model
   */
  async getYears(make: string, model: string): Promise<number[] | null> {
    try {
      const key = `${this.YEARS_KEY_PREFIX}${make}:${model}`;
      const cached = await redis.get<number[]>(key);
      return cached;
    } catch (error) {
      console.error('[AutocompleteCache] Error getting years from cache:', error);
      return null;
    }
  }

  /**
   * Set cached years for make/model
   */
  async setYears(make: string, model: string, years: number[]): Promise<void> {
    try {
      const key = `${this.YEARS_KEY_PREFIX}${make}:${model}`;
      await redis.set(key, years, { ex: this.TTL });
    } catch (error) {
      console.error('[AutocompleteCache] Error setting years in cache:', error);
    }
  }

  /**
   * Clear all autocomplete caches
   */
  async clearAll(): Promise<void> {
    try {
      // Vercel KV doesn't support KEYS command, so we clear known keys
      // In production, consider maintaining a set of active cache keys
      await redis.del(this.MAKES_KEY);
      
      console.log(`[AutocompleteCache] Cleared autocomplete cache`);
    } catch (error) {
      console.error('[AutocompleteCache] Error clearing cache:', error);
    }
  }
}

// Export singleton instance
export const autocompleteCache = new AutocompleteCache();
