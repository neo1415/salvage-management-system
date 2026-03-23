/**
 * Unit Tests for Scraping Logger Service Edge Cases
 * 
 * Feature: market-data-scraping-system
 * Tests edge cases and error handling for scraping logging
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  generatePropertyHash,
  logScrapingStart,
  logScrapingSuccess,
  logScrapingFailure,
  logCacheHit,
  logStaleFallback,
  logTimeout,
  logRateLimited,
  logScrapingEvent,
  ScrapingStatus,
} from '@/features/market-data/services/scraping-logger.service';
import type { PropertyIdentifier } from '@/features/market-data/types';

// Mock the database
const mockInsert = vi.fn();

vi.mock('@/lib/db/drizzle', () => ({
  db: {
    insert: () => ({
      values: mockInsert,
    }),
  },
}));

vi.mock('@/lib/db/schema/market-data', () => ({
  scrapingLogs: {
    propertyHash: 'propertyHash',
    sourceName: 'sourceName',
    status: 'status',
    pricesFound: 'pricesFound',
    durationMs: 'durationMs',
    errorMessage: 'errorMessage',
  },
}));

describe('Scraping Logger Service - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Property Hash Generation', () => {
    test('generates consistent hash for same property', () => {
      const property: PropertyIdentifier = {
        type: 'vehicle',
        make: 'Toyota',
        model: 'Camry',
      };

      const hash1 = generatePropertyHash(property);
      const hash2 = generatePropertyHash(property);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex characters
    });

    test('generates different hashes for different properties', () => {
      const property1: PropertyIdentifier = {
        type: 'vehicle',
        make: 'Toyota',
      };

      const property2: PropertyIdentifier = {
        type: 'vehicle',
        make: 'Honda',
      };

      const hash1 = generatePropertyHash(property1);
      const hash2 = generatePropertyHash(property2);

      expect(hash1).not.toBe(hash2);
    });

    test('generates same hash regardless of property key order', () => {
      const property1 = {
        type: 'vehicle' as const,
        make: 'Toyota',
        model: 'Camry',
      };

      const property2 = {
        model: 'Camry',
        type: 'vehicle' as const,
        make: 'Toyota',
      };

      const hash1 = generatePropertyHash(property1);
      const hash2 = generatePropertyHash(property2);

      expect(hash1).toBe(hash2);
    });

    test('handles minimal property data', () => {
      const property: PropertyIdentifier = {
        type: 'vehicle',
      };

      const hash = generatePropertyHash(property);

      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64);
    });

    test('handles property with all fields', () => {
      const property: PropertyIdentifier = {
        type: 'vehicle',
        make: 'Toyota',
        model: 'Camry',
        year: 2020,
        mileage: 50000,
      };

      const hash = generatePropertyHash(property);

      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64);
    });
  });

  describe('Logging Start Edge Cases', () => {
    test('logs start for multiple sources', async () => {
      mockInsert.mockResolvedValue(undefined);

      const property: PropertyIdentifier = { type: 'vehicle' };
      const sources = ['jiji', 'jumia', 'cars45'];

      await logScrapingStart(property, sources);

      expect(mockInsert).toHaveBeenCalledTimes(3);
    });

    test('logs start for single source', async () => {
      mockInsert.mockResolvedValue(undefined);

      const property: PropertyIdentifier = { type: 'vehicle' };
      const sources = ['jiji'];

      await logScrapingStart(property, sources);

      expect(mockInsert).toHaveBeenCalledTimes(1);
    });

    test('handles empty sources array', async () => {
      mockInsert.mockResolvedValue(undefined);

      const property: PropertyIdentifier = { type: 'vehicle' };
      const sources: string[] = [];

      await logScrapingStart(property, sources);

      expect(mockInsert).not.toHaveBeenCalled();
    });

    test('handles database errors gracefully', async () => {
      mockInsert.mockRejectedValue(new Error('Database error'));

      const property: PropertyIdentifier = { type: 'vehicle' };
      const sources = ['jiji'];

      // Should not throw
      await expect(logScrapingStart(property, sources)).resolves.not.toThrow();
    });
  });

  describe('Logging Success Edge Cases', () => {
    test('logs success with zero prices found', async () => {
      mockInsert.mockResolvedValue(undefined);

      const property: PropertyIdentifier = { type: 'vehicle' };

      await logScrapingSuccess(property, 'jiji', 0, 1000);

      expect(mockInsert).toHaveBeenCalled();
    });

    test('logs success with many prices found', async () => {
      mockInsert.mockResolvedValue(undefined);

      const property: PropertyIdentifier = { type: 'vehicle' };

      await logScrapingSuccess(property, 'jiji', 100, 5000);

      expect(mockInsert).toHaveBeenCalled();
    });

    test('logs success with very short duration', async () => {
      mockInsert.mockResolvedValue(undefined);

      const property: PropertyIdentifier = { type: 'vehicle' };

      await logScrapingSuccess(property, 'jiji', 5, 10);

      expect(mockInsert).toHaveBeenCalled();
    });

    test('logs success with very long duration', async () => {
      mockInsert.mockResolvedValue(undefined);

      const property: PropertyIdentifier = { type: 'vehicle' };

      await logScrapingSuccess(property, 'jiji', 5, 30000);

      expect(mockInsert).toHaveBeenCalled();
    });

    test('handles database errors gracefully', async () => {
      mockInsert.mockRejectedValue(new Error('Database error'));

      const property: PropertyIdentifier = { type: 'vehicle' };

      await expect(
        logScrapingSuccess(property, 'jiji', 5, 1000)
      ).resolves.not.toThrow();
    });
  });

  describe('Logging Failure Edge Cases', () => {
    test('logs failure with short error message', async () => {
      mockInsert.mockResolvedValue(undefined);

      const property: PropertyIdentifier = { type: 'vehicle' };

      await logScrapingFailure(property, 'jiji', 'Timeout', 5000);

      expect(mockInsert).toHaveBeenCalled();
    });

    test('logs failure with long error message', async () => {
      mockInsert.mockResolvedValue(undefined);

      const property: PropertyIdentifier = { type: 'vehicle' };
      const longError = 'A'.repeat(1000);

      await logScrapingFailure(property, 'jiji', longError, 5000);

      expect(mockInsert).toHaveBeenCalled();
    });

    test('logs failure with special characters in error', async () => {
      mockInsert.mockResolvedValue(undefined);

      const property: PropertyIdentifier = { type: 'vehicle' };

      await logScrapingFailure(
        property,
        'jiji',
        'Error: "Connection failed" at line 42',
        5000
      );

      expect(mockInsert).toHaveBeenCalled();
    });

    test('handles database errors gracefully', async () => {
      mockInsert.mockRejectedValue(new Error('Database error'));

      const property: PropertyIdentifier = { type: 'vehicle' };

      await expect(
        logScrapingFailure(property, 'jiji', 'Error', 5000)
      ).resolves.not.toThrow();
    });
  });

  describe('Cache Hit Logging Edge Cases', () => {
    test('logs cache hit with zero age', async () => {
      mockInsert.mockResolvedValue(undefined);

      const property: PropertyIdentifier = { type: 'vehicle' };

      await logCacheHit(property, 0);

      expect(mockInsert).toHaveBeenCalled();
    });

    test('logs cache hit with fractional days', async () => {
      mockInsert.mockResolvedValue(undefined);

      const property: PropertyIdentifier = { type: 'vehicle' };

      await logCacheHit(property, 0.5);

      expect(mockInsert).toHaveBeenCalled();
    });

    test('logs cache hit with very old data', async () => {
      mockInsert.mockResolvedValue(undefined);

      const property: PropertyIdentifier = { type: 'vehicle' };

      await logCacheHit(property, 365);

      expect(mockInsert).toHaveBeenCalled();
    });

    test('handles database errors gracefully', async () => {
      mockInsert.mockRejectedValue(new Error('Database error'));

      const property: PropertyIdentifier = { type: 'vehicle' };

      await expect(logCacheHit(property, 5)).resolves.not.toThrow();
    });
  });

  describe('Stale Fallback Logging Edge Cases', () => {
    test('logs fallback with short reason', async () => {
      mockInsert.mockResolvedValue(undefined);

      const property: PropertyIdentifier = { type: 'vehicle' };

      await logStaleFallback(property, 10, 'Timeout');

      expect(mockInsert).toHaveBeenCalled();
    });

    test('logs fallback with detailed reason', async () => {
      mockInsert.mockResolvedValue(undefined);

      const property: PropertyIdentifier = { type: 'vehicle' };

      await logStaleFallback(
        property,
        10,
        'All sources failed: jiji timeout, jumia 404, cars45 rate limited'
      );

      expect(mockInsert).toHaveBeenCalled();
    });

    test('handles database errors gracefully', async () => {
      mockInsert.mockRejectedValue(new Error('Database error'));

      const property: PropertyIdentifier = { type: 'vehicle' };

      await expect(
        logStaleFallback(property, 10, 'Error')
      ).resolves.not.toThrow();
    });
  });

  describe('Timeout Logging Edge Cases', () => {
    test('logs timeout with exact timeout duration', async () => {
      mockInsert.mockResolvedValue(undefined);

      const property: PropertyIdentifier = { type: 'vehicle' };

      await logTimeout(property, 'jiji', 5000);

      expect(mockInsert).toHaveBeenCalled();
    });

    test('logs timeout with exceeded duration', async () => {
      mockInsert.mockResolvedValue(undefined);

      const property: PropertyIdentifier = { type: 'vehicle' };

      await logTimeout(property, 'jiji', 10000);

      expect(mockInsert).toHaveBeenCalled();
    });

    test('handles database errors gracefully', async () => {
      mockInsert.mockRejectedValue(new Error('Database error'));

      const property: PropertyIdentifier = { type: 'vehicle' };

      await expect(logTimeout(property, 'jiji', 5000)).resolves.not.toThrow();
    });
  });

  describe('Rate Limiting Logging Edge Cases', () => {
    test('logs rate limit with short retry time', async () => {
      mockInsert.mockResolvedValue(undefined);

      const property: PropertyIdentifier = { type: 'vehicle' };

      await logRateLimited(property, 'jiji', 100);

      expect(mockInsert).toHaveBeenCalled();
    });

    test('logs rate limit with long retry time', async () => {
      mockInsert.mockResolvedValue(undefined);

      const property: PropertyIdentifier = { type: 'vehicle' };

      await logRateLimited(property, 'jiji', 60000);

      expect(mockInsert).toHaveBeenCalled();
    });

    test('handles database errors gracefully', async () => {
      mockInsert.mockRejectedValue(new Error('Database error'));

      const property: PropertyIdentifier = { type: 'vehicle' };

      await expect(
        logRateLimited(property, 'jiji', 1000)
      ).resolves.not.toThrow();
    });
  });

  describe('Generic Event Logging Edge Cases', () => {
    test('logs custom event with all fields', async () => {
      mockInsert.mockResolvedValue(undefined);

      await logScrapingEvent({
        propertyHash: 'hash123',
        sourceName: 'custom-source',
        status: ScrapingStatus.SUCCESS,
        pricesFound: 5,
        durationMs: 1000,
        errorMessage: 'No error',
      });

      expect(mockInsert).toHaveBeenCalled();
    });

    test('logs custom event with minimal fields', async () => {
      mockInsert.mockResolvedValue(undefined);

      await logScrapingEvent({
        propertyHash: 'hash123',
        sourceName: 'custom-source',
        status: ScrapingStatus.STARTED,
        durationMs: 0,
      });

      expect(mockInsert).toHaveBeenCalled();
    });

    test('handles database errors gracefully', async () => {
      mockInsert.mockRejectedValue(new Error('Database error'));

      await expect(
        logScrapingEvent({
          propertyHash: 'hash123',
          sourceName: 'custom-source',
          status: ScrapingStatus.SUCCESS,
          durationMs: 1000,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('Concurrent Logging', () => {
    test('handles multiple concurrent log calls', async () => {
      mockInsert.mockResolvedValue(undefined);

      const property: PropertyIdentifier = { type: 'vehicle' };

      await Promise.all([
        logScrapingSuccess(property, 'jiji', 5, 1000),
        logScrapingSuccess(property, 'jumia', 3, 1500),
        logScrapingFailure(property, 'cars45', 'Error', 2000),
      ]);

      expect(mockInsert).toHaveBeenCalledTimes(3);
    });
  });
});
