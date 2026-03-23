/**
 * Property-Based Tests for Logging Completeness
 * 
 * Tests that all required logging occurs for damage assessments using property-based testing with fast-check.
 * Validates logging across 100+ random assessment scenarios.
 * 
 * Feature: gemini-damage-detection-migration
 * Property 10: Logging Completeness
 * Validates: Requirements 5.3, 9.4, 10.2, 10.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { assessDamage } from '@/features/cases/services/ai-assessment.service';
import { 
  assessDamageWithGemini,
  initializeGeminiService,
  resetGeminiService,
  type VehicleContext,
} from '@/lib/integrations/gemini-damage-detection';
import { 
  assessDamageWithVision 
} from '@/lib/integrations/vision-damage-detection';
import { GeminiRateLimiter } from '@/lib/integrations/gemini-rate-limiter';

// Mock the integrations
vi.mock('@/lib/integrations/gemini-damage-detection', async () => {
  const actual = await vi.importActual('@/lib/integrations/gemini-damage-detection');
  return {
    ...actual,
    assessDamageWithGemini: vi.fn(),
    initializeGeminiService: vi.fn(),
    isGeminiEnabled: vi.fn(),
  };
});

vi.mock('@/lib/integrations/vision-damage-detection', () => ({
  assessDamageWithVision: vi.fn(),
}));

vi.mock('@/lib/integrations/gemini-rate-limiter', () => {
  const mockRateLimiter = {
    checkQuota: vi.fn(),
    recordRequest: vi.fn(),
    getDailyUsage: vi.fn(),
    getMinuteUsage: vi.fn(),
    reset: vi.fn(),
  };
  
  return {
    GeminiRateLimiter: vi.fn(() => mockRateLimiter),
    getGeminiRateLimiter: vi.fn(() => mockRateLimiter),
  };
});

describe('Logging Completeness - Property-Based Tests', () => {
  let consoleInfoSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;
  let mockRateLimiter: any;

  beforeEach(async () => {
    // Spy on console methods to capture logs
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Reset mocks
    vi.clearAllMocks();

    // Get mock rate limiter
    const { getGeminiRateLimiter } = await import('@/lib/integrations/gemini-rate-limiter');
    mockRateLimiter = getGeminiRateLimiter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Property 10: Logging Completeness
   * 
   * For any damage assessment request, the system SHALL log:
   * - The assessment method used ('gemini', 'vision', or 'neutral')
   * - For Gemini requests: timestamp, photo count, and quota usage
   * - For any fallback: the reason for fallback
   * 
   * Validates: Requirements 5.3, 9.4, 10.2, 10.3
   */
  describe('Property 10: Logging Completeness', () => {
    /**
     * Test that method used is logged for any assessment request
     * Validates: Requirement 9.4
     */
    it('should log the assessment method for any request', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random assessment scenarios
          fc.record({
            photoCount: fc.integer({ min: 1, max: 10 }),
            marketValue: fc.integer({ min: 10000, max: 1000000 }),
            vehicleContext: fc.record({
              make: fc.constantFrom('Toyota', 'Honda', 'Ford', 'BMW', 'Mercedes'),
              model: fc.constantFrom('Camry', 'Accord', 'F-150', 'X5', 'C-Class'),
              year: fc.integer({ min: 2010, max: 2024 }),
            }),
            geminiEnabled: fc.boolean(),
            geminiSuccess: fc.boolean(),
            visionSuccess: fc.boolean(),
          }),
          async (scenario) => {
            // Clear previous logs
            consoleInfoSpy.mockClear();
            consoleWarnSpy.mockClear();
            consoleErrorSpy.mockClear();

            // Generate image URLs
            const imageUrls = Array.from(
              { length: scenario.photoCount },
              (_, i) => `https://example.com/photo${i}.jpg`
            );

            // Setup mocks based on scenario
            const { isGeminiEnabled } = await import('@/lib/integrations/gemini-damage-detection');
            (isGeminiEnabled as any).mockReturnValue(scenario.geminiEnabled);

            // Mock rate limiter to allow requests
            mockRateLimiter.checkQuota.mockReturnValue({
              allowed: true,
              minuteRemaining: 10,
              dailyRemaining: 1500,
              resetAt: new Date(),
            });

            // Mock Gemini assessment
            if (scenario.geminiEnabled && scenario.geminiSuccess) {
              (assessDamageWithGemini as any).mockResolvedValue({
                structural: 50,
                mechanical: 40,
                cosmetic: 60,
                electrical: 30,
                interior: 45,
                severity: 'moderate',
                airbagDeployed: false,
                totalLoss: false,
                summary: 'Moderate damage detected',
                confidence: 85,
                method: 'gemini',
              });
            } else if (scenario.geminiEnabled) {
              (assessDamageWithGemini as any).mockRejectedValue(
                new Error('Gemini API error')
              );
            }

            // Mock Vision assessment
            if (scenario.visionSuccess) {
              (assessDamageWithVision as any).mockResolvedValue({
                labels: ['damage', 'dent', 'scratch'],
                confidenceScore: 75,
                damagePercentage: 45,
                method: 'vision',
              });
            } else {
              (assessDamageWithVision as any).mockRejectedValue(
                new Error('Vision API error')
              );
            }

            // Perform assessment
            try {
              await assessDamage(
                imageUrls,
                scenario.marketValue,
                scenario.vehicleContext
              );
            } catch (error) {
              // Some scenarios may fail completely (both Gemini and Vision fail)
              // That's okay - we still check logging
            }

            // Verify that method was logged
            const allLogs = [
              ...consoleInfoSpy.mock.calls.map((call: any) => call[0]),
              ...consoleWarnSpy.mock.calls.map((call: any) => call[0]),
              ...consoleErrorSpy.mock.calls.map((call: any) => call[0]),
            ].join(' ');

            // At least one of the methods should be mentioned in logs
            const methodLogged =
              allLogs.includes('gemini') ||
              allLogs.includes('vision') ||
              allLogs.includes('neutral') ||
              allLogs.includes('Gemini') ||
              allLogs.includes('Vision') ||
              allLogs.includes('Neutral');

            expect(methodLogged).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test that Gemini requests log timestamp, photo count, and quota usage
     * Validates: Requirements 10.2, 10.3
     */
    it('should log timestamp, photo count, and quota for Gemini requests', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random Gemini assessment scenarios
          fc.record({
            photoCount: fc.integer({ min: 1, max: 6 }),
            marketValue: fc.integer({ min: 10000, max: 1000000 }),
            vehicleContext: fc.record({
              make: fc.constantFrom('Toyota', 'Honda', 'Ford'),
              model: fc.constantFrom('Camry', 'Accord', 'F-150'),
              year: fc.integer({ min: 2015, max: 2024 }),
            }),
            quotaRemaining: fc.record({
              minuteRemaining: fc.integer({ min: 1, max: 10 }),
              dailyRemaining: fc.integer({ min: 100, max: 1500 }),
            }),
          }),
          async (scenario) => {
            // Clear previous logs
            consoleInfoSpy.mockClear();
            consoleWarnSpy.mockClear();
            consoleErrorSpy.mockClear();

            // Generate image URLs
            const imageUrls = Array.from(
              { length: scenario.photoCount },
              (_, i) => `https://example.com/photo${i}.jpg`
            );

            // Setup mocks for successful Gemini assessment
            const { isGeminiEnabled } = await import('@/lib/integrations/gemini-damage-detection');
            (isGeminiEnabled as any).mockReturnValue(true);

            mockRateLimiter.checkQuota.mockReturnValue({
              allowed: true,
              minuteRemaining: scenario.quotaRemaining.minuteRemaining,
              dailyRemaining: scenario.quotaRemaining.dailyRemaining,
              resetAt: new Date(),
            });

            (assessDamageWithGemini as any).mockResolvedValue({
              structural: 50,
              mechanical: 40,
              cosmetic: 60,
              electrical: 30,
              interior: 45,
              severity: 'moderate',
              airbagDeployed: false,
              totalLoss: false,
              summary: 'Moderate damage detected',
              confidence: 85,
              method: 'gemini',
            });

            // Perform assessment
            await assessDamage(
              imageUrls,
              scenario.marketValue,
              scenario.vehicleContext
            );

            // Collect all logs
            const allLogs = [
              ...consoleInfoSpy.mock.calls.map((call: any) => call[0]),
              ...consoleWarnSpy.mock.calls.map((call: any) => call[0]),
            ].join(' ');

            // Verify photo count is logged
            const photoCountLogged =
              allLogs.includes(`Photos: ${scenario.photoCount}`) ||
              allLogs.includes(`${scenario.photoCount} photo`) ||
              allLogs.match(new RegExp(`photos?.*${scenario.photoCount}`, 'i')) !== null;

            expect(photoCountLogged).toBe(true);

            // Verify quota information is logged (either remaining or usage)
            const quotaLogged =
              allLogs.includes('quota') ||
              allLogs.includes('Quota') ||
              allLogs.includes('remaining') ||
              allLogs.includes('Remaining') ||
              allLogs.match(/\d+\/minute/) !== null ||
              allLogs.match(/\d+\/day/) !== null;

            expect(quotaLogged).toBe(true);

            // Verify timestamp is present (Request ID contains timestamp or explicit timestamp)
            const timestampLogged =
              allLogs.includes('Request ID:') ||
              allLogs.match(/\d{13}/) !== null || // Unix timestamp in milliseconds
              allLogs.includes('timestamp') ||
              allLogs.includes('Timestamp');

            expect(timestampLogged).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test that fallback reason is logged for any fallback
     * Validates: Requirement 5.3
     */
    it('should log fallback reason when fallback occurs', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random fallback scenarios
          fc.record({
            photoCount: fc.integer({ min: 1, max: 6 }),
            marketValue: fc.integer({ min: 10000, max: 1000000 }),
            vehicleContext: fc.record({
              make: fc.constantFrom('Toyota', 'Honda', 'Ford'),
              model: fc.constantFrom('Camry', 'Accord', 'F-150'),
              year: fc.integer({ min: 2015, max: 2024 }),
            }),
            fallbackScenario: fc.constantFrom(
              'gemini-rate-limit',
              'gemini-api-error',
              'gemini-timeout',
              'gemini-disabled',
              'vision-failure'
            ),
          }),
          async (scenario) => {
            // Clear previous logs
            consoleInfoSpy.mockClear();
            consoleWarnSpy.mockClear();
            consoleErrorSpy.mockClear();

            // Generate image URLs
            const imageUrls = Array.from(
              { length: scenario.photoCount },
              (_, i) => `https://example.com/photo${i}.jpg`
            );

            // Setup mocks based on fallback scenario
            const { isGeminiEnabled } = await import('@/lib/integrations/gemini-damage-detection');

            switch (scenario.fallbackScenario) {
              case 'gemini-rate-limit':
                (isGeminiEnabled as any).mockReturnValue(true);
                mockRateLimiter.checkQuota.mockReturnValue({
                  allowed: false,
                  minuteRemaining: 0,
                  dailyRemaining: 1000,
                  resetAt: new Date(),
                });
                (assessDamageWithVision as any).mockResolvedValue({
                  labels: ['damage'],
                  confidenceScore: 75,
                  damagePercentage: 45,
                  method: 'vision',
                });
                break;

              case 'gemini-api-error':
                (isGeminiEnabled as any).mockReturnValue(true);
                mockRateLimiter.checkQuota.mockReturnValue({
                  allowed: true,
                  minuteRemaining: 10,
                  dailyRemaining: 1500,
                  resetAt: new Date(),
                });
                (assessDamageWithGemini as any).mockRejectedValue(
                  new Error('API error: 500 Internal Server Error')
                );
                (assessDamageWithVision as any).mockResolvedValue({
                  labels: ['damage'],
                  confidenceScore: 75,
                  damagePercentage: 45,
                  method: 'vision',
                });
                break;

              case 'gemini-timeout':
                (isGeminiEnabled as any).mockReturnValue(true);
                mockRateLimiter.checkQuota.mockReturnValue({
                  allowed: true,
                  minuteRemaining: 10,
                  dailyRemaining: 1500,
                  resetAt: new Date(),
                });
                (assessDamageWithGemini as any).mockRejectedValue(
                  new Error('Gemini API call timed out after 10000ms')
                );
                (assessDamageWithVision as any).mockResolvedValue({
                  labels: ['damage'],
                  confidenceScore: 75,
                  damagePercentage: 45,
                  method: 'vision',
                });
                break;

              case 'gemini-disabled':
                (isGeminiEnabled as any).mockReturnValue(false);
                (assessDamageWithVision as any).mockResolvedValue({
                  labels: ['damage'],
                  confidenceScore: 75,
                  damagePercentage: 45,
                  method: 'vision',
                });
                break;

              case 'vision-failure':
                (isGeminiEnabled as any).mockReturnValue(true);
                mockRateLimiter.checkQuota.mockReturnValue({
                  allowed: true,
                  minuteRemaining: 10,
                  dailyRemaining: 1500,
                  resetAt: new Date(),
                });
                (assessDamageWithGemini as any).mockRejectedValue(
                  new Error('Gemini API error')
                );
                (assessDamageWithVision as any).mockRejectedValue(
                  new Error('Vision API error')
                );
                break;
            }

            // Perform assessment
            try {
              await assessDamage(
                imageUrls,
                scenario.marketValue,
                scenario.vehicleContext
              );
            } catch (error) {
              // Some scenarios may fail completely
            }

            // Collect all logs
            const allLogs = [
              ...consoleInfoSpy.mock.calls.map((call: any) => call[0]),
              ...consoleWarnSpy.mock.calls.map((call: any) => call[0]),
              ...consoleErrorSpy.mock.calls.map((call: any) => call[0]),
            ].join(' ');

            // Verify fallback reason is logged
            let fallbackReasonLogged = false;

            switch (scenario.fallbackScenario) {
              case 'gemini-rate-limit':
                fallbackReasonLogged =
                  allLogs.includes('rate limit') ||
                  allLogs.includes('Rate limit') ||
                  allLogs.includes('quota') ||
                  allLogs.includes('Quota') ||
                  allLogs.includes('exceeded');
                break;

              case 'gemini-api-error':
              case 'gemini-timeout':
                fallbackReasonLogged =
                  allLogs.includes('failed') ||
                  allLogs.includes('Failed') ||
                  allLogs.includes('error') ||
                  allLogs.includes('Error') ||
                  allLogs.includes('Falling back') ||
                  allLogs.includes('fallback');
                break;

              case 'gemini-disabled':
                fallbackReasonLogged =
                  allLogs.includes('not enabled') ||
                  allLogs.includes('disabled') ||
                  allLogs.includes('Using Vision');
                break;

              case 'vision-failure':
                fallbackReasonLogged =
                  allLogs.includes('failed') ||
                  allLogs.includes('Failed') ||
                  allLogs.includes('neutral') ||
                  allLogs.includes('Neutral');
                break;
            }

            expect(fallbackReasonLogged).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test comprehensive logging across all assessment types
     * Validates: Requirements 5.3, 9.4, 10.2, 10.3
     */
    it('should log complete information for all assessment types', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate comprehensive random scenarios
          fc.record({
            photoCount: fc.integer({ min: 1, max: 10 }),
            marketValue: fc.integer({ min: 10000, max: 1000000 }),
            vehicleContext: fc.record({
              make: fc.constantFrom('Toyota', 'Honda', 'Ford', 'BMW', 'Mercedes', 'Nissan'),
              model: fc.constantFrom('Camry', 'Accord', 'F-150', 'X5', 'C-Class', 'Altima'),
              year: fc.integer({ min: 2010, max: 2024 }),
            }),
            assessmentOutcome: fc.constantFrom(
              'gemini-success',
              'gemini-fail-vision-success',
              'all-fail-neutral'
            ),
          }),
          async (scenario) => {
            // Clear previous logs
            consoleInfoSpy.mockClear();
            consoleWarnSpy.mockClear();
            consoleErrorSpy.mockClear();

            // Generate image URLs
            const imageUrls = Array.from(
              { length: scenario.photoCount },
              (_, i) => `https://example.com/photo${i}.jpg`
            );

            // Setup mocks based on outcome
            const { isGeminiEnabled } = await import('@/lib/integrations/gemini-damage-detection');

            switch (scenario.assessmentOutcome) {
              case 'gemini-success':
                (isGeminiEnabled as any).mockReturnValue(true);
                mockRateLimiter.checkQuota.mockReturnValue({
                  allowed: true,
                  minuteRemaining: 8,
                  dailyRemaining: 1200,
                  resetAt: new Date(),
                });
                (assessDamageWithGemini as any).mockResolvedValue({
                  structural: 50,
                  mechanical: 40,
                  cosmetic: 60,
                  electrical: 30,
                  interior: 45,
                  severity: 'moderate',
                  airbagDeployed: false,
                  totalLoss: false,
                  summary: 'Moderate damage detected',
                  confidence: 85,
                  method: 'gemini',
                });
                break;

              case 'gemini-fail-vision-success':
                (isGeminiEnabled as any).mockReturnValue(true);
                mockRateLimiter.checkQuota.mockReturnValue({
                  allowed: true,
                  minuteRemaining: 8,
                  dailyRemaining: 1200,
                  resetAt: new Date(),
                });
                (assessDamageWithGemini as any).mockRejectedValue(
                  new Error('Gemini API error')
                );
                (assessDamageWithVision as any).mockResolvedValue({
                  labels: ['damage', 'dent'],
                  confidenceScore: 75,
                  damagePercentage: 45,
                  method: 'vision',
                });
                break;

              case 'all-fail-neutral':
                (isGeminiEnabled as any).mockReturnValue(true);
                mockRateLimiter.checkQuota.mockReturnValue({
                  allowed: true,
                  minuteRemaining: 8,
                  dailyRemaining: 1200,
                  resetAt: new Date(),
                });
                (assessDamageWithGemini as any).mockRejectedValue(
                  new Error('Gemini API error')
                );
                (assessDamageWithVision as any).mockRejectedValue(
                  new Error('Vision API error')
                );
                break;
            }

            // Perform assessment
            try {
              const result = await assessDamage(
                imageUrls,
                scenario.marketValue,
                scenario.vehicleContext
              );

              // Verify result has method field
              expect(result.method).toBeDefined();
              expect(['gemini', 'vision', 'neutral']).toContain(result.method);
            } catch (error) {
              // Complete failure is acceptable for all-fail-neutral scenario
            }

            // Collect all logs
            const allLogs = [
              ...consoleInfoSpy.mock.calls.map((call: any) => call[0]),
              ...consoleWarnSpy.mock.calls.map((call: any) => call[0]),
              ...consoleErrorSpy.mock.calls.map((call: any) => call[0]),
            ].join(' ');

            // Verify comprehensive logging
            // 1. Request ID should be present (contains timestamp)
            expect(allLogs).toMatch(/Request ID:/);

            // 2. Photo count should be logged
            const photoCountPattern = new RegExp(`${Math.min(scenario.photoCount, 6)}`);
            expect(allLogs).toMatch(photoCountPattern);

            // 3. Vehicle context should be logged
            expect(allLogs).toContain(scenario.vehicleContext.make);

            // 4. Method or outcome should be logged
            const methodLogged =
              allLogs.includes('Gemini') ||
              allLogs.includes('Vision') ||
              allLogs.includes('neutral') ||
              allLogs.includes('succeeded') ||
              allLogs.includes('failed');
            expect(methodLogged).toBe(true);

            // 5. For Gemini attempts, quota should be logged
            if (scenario.assessmentOutcome.startsWith('gemini')) {
              const quotaLogged =
                allLogs.includes('quota') ||
                allLogs.includes('Quota') ||
                allLogs.includes('remaining');
              expect(quotaLogged).toBe(true);
            }

            // 6. For fallback scenarios, reason should be logged
            if (scenario.assessmentOutcome !== 'gemini-success') {
              const fallbackLogged =
                allLogs.includes('failed') ||
                allLogs.includes('Failed') ||
                allLogs.includes('error') ||
                allLogs.includes('Error') ||
                allLogs.includes('fallback') ||
                allLogs.includes('Falling back');
              expect(fallbackLogged).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test that duration/timing information is logged
     * Validates: Requirement 10.2 (timestamp logging)
     */
    it('should log timing information for assessments', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            photoCount: fc.integer({ min: 1, max: 6 }),
            marketValue: fc.integer({ min: 10000, max: 500000 }),
            vehicleContext: fc.record({
              make: fc.constantFrom('Toyota', 'Honda'),
              model: fc.constantFrom('Camry', 'Accord'),
              year: fc.integer({ min: 2015, max: 2024 }),
            }),
          }),
          async (scenario) => {
            // Clear previous logs
            consoleInfoSpy.mockClear();

            const imageUrls = Array.from(
              { length: scenario.photoCount },
              (_, i) => `https://example.com/photo${i}.jpg`
            );

            const { isGeminiEnabled } = await import('@/lib/integrations/gemini-damage-detection');
            (isGeminiEnabled as any).mockReturnValue(true);

            mockRateLimiter.checkQuota.mockReturnValue({
              allowed: true,
              minuteRemaining: 10,
              dailyRemaining: 1500,
              resetAt: new Date(),
            });

            (assessDamageWithGemini as any).mockResolvedValue({
              structural: 50,
              mechanical: 40,
              cosmetic: 60,
              electrical: 30,
              interior: 45,
              severity: 'moderate',
              airbagDeployed: false,
              totalLoss: false,
              summary: 'Moderate damage',
              confidence: 85,
              method: 'gemini',
            });

            await assessDamage(
              imageUrls,
              scenario.marketValue,
              scenario.vehicleContext
            );

            const allLogs = consoleInfoSpy.mock.calls
              .map((call: any) => call[0])
              .join(' ');

            // Verify timing information is logged (duration in ms or timestamp)
            const timingLogged =
              allLogs.match(/\d+ms/) !== null || // Duration in milliseconds
              allLogs.match(/duration/i) !== null || // Duration keyword
              allLogs.match(/\d{13}/) !== null; // Unix timestamp

            expect(timingLogged).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
