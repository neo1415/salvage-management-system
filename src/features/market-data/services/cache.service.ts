/**
 * Cache Service
 * 
 * Manages persistent storage and retrieval of market data using PostgreSQL.
 * Implements 7-day freshness policy with stale data fallback.
 */

import { db } from '../../../lib/db/drizzle';
import { marketDataCache, marketDataSources } from '../../../lib/db/schema/market-data';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';
import type { PropertyIdentifier, SourcePrice, CachedMarketData } from '../types';

/**
 * Generate a unique hash for a property identifier
 * Uses SHA-256 hash of normalized property details
 */
export function generatePropertyHash(property: PropertyIdentifier): string {
  // Normalize property details for consistent hashing
  const normalized: Record<string, any> = {
    type: property.type,
  };

  // Add type-specific fields in sorted order
  if (property.type === 'vehicle') {
    if (property.make) normalized.make = property.make.toLowerCase().trim();
    if (property.model) normalized.model = property.model.toLowerCase().trim();
    if (property.year) normalized.year = property.year;
    if (property.mileage) normalized.mileage = property.mileage;
    if (property.condition) normalized.condition = property.condition.toLowerCase().trim();
  } else if (property.type === 'electronics') {
    if (property.brand) normalized.brand = property.brand.toLowerCase().trim();
    if (property.productModel) normalized.productModel = property.productModel.toLowerCase().trim();
    if (property.productType) normalized.productType = property.productType.toLowerCase().trim();
    // Enhanced storage field handling
    if (property.storageCapacity) normalized.storageCapacity = property.storageCapacity.toLowerCase().trim();
    if (property.storageType) normalized.storageType = property.storageType.toLowerCase().trim();
    if (property.storage) normalized.storage = property.storage.toLowerCase().trim();
    if (property.color) normalized.color = property.color.toLowerCase().trim();
    if (property.condition) normalized.condition = property.condition.toLowerCase().trim();
  } else if (property.type === 'building') {
    if (property.location) normalized.location = property.location.toLowerCase().trim();
    if (property.propertyType) normalized.propertyType = property.propertyType.toLowerCase().trim();
    if (property.size) normalized.size = property.size;
    if (property.bedrooms) normalized.bedrooms = property.bedrooms;
    if (property.condition) normalized.condition = property.condition.toLowerCase().trim();
  } else if (property.type === 'appliance') {
    if (property.brand) normalized.brand = property.brand.toLowerCase().trim();
    if (property.model) normalized.model = property.model.toLowerCase().trim();
    if (property.applianceType) normalized.applianceType = property.applianceType.toLowerCase().trim();
    if (property.condition) normalized.condition = property.condition.toLowerCase().trim();
  } else if (property.type === 'property') {
    if (property.propertyType) normalized.propertyType = property.propertyType.toLowerCase().trim();
    if (property.location) normalized.location = property.location.toLowerCase().trim();
    if (property.bedrooms) normalized.bedrooms = property.bedrooms;
    if (property.condition) normalized.condition = property.condition.toLowerCase().trim();
  } else if (property.type === 'jewelry') {
    if (property.jewelryType) normalized.jewelryType = property.jewelryType.toLowerCase().trim();
    if (property.brand) normalized.brand = property.brand.toLowerCase().trim();
    if (property.material) normalized.material = property.material.toLowerCase().trim();
    if (property.weight) normalized.weight = property.weight.toLowerCase().trim();
    if (property.condition) normalized.condition = property.condition.toLowerCase().trim();
  } else if (property.type === 'furniture') {
    if (property.furnitureType) normalized.furnitureType = property.furnitureType.toLowerCase().trim();
    if (property.brand) normalized.brand = property.brand.toLowerCase().trim();
    if (property.material) normalized.material = property.material.toLowerCase().trim();
    if (property.size) normalized.size = property.size;
    if (property.condition) normalized.condition = property.condition.toLowerCase().trim();
  } else if (property.type === 'machinery') {
    if (property.brand) normalized.brand = property.brand.toLowerCase().trim();
    if (property.machineryType) normalized.machineryType = property.machineryType.toLowerCase().trim();
    if (property.model) normalized.model = property.model.toLowerCase().trim();
    if (property.year) normalized.year = property.year;
    if (property.condition) normalized.condition = property.condition.toLowerCase().trim();
  }

  // Create deterministic JSON string (sorted keys)
  const jsonString = JSON.stringify(normalized, Object.keys(normalized).sort());
  
  // Generate SHA-256 hash
  return createHash('sha256').update(jsonString).digest('hex');
}

/**
 * Check if cached data is stale (older than 7 days)
 */
export function isStale(scrapedAt: Date): boolean {
  const now = new Date();
  const ageInDays = (now.getTime() - scrapedAt.getTime()) / (1000 * 60 * 60 * 24);
  return ageInDays > 7;
}

/**
 * Calculate cache age in days
 */
