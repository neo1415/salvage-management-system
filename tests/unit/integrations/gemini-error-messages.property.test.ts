/**
 * Property-Based Tests for Error Message Descriptiveness
 * 
 * Tests that error messages are clear and descriptive using property-based testing with fast-check.
 * Validates error messages across 100+ random error scenarios.
 * 
 * Feature: gemini-damage-detection-migration
 * Property 11: Error Message Descriptiveness
 * Validates: Requirements 13.2, 13.3, 13.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { assessDamage } from '@/features/cases/services/ai-assessment.service';
import { 
  assessDamageWithGemini,
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

describe('Error Message Descriptiveness - Property-Based Tests', () => {
  let consoleErrorSpy: any;
  let consoleWarnSpy: any;
  let mockRateLimiter: any;

  beforeEach(async () => {
    // Spy on console methods to capture error messages
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

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
   * Property 11: Error Message Descriptiveness
   * 
   * For any error condition, the error message SHALL:
   * - Clearly describe the problem
   * - For rate limit errors: include retry time
   * - For invalid photo format errors: include supported formats list
   * - For authentication errors: indicate API key issue
   * 
   * Validates: Requirements 13.2, 13.3, 13.4
   */
  describe('Property 11: Error Message Descriptiveness', () => {
    /**
     * Test that rate limit errors include retry time
     * Validates: Requirement 13.3
     */
    it('should include retry time in rate limit error messages', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random rate limit scenarios
          fc.record({
            photoCount: fc.integer({ min: 1, max: 6 }),
            marketValue: fc.integer({ min: 10000, max: 500000 }),
            vehicleContext: fc.record({
              make: fc.constantFrom('Toyota', 'Honda', 'Ford'),
              model: fc.constantFrom('Camry', 'Accord', 'F-150'),
              year: fc.integer({ min: 2015, max: 2024 }),
            }),
            rateLimitType: fc.constantFrom('minute', 'daily'),
            resetTime: fc.integer({ min: 1, max: 3600 }), // Seconds until reset
          }),
          async (scenario) => {
            // Clear previous logs
            consoleErrorSpy.mockClear();
            consoleWarnSpy.mockClear();

            // Generate image URLs
            const imageUrls = Array.from(
              { length: scenario.photoCount },
              (_, i) => `https://example.com/photo${i}.jpg`
            );

            // Setup mocks for rate limit scenario
            const { isGeminiEnabled } = await import('@/lib/integrations/gemini-damage-detection');
            (isGeminiEnabled as any).mockReturnValue(true);

            const resetAt = new Date(Date.now() + scenario.resetTime * 1000);

            mockRateLimiter.checkQuota.mockReturnValue({
              allowed: false,
              minuteRemaining: scenario.rateLimitType === 'minute' ? 0 : 5,
              dailyRemaining: scenario.rateLimitType === 'daily' ? 0 : 1000,
              resetAt: resetAt,
            });

            // Mock Vision as fallback
            (assessDamageWithVision as any).mockResolvedValue({
              labels: ['damage'],
              confidenceScore: 75,
              damagePercentage: 45,
              method: 'vision',
            });

            // Perform assessment
            await assessDamage(
              imageUrls,
              scenario.marketValue,
              scenario.vehicleContext
            );

            // Collect all error and warning messages
            const allMessages = [
              ...consoleErrorSpy.mock.calls.map((call: any) => call[0]),
              ...consoleWarnSpy.mock.calls.map((call: any) => call[0]),
            ].join(' ');

            // Verify rate limit message includes retry information
            const hasRateLimitMessage =
              allMessages.includes('rate limit') ||
              allMessages.includes('Rate limit') ||
              allMessages.includes('quota') ||
              allMessages.includes('Quota') ||
              allMessages.includes('exceeded');

            expect(hasRateLimitMessage).toBe(true);

            // Verify retry time information is present
            const hasRetryTime =
              allMessages.includes('retry') ||
              allMessages.includes('Retry') ||
              allMessages.includes('wait') ||
              allMessages.includes('Wait') ||
              allMessages.includes('minute') ||
              allMessages.includes('second') ||
              allMessages.match(/\d+\s*(second|minute|hour)/) !== null ||
              allMessages.includes('reset') ||
              allMessages.includes('Reset');

            expect(hasRetryTime).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test that invalid photo format errors include supported formats
     * Validates: Requirement 13.2
     */
    it('should include supported formats in invalid photo format errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random invalid format scenarios
          fc.record({
            invalidFormat: fc.constantFrom('bmp', 'gif', 'tiff', 'svg', 'pdf', 'txt'),
            photoCount: fc.integer({ min: 1, max: 3 }),
            marketValue: fc.integer({ min: 10000, max: 500000 }),
            vehicleContext: fc.record({
              make: fc.constantFrom('Toyota', 'Honda'),
              model: fc.constantFrom('Camry', 'Accord'),
              year: fc.integer({ min: 2015, max: 2024 }),
            }),
          }),
          async (scenario) => {
            // Clear previous logs
            consoleErrorSpy.mockClear();
            consoleWarnSpy.mockClear();

            // Generate image URLs with invalid format
            const imageUrls = Array.from(
              { length: scenario.photoCount },
              (_, i) => `https://example.com/photo${i}.${scenario.invalidFormat}`
            );

            // Setup mocks
            const { isGeminiEnabled } = await import('@/lib/integrations/gemini-damage-detection');
            (isGeminiEnabled as any).mockReturnValue(true);

            mockRateLimiter.checkQuota.mockReturnValue({
              allowed: true,
              minuteRemaining: 10,
              dailyRemaining: 1500,
              resetAt: new Date(),
            });

            // Mock Gemini to reject invalid format
            (assessDamageWithGemini as any).mockRejectedValue(
              new Error(`Invalid image format: ${scenario.invalidFormat}. Supported formats: JPEG, PNG, WebP`)
            );

            // Mock Vision as fallback
            (assessDamageWithVision as any).mockResolvedValue({
              labels: ['damage'],
              confidenceScore: 75,
              damagePercentage: 45,
              method: 'vision',
            });

            // Perform assessment
            try {
              await assessDamage(
                imageUrls,
                scenario.marketValue,
                scenario.vehicleContext
              );
            } catch (error) {
              // May throw error for invalid format
            }

            // Collect all error messages
            const allMessages = [
              ...consoleErrorSpy.mock.calls.map((call: any) => call[0]),
              ...consoleWarnSpy.mock.calls.map((call: any) => call[0]),
            ].join(' ');

            // Verify error message mentions invalid format
            const hasFormatError =
              allMessages.includes('format') ||
              allMessages.includes('Format') ||
              allMessages.includes(scenario.invalidFormat) ||
              allMessages.includes('invalid') ||
              allMessages.includes('Invalid');

            expect(hasFormatError).toBe(true);

            // Verify supported formats are listed
            const hasSupportedFormats =
              (allMessages.includes('JPEG') || allMessages.includes('jpeg')) ||
              (allMessages.includes('PNG') || allMessages.includes('png')) ||
              (allMessages.includes('WebP') || allMessages.includes('webp')) ||
              allMessages.includes('supported') ||
              allMessages.includes('Supported');

            expect(hasSupportedFormats).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test that authentication errors indicate API key issue
     * Validates: Requirement 13.4
     */
    it('should indicate API key issue in authentication errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random authentication error scenarios
          fc.record({
            photoCount: fc.integer({ min: 1, max: 6 }),
            marketValue: fc.integer({ min: 10000, max: 500000 }),
            vehicleContext: fc.record({
              make: fc.constantFrom('Toyota', 'Honda', 'Ford'),
              model: fc.constantFrom('Camry', 'Accord', 'F-150'),
              year: fc.integer({ min: 2015, max: 2024 }),
            }),
            authErrorType: fc.constantFrom(
              'invalid-key',
              'missing-key',
              'expired-key',
              'unauthorized'
            ),
          }),
          async (scenario) => {
            // Clear previous logs
            consoleErrorSpy.mockClear();
            consoleWarnSpy.mockClear();

            // Generate image URLs
            const imageUrls = Array.from(
              { length: scenario.photoCount },
              (_, i) => `https://example.com/photo${i}.jpg`
            );

            // Setup mocks for authentication error
            const { isGeminiEnabled } = await import('@/lib/integrations/gemini-damage-detection');
            (isGeminiEnabled as any).mockReturnValue(true);

            mockRateLimiter.checkQuota.mockReturnValue({
              allowed: true,
              minuteRemaining: 10,
              dailyRemaining: 1500,
              resetAt: new Date(),
            });

            // Mock Gemini to return authentication error
            let errorMessage = '';
            switch (scenario.authErrorType) {
              case 'invalid-key':
                errorMessage = 'Authentication failed: Invalid API key';
                break;
              case 'missing-key':
                errorMessage = 'Authentication failed: API key not provided';
                break;
              case 'expired-key':
                errorMessage = 'Authentication failed: API key has expired';
                break;
              case 'unauthorized':
                errorMessage = 'Authentication failed: Unauthorized access';
                break;
            }

            (assessDamageWithGemini as any).mockRejectedValue(
              new Error(errorMessage)
            );

            // Mock Vision as fallback
            (assessDamageWithVision as any).mockResolvedValue({
              labels: ['damage'],
              confidenceScore: 75,
              damagePercentage: 45,
              method: 'vision',
            });

            // Perform assessment
            await assessDamage(
              imageUrls,
              scenario.marketValue,
              scenario.vehicleContext
            );

            // Collect all error messages
            const allMessages = [
              ...consoleErrorSpy.mock.calls.map((call: any) => call[0]),
              ...consoleWarnSpy.mock.calls.map((call: any) => call[0]),
            ].join(' ');

            // Verify error message indicates authentication/API key issue
            const hasAuthError =
              allMessages.includes('API key') ||
              allMessages.includes('api key') ||
              allMessages.includes('Authentication') ||
              allMessages.includes('authentication') ||
              allMessages.includes('Unauthorized') ||
              allMessages.includes('unauthorized') ||
              allMessages.includes('Invalid') ||
              allMessages.includes('invalid') ||
              allMessages.includes('GEMINI_API_KEY');

            expect(hasAuthError).toBe(true);

            // Verify error message provides guidance
            const hasGuidance =
              allMessages.includes('check') ||
              allMessages.includes('Check') ||
              allMessages.includes('verify') ||
              allMessages.includes('Verify') ||
              allMessages.includes('configure') ||
              allMessages.includes('Configure') ||
              allMessages.includes('set') ||
              allMessages.includes('Set') ||
              allMessages.includes('aistudio.google.com');

            expect(hasGuidance).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test that all error messages clearly describe the problem
     * Validates: Requirements 13.2, 13.3, 13.4
     */
    it('should clearly describe the problem in all error messages', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random error scenarios
          fc.record({
            photoCount: fc.integer({ min: 1, max: 6 }),
            marketValue: fc.integer({ min: 10000, max: 500000 }),
            vehicleContext: fc.record({
              make: fc.constantFrom('Toyota', 'Honda', 'Ford', 'BMW'),
              model: fc.constantFrom('Camry', 'Accord', 'F-150', 'X5'),
              year: fc.integer({ min: 2010, max: 2024 }),
            }),
            errorScenario: fc.constantFrom(
              'network-timeout',
              'api-500-error',
              'invalid-response',
              'rate-limit',
              'auth-error',
              'photo-format-error'
            ),
          }),
          async (scenario) => {
            // Clear previous logs
            consoleErrorSpy.mockClear();
            consoleWarnSpy.mockClear();

            // Generate image URLs
            const imageUrls = Array.from(
              { length: scenario.photoCount },
              (_, i) => `https://example.com/photo${i}.jpg`
            );

            // Setup mocks based on error scenario
            const { isGeminiEnabled } = await import('@/lib/integrations/gemini-damage-detection');
            (isGeminiEnabled as any).mockReturnValue(true);

            switch (scenario.errorScenario) {
              case 'network-timeout':
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

              case 'api-500-error':
                mockRateLimiter.checkQuota.mockReturnValue({
                  allowed: true,
                  minuteRemaining: 10,
                  dailyRemaining: 1500,
                  resetAt: new Date(),
                });
                (assessDamageWithGemini as any).mockRejectedValue(
                  new Error('Gemini API error: 500 Internal Server Error')
                );
                (assessDamageWithVision as any).mockResolvedValue({
                  labels: ['damage'],
                  confidenceScore: 75,
                  damagePercentage: 45,
                  method: 'vision',
                });
                break;

              case 'invalid-response':
                mockRateLimiter.checkQuota.mockReturnValue({
                  allowed: true,
                  minuteRemaining: 10,
                  dailyRemaining: 1500,
                  resetAt: new Date(),
                });
                (assessDamageWithGemini as any).mockRejectedValue(
                  new Error('Invalid response from Gemini: missing required field "structural"')
                );
                (assessDamageWithVision as any).mockResolvedValue({
                  labels: ['damage'],
                  confidenceScore: 75,
                  damagePercentage: 45,
                  method: 'vision',
                });
                break;

              case 'rate-limit':
                mockRateLimiter.checkQuota.mockReturnValue({
                  allowed: false,
                  minuteRemaining: 0,
                  dailyRemaining: 1000,
                  resetAt: new Date(Date.now() + 30000),
                });
                (assessDamageWithVision as any).mockResolvedValue({
                  labels: ['damage'],
                  confidenceScore: 75,
                  damagePercentage: 45,
                  method: 'vision',
                });
                break;

              case 'auth-error':
                mockRateLimiter.checkQuota.mockReturnValue({
                  allowed: true,
                  minuteRemaining: 10,
                  dailyRemaining: 1500,
                  resetAt: new Date(),
                });
                (assessDamageWithGemini as any).mockRejectedValue(
                  new Error('Authentication failed: Invalid API key')
                );
                (assessDamageWithVision as any).mockResolvedValue({
                  labels: ['damage'],
                  confidenceScore: 75,
                  damagePercentage: 45,
                  method: 'vision',
                });
                break;

              case 'photo-format-error':
                mockRateLimiter.checkQuota.mockReturnValue({
                  allowed: true,
                  minuteRemaining: 10,
                  dailyRemaining: 1500,
                  resetAt: new Date(),
                });
                (assessDamageWithGemini as any).mockRejectedValue(
                  new Error('Invalid image format: bmp. Supported formats: JPEG, PNG, WebP')
                );
                (assessDamageWithVision as any).mockResolvedValue({
                  labels: ['damage'],
                  confidenceScore: 75,
                  damagePercentage: 45,
                  method: 'vision',
                });
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
              // Some scenarios may throw
            }

            // Collect all error messages
            const allMessages = [
              ...consoleErrorSpy.mock.calls.map((call: any) => call[0]),
              ...consoleWarnSpy.mock.calls.map((call: any) => call[0]),
            ].join(' ');

            // Verify error message is descriptive (contains key information)
            let hasDescriptiveMessage = false;

            switch (scenario.errorScenario) {
              case 'network-timeout':
                hasDescriptiveMessage =
                  (allMessages.includes('timeout') || allMessages.includes('Timeout') || allMessages.includes('timed out')) &&
                  (allMessages.match(/\d+/) !== null); // Contains timeout duration
                break;

              case 'api-500-error':
                hasDescriptiveMessage =
                  (allMessages.includes('500') || allMessages.includes('error') || allMessages.includes('Error')) &&
                  (allMessages.includes('API') || allMessages.includes('api') || allMessages.includes('server'));
                break;

              case 'invalid-response':
                hasDescriptiveMessage =
                  (allMessages.includes('invalid') || allMessages.includes('Invalid') || allMessages.includes('missing')) &&
                  (allMessages.includes('response') || allMessages.includes('Response') || allMessages.includes('field'));
                break;

              case 'rate-limit':
                hasDescriptiveMessage =
                  (allMessages.includes('rate') || allMessages.includes('Rate') || allMessages.includes('quota') || allMessages.includes('Quota')) &&
                  (allMessages.includes('limit') || allMessages.includes('Limit') || allMessages.includes('exceeded'));
                break;

              case 'auth-error':
                hasDescriptiveMessage =
                  (allMessages.includes('API key') || allMessages.includes('api key') || allMessages.includes('Authentication') || allMessages.includes('authentication')) &&
                  (allMessages.includes('invalid') || allMessages.includes('Invalid') || allMessages.includes('failed'));
                break;

              case 'photo-format-error':
                hasDescriptiveMessage =
                  (allMessages.includes('format') || allMessages.includes('Format')) &&
                  (allMessages.includes('invalid') || allMessages.includes('Invalid') || allMessages.includes('supported') || allMessages.includes('Supported'));
                break;
            }

            expect(hasDescriptiveMessage).toBe(true);

            // Verify error message is not empty
            expect(allMessages.length).toBeGreaterThan(0);

            // Verify error message contains actionable information
            const hasActionableInfo =
              allMessages.includes('retry') ||
              allMessages.includes('Retry') ||
              allMessages.includes('check') ||
              allMessages.includes('Check') ||
              allMessages.includes('verify') ||
              allMessages.includes('Verify') ||
              allMessages.includes('fallback') ||
              allMessages.includes('Fallback') ||
              allMessages.includes('Using') ||
              allMessages.includes('using') ||
              allMessages.includes('supported') ||
              allMessages.includes('Supported');

            expect(hasActionableInfo).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test that error messages include context information
     * Validates: Requirements 13.2, 13.3, 13.4
     */
    it('should include context information in error messages', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            photoCount: fc.integer({ min: 1, max: 6 }),
            marketValue: fc.integer({ min: 10000, max: 500000 }),
            vehicleContext: fc.record({
              make: fc.constantFrom('Toyota', 'Honda', 'Ford'),
              model: fc.constantFrom('Camry', 'Accord', 'F-150'),
              year: fc.integer({ min: 2015, max: 2024 }),
            }),
          }),
          async (scenario) => {
            // Clear previous logs
            consoleErrorSpy.mockClear();
            consoleWarnSpy.mockClear();

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

            (assessDamageWithGemini as any).mockRejectedValue(
              new Error('Gemini API error: 500 Internal Server Error')
            );

            (assessDamageWithVision as any).mockResolvedValue({
              labels: ['damage'],
              confidenceScore: 75,
              damagePercentage: 45,
              method: 'vision',
            });

            await assessDamage(
              imageUrls,
              scenario.marketValue,
              scenario.vehicleContext
            );

            const allMessages = [
              ...consoleErrorSpy.mock.calls.map((call: any) => call[0]),
              ...consoleWarnSpy.mock.calls.map((call: any) => call[0]),
            ].join(' ');

            // Verify context information is included
            // 1. Request ID for traceability
            const hasRequestId =
              allMessages.includes('Request ID:') ||
              allMessages.includes('request ID') ||
              allMessages.match(/\d{13}/) !== null;

            expect(hasRequestId).toBe(true);

            // 2. Photo count
            const hasPhotoCount =
              allMessages.includes(`${scenario.photoCount}`) ||
              allMessages.includes('photo');

            expect(hasPhotoCount).toBe(true);

            // 3. Vehicle context
            const hasVehicleContext =
              allMessages.includes(scenario.vehicleContext.make) ||
              allMessages.includes('vehicle') ||
              allMessages.includes('Vehicle');

            expect(hasVehicleContext).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
