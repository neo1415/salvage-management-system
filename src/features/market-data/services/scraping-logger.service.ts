/**
 * Scraping Logger Service
 * 
 * Extends the existing audit logging infrastructure for market data scraping operations.
 * Logs all scraping activity to the scraping_logs table for monitoring and debugging.
 * 
 * Requirements: 5.1-5.5
 */

import { db } from '@/lib/db/drizzle';
import { scrapingLogs } from '@/lib/db/schema/market-data';
import type { PropertyIdentifier } from '@/features/market-data/types';
import crypto from 'crypto';

/**
 * Scraping log status types
 */
export enum ScrapingStatus {
  STARTED = 'started',
  SUCCESS = 'success',
  FAILURE = 'failure',
  CACHE_HIT = 'cache_hit',
  DATABASE_HIT = 'database_hit', // NEW: For valuation database hits
  FALLBACK = 'fallback',
  TIMEOUT = 'timeout',
  RATE_LIMITED = 'rate_limited',
}

/**
 * Scraping log entry data
 */
export interface ScrapingLogData {
  propertyHash: string;
  sourceName: string;
  status: ScrapingStatus;
  pricesFound?: number;
  durationMs: number;
  errorMessage?: string;
}

/**
 * Generate a consistent hash for a property identifier
 * Used to link scraping logs to cached data
 */
export function generatePropertyHash(property: PropertyIdentifier): string {
  const normalized = JSON.stringify(property, Object.keys(property).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Log a scraping operation start
 * 
 * Requirement 5.1: Log property identifier, sources targeted, and timestamp
 */
export async function logScrapingStart(
  property: PropertyIdentifier,
  sources: string[]
): Promise<void> {
  const propertyHash = generatePropertyHash(property);
  const startTime = Date.now();

  try {
    // Log start for each source
    const logPromises = sources.map(source =>
      db.insert(scrapingLogs).values({
        propertyHash,
        sourceName: source,
        status: ScrapingStatus.STARTED,
        pricesFound: 0,
        durationMs: 0,
      })
    );

    await Promise.all(logPromises);
  } catch (error) {
    // Don't throw - logging failures shouldn't break scraping
    console.error('Failed to log scraping start:', error);
  }
}

/**
 * Log a successful scraping operation
 * 
 * Requirement 5.2: Log number of prices found per source
 */
export async function logScrapingSuccess(
  property: PropertyIdentifier,
  sourceName: string,
  pricesFound: number,
  durationMs: number
): Promise<void> {
  const propertyHash = generatePropertyHash(property);

  try {
    await db.insert(scrapingLogs).values({
      propertyHash,
      sourceName,
      status: ScrapingStatus.SUCCESS,
      pricesFound,
      durationMs: Math.round(durationMs), // Round to integer for database
    });
  } catch (error) {
    console.error('Failed to log scraping success:', error);
  }
}

/**
 * Log a failed scraping operation
 * 
 * Requirement 5.3: Log error message, source name, and failure reason
 */
export async function logScrapingFailure(
  property: PropertyIdentifier,
  sourceName: string,
  errorMessage: string,
  durationMs: number
): Promise<void> {
  const propertyHash = generatePropertyHash(property);

  try {
    await db.insert(scrapingLogs).values({
      propertyHash,
      sourceName,
      status: ScrapingStatus.FAILURE,
      pricesFound: 0,
      durationMs: Math.round(durationMs), // Round to integer for database
      errorMessage,
    });
  } catch (error) {
    console.error('Failed to log scraping failure:', error);
  }
}

/**
 * Log a cache hit
 * 
 * Requirement 5.4: Log cache hit with data age
 */
export async function logCacheHit(
  property: PropertyIdentifier,
  dataAgeDays: number
): Promise<void> {
  const propertyHash = generatePropertyHash(property);

  try {
    await db.insert(scrapingLogs).values({
      propertyHash,
      sourceName: 'cache',
      status: ScrapingStatus.CACHE_HIT,
      pricesFound: 0,
      durationMs: 0,
      errorMessage: `Data age: ${dataAgeDays} days`,
    });
  } catch (error) {
    console.error('Failed to log cache hit:', error);
  }
}

/**
 * Log a valuation database hit
 * 
 * Requirement 5.5: Log database hit for analytics
 */
export async function logDatabaseHit(
  property: PropertyIdentifier
): Promise<void> {
  const propertyHash = generatePropertyHash(property);

  try {
    await db.insert(scrapingLogs).values({
      propertyHash,
      sourceName: 'valuation_database',
      status: ScrapingStatus.DATABASE_HIT,
      pricesFound: 1,
      durationMs: 0,
      errorMessage: `Database hit: ${property.make} ${property.model} ${property.year}`,
    });
  } catch (error) {
    console.error('Failed to log database hit:', error);
  }
}

/**
 * Log a fallback to stale data
 * 
 * Requirement 5.5: Log fallback event when stale data is returned due to scraping failure
 */
export async function logStaleFallback(
  property: PropertyIdentifier,
  dataAgeDays: number,
  reason: string
): Promise<void> {
  const propertyHash = generatePropertyHash(property);

  try {
    await db.insert(scrapingLogs).values({
      propertyHash,
      sourceName: 'cache',
      status: ScrapingStatus.FALLBACK,
      pricesFound: 0,
      durationMs: 0,
      errorMessage: `Fallback to stale data (${dataAgeDays} days old): ${reason}`,
    });
  } catch (error) {
    console.error('Failed to log stale fallback:', error);
  }
}

/**
 * Log a timeout event
 */
export async function logTimeout(
  property: PropertyIdentifier,
  sourceName: string,
  durationMs: number
): Promise<void> {
  const propertyHash = generatePropertyHash(property);

  try {
    await db.insert(scrapingLogs).values({
      propertyHash,
      sourceName,
      status: ScrapingStatus.TIMEOUT,
      pricesFound: 0,
      durationMs,
      errorMessage: 'Request timed out',
    });
  } catch (error) {
    console.error('Failed to log timeout:', error);
  }
}

/**
 * Log a rate limiting event
 */
export async function logRateLimited(
  property: PropertyIdentifier,
  sourceName: string,
  retryAfterMs: number
): Promise<void> {
  const propertyHash = generatePropertyHash(property);

  try {
    await db.insert(scrapingLogs).values({
      propertyHash,
      sourceName,
      status: ScrapingStatus.RATE_LIMITED,
      pricesFound: 0,
      durationMs: 0,
      errorMessage: `Rate limited, retry after ${retryAfterMs}ms`,
    });
  } catch (error) {
    console.error('Failed to log rate limiting:', error);
  }
}

/**
 * Generic log function for custom scraping events
 */
export async function logScrapingEvent(data: ScrapingLogData): Promise<void> {
  try {
    await db.insert(scrapingLogs).values({
      propertyHash: data.propertyHash,
      sourceName: data.sourceName,
      status: data.status,
      pricesFound: data.pricesFound || 0,
      durationMs: data.durationMs,
      errorMessage: data.errorMessage || null,
    });
  } catch (error) {
    console.error('Failed to log scraping event:', error);
  }
}
