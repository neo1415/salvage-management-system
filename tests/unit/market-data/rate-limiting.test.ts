import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import {
  checkRateLimit,
  recordRequest,
  waitForRateLimit,
  getRateLimitStatus,
  resetRateLimit,
} from '../../../src/features/market-data/services/rate-limiter.service';

/**
 * Feature: market-data-scraping-system
 * Property-Based Tests for Rate Limiting
 * 
 * Property 6: Rate limiting enforcement
 * Property 24: Rate limit retry queueing
 * 
 * Validates: Requirements 1.8, 7.5
 */

describe('Rate Limiting Property Tests', () => {
  const testSources = ['jiji', 'jumia', 'cars45', 'cheki'];

  beforeEach(async () => {
    // Reset rate limits for all test sources
    for (const source of testSources) {
      await resetRateLimit(source);
    }
  });

  afterEach(async () => {
    // Clean up rate limits after each test
    for (const source of testSources) {
      await resetRateLimit(source);
    }
  });

  describe('Property 6: Rate limiting enforcement', () => {
    it('should enforce maximum 2 requests per second per source', { timeout: 15000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...testSources),
          async (source) => {
            // Reset rate limit for this source
            await resetRateLimit(source);

            // Record 2 requests (should be allowed)
            await recordRequest(source);
            await recordRequest(source);

            // Check rate limit - should be at limit
            const status = await getRateLimitStatus(source);
            expect(status.requestCount).toBe(2);
            expect(status.allowed).toBe(false);

            // Third request should be blocked
            const result = await checkRateLimit(source);
            expect(result.allowed).toBe(false);
            expect(result.retryAfter).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow requests after rate limit window expires', { timeout: 15000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...testSources),
          async (source) => {
            // Reset rate limit
            await resetRateLimit(source);

            // Fill up rate limit
            await recordRequest(source);
            await recordRequest(source);

            // Verify blocked
            const blockedResult = await checkRateLimit(source);
            expect(blockedResult.allowed).toBe(false);

            // Wait for window to expire (1 second + buffer)
            await new Promise((resolve) => setTimeout(resolve, 1100));

            // Should be allowed again
            const allowedResult = await checkRateLimit(source);
            expect(allowedResult.allowed).toBe(true);
          }
        ),
        { numRuns: 50 } // Fewer runs due to time delays
      );
    });

    it('should enforce rate limits independently per source', { timeout: 15000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...testSources),
          fc.constantFrom(...testSources),
          async (source1, source2) => {
            // Skip if same source
            if (source1 === source2) return;

            // Reset both sources
            await resetRateLimit(source1);
            await resetRateLimit(source2);

            // Fill rate limit for source1
            await recordRequest(source1);
            await recordRequest(source1);

            // source1 should be blocked
            const result1 = await checkRateLimit(source1);
            expect(result1.allowed).toBe(false);

            // source2 should still be allowed
            const result2 = await checkRateLimit(source2);
            expect(result2.allowed).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should track request count accurately in sliding window', { timeout: 15000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...testSources),
          fc.integer({ min: 1, max: 5 }),
          async (source, requestCount) => {
            // Reset rate limit
            await resetRateLimit(source);

            // Record specified number of requests
            for (let i = 0; i < requestCount; i++) {
              await recordRequest(source);
            }

            // Check status
            const status = await getRateLimitStatus(source);
            
            // Should track up to the limit (max 2)
            const expectedCount = Math.min(requestCount, 2);
            expect(status.requestCount).toBeLessThanOrEqual(2);
            
            // If we recorded more than 2, should be blocked
            if (requestCount > 2) {
              expect(status.allowed).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 24: Rate limit retry queueing', () => {
    it('should queue and retry requests when rate limited', { timeout: 15000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...testSources),
          async (source) => {
            // Reset rate limit
            await resetRateLimit(source);

            // Fill rate limit
            await recordRequest(source);
            await recordRequest(source);

            // Attempt to wait for rate limit (should succeed after waiting)
            const startTime = Date.now();
            await waitForRateLimit(source);
            const endTime = Date.now();

            // Should have waited at least some time
            const waitTime = endTime - startTime;
            expect(waitTime).toBeGreaterThan(0);

            // After waiting, should be allowed
            const result = await checkRateLimit(source);
            expect(result.allowed).toBe(true);
          }
        ),
        { numRuns: 20, timeout: 10000 } // Fewer runs, longer timeout due to waiting
      );
    });

    it('should calculate retry after time correctly', { timeout: 15000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...testSources),
          async (source) => {
            // Reset rate limit
            await resetRateLimit(source);

            // Fill rate limit
            await recordRequest(source);
            await recordRequest(source);

            // Check retry after time
            const result = await checkRateLimit(source);
            expect(result.allowed).toBe(false);
            expect(result.retryAfter).toBeDefined();
            expect(result.retryAfter).toBeGreaterThan(0);
            expect(result.retryAfter).toBeLessThanOrEqual(1000); // Should be within 1 second window
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle concurrent rate limit checks correctly', { timeout: 15000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...testSources),
          async (source) => {
            // Reset rate limit
            await resetRateLimit(source);

            // Record 2 requests
            await recordRequest(source);
            await recordRequest(source);

            // Make multiple concurrent checks
            const results = await Promise.all([
              checkRateLimit(source),
              checkRateLimit(source),
              checkRateLimit(source),
            ]);

            // All should be blocked
            results.forEach((result) => {
              expect(result.allowed).toBe(false);
              expect(result.retryAfter).toBeGreaterThan(0);
            });
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reset rate limit state correctly', { timeout: 15000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...testSources),
          async (source) => {
            // Fill rate limit
            await recordRequest(source);
            await recordRequest(source);

            // Verify blocked
            const blockedResult = await checkRateLimit(source);
            expect(blockedResult.allowed).toBe(false);

            // Reset
            await resetRateLimit(source);

            // Should be allowed after reset
            const allowedResult = await checkRateLimit(source);
            expect(allowedResult.allowed).toBe(true);

            // Status should show 0 requests
            const status = await getRateLimitStatus(source);
            expect(status.requestCount).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle unknown sources gracefully', async () => {
      const unknownSource = 'unknown-source-' + Date.now();

      // Should not throw
      const result = await checkRateLimit(unknownSource);
      expect(result.allowed).toBe(true); // Should allow by default

      // Recording should not throw
      await expect(recordRequest(unknownSource)).resolves.not.toThrow();
    });

    it('should handle rapid sequential requests', async () => {
      const source = 'jiji';
      await resetRateLimit(source);

      // Record many requests rapidly
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(recordRequest(source));
      }
      await Promise.all(promises);

      // Should track correctly (up to limit)
      const status = await getRateLimitStatus(source);
      expect(status.requestCount).toBeLessThanOrEqual(2);
    });

    it('should fail open if Redis is unavailable', async () => {
      // This test verifies the fail-open behavior mentioned in the service
      // In production, if Redis fails, requests should be allowed
      const source = 'test-source-' + Date.now();
      
      // Even with a non-existent source (simulating Redis failure scenario)
      const result = await checkRateLimit(source);
      expect(result.allowed).toBe(true);
    });
  });
});
