/**
 * Unit Tests: AI Assessment Fallback Orchestration
 * 
 * Tests the three-tier fallback chain for damage assessment:
 * 1. Gemini 2.0 Flash (primary)
 * 2. Google Cloud Vision API (fallback)
 * 3. Neutral scores (final fallback)
 * 
 * Test Coverage:
 * - Successful Gemini assessment (no fallback)
 * - Gemini failure triggers Vision fallback
 * - Vision failure triggers neutral response
 * - Rate limit exceeded triggers Vision fallback
 * - Missing API key triggers Vision fallback
 * - Method field accuracy ('gemini', 'vision', or 'neutral')
 * - Logging of fallback reasons
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 9.1, 9.2, 9.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { assessDamage } from '@/features/cases/services/ai-assessment.service';
import * as geminiService from '@/lib/integrations/gemini-damage-detection';
import * as visionService from '@/lib/integrations/vision-damage-detection';
import * as rateLimiter from '@/lib/integrations/gemini-rate-limiter';
import type { GeminiDamageAssessment } from '@/lib/integrations/gemini-damage-detection';
import type { VisionDamageAssessment } from '@/lib/integrations/vision-damage-detection';

// Mock modules
vi.mock('@/lib/integrations/gemini-damage-detection');
vi.mock('@/lib/integrations/vision-damage-detection');
vi.mock('@/lib/integrations/gemini-rate-limiter');

describe('AI Assessment Fallback Orchestration', () => {
  const mockImageUrls = ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'];
  const mockMarketValue = 10000;
  const mockVehicleContext = {
    make: 'Toyota',
    model: 'Camry',
    year: 2020,
  };

  // Mock Gemini assessment
  const mockGeminiAssessment: GeminiDamageAssessment = {
    structural: 60,
    mechanical: 40,
    cosmetic: 70,
    electrical: 30,
    interior: 50,
    severity: 'moderate',
    airbagDeployed: true,
    totalLoss: false,
    summary: 'Moderate front-end damage with deployed airbag',
    confidence: 85,
    method: 'gemini',
  };

  // Mock Vision assessment
  const mockVisionAssessment: VisionDamageAssessment = {
    labels: ['Vehicle', 'Car', 'Damage', 'Dent', 'Broken'],
    confidenceScore: 75,
    damagePercentage: 65,
    method: 'vision',
  };

  // Mock rate limiter
  const mockRateLimiter = {
    checkQuota: vi.fn(),
    recordRequest: vi.fn(),
    getDailyUsage: vi.fn(),
    getMinuteUsage: vi.fn(),
    reset: vi.fn(),
  };

  // Console spy for logging verification
  let consoleInfoSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup console spies
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Default mock implementations
    vi.mocked(geminiService.isGeminiEnabled).mockReturnValue(true);
    vi.mocked(rateLimiter.getGeminiRateLimiter).mockReturnValue(mockRateLimiter as any);
    mockRateLimiter.checkQuota.mockReturnValue({
      allowed: true,
      minuteRemaining: 10,
      dailyRemaining: 1500,
      resetAt: new Date(),
    });
  });

  afterEach(() => {
    // Restore console
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Successful Gemini Assessment (No Fallback)', () => {
    it('should use Gemini when enabled, rate limit allows, and vehicle context provided', async () => {
      // Arrange
      vi.mocked(geminiService.assessDamageWithGemini).mockResolvedValue(mockGeminiAssessment);

      // Act
      const result = await assessDamage(mockImageUrls, mockMarketValue, mockVehicleContext);

      // Assert
      expect(result.method).toBe('gemini');
      expect(geminiService.assessDamageWithGemini).toHaveBeenCalledWith(mockImageUrls, mockVehicleContext);
      expect(visionService.assessDamageWithVision).not.toHaveBeenCalled();
      expect(mockRateLimiter.recordRequest).toHaveBeenCalled();
      
      // Verify detailed scores are present
      expect(result.detailedScores).toBeDefined();
      expect(result.detailedScores?.structural).toBe(60);
      expect(result.detailedScores?.mechanical).toBe(40);
      expect(result.detailedScores?.cosmetic).toBe(70);
      expect(result.detailedScores?.electrical).toBe(30);
      expect(result.detailedScores?.interior).toBe(50);
      
      // Verify Gemini-specific fields
      expect(result.airbagDeployed).toBe(true);
      expect(result.totalLoss).toBe(false);
      expect(result.summary).toBe('Moderate front-end damage with deployed airbag');
      
      // Verify logging
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Gemini assessment succeeded')
      );
    });

    it('should calculate damage percentage from individual scores', async () => {
      // Arrange
      vi.mocked(geminiService.assessDamageWithGemini).mockResolvedValue(mockGeminiAssessment);

      // Act
      const result = await assessDamage(mockImageUrls, mockMarketValue, mockVehicleContext);

      // Assert
      // Weighted average: 60*0.3 + 40*0.25 + 70*0.2 + 30*0.15 + 50*0.1 = 52
      expect(result.damagePercentage).toBe(52);
    });

    it('should calculate salvage value and reserve price correctly', async () => {
      // Arrange
      vi.mocked(geminiService.assessDamageWithGemini).mockResolvedValue(mockGeminiAssessment);

      // Act
      const result = await assessDamage(mockImageUrls, mockMarketValue, mockVehicleContext);

      // Assert
      // Salvage value: 10000 * (100 - 52) / 100 = 4800
      expect(result.estimatedSalvageValue).toBe(4800);
      // Reserve price: 4800 * 0.7 = 3360
      expect(result.reservePrice).toBe(3360);
    });

    it('should log quota status before Gemini attempt', async () => {
      // Arrange
      vi.mocked(geminiService.assessDamageWithGemini).mockResolvedValue(mockGeminiAssessment);

      // Act
      await assessDamage(mockImageUrls, mockMarketValue, mockVehicleContext);

      // Assert
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Attempting Gemini assessment')
      );
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Quota remaining: 10/minute, 1500/day')
      );
    });
  });

  describe('Gemini Failure Triggers Vision Fallback', () => {
    it('should fall back to Vision when Gemini throws error', async () => {
      // Arrange
      vi.mocked(geminiService.assessDamageWithGemini).mockRejectedValue(
        new Error('Gemini API error')
      );
      vi.mocked(visionService.assessDamageWithVision).mockResolvedValue(mockVisionAssessment);

      // Act
      const result = await assessDamage(mockImageUrls, mockMarketValue, mockVehicleContext);

      // Assert
      expect(result.method).toBe('vision');
      expect(geminiService.assessDamageWithGemini).toHaveBeenCalled();
      expect(visionService.assessDamageWithVision).toHaveBeenCalledWith(mockImageUrls);
      
      // Verify Vision-specific behavior
      expect(result.detailedScores).toBeUndefined();
      expect(result.airbagDeployed).toBeUndefined();
      expect(result.totalLoss).toBeUndefined();
      expect(result.summary).toBeUndefined();
      
      // Verify logging of fallback
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Gemini assessment failed')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Falling back to Vision API')
      );
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Vision API assessment succeeded')
      );
    });

    it('should log Gemini error details', async () => {
      // Arrange
      const geminiError = new Error('Invalid API response format');
      vi.mocked(geminiService.assessDamageWithGemini).mockRejectedValue(geminiError);
      vi.mocked(visionService.assessDamageWithVision).mockResolvedValue(mockVisionAssessment);

      // Act
      await assessDamage(mockImageUrls, mockMarketValue, mockVehicleContext);

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error: Invalid API response format')
      );
    });

    it('should not record Gemini request when it fails', async () => {
      // Arrange
      vi.mocked(geminiService.assessDamageWithGemini).mockRejectedValue(
        new Error('Gemini API error')
      );
      vi.mocked(visionService.assessDamageWithVision).mockResolvedValue(mockVisionAssessment);

      // Act
      await assessDamage(mockImageUrls, mockMarketValue, mockVehicleContext);

      // Assert
      expect(mockRateLimiter.recordRequest).not.toHaveBeenCalled();
    });
  });

  describe('Vision Failure Triggers Neutral Response', () => {
    it('should return neutral scores when both Gemini and Vision fail', async () => {
      // Arrange
      vi.mocked(geminiService.assessDamageWithGemini).mockRejectedValue(
        new Error('Gemini API error')
      );
      vi.mocked(visionService.assessDamageWithVision).mockRejectedValue(
        new Error('Vision API error')
      );

      // Act
      const result = await assessDamage(mockImageUrls, mockMarketValue, mockVehicleContext);

      // Assert
      expect(result.method).toBe('neutral');
      expect(result.damagePercentage).toBe(50);
      expect(result.damageSeverity).toBe('moderate');
      expect(result.confidenceScore).toBe(0);
      
      // Verify neutral detailed scores
      expect(result.detailedScores).toBeDefined();
      expect(result.detailedScores?.structural).toBe(50);
      expect(result.detailedScores?.mechanical).toBe(50);
      expect(result.detailedScores?.cosmetic).toBe(50);
      expect(result.detailedScores?.electrical).toBe(50);
      expect(result.detailedScores?.interior).toBe(50);
      
      // Verify neutral flags
      expect(result.airbagDeployed).toBe(false);
      expect(result.totalLoss).toBe(false);
      expect(result.summary).toContain('AI assessment unavailable');
      
      // Verify logging
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('All AI methods failed')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Returning neutral scores')
      );
    });

    it('should log both Gemini and Vision errors', async () => {
      // Arrange
      vi.mocked(geminiService.assessDamageWithGemini).mockRejectedValue(
        new Error('Gemini timeout')
      );
      vi.mocked(visionService.assessDamageWithVision).mockRejectedValue(
        new Error('Vision authentication failed')
      );

      // Act
      await assessDamage(mockImageUrls, mockMarketValue, mockVehicleContext);

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Gemini timeout')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Vision authentication failed')
      );
    });

    it('should calculate neutral salvage value correctly', async () => {
      // Arrange
      vi.mocked(geminiService.assessDamageWithGemini).mockRejectedValue(
        new Error('Gemini API error')
      );
      vi.mocked(visionService.assessDamageWithVision).mockRejectedValue(
        new Error('Vision API error')
      );

      // Act
      const result = await assessDamage(mockImageUrls, mockMarketValue, mockVehicleContext);

      // Assert
      // Salvage value: 10000 * (100 - 50) / 100 = 5000
      expect(result.estimatedSalvageValue).toBe(5000);
      // Reserve price: 5000 * 0.7 = 3500
      expect(result.reservePrice).toBe(3500);
    });
  });

  describe('Rate Limit Exceeded Triggers Vision Fallback', () => {
    it('should fall back to Vision when minute quota exceeded', async () => {
      // Arrange
      mockRateLimiter.checkQuota.mockReturnValue({
        allowed: false,
        minuteRemaining: 0,
        dailyRemaining: 1000,
        resetAt: new Date(),
      });
      vi.mocked(visionService.assessDamageWithVision).mockResolvedValue(mockVisionAssessment);

      // Act
      const result = await assessDamage(mockImageUrls, mockMarketValue, mockVehicleContext);

      // Assert
      expect(result.method).toBe('vision');
      expect(geminiService.assessDamageWithGemini).not.toHaveBeenCalled();
      expect(visionService.assessDamageWithVision).toHaveBeenCalled();
      
      // Verify logging
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Gemini rate limit exceeded')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Minute quota exhausted (0 remaining)')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Falling back to Vision API')
      );
    });

    it('should fall back to Vision when daily quota exceeded', async () => {
      // Arrange
      mockRateLimiter.checkQuota.mockReturnValue({
        allowed: false,
        minuteRemaining: 5,
        dailyRemaining: 0,
        resetAt: new Date(),
      });
      vi.mocked(visionService.assessDamageWithVision).mockResolvedValue(mockVisionAssessment);

      // Act
      const result = await assessDamage(mockImageUrls, mockMarketValue, mockVehicleContext);

      // Assert
      expect(result.method).toBe('vision');
      expect(geminiService.assessDamageWithGemini).not.toHaveBeenCalled();
      
      // Verify logging
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Daily quota exhausted (0 remaining)')
      );
    });

    it('should not record Gemini request when rate limited', async () => {
      // Arrange
      mockRateLimiter.checkQuota.mockReturnValue({
        allowed: false,
        minuteRemaining: 0,
        dailyRemaining: 1000,
        resetAt: new Date(),
      });
      vi.mocked(visionService.assessDamageWithVision).mockResolvedValue(mockVisionAssessment);

      // Act
      await assessDamage(mockImageUrls, mockMarketValue, mockVehicleContext);

      // Assert
      expect(mockRateLimiter.recordRequest).not.toHaveBeenCalled();
    });
  });

  describe('Missing API Key Triggers Vision Fallback', () => {
    it('should fall back to Vision when Gemini is not enabled', async () => {
      // Arrange
      vi.mocked(geminiService.isGeminiEnabled).mockReturnValue(false);
      vi.mocked(visionService.assessDamageWithVision).mockResolvedValue(mockVisionAssessment);

      // Act
      const result = await assessDamage(mockImageUrls, mockMarketValue, mockVehicleContext);

      // Assert
      expect(result.method).toBe('vision');
      expect(geminiService.assessDamageWithGemini).not.toHaveBeenCalled();
      expect(visionService.assessDamageWithVision).toHaveBeenCalled();
      
      // Verify logging
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Gemini not enabled')
      );
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Using Vision API')
      );
    });

    it('should not check rate limiter when Gemini is disabled', async () => {
      // Arrange
      vi.mocked(geminiService.isGeminiEnabled).mockReturnValue(false);
      vi.mocked(visionService.assessDamageWithVision).mockResolvedValue(mockVisionAssessment);

      // Act
      await assessDamage(mockImageUrls, mockMarketValue, mockVehicleContext);

      // Assert
      expect(mockRateLimiter.checkQuota).not.toHaveBeenCalled();
    });
  });

  describe('Missing Vehicle Context Triggers Vision Fallback', () => {
    it('should fall back to Vision when vehicle context is not provided', async () => {
      // Arrange
      vi.mocked(visionService.assessDamageWithVision).mockResolvedValue(mockVisionAssessment);

      // Act - no vehicle context provided
      const result = await assessDamage(mockImageUrls, mockMarketValue);

      // Assert
      expect(result.method).toBe('vision');
      expect(geminiService.assessDamageWithGemini).not.toHaveBeenCalled();
      expect(visionService.assessDamageWithVision).toHaveBeenCalled();
      
      // Verify logging
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Vehicle context not provided')
      );
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Using Vision API')
      );
    });

    it('should maintain backward compatibility when vehicle context is omitted', async () => {
      // Arrange
      vi.mocked(visionService.assessDamageWithVision).mockResolvedValue(mockVisionAssessment);

      // Act - legacy call without vehicle context
      const result = await assessDamage(mockImageUrls, mockMarketValue);

      // Assert
      expect(result).toBeDefined();
      expect(result.labels).toBeDefined();
      expect(result.confidenceScore).toBeDefined();
      expect(result.damagePercentage).toBeDefined();
      expect(result.damageSeverity).toBeDefined();
      expect(result.estimatedSalvageValue).toBeDefined();
      expect(result.reservePrice).toBeDefined();
    });
  });

  describe('Method Field Accuracy', () => {
    it('should set method to "gemini" when Gemini succeeds', async () => {
      // Arrange
      vi.mocked(geminiService.assessDamageWithGemini).mockResolvedValue(mockGeminiAssessment);

      // Act
      const result = await assessDamage(mockImageUrls, mockMarketValue, mockVehicleContext);

      // Assert
      expect(result.method).toBe('gemini');
    });

    it('should set method to "vision" when Vision is used', async () => {
      // Arrange
      vi.mocked(geminiService.isGeminiEnabled).mockReturnValue(false);
      vi.mocked(visionService.assessDamageWithVision).mockResolvedValue(mockVisionAssessment);

      // Act
      const result = await assessDamage(mockImageUrls, mockMarketValue, mockVehicleContext);

      // Assert
      expect(result.method).toBe('vision');
    });

    it('should set method to "neutral" when all methods fail', async () => {
      // Arrange
      vi.mocked(geminiService.assessDamageWithGemini).mockRejectedValue(
        new Error('Gemini error')
      );
      vi.mocked(visionService.assessDamageWithVision).mockRejectedValue(
        new Error('Vision error')
      );

      // Act
      const result = await assessDamage(mockImageUrls, mockMarketValue, mockVehicleContext);

      // Assert
      expect(result.method).toBe('neutral');
    });
  });

  describe('Logging of Fallback Reasons', () => {
    it('should log reason when Gemini fails', async () => {
      // Arrange
      const errorMessage = 'Network timeout';
      vi.mocked(geminiService.assessDamageWithGemini).mockRejectedValue(
        new Error(errorMessage)
      );
      vi.mocked(visionService.assessDamageWithVision).mockResolvedValue(mockVisionAssessment);

      // Act
      await assessDamage(mockImageUrls, mockMarketValue, mockVehicleContext);

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Gemini assessment failed')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(errorMessage)
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Falling back to Vision API')
      );
    });

    it('should log reason when Vision fails', async () => {
      // Arrange
      const visionError = 'Authentication failed';
      vi.mocked(geminiService.assessDamageWithGemini).mockRejectedValue(
        new Error('Gemini error')
      );
      vi.mocked(visionService.assessDamageWithVision).mockRejectedValue(
        new Error(visionError)
      );

      // Act
      await assessDamage(mockImageUrls, mockMarketValue, mockVehicleContext);

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Vision API assessment failed')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(visionError)
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Falling back to neutral scores')
      );
    });

    it('should log attempted methods when all fail', async () => {
      // Arrange
      vi.mocked(geminiService.assessDamageWithGemini).mockRejectedValue(
        new Error('Gemini error')
      );
      vi.mocked(visionService.assessDamageWithVision).mockRejectedValue(
        new Error('Vision error')
      );

      // Act
      await assessDamage(mockImageUrls, mockMarketValue, mockVehicleContext);

      // Assert
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Attempted methods: gemini → vision → neutral')
      );
    });

    it('should log rate limit reason with quota details', async () => {
      // Arrange
      mockRateLimiter.checkQuota.mockReturnValue({
        allowed: false,
        minuteRemaining: 0,
        dailyRemaining: 500,
        resetAt: new Date(),
      });
      vi.mocked(visionService.assessDamageWithVision).mockResolvedValue(mockVisionAssessment);

      // Act
      await assessDamage(mockImageUrls, mockMarketValue, mockVehicleContext);

      // Assert
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Minute quota exhausted (0 remaining)')
      );
    });

    it('should include request ID in all log messages', async () => {
      // Arrange
      vi.mocked(geminiService.assessDamageWithGemini).mockResolvedValue(mockGeminiAssessment);

      // Act
      await assessDamage(mockImageUrls, mockMarketValue, mockVehicleContext);

      // Assert
      const logCalls = consoleInfoSpy.mock.calls;
      const hasRequestId = logCalls.some((call: any[]) => 
        call[0].includes('Request ID:')
      );
      expect(hasRequestId).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when no image URLs provided', async () => {
      // Act & Assert
      await expect(
        assessDamage([], mockMarketValue, mockVehicleContext)
      ).rejects.toThrow('At least one image URL is required');
    });

    it('should throw error when imageUrls is null', async () => {
      // Act & Assert
      await expect(
        assessDamage(null as any, mockMarketValue, mockVehicleContext)
      ).rejects.toThrow('At least one image URL is required');
    });

    it('should throw error when imageUrls is undefined', async () => {
      // Act & Assert
      await expect(
        assessDamage(undefined as any, mockMarketValue, mockVehicleContext)
      ).rejects.toThrow('At least one image URL is required');
    });
  });

  describe('Backward Compatibility', () => {
    it('should return all required fields for backward compatibility', async () => {
      // Arrange
      vi.mocked(geminiService.assessDamageWithGemini).mockResolvedValue(mockGeminiAssessment);

      // Act
      const result = await assessDamage(mockImageUrls, mockMarketValue, mockVehicleContext);

      // Assert - all existing required fields must be present
      expect(result.labels).toBeDefined();
      expect(Array.isArray(result.labels)).toBe(true);
      expect(result.confidenceScore).toBeDefined();
      expect(typeof result.confidenceScore).toBe('number');
      expect(result.damagePercentage).toBeDefined();
      expect(typeof result.damagePercentage).toBe('number');
      expect(result.processedAt).toBeDefined();
      expect(result.processedAt).toBeInstanceOf(Date);
      expect(result.damageSeverity).toBeDefined();
      expect(['minor', 'moderate', 'severe']).toContain(result.damageSeverity);
      expect(result.estimatedSalvageValue).toBeDefined();
      expect(typeof result.estimatedSalvageValue).toBe('number');
      expect(result.reservePrice).toBeDefined();
      expect(typeof result.reservePrice).toBe('number');
    });

    it('should work without vehicle context (legacy behavior)', async () => {
      // Arrange
      vi.mocked(visionService.assessDamageWithVision).mockResolvedValue(mockVisionAssessment);

      // Act - legacy call without vehicle context
      const result = await assessDamage(mockImageUrls, mockMarketValue);

      // Assert
      expect(result).toBeDefined();
      expect(result.method).toBe('vision');
      expect(result.labels).toBeDefined();
      expect(result.confidenceScore).toBeDefined();
      expect(result.damagePercentage).toBeDefined();
    });
  });
});
