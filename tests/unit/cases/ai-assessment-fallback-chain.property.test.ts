/**
 * Property-Based Tests for AI Assessment Fallback Chain
 * 
 * Feature: gemini-damage-detection-migration
 * Property 3: Fallback Chain Execution Order
 * Validates: Requirements 5.1, 5.2, 5.4, 5.5
 * 
 * Tests that for any failure scenario, fallback order is Gemini → Vision → Neutral,
 * method field always indicates which service was used, and neutral scores are
 * returned when all methods fail.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { assessDamage } from '@/features/cases/services/ai-assessment.service';
import * as geminiService from '@/lib/integrations/gemini-damage-detection';
import * as visionService from '@/lib/integrations/vision-damage-detection';
import * as rateLimiter from '@/lib/integrations/gemini-rate-limiter';

// Mock all external services
vi.mock('@/lib/integrations/gemini-damage-detection');
vi.mock('@/lib/integrations/vision-damage-detection');
vi.mock('@/lib/integrations/gemini-rate-limiter');

describe('Property 3: Fallback Chain Execution Order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should always follow Gemini → Vision → Neutral fallback order for any failure scenario', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random failure scenarios
        fc.record({
          geminiFailure: fc.boolean(),
          visionFailure: fc.boolean(),
          rateLimitExceeded: fc.boolean(),
          imageUrls: fc.array(fc.webUrl(), { minLength: 1, maxLength: 6 }),
          marketValue: fc.integer({ min: 1000, max: 100000 }),
          vehicleContext: fc.record({
            make: fc.constantFrom('Toyota', 'Honda', 'Ford', 'BMW', 'Mercedes'),
            model: fc.string({ minLength: 3, maxLength: 20 }),
            year: fc.integer({ min: 2000, max: 2024 })
          })
        }),
        async (scenario) => {
          // Setup rate limiter mock
          vi.mocked(rateLimiter.checkGeminiQuota).mockReturnValue({
            allowed: !scenario.rateLimitExceeded,
            minuteRemaining: scenario.rateLimitExceeded ? 0 : 5,
            dailyRemaining: scenario.rateLimitExceeded ? 0 : 1000,
            resetAt: new Date()
          });

          // Setup Gemini mock
          if (scenario.geminiFailure || scenario.rateLimitExceeded) {
            vi.mocked(geminiService.assessDamageWithGemini).mockRejectedValue(
              new Error('Gemini service unavailable')
            );
          } else {
            vi.mocked(geminiService.assessDamageWithGemini).mockResolvedValue({
              structural: 45,
              mechanical: 30,
              cosmetic: 60,
              electrical: 20,
              interior: 25,
              severity: 'moderate' as const,
              airbagDeployed: false,
              totalLoss: false,
              summary: 'Moderate damage to body panels',
              confidence: 85,
              method: 'gemini' as const
            });
          }

          // Setup Vision mock
          if (scenario.visionFailure) {
            vi.mocked(visionService.assessDamageWithVision).mockRejectedValue(
              new Error('Vision service unavailable')
            );
          } else {
            vi.mocked(visionService.assessDamageWithVision).mockResolvedValue({
              labels: ['damaged', 'dent', 'scratch'],
              confidenceScore: 0.75,
              damagePercentage: 40,
              method: 'vision' as const
            });
          }

          // Execute assessment
          const result = await assessDamage(
            scenario.imageUrls,
            scenario.marketValue,
            scenario.vehicleContext
          );

          // Property 1: Method field must always be present and valid
          expect(result.method).toBeDefined();
          expect(['gemini', 'vision', 'neutral']).toContain(result.method);

          // Property 2: Fallback order must be respected
          if (!scenario.rateLimitExceeded && !scenario.geminiFailure) {
            // Gemini should succeed
            expect(result.method).toBe('gemini');
            expect(vi.mocked(geminiService.assessDamageWithGemini)).toHaveBeenCalled();
          } else if (!scenario.visionFailure) {
            // Gemini failed/skipped, Vision should succeed
            expect(result.method).toBe('vision');
            expect(vi.mocked(visionService.assessDamageWithVision)).toHaveBeenCalled();
          } else {
            // Both failed, Neutral should be used
            expect(result.method).toBe('neutral');
          }

          // Property 3: Neutral scores must be returned when all methods fail
          if (scenario.visionFailure && (scenario.geminiFailure || scenario.rateLimitExceeded)) {
            expect(result.method).toBe('neutral');
            expect(result.damagePercentage).toBe(50);
            expect(result.damageSeverity).toBe('moderate');
            expect(result.detailedScores).toEqual({
              structural: 50,
              mechanical: 50,
              cosmetic: 50,
              electrical: 50,
              interior: 50
            });
          }

          // Property 4: Result must always be valid regardless of fallback level
          expect(result.damagePercentage).toBeGreaterThanOrEqual(0);
          expect(result.damagePercentage).toBeLessThanOrEqual(100);
          expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
          expect(result.confidenceScore).toBeLessThanOrEqual(1);
          expect(['minor', 'moderate', 'severe']).toContain(result.damageSeverity);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should never skip fallback levels in the chain', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          imageUrls: fc.array(fc.webUrl(), { minLength: 1, maxLength: 6 }),
          marketValue: fc.integer({ min: 1000, max: 100000 }),
          vehicleContext: fc.record({
            make: fc.string({ minLength: 3, maxLength: 20 }),
            model: fc.string({ minLength: 3, maxLength: 20 }),
            year: fc.integer({ min: 2000, max: 2024 })
          })
        }),
        async (input) => {
          // Setup: Gemini fails
          vi.mocked(rateLimiter.checkGeminiQuota).mockReturnValue({
            allowed: true,
            minuteRemaining: 10,
            dailyRemaining: 1500,
            resetAt: new Date()
          });
          vi.mocked(geminiService.assessDamageWithGemini).mockRejectedValue(
            new Error('Gemini failed')
          );
          vi.mocked(visionService.assessDamageWithVision).mockResolvedValue({
            labels: ['damaged'],
            confidenceScore: 0.8,
            damagePercentage: 45,
            method: 'vision' as const
          });

          const result = await assessDamage(
            input.imageUrls,
            input.marketValue,
            input.vehicleContext
          );

          // Property: When Gemini fails, must attempt Vision (not skip to Neutral)
          expect(vi.mocked(geminiService.assessDamageWithGemini)).toHaveBeenCalled();
          expect(vi.mocked(visionService.assessDamageWithVision)).toHaveBeenCalled();
          expect(result.method).toBe('vision');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly identify which method was used for any input combination', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          geminiWorks: fc.boolean(),
          visionWorks: fc.boolean(),
          imageUrls: fc.array(fc.webUrl(), { minLength: 1, maxLength: 6 }),
          marketValue: fc.integer({ min: 1000, max: 100000 })
        }),
        async (scenario) => {
          // Setup mocks based on scenario
          vi.mocked(rateLimiter.checkGeminiQuota).mockReturnValue({
            allowed: true,
            minuteRemaining: 10,
            dailyRemaining: 1500,
            resetAt: new Date()
          });

          if (scenario.geminiWorks) {
            vi.mocked(geminiService.assessDamageWithGemini).mockResolvedValue({
              structural: 40,
              mechanical: 35,
              cosmetic: 55,
              electrical: 25,
              interior: 30,
              severity: 'moderate' as const,
              airbagDeployed: false,
              totalLoss: false,
              summary: 'Test damage',
              confidence: 80,
              method: 'gemini' as const
            });
          } else {
            vi.mocked(geminiService.assessDamageWithGemini).mockRejectedValue(
              new Error('Gemini failed')
            );
          }

          if (scenario.visionWorks) {
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

          const result = await assessDamage(scenario.imageUrls, scenario.marketValue);

          // Property: Method field must accurately reflect which service was used
          if (scenario.geminiWorks) {
            expect(result.method).toBe('gemini');
          } else if (scenario.visionWorks) {
            expect(result.method).toBe('vision');
          } else {
            expect(result.method).toBe('neutral');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle rate limit exceeded by skipping Gemini and using Vision', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          imageUrls: fc.array(fc.webUrl(), { minLength: 1, maxLength: 6 }),
          marketValue: fc.integer({ min: 1000, max: 100000 }),
          minuteRemaining: fc.integer({ min: 0, max: 0 }), // Rate limit exceeded
          dailyRemaining: fc.integer({ min: 0, max: 100 })
        }),
        async (input) => {
          // Setup: Rate limit exceeded
          vi.mocked(rateLimiter.checkGeminiQuota).mockReturnValue({
            allowed: false,
            minuteRemaining: input.minuteRemaining,
            dailyRemaining: input.dailyRemaining,
            resetAt: new Date()
          });

          vi.mocked(visionService.assessDamageWithVision).mockResolvedValue({
            labels: ['damaged'],
            confidenceScore: 0.8,
            damagePercentage: 45,
            method: 'vision' as const
          });

          const result = await assessDamage(input.imageUrls, input.marketValue);

          // Property: When rate limited, must skip Gemini and use Vision
          expect(vi.mocked(geminiService.assessDamageWithGemini)).not.toHaveBeenCalled();
          expect(vi.mocked(visionService.assessDamageWithVision)).toHaveBeenCalled();
          expect(result.method).toBe('vision');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should always return a valid assessment regardless of failure combinations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          geminiError: fc.option(fc.constantFrom(
            'timeout',
            'invalid_key',
            'network_error',
            'invalid_response'
          )),
          visionError: fc.option(fc.constantFrom(
            'timeout',
            'network_error',
            'invalid_response'
          )),
          imageUrls: fc.array(fc.webUrl(), { minLength: 1, maxLength: 6 }),
          marketValue: fc.integer({ min: 1000, max: 100000 })
        }),
        async (scenario) => {
          // Setup mocks with various error types
          vi.mocked(rateLimiter.checkGeminiQuota).mockReturnValue({
            allowed: true,
            minuteRemaining: 10,
            dailyRemaining: 1500,
            resetAt: new Date()
          });

          if (scenario.geminiError) {
            vi.mocked(geminiService.assessDamageWithGemini).mockRejectedValue(
              new Error(`Gemini ${scenario.geminiError}`)
            );
          } else {
            vi.mocked(geminiService.assessDamageWithGemini).mockResolvedValue({
              structural: 50,
              mechanical: 40,
              cosmetic: 60,
              electrical: 30,
              interior: 35,
              severity: 'moderate' as const,
              airbagDeployed: false,
              totalLoss: false,
              summary: 'Test',
              confidence: 85,
              method: 'gemini' as const
            });
          }

          if (scenario.visionError) {
            vi.mocked(visionService.assessDamageWithVision).mockRejectedValue(
              new Error(`Vision ${scenario.visionError}`)
            );
          } else {
            vi.mocked(visionService.assessDamageWithVision).mockResolvedValue({
              labels: ['damaged'],
              confidenceScore: 0.75,
              damagePercentage: 45,
              method: 'vision' as const
            });
          }

          const result = await assessDamage(scenario.imageUrls, scenario.marketValue);

          // Property: Must always return a valid assessment
          expect(result).toBeDefined();
          expect(result.method).toBeDefined();
          expect(result.damagePercentage).toBeGreaterThanOrEqual(0);
          expect(result.damagePercentage).toBeLessThanOrEqual(100);
          expect(result.damageSeverity).toBeDefined();
          expect(['minor', 'moderate', 'severe']).toContain(result.damageSeverity);
        }
      ),
      { numRuns: 100 }
    );
  });
});
