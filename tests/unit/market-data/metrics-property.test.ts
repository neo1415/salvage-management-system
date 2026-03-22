/**
 * Property-Based Tests for Metrics Service
 * 
 * Feature: market-data-scraping-system
 * Tests universal properties of metrics collection and logging
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import {
  getScrapingMetrics,
  checkMetricsTargets,
  logScrapingOperation,
} from '@/features/market-data/services/metrics.service';
import { db } from '@/lib/db/drizzle';
import { scrapingLogs } from '@/lib/db/schema/market-data';

describe('Metrics Service - Property Tests', () => {
  beforeEach(async () => {
    // Clean up test data
    await db.delete(scrapingLogs);
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(scrapingLogs);
  });

  describe('Property 32: Metrics logging for unmet targets', () => {
    /**
     * **Validates: Requirements 11.5**
     * 
     * For any operation where accuracy targets are not met, the system should
     * log detailed metrics for analysis
     */
    test('logs detailed metrics when targets are not met', { timeout: 30000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            successCount: fc.integer({ min: 0, max: 50 }),
            failureCount: fc.integer({ min: 51, max: 100 }),
          }),
          async ({ successCount, failureCount }) => {
            // Create scraping logs with low success rate (< 70%)
            const logs = [
              ...Array.from({ length: successCount }, (_, i) => ({
                propertyHash: `test-hash-${i}`,
                sourceName: 'jiji',
                status: 'success' as const,
                pricesFound: 3,
                durationMs: 1000,
              })),
              ...Array.from({ length: failureCount }, (_, i) => ({
                propertyHash: `test-hash-${successCount + i}`,
                sourceName: 'jiji',
                status: 'failed' as const,
                pricesFound: 0,
                durationMs: 5000,
                errorMessage: 'HTTP 500',
              })),
            ];

            await db.insert(scrapingLogs).values(logs);

            // Check metrics targets
            const now = new Date();
            const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const targets = await checkMetricsTargets({ startDate, endDate: now });

            // Should have target metrics
            expect(targets.length).toBeGreaterThan(0);

            // Find scraping success rate target
            const successRateTarget = targets.find((t) => t.metric === 'Scraping Success Rate');
            expect(successRateTarget).toBeDefined();

            // Success rate should be calculated correctly
            const expectedSuccessRate = (successCount / (successCount + failureCount)) * 100;
            expect(Math.abs(successRateTarget!.actual - expectedSuccessRate)).toBeLessThan(1);

            // If success rate < 70%, target should not be met
            if (expectedSuccessRate < 70) {
              expect(successRateTarget!.met).toBe(false);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('calculates cache hit rate correctly', { timeout: 30000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            cacheHits: fc.integer({ min: 0, max: 100 }),
            cacheMisses: fc.integer({ min: 0, max: 100 }),
          }),
          async ({ cacheHits, cacheMisses }) => {
            // Skip if no operations
            if (cacheHits + cacheMisses === 0) return;

            // Create scraping logs
            const logs = [
              ...Array.from({ length: cacheHits }, (_, i) => ({
                propertyHash: `test-hash-${i}`,
                sourceName: 'cache',
                status: 'cache_hit' as const,
                pricesFound: 3,
                durationMs: 100,
              })),
              ...Array.from({ length: cacheMisses }, (_, i) => ({
                propertyHash: `test-hash-${cacheHits + i}`,
                sourceName: 'jiji',
                status: 'cache_miss' as const,
                pricesFound: 3,
                durationMs: 2000,
              })),
            ];

            await db.insert(scrapingLogs).values(logs);

            // Get metrics
            const now = new Date();
            const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const metrics = await getScrapingMetrics({ startDate, endDate: now });

            // Cache hit rate should be calculated correctly
            const expectedCacheHitRate = (cacheHits / (cacheHits + cacheMisses)) * 100;
            expect(Math.abs(metrics.cacheHitRate - expectedCacheHitRate)).toBeLessThan(1);

            // Cache hits and misses should match
            expect(metrics.cacheHits).toBe(cacheHits);
            expect(metrics.cacheMisses).toBe(cacheMisses);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('tracks per-source metrics correctly', { timeout: 30000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            jijiSuccess: fc.integer({ min: 0, max: 50 }),
            jijiFailure: fc.integer({ min: 0, max: 50 }),
            jumiaSuccess: fc.integer({ min: 0, max: 50 }),
            jumiaFailure: fc.integer({ min: 0, max: 50 }),
          }),
          async ({ jijiSuccess, jijiFailure, jumiaSuccess, jumiaFailure }) => {
            // Create scraping logs for multiple sources
            const logs = [
              ...Array.from({ length: jijiSuccess }, (_, i) => ({
                propertyHash: `test-hash-${i}`,
                sourceName: 'jiji',
                status: 'success' as const,
                pricesFound: 3,
                durationMs: 1000,
              })),
              ...Array.from({ length: jijiFailure }, (_, i) => ({
                propertyHash: `test-hash-${jijiSuccess + i}`,
                sourceName: 'jiji',
                status: 'failed' as const,
                pricesFound: 0,
                durationMs: 5000,
                errorMessage: 'HTTP 500',
              })),
              ...Array.from({ length: jumiaSuccess }, (_, i) => ({
                propertyHash: `test-hash-${jijiSuccess + jijiFailure + i}`,
                sourceName: 'jumia',
                status: 'success' as const,
                pricesFound: 2,
                durationMs: 1500,
              })),
              ...Array.from({ length: jumiaFailure }, (_, i) => ({
                propertyHash: `test-hash-${jijiSuccess + jijiFailure + jumiaSuccess + i}`,
                sourceName: 'jumia',
                status: 'failed' as const,
                pricesFound: 0,
                durationMs: 5000,
                errorMessage: 'Timeout',
              })),
            ];

            await db.insert(scrapingLogs).values(logs);

            // Get metrics
            const now = new Date();
            const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const metrics = await getScrapingMetrics({ startDate, endDate: now });

            // Should have source metrics
            expect(metrics.sourceMetrics.length).toBeGreaterThan(0);

            // Find jiji metrics
            const jijiMetrics = metrics.sourceMetrics.find((s) => s.source === 'jiji');
            if (jijiSuccess + jijiFailure > 0) {
              expect(jijiMetrics).toBeDefined();
              expect(jijiMetrics!.totalRequests).toBe(jijiSuccess + jijiFailure);
              expect(jijiMetrics!.successfulRequests).toBe(jijiSuccess);
              expect(jijiMetrics!.failedRequests).toBe(jijiFailure);

              const expectedJijiSuccessRate =
                (jijiSuccess / (jijiSuccess + jijiFailure)) * 100;
              expect(Math.abs(jijiMetrics!.successRate - expectedJijiSuccessRate)).toBeLessThan(1);
            }

            // Find jumia metrics
            const jumiaMetrics = metrics.sourceMetrics.find((s) => s.source === 'jumia');
            if (jumiaSuccess + jumiaFailure > 0) {
              expect(jumiaMetrics).toBeDefined();
              expect(jumiaMetrics!.totalRequests).toBe(jumiaSuccess + jumiaFailure);
              expect(jumiaMetrics!.successfulRequests).toBe(jumiaSuccess);
              expect(jumiaMetrics!.failedRequests).toBe(jumiaFailure);

              const expectedJumiaSuccessRate =
                (jumiaSuccess / (jumiaSuccess + jumiaFailure)) * 100;
              expect(Math.abs(jumiaMetrics!.successRate - expectedJumiaSuccessRate)).toBeLessThan(
                1
              );
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('logs scraping operations with all required fields', { timeout: 30000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            propertyHash: fc.string({ minLength: 10, maxLength: 64 }),
            source: fc.constantFrom('jiji', 'jumia', 'cars45', 'cheki'),
            status: fc.constantFrom('success', 'failed', 'cache_hit', 'cache_miss'),
            pricesFound: fc.integer({ min: 0, max: 10 }),
            durationMs: fc.integer({ min: 100, max: 10000 }),
          }),
          async ({ propertyHash, source, status, pricesFound, durationMs }) => {
            // Log operation
            await logScrapingOperation({
              propertyHash,
              source,
              status: status as any,
              pricesFound,
              durationMs,
              errorMessage: status === 'failed' ? 'Test error' : undefined,
            });

            // Verify log was created
            const now = new Date();
            const startDate = new Date(now.getTime() - 1000); // 1 second ago
            const metrics = await getScrapingMetrics({ startDate, endDate: now });

            expect(metrics.totalRequests).toBeGreaterThan(0);

            // Verify source metrics
            const sourceMetrics = metrics.sourceMetrics.find((s) => s.source === source);
            expect(sourceMetrics).toBeDefined();
            expect(sourceMetrics!.totalRequests).toBeGreaterThan(0);
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});

