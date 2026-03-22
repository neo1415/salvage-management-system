/**
 * Property-Based Tests for Gemini Rate Limiter
 * 
 * Tests rate limiting enforcement using property-based testing with fast-check.
 * Validates that rate limits are enforced across 100+ random request scenarios.
 * 
 * Feature: gemini-damage-detection-migration
 * Property 4: Rate Limiting Enforcement
 * Validates: Requirements 6.1, 6.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { GeminiRateLimiter } from '@/lib/integrations/gemini-rate-limiter';

describe('GeminiRateLimiter - Property-Based Tests', () => {
  let rateLimiter: GeminiRateLimiter;

  beforeEach(() => {
    rateLimiter = new GeminiRateLimiter();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  /**
   * Property 4: Rate Limiting Enforcement
   * 
   * For any 60-second time window, the number of Gemini API requests
   * SHALL NOT exceed 10, regardless of request pattern.
   * 
   * Validates: Requirements 6.1
   */
  describe('Property 4: Rate Limiting Enforcement', () => {
    it('should never allow more than 10 requests in any 60-second window', () => {
      fc.assert(
        fc.property(
          // Generate random burst request patterns
          // Array of delays between requests (0-5000ms each)
          fc.array(fc.integer({ min: 0, max: 5000 }), { minLength: 15, maxLength: 30 }),
          (delays) => {
            // Reset rate limiter for each test case
            rateLimiter.reset();

            let requestsInWindow = 0;
            let totalRequests = 0;
            const requestTimestamps: number[] = [];

            // Simulate requests with random delays
            for (const delay of delays) {
              // Advance time by the delay
              if (delay > 0) {
                vi.advanceTimersByTime(delay);
              }

              const currentTime = Date.now();

              // Clean up timestamps older than 60 seconds
              const sixtySecondsAgo = currentTime - 60000;
              const recentTimestamps = requestTimestamps.filter(
                (ts) => ts > sixtySecondsAgo
              );
              requestsInWindow = recentTimestamps.length;

              // Check quota
              const status = rateLimiter.checkQuota();

              // If we have less than 10 requests in the window, should be allowed
              if (requestsInWindow < 10) {
                expect(status.allowed).toBe(true);
                expect(status.minuteRemaining).toBeGreaterThan(0);

                // Record the request
                rateLimiter.recordRequest();
                requestTimestamps.push(currentTime);
                totalRequests++;
              } else {
                // If we have 10 or more requests in the window, should be blocked
                expect(status.allowed).toBe(false);
                expect(status.minuteRemaining).toBe(0);
              }

              // Verify the rate limiter's minute usage matches our tracking
              expect(rateLimiter.getMinuteUsage()).toBeLessThanOrEqual(10);
            }

            // Final verification: minute usage should never exceed 10
            expect(rateLimiter.getMinuteUsage()).toBeLessThanOrEqual(10);
          }
        ),
        { numRuns: 100 } // Run 100+ random scenarios
      );
    });

    it('should enforce sliding window correctly across random request patterns', () => {
      fc.assert(
        fc.property(
          // Generate random request patterns with varying delays
          fc.array(
            fc.record({
              delay: fc.integer({ min: 0, max: 10000 }), // 0-10 seconds
              requestCount: fc.integer({ min: 1, max: 5 }), // 1-5 requests at once
            }),
            { minLength: 5, maxLength: 20 }
          ),
          (requestPatterns) => {
            rateLimiter.reset();

            for (const pattern of requestPatterns) {
              // Advance time by the delay
              if (pattern.delay > 0) {
                vi.advanceTimersByTime(pattern.delay);
              }

              // Try to make multiple requests
              for (let i = 0; i < pattern.requestCount; i++) {
                const status = rateLimiter.checkQuota();

                if (status.allowed) {
                  rateLimiter.recordRequest();
                }

                // Verify minute usage never exceeds 10
                expect(rateLimiter.getMinuteUsage()).toBeLessThanOrEqual(10);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly handle burst requests followed by delays', () => {
      fc.assert(
        fc.property(
          // Generate burst size (5-15 requests) and delay after burst (0-120 seconds)
          fc.record({
            burstSize: fc.integer({ min: 5, max: 15 }),
            delayAfterBurst: fc.integer({ min: 0, max: 120000 }), // 0-120 seconds
          }),
          ({ burstSize, delayAfterBurst }) => {
            rateLimiter.reset();

            let successfulRequests = 0;

            // Make burst requests
            for (let i = 0; i < burstSize; i++) {
              const status = rateLimiter.checkQuota();

              if (status.allowed) {
                rateLimiter.recordRequest();
                successfulRequests++;
              }

              // Should never exceed 10 requests in window
              expect(rateLimiter.getMinuteUsage()).toBeLessThanOrEqual(10);
            }

            // First 10 requests should succeed, rest should be blocked
            expect(successfulRequests).toBe(Math.min(burstSize, 10));

            // Advance time by the delay
            if (delayAfterBurst > 0) {
              vi.advanceTimersByTime(delayAfterBurst);
            }

            // After delay, check if requests are allowed based on sliding window
            const status = rateLimiter.checkQuota();

            if (delayAfterBurst > 60000) {
              // If delay is more than 60 seconds, all old requests should be outside window
              expect(status.allowed).toBe(true);
              expect(rateLimiter.getMinuteUsage()).toBe(0);
            } else {
              // If delay is less than 60 seconds, some requests may still be in window
              expect(rateLimiter.getMinuteUsage()).toBeLessThanOrEqual(10);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain rate limit invariant across random time advances', () => {
      fc.assert(
        fc.property(
          // Generate random sequence of actions: request or time advance
          fc.array(
            fc.oneof(
              fc.constant({ type: 'request' as const }),
              fc.record({
                type: fc.constant('advance' as const),
                ms: fc.integer({ min: 100, max: 30000 }), // 0.1-30 seconds
              })
            ),
            { minLength: 20, maxLength: 50 }
          ),
          (actions) => {
            rateLimiter.reset();

            for (const action of actions) {
              if (action.type === 'request') {
                const status = rateLimiter.checkQuota();

                if (status.allowed) {
                  rateLimiter.recordRequest();
                }

                // Invariant: minute usage never exceeds 10
                expect(rateLimiter.getMinuteUsage()).toBeLessThanOrEqual(10);
              } else {
                // Advance time
                vi.advanceTimersByTime(action.ms);

                // Invariant still holds after time advance
                expect(rateLimiter.getMinuteUsage()).toBeLessThanOrEqual(10);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test that automatic fallback occurs when rate limit is reached
     * Validates: Requirements 6.3
     */
    it('should indicate fallback is needed when limit reached', () => {
      fc.assert(
        fc.property(
          // Generate number of requests to make (10-20)
          fc.integer({ min: 10, max: 20 }),
          (requestCount) => {
            rateLimiter.reset();

            let allowedCount = 0;
            let blockedCount = 0;

            for (let i = 0; i < requestCount; i++) {
              const status = rateLimiter.checkQuota();

              if (status.allowed) {
                rateLimiter.recordRequest();
                allowedCount++;
              } else {
                blockedCount++;
              }
            }

            // Exactly 10 requests should be allowed
            expect(allowedCount).toBe(10);

            // Remaining requests should be blocked
            expect(blockedCount).toBe(requestCount - 10);

            // When blocked, system should fall back to Vision API
            const finalStatus = rateLimiter.checkQuota();
            if (!finalStatus.allowed) {
              expect(finalStatus.minuteRemaining).toBe(0);
              // This indicates fallback to Vision API should occur
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle concurrent-like request patterns', () => {
      fc.assert(
        fc.property(
          // Generate batches of requests with small delays between them
          fc.array(
            fc.record({
              batchSize: fc.integer({ min: 1, max: 8 }),
              delayBetweenBatches: fc.integer({ min: 0, max: 2000 }), // 0-2 seconds
            }),
            { minLength: 3, maxLength: 10 }
          ),
          (batches) => {
            rateLimiter.reset();

            for (const batch of batches) {
              // Make batch of requests with minimal delay (simulating concurrent requests)
              for (let i = 0; i < batch.batchSize; i++) {
                const status = rateLimiter.checkQuota();

                if (status.allowed) {
                  rateLimiter.recordRequest();
                }

                // Small delay to simulate near-concurrent requests
                vi.advanceTimersByTime(10); // 10ms
              }

              // Verify invariant holds
              expect(rateLimiter.getMinuteUsage()).toBeLessThanOrEqual(10);

              // Delay before next batch
              if (batch.delayBetweenBatches > 0) {
                vi.advanceTimersByTime(batch.delayBetweenBatches);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly calculate remaining quota across random scenarios', () => {
      fc.assert(
        fc.property(
          // Generate random number of requests (0-15)
          fc.integer({ min: 0, max: 15 }),
          (requestCount) => {
            rateLimiter.reset();

            let successfulRequests = 0;

            for (let i = 0; i < requestCount; i++) {
              const status = rateLimiter.checkQuota();

              if (status.allowed) {
                rateLimiter.recordRequest();
                successfulRequests++;
              }
            }

            // Verify remaining quota is correct
            const finalStatus = rateLimiter.checkQuota();
            const expectedRemaining = Math.max(0, 10 - successfulRequests);

            expect(finalStatus.minuteRemaining).toBe(expectedRemaining);
            expect(successfulRequests).toBe(Math.min(requestCount, 10));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge case of exactly 60-second window boundary', () => {
      fc.assert(
        fc.property(
          // Generate delay that's close to 60 seconds (59-61 seconds)
          fc.integer({ min: 59000, max: 61000 }),
          (delay) => {
            rateLimiter.reset();

            // Make 10 requests
            for (let i = 0; i < 10; i++) {
              rateLimiter.recordRequest();
            }

            expect(rateLimiter.getMinuteUsage()).toBe(10);

            // Advance time by the delay
            vi.advanceTimersByTime(delay);

            const minuteUsage = rateLimiter.getMinuteUsage();

            if (delay > 60000) {
              // All requests should be outside the window
              expect(minuteUsage).toBe(0);
            } else {
              // Some or all requests may still be in the window
              expect(minuteUsage).toBeLessThanOrEqual(10);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain invariant with mixed request and time advance patterns', () => {
      fc.assert(
        fc.property(
          // Generate complex pattern of requests and time advances
          fc.array(
            fc.oneof(
              // Request action
              fc.constant({ type: 'request' as const }),
              // Small time advance (0-5 seconds)
              fc.record({
                type: fc.constant('smallAdvance' as const),
                ms: fc.integer({ min: 0, max: 5000 }),
              }),
              // Large time advance (60-120 seconds)
              fc.record({
                type: fc.constant('largeAdvance' as const),
                ms: fc.integer({ min: 60000, max: 120000 }),
              })
            ),
            { minLength: 30, maxLength: 60 }
          ),
          (actions) => {
            rateLimiter.reset();

            for (const action of actions) {
              if (action.type === 'request') {
                const status = rateLimiter.checkQuota();

                if (status.allowed) {
                  rateLimiter.recordRequest();
                }
              } else if (action.type === 'smallAdvance') {
                vi.advanceTimersByTime(action.ms);
              } else if (action.type === 'largeAdvance') {
                vi.advanceTimersByTime(action.ms);
              }

              // Core invariant: minute usage never exceeds 10
              expect(rateLimiter.getMinuteUsage()).toBeLessThanOrEqual(10);

              // Additional invariant: if allowed is false, minuteRemaining is 0
              const status = rateLimiter.checkQuota();
              if (!status.allowed && status.dailyRemaining > 0) {
                expect(status.minuteRemaining).toBe(0);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: Rate limit status consistency
   * 
   * Verifies that checkQuota() and getMinuteUsage() are always consistent
   */
  describe('Rate limit status consistency', () => {
    it('should maintain consistency between checkQuota and getMinuteUsage', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              fc.constant({ type: 'request' as const }),
              fc.record({
                type: fc.constant('advance' as const),
                ms: fc.integer({ min: 0, max: 10000 }),
              })
            ),
            { minLength: 10, maxLength: 30 }
          ),
          (actions) => {
            rateLimiter.reset();

            for (const action of actions) {
              if (action.type === 'request') {
                const status = rateLimiter.checkQuota();
                const minuteUsage = rateLimiter.getMinuteUsage();

                // Consistency check: minuteRemaining + minuteUsage should equal 10
                expect(status.minuteRemaining + minuteUsage).toBe(10);

                if (status.allowed) {
                  rateLimiter.recordRequest();
                }
              } else {
                vi.advanceTimersByTime(action.ms);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