export function getCacheAge(scrapedAt: Date): number {
  const now = new Date();
  const ageInMs = now.getTime() - scrapedAt.getTime();
  return Math.floor(ageInMs / (1000 * 60 * 60 * 24));
}

/**
 * Get cached market price for a property
 * Returns null if no cache exists
 */
export async function getCachedPrice(
  property: PropertyIdentifier
): Promise<CachedMarketData | null> {
  const propertyHash = generatePropertyHash(property);

  try {
    // Query cache with sources
    const cacheResult = await db
      .select()
      .from(marketDataCache)
      .where(eq(marketDataCache.propertyHash, propertyHash))
      .limit(1);

    if (cacheResult.length === 0) {
      return null;
    }

    const cache = cacheResult[0];

    // Get associated source prices
    const sourcesResult = await db
      .select()
      .from(marketDataSources)
      .where(eq(marketDataSources.cacheId, cache.id));

    // Convert to SourcePrice format
    const prices: SourcePrice[] = sourcesResult.map((source) => ({
      source: source.sourceName,
      price: parseFloat(source.price),
      currency: source.currency,
      listingUrl: source.listingUrl,
      listingTitle: source.listingTitle,
      scrapedAt: source.scrapedAt,
    }));

    // Check if stale
    const stale = isStale(cache.scrapedAt);

    return {
      id: cache.id,
      propertyHash: cache.propertyHash,
      propertyType: cache.propertyType,
      propertyDetails: cache.propertyDetails as PropertyIdentifier,
      prices,
      medianPrice: parseFloat(cache.medianPrice),
      scrapedAt: cache.scrapedAt,
      isStale: stale,
      staleAt: cache.staleAt,
    };
  } catch (error) {
    console.error('Error getting cached price:', error);
    throw new Error('Failed to retrieve cached market data');
  }
}

/**
 * Store market price data in cache
 * Updates existing cache or creates new entry
 * Uses database transaction to ensure atomicity
 */
export async function setCachedPrice(
  property: PropertyIdentifier,
  prices: SourcePrice[]
): Promise<void> {
  if (prices.length === 0) {
    throw new Error('Cannot cache empty price list');
  }

  const propertyHash = generatePropertyHash(property);
  const now = new Date();
  const staleAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

  // Calculate aggregated values
  const priceValues = prices.map((p) => p.price);
  const medianPrice = calculateMedian(priceValues);
  const minPrice = Math.min(...priceValues);
  const maxPrice = Math.max(...priceValues);

  try {
    // Use transaction to ensure atomicity
    await db.transaction(async (tx) => {
      // Check if cache entry exists
      const existing = await tx
        .select()
        .from(marketDataCache)
        .where(eq(marketDataCache.propertyHash, propertyHash))
        .limit(1);

      let cacheId: string;

      if (existing.length > 0) {
        // Update existing cache
        cacheId = existing[0].id;
        
        // Delete old source prices first
        await tx
          .delete(marketDataSources)
          .where(eq(marketDataSources.cacheId, cacheId));
        
        await tx
          .update(marketDataCache)
          .set({
            medianPrice: medianPrice.toString(),
            minPrice: minPrice.toString(),
            maxPrice: maxPrice.toString(),
            sourceCount: prices.length,
            scrapedAt: now,
            staleAt,
            updatedAt: now,
          })
          .where(eq(marketDataCache.id, cacheId));
      } else {
        // Create new cache entry
        const insertResult = await tx
          .insert(marketDataCache)
          .values({
            propertyHash,
            propertyType: property.type,
            propertyDetails: property as any,
            medianPrice: medianPrice.toString(),
            minPrice: minPrice.toString(),
            maxPrice: maxPrice.toString(),
            sourceCount: prices.length,
            scrapedAt: now,
            staleAt,
          })
          .returning({ id: marketDataCache.id });

        cacheId = insertResult[0].id;
      }

      // Insert new source prices
      const sourceValues = prices.map((price) => ({
        cacheId,
        sourceName: price.source,
        price: price.price.toString(),
        currency: price.currency,
        listingUrl: price.listingUrl,
        listingTitle: price.listingTitle,
        scrapedAt: price.scrapedAt,
      }));

      if (sourceValues.length > 0) {
        await tx.insert(marketDataSources).values(sourceValues);
      }
    });
  } catch (error) {
    console.error('Error setting cached price:', error);
    throw new Error('Failed to store market data in cache');
  }
}

/**
 * Mark cached data as stale by updating staleAt timestamp
 */
export async function markStale(propertyHash: string): Promise<void> {
  try {
    const now = new Date();
    
    await db
      .update(marketDataCache)
      .set({
        staleAt: now,
        updatedAt: now,
      })
      .where(eq(marketDataCache.propertyHash, propertyHash));
  } catch (error) {
    console.error('Error marking cache as stale:', error);
    throw new Error('Failed to mark cache as stale');
  }
}

/**
 * Calculate median of an array of numbers
 * Helper function for price aggregation
 */
function calculateMedian(values: number[]): number {
  if (values.length === 0) {
    throw new Error('Cannot calculate median of empty array');
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}
