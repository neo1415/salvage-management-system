/**
 * Property-Based Tests for AI Assessment Timeout Guarantee
 * 
 * Feature: gemini-damage-detection-migration
 * Property 9: Assessment Timeout Guarantee
 * Validates: Requirement 9.3
 * 
 * Tests that for any assessment request, total processing time never exceeds
 * 30 seconds regardless of which fallback level is reached.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { assessDamage } from '@/features/cases/services/ai-assessment.service';
import * as geminiService from '@/lib/integrations/gemini-damage-detection';
import * as visionService from '@/lib/integrations/vision-damage-detection';
import { getGeminiRateLimiter } from '@/lib/integrations/gemini-rate-limiter';

// Mock all external services
vi.mock('@/lib/integrations/gemini-damage-detection');
vi.mock('@/lib/integrations/vision-damage-detection');
vi.mock('@/lib/integrations/gemini-rate-limiter');

describe('Property 9: Assessment Timeout Guarantee', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default rate limiter mock
    vi.mocked(getGeminiRateLimiter).mockReturnValue({
      checkQuota: vi.fn().mockReturnValue({
        allowed: true,
        minuteRemaining: 10,
        dailyRemaining: 1500,
        resetAt: new Date()
      }),
      recordRequest: vi.fn(),
      getDailyUsage: vi.fn().mockReturnValue(0),
      getMinuteUsage: vi.fn().mockReturnValue(0),
      reset: vi.fn()
    } as any);
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should complete within 30 seconds for any input regardless of fallback level', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          imageUrls: fc.array(fc.webUrl(), { minLength: 1, maxLength: 6 }),
          marketValue: fc.integer({ min: 1000, max: 100000 }),
          vehicleContext: fc.option(fc.record({
            make: fc.string({ minLength: 3, maxLength: 20 }),
            model: fc.string({ minLength: 3, maxLength: 20 }),
            year: fc.integer({ min: 2000, max: 2024 })
          })),
          geminiSuccess: fc.boolean(),
          visionSuccess: fc.boolean()
        }),
        async (scenario) => {
          // Setup Gemini mock
          if (scenario.geminiSuccess) {
            vi.mocked(geminiService.assessDamageWithGemini).mockResolvedValue({
              structural: 45,
              mechanical: 30,
              cosmetic: 60,
              electrical: 20,
              interior: 25,
              severity: 'moderate' as const,
              airbagDeployed: false,
              totalLoss: false,
              summary: 'Test damage',
              confidence: 85,
              method: 'gemini' as const
            });
          } else {
            vi.mocked(geminiService.assessDamageWithGemini).mockRejectedValue(
              new Error('Gemini failed')
            );
          }

          // Setup Vision mock
          if (scenario.visionSuccess) {
            vi.mocked(visionService.assessDamageWithVision).mockResolvedValue({
              labels: ['damaged'],
              confidenceScore: 0.75,
              damagePercentage: 42,
              method: 'vision' as const
            });
          } else {
            vi.mocked(visionService.assessDamageWithVision).mockRejectedValue(
              new Error('Vision failed')
            );
          }

          // Measure execution time
          const startTime = Date.now();
          
          const result = await assessDamage(
            scenario.imageUrls,
            scenario.marketValue,
            scenario.vehicleContext || undefined
          );

          const duration = Date.now() - startTime;

          // Property: Total time must not exceed 30 seconds (30000ms)
          expect(duration).toBeLessThan(30000);

          // Verify result is valid
          expect(result).toBeDefined();
          expect(result.method).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should complete quickly when using neutral fallback', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          imageUrls: fc.array(fc.webUrl(), { minLength: 1, maxLength: 6 }),
          marketValue: fc.integer({ min: 1000, max: 100000 })
        }),
        async (scenario) => {
          // Setup: Both Gemini and Vision fail immediately
          vi.mocked(geminiService.assessDamageWithGemini).mockRejectedValue(
            new Error('Gemini failed')
          );

          vi.mocked(visionService.assessDamageWithVision).mockRejectedValue(
            new Error('Vision failed')
          );

          const startTime = Date.now();
          
          const result = await assessDamage(scenario.imageUrls, scenario.marketValue);

          const duration = Date.now() - startTime;

          // Property: Neutral fallback should be very fast (<1 second)
          expect(duration).toBeLessThan(1000);
          
          // Should use neutral method
          expect(result.method).toBe('neutral');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle concurrent requests without exceeding timeout', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          requestCount: fc.integer({ min: 2, max: 5 }),
          imageUrls: fc.array(fc.webUrl(), { minLength: 1, maxLength: 6 }),
          marketValue: fc.integer({ min: 1000, max: 100000 })
        }),
        async (scenario) => {
          // Setup mocks
          vi.mocked(geminiService.assessDamageWithGemini).mockResolvedValue({
            structural: 45,
            mechanical: 30,
            cosmetic: 60,
            electrical: 20,
            interior: 25,
            severity: 'moderate' as const,
            airbagDeployed: false,
            totalLoss: false,
            summary: 'Test',
            confidence: 85,
            method: 'gemini' as const
          });

          // Create multiple concurrent requests
          const requests = Array.from({ length: scenario.requestCount }, () =>
            assessDamage(scenario.imageUrls, scenario.marketValue)
          );

          const startTime = Date.now();
          
          const results = await Promise.all(requests);

          const duration = Date.now() - startTime;

          // Property: All concurrent requests should complete within 30 seconds
          expect(duration).toBeLessThan(30000);
          
          // All results should be valid
          results.forEach(result => {
            expect(result).toBeDefined();
            expect(result.method).toBeDefined();
          });
        }
      ),
      { numRuns: 50 } // Fewer runs due to concurrent operations
    );
  });

  it('should respect timeout across all fallback levels', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          imageUrls: fc.array(fc.webUrl(), { minLength: 1, maxLength: 6 }),
          marketValue: fc.integer({ min: 1000, max: 100000 }),
          fallbackLevel: fc.constantFrom('gemini', 'vision', 'neutral')
        }),
        async (scenario) => {
          // Setup based on fallback level
          if (scenario.fallbackLevel === 'gemini') {
            // Gemini succeeds
            vi.mocked(geminiService.assessDamageWithGemini).mockResolvedValue({
              structural: 45,
              mechanical: 30,
              cosmetic: 60,
              electrical: 20,
              interior: 25,
              severity: 'moderate' as const,
              airbagDeployed: false,
              totalLoss: false,
              summary: 'Test',
              confidence: 85,
              method: 'gemini' as const
            });
          } else {
            // Gemini fails
            vi.mocked(geminiService.assessDamageWithGemini).mockRejectedValue(
              new Error('Gemini failed')
            );
          }

          if (scenario.fallbackLevel === 'vision' || scenario.fallbackLevel === 'gemini') {
            // Vision succeeds
            vi.mocked(visionService.assessDamageWithVision).mockResolvedValue({
              labels: ['damaged'],
              confidenceScore: 0.75,
              damagePercentage: 42,
              method: 'vision' as const
            });
          } else {
            // Vision fails
            vi.mocked(visionService.assessDamageWithVision).mockRejectedValue(
              new Error('Vision failed')
            );
          }

          const startTime = Date.now();
          
          const result = await assessDamage(scenario.imageUrls, scenario.marketValue);

          const duration = Date.now() - startTime;

          // Property: Must complete within 30 seconds at any fallback level
          expect(duration).toBeLessThan(30000);
          
          // Result must be valid
          expect(result).toBeDefined();
          expect(result.method).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});
