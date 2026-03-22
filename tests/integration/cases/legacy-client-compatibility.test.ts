/**
 * Legacy Client Compatibility Tests
 * 
 * Tests that verify the Gemini migration maintains backward compatibility
 * with existing client code that calls the AI assessment service.
 * 
 * Test Scenarios:
 * 1. Legacy requests without vehicle context
 * 2. Response schema compatibility (all existing fields present)
 * 3. Optional fields don't break existing parsers
 * 4. Production-like request patterns
 * 5. Error handling maintains existing behavior
 * 
 * Requirements: 11.1, 11.2, 11.3, 11.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { assessDamage } from '@/features/cases/services/ai-assessment.service';
import * as geminiService from '@/lib/integrations/gemini-damage-detection';
import * as visionService from '@/lib/integrations/vision-damage-detection';

describe('Legacy Client Compatibility Tests', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Requirement 11.1: Same API Response Schema', () => {
    it('should maintain all existing required fields in response', async () => {
      // Mock Vision API to return legacy format
      vi.spyOn(geminiService, 'isGeminiEnabled').mockReturnValue(false);
      vi.spyOn(visionService, 'assessDamageWithVision').mockResolvedValue({
        labels: ['Vehicle', 'Car', 'Damaged', 'Collision'],
        confidenceScore: 85,
        damagePercentage: 65,
        method: 'vision',
      });

      const imageUrls = ['https://example.com/photo1.jpg'];
      const marketValue = 50000;

      // Call without vehicle context (legacy behavior)
      const result = await assessDamage(imageUrls, marketValue);

      // Verify all existing required fields are present
      expect(result).toHaveProperty('labels');
      expect(result).toHaveProperty('confidenceScore');
      expect(result).toHaveProperty('damagePercentage');
      expect(result).toHaveProperty('processedAt');
      expect(result).toHaveProperty('damageSeverity');
      expect(result).toHaveProperty('estimatedSalvageValue');
      expect(result).toHaveProperty('reservePrice');

      // Verify field types match existing API
      expect(Array.isArray(result.labels)).toBe(true);
      expect(typeof result.confidenceScore).toBe('number');
      expect(typeof result.damagePercentage).toBe('number');
      expect(result.processedAt).toBeInstanceOf(Date);
      expect(['minor', 'moderate', 'severe']).toContain(result.damageSeverity);
      expect(typeof result.estimatedSalvageValue).toBe('number');
      expect(typeof result.reservePrice).toBe('number');
    });

    it('should return same response structure when Gemini is disabled', async () => {
      // Disable Gemini to force Vision API usage
      vi.spyOn(geminiService, 'isGeminiEnabled').mockReturnValue(false);
      vi.spyOn(visionService, 'assessDamageWithVision').mockResolvedValue({
        labels: ['Vehicle', 'Sedan', 'Minor Damage'],
        confidenceScore: 90,
        damagePercentage: 45,
        method: 'vision',
      });

      const imageUrls = ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'];
      const marketValue = 30000;

      const result = await assessDamage(imageUrls, marketValue);

      // Verify response structure matches legacy format
      expect(result).toMatchObject({
        labels: expect.any(Array),
        confidenceScore: expect.any(Number),
        damagePercentage: expect.any(Number),
        processedAt: expect.any(Date),
        damageSeverity: expect.stringMatching(/^(minor|moderate|severe)$/),
        estimatedSalvageValue: expect.any(Number),
        reservePrice: expect.any(Number),
      });

      // Verify calculations match legacy behavior
      const expectedSalvageValue = marketValue * ((100 - 45) / 100);
      const expectedReservePrice = expectedSalvageValue * 0.7;
      expect(result.estimatedSalvageValue).toBeCloseTo(expectedSalvageValue, 2);
      expect(result.reservePrice).toBeCloseTo(expectedReservePrice, 2);
    });
  });

  describe('Requirement 11.2: Same Data Types', () => {
    it('should maintain exact data types for all existing fields', async () => {
      vi.spyOn(geminiService, 'isGeminiEnabled').mockReturnValue(false);
      vi.spyOn(visionService, 'assessDamageWithVision').mockResolvedValue({
        labels: ['Vehicle', 'Truck', 'Severe Damage'],
        confidenceScore: 75,
        damagePercentage: 85,
        method: 'vision',
      });

      const result = await assessDamage(['https://example.com/photo.jpg'], 40000);

      // Strict type checking for existing fields
      expect(typeof result.labels).toBe('object'); // Array is object type
      expect(Array.isArray(result.labels)).toBe(true);
      expect(result.labels.every(label => typeof label === 'string')).toBe(true);
      
      expect(typeof result.confidenceScore).toBe('number');
      expect(Number.isFinite(result.confidenceScore)).toBe(true);
      
      expect(typeof result.damagePercentage).toBe('number');
      expect(Number.isFinite(result.damagePercentage)).toBe(true);
      
      expect(result.processedAt instanceof Date).toBe(true);
      expect(result.processedAt.getTime()).toBeLessThanOrEqual(Date.now());
      
      expect(typeof result.damageSeverity).toBe('string');
      expect(['minor', 'moderate', 'severe']).toContain(result.damageSeverity);
      
      expect(typeof result.estimatedSalvageValue).toBe('number');
      expect(Number.isFinite(result.estimatedSalvageValue)).toBe(true);
      
      expect(typeof result.reservePrice).toBe('number');
      expect(Number.isFinite(result.reservePrice)).toBe(true);
    });

    it('should not change numeric precision for existing fields', async () => {
      vi.spyOn(geminiService, 'isGeminiEnabled').mockReturnValue(false);
      vi.spyOn(visionService, 'assessDamageWithVision').mockResolvedValue({
        labels: ['Vehicle'],
        confidenceScore: 88.5,
        damagePercentage: 52.3,
        method: 'vision',
      });

      const marketValue = 25000.50;
      const result = await assessDamage(['https://example.com/photo.jpg'], marketValue);

      // Verify numeric values maintain precision
      expect(result.confidenceScore).toBe(88.5);
      expect(result.damagePercentage).toBe(52.3);
      
      // Verify calculated values are rounded to 2 decimal places (existing behavior)
      const expectedSalvageValue = marketValue * ((100 - 52.3) / 100);
      expect(result.estimatedSalvageValue).toBeCloseTo(expectedSalvageValue, 2);
      expect(result.reservePrice).toBeCloseTo(expectedSalvageValue * 0.7, 2);
    });
  });

  describe('Requirement 11.3: No Removed Fields', () => {
    it('should never remove existing fields from response', async () => {
      vi.spyOn(geminiService, 'isGeminiEnabled').mockReturnValue(false);
      vi.spyOn(visionService, 'assessDamageWithVision').mockResolvedValue({
        labels: ['Vehicle', 'Car'],
        confidenceScore: 80,
        damagePercentage: 50,
        method: 'vision',
      });

      const result = await assessDamage(['https://example.com/photo.jpg'], 35000);

      // Define all existing fields that must be present
      const requiredFields = [
        'labels',
        'confidenceScore',
        'damagePercentage',
        'processedAt',
        'damageSeverity',
        'estimatedSalvageValue',
        'reservePrice',
      ];

      // Verify every required field exists
      requiredFields.forEach(field => {
        expect(result).toHaveProperty(field);
        expect(result[field as keyof typeof result]).toBeDefined();
        expect(result[field as keyof typeof result]).not.toBeNull();
      });
    });

    it('should preserve all fields even when Gemini adds new ones', async () => {
      // Enable Gemini to test with new optional fields
      vi.spyOn(geminiService, 'isGeminiEnabled').mockReturnValue(true);
      vi.spyOn(geminiService, 'assessDamageWithGemini').mockResolvedValue({
        structural: 60,
        mechanical: 50,
        cosmetic: 70,
        electrical: 40,
        interior: 45,
        severity: 'moderate',
        airbagDeployed: true,
        totalLoss: false,
        summary: 'Moderate damage to front end with airbag deployment.',
        confidence: 85,
        method: 'gemini',
      });

      const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2020 };
      const result = await assessDamage(['https://example.com/photo.jpg'], 30000, vehicleContext);

      // Verify all existing fields are still present
      expect(result).toHaveProperty('labels');
      expect(result).toHaveProperty('confidenceScore');
      expect(result).toHaveProperty('damagePercentage');
      expect(result).toHaveProperty('processedAt');
      expect(result).toHaveProperty('damageSeverity');
      expect(result).toHaveProperty('estimatedSalvageValue');
      expect(result).toHaveProperty('reservePrice');

      // Verify new optional fields are also present
      expect(result).toHaveProperty('method');
      expect(result).toHaveProperty('detailedScores');
      expect(result).toHaveProperty('airbagDeployed');
      expect(result).toHaveProperty('totalLoss');
      expect(result).toHaveProperty('summary');
    });
  });

  describe('Requirement 11.4: Optional New Fields', () => {
    it('should mark new fields as optional (not required)', async () => {
      // Test with Vision API (should not have new fields)
      vi.spyOn(geminiService, 'isGeminiEnabled').mockReturnValue(false);
      vi.spyOn(visionService, 'assessDamageWithVision').mockResolvedValue({
        labels: ['Vehicle'],
        confidenceScore: 85,
        damagePercentage: 55,
        method: 'vision',
      });

      const result = await assessDamage(['https://example.com/photo.jpg'], 40000);

      // Verify method field is present (added by adapter)
      expect(result.method).toBe('vision');

      // Verify other new fields are not present (optional)
      // Vision adapter should not add detailedScores, airbagDeployed, totalLoss, or summary
      expect(result.detailedScores).toBeUndefined();
      expect(result.airbagDeployed).toBeUndefined();
      expect(result.totalLoss).toBeUndefined();
      expect(result.summary).toBeUndefined();
    });

    it('should allow clients to ignore new optional fields', async () => {
      vi.spyOn(geminiService, 'isGeminiEnabled').mockReturnValue(true);
      vi.spyOn(geminiService, 'assessDamageWithGemini').mockResolvedValue({
        structural: 55,
        mechanical: 45,
        cosmetic: 65,
        electrical: 35,
        interior: 40,
        severity: 'moderate',
        airbagDeployed: false,
        totalLoss: false,
        summary: 'Moderate cosmetic damage.',
        confidence: 88,
        method: 'gemini',
      });

      const vehicleContext = { make: 'Honda', model: 'Accord', year: 2019 };
      const result = await assessDamage(['https://example.com/photo.jpg'], 28000, vehicleContext);

      // Simulate legacy client that only reads existing fields
      const legacyClientView = {
        labels: result.labels,
        confidenceScore: result.confidenceScore,
        damagePercentage: result.damagePercentage,
        processedAt: result.processedAt,
        damageSeverity: result.damageSeverity,
        estimatedSalvageValue: result.estimatedSalvageValue,
        reservePrice: result.reservePrice,
      };

      // Verify legacy client can extract all required fields
      expect(legacyClientView.labels).toBeDefined();
      expect(legacyClientView.confidenceScore).toBeDefined();
      expect(legacyClientView.damagePercentage).toBeDefined();
      expect(legacyClientView.processedAt).toBeDefined();
      expect(legacyClientView.damageSeverity).toBeDefined();
      expect(legacyClientView.estimatedSalvageValue).toBeDefined();
      expect(legacyClientView.reservePrice).toBeDefined();

      // Verify legacy client view has all required data
      expect(Array.isArray(legacyClientView.labels)).toBe(true);
      expect(typeof legacyClientView.confidenceScore).toBe('number');
      expect(typeof legacyClientView.damagePercentage).toBe('number');
    });

    it('should not break JSON parsing when new fields are present', async () => {
      vi.spyOn(geminiService, 'isGeminiEnabled').mockReturnValue(true);
      vi.spyOn(geminiService, 'assessDamageWithGemini').mockResolvedValue({
        structural: 70,
        mechanical: 60,
        cosmetic: 75,
        electrical: 50,
        interior: 55,
        severity: 'severe',
        airbagDeployed: true,
        totalLoss: true,
        summary: 'Severe damage with total loss determination.',
        confidence: 90,
        method: 'gemini',
      });

      const vehicleContext = { make: 'Ford', model: 'F-150', year: 2021 };
      const result = await assessDamage(['https://example.com/photo.jpg'], 45000, vehicleContext);

      // Simulate JSON serialization/deserialization (common in API responses)
      const serialized = JSON.stringify(result);
      const deserialized = JSON.parse(serialized);

      // Verify all existing fields survive JSON round-trip
      expect(deserialized.labels).toEqual(result.labels);
      expect(deserialized.confidenceScore).toBe(result.confidenceScore);
      expect(deserialized.damagePercentage).toBe(result.damagePercentage);
      expect(deserialized.damageSeverity).toBe(result.damageSeverity);
      expect(deserialized.estimatedSalvageValue).toBe(result.estimatedSalvageValue);
      expect(deserialized.reservePrice).toBe(result.reservePrice);

      // Verify new optional fields also survive JSON round-trip
      expect(deserialized.method).toBe(result.method);
      expect(deserialized.detailedScores).toEqual(result.detailedScores);
      expect(deserialized.airbagDeployed).toBe(result.airbagDeployed);
      expect(deserialized.totalLoss).toBe(result.totalLoss);
      expect(deserialized.summary).toBe(result.summary);
    });
  });

  describe('Production-like Request Patterns', () => {
    it('should handle single photo request (common pattern)', async () => {
      vi.spyOn(geminiService, 'isGeminiEnabled').mockReturnValue(false);
      vi.spyOn(visionService, 'assessDamageWithVision').mockResolvedValue({
        labels: ['Vehicle', 'Car'],
        confidenceScore: 82,
        damagePercentage: 48,
        method: 'vision',
      });

      const result = await assessDamage(['https://cloudinary.com/image1.jpg'], 32000);

      expect(result).toBeDefined();
      expect(result.labels).toHaveLength(2);
      expect(result.damagePercentage).toBe(48);
    });

    it('should handle multiple photos request (common pattern)', async () => {
      vi.spyOn(geminiService, 'isGeminiEnabled').mockReturnValue(false);
      vi.spyOn(visionService, 'assessDamageWithVision').mockResolvedValue({
        labels: ['Vehicle', 'SUV', 'Moderate Damage'],
        confidenceScore: 87,
        damagePercentage: 62,
        method: 'vision',
      });

      const imageUrls = [
        'https://cloudinary.com/front.jpg',
        'https://cloudinary.com/side.jpg',
        'https://cloudinary.com/rear.jpg',
        'https://cloudinary.com/interior.jpg',
      ];

      const result = await assessDamage(imageUrls, 38000);

      expect(result).toBeDefined();
      expect(result.damageSeverity).toBe('moderate');
      expect(result.estimatedSalvageValue).toBeGreaterThan(0);
    });

    it('should handle request without vehicle context (legacy pattern)', async () => {
      vi.spyOn(geminiService, 'isGeminiEnabled').mockReturnValue(true);
      vi.spyOn(visionService, 'assessDamageWithVision').mockResolvedValue({
        labels: ['Vehicle', 'Sedan'],
        confidenceScore: 84,
        damagePercentage: 56,
        method: 'vision',
      });

      // Call without vehicle context - should fall back to Vision
      const result = await assessDamage(['https://cloudinary.com/photo.jpg'], 29000);

      expect(result).toBeDefined();
      expect(result.method).toBe('vision'); // Should use Vision when no context
      expect(result.labels).toBeDefined();
      expect(result.confidenceScore).toBeDefined();
    });

    it('should handle high market value vehicles (production pattern)', async () => {
      vi.spyOn(geminiService, 'isGeminiEnabled').mockReturnValue(false);
      vi.spyOn(visionService, 'assessDamageWithVision').mockResolvedValue({
        labels: ['Vehicle', 'Luxury Car', 'Minor Damage'],
        confidenceScore: 91,
        damagePercentage: 45, // Changed to 45 to match 'minor' severity range (40-60%)
        method: 'vision',
      });

      const highMarketValue = 125000; // Luxury vehicle
      const result = await assessDamage(['https://cloudinary.com/luxury.jpg'], highMarketValue);

      expect(result.estimatedSalvageValue).toBeGreaterThan(68000);
      expect(result.reservePrice).toBeGreaterThan(47000);
      expect(result.damageSeverity).toBe('minor');
    });

    it('should handle low market value vehicles (production pattern)', async () => {
      vi.spyOn(geminiService, 'isGeminiEnabled').mockReturnValue(false);
      vi.spyOn(visionService, 'assessDamageWithVision').mockResolvedValue({
        labels: ['Vehicle', 'Old Car', 'Severe Damage'],
        confidenceScore: 78,
        damagePercentage: 88,
        method: 'vision',
      });

      const lowMarketValue = 5000; // Older vehicle
      const result = await assessDamage(['https://cloudinary.com/old.jpg'], lowMarketValue);

      expect(result.estimatedSalvageValue).toBeLessThan(1000);
      expect(result.damageSeverity).toBe('severe');
    });

    it('should handle rapid sequential requests (production load pattern)', async () => {
      vi.spyOn(geminiService, 'isGeminiEnabled').mockReturnValue(false);
      vi.spyOn(visionService, 'assessDamageWithVision').mockResolvedValue({
        labels: ['Vehicle'],
        confidenceScore: 85,
        damagePercentage: 50,
        method: 'vision',
      });

      // Simulate 5 rapid requests
      const requests = Array.from({ length: 5 }, (_, i) => 
        assessDamage([`https://cloudinary.com/photo${i}.jpg`], 30000 + i * 1000)
      );

      const results = await Promise.all(requests);

      // Verify all requests succeeded
      expect(results).toHaveLength(5);
      results.forEach((result, i) => {
        expect(result).toBeDefined();
        expect(result.labels).toBeDefined();
        expect(result.estimatedSalvageValue).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling Backward Compatibility', () => {
    it('should maintain existing error behavior for invalid inputs', async () => {
      // Test with empty image array (should throw)
      await expect(assessDamage([], 30000)).rejects.toThrow(
        'At least one image URL is required'
      );
    });

    it('should handle Vision API errors same as before migration', async () => {
      vi.spyOn(geminiService, 'isGeminiEnabled').mockReturnValue(false);
      vi.spyOn(visionService, 'assessDamageWithVision').mockRejectedValue(
        new Error('Vision API unavailable')
      );

      const result = await assessDamage(['https://cloudinary.com/photo.jpg'], 35000);

      // Should fall back to neutral scores (existing behavior)
      expect(result.method).toBe('neutral');
      expect(result.damagePercentage).toBe(50);
      expect(result.damageSeverity).toBe('moderate');
    });

    it('should return neutral scores when all methods fail (existing behavior)', async () => {
      vi.spyOn(geminiService, 'isGeminiEnabled').mockReturnValue(true);
      vi.spyOn(geminiService, 'assessDamageWithGemini').mockRejectedValue(
        new Error('Gemini unavailable')
      );
      vi.spyOn(visionService, 'assessDamageWithVision').mockRejectedValue(
        new Error('Vision unavailable')
      );

      const result = await assessDamage(['https://cloudinary.com/photo.jpg'], 40000);

      // Verify neutral response structure matches existing behavior
      expect(result.method).toBe('neutral');
      expect(result.damagePercentage).toBe(50);
      expect(result.damageSeverity).toBe('moderate');
      expect(result.confidenceScore).toBe(0);
      expect(result.labels).toContain('Vehicle');
      expect(result.estimatedSalvageValue).toBeGreaterThan(0);
      expect(result.reservePrice).toBeGreaterThan(0);
    });
  });

  describe('Response Calculation Consistency', () => {
    it('should calculate salvage value same as before migration', async () => {
      vi.spyOn(geminiService, 'isGeminiEnabled').mockReturnValue(false);
      vi.spyOn(visionService, 'assessDamageWithVision').mockResolvedValue({
        labels: ['Vehicle'],
        confidenceScore: 85,
        damagePercentage: 40,
        method: 'vision',
      });

      const marketValue = 50000;
      const result = await assessDamage(['https://cloudinary.com/photo.jpg'], marketValue);

      // Verify calculation: salvageValue = marketValue * (100 - damagePercentage) / 100
      const expectedSalvageValue = marketValue * ((100 - 40) / 100);
      expect(result.estimatedSalvageValue).toBeCloseTo(expectedSalvageValue, 2);
    });

    it('should calculate reserve price same as before migration', async () => {
      vi.spyOn(geminiService, 'isGeminiEnabled').mockReturnValue(false);
      vi.spyOn(visionService, 'assessDamageWithVision').mockResolvedValue({
        labels: ['Vehicle'],
        confidenceScore: 85,
        damagePercentage: 60,
        method: 'vision',
      });

      const marketValue = 45000;
      const result = await assessDamage(['https://cloudinary.com/photo.jpg'], marketValue);

      // Verify calculation: reservePrice = salvageValue * 0.7
      const expectedSalvageValue = marketValue * ((100 - 60) / 100);
      const expectedReservePrice = expectedSalvageValue * 0.7;
      expect(result.reservePrice).toBeCloseTo(expectedReservePrice, 2);
    });

    it('should determine severity same as before migration', async () => {
      vi.spyOn(geminiService, 'isGeminiEnabled').mockReturnValue(false);

      // Test minor damage (40-60%)
      vi.spyOn(visionService, 'assessDamageWithVision').mockResolvedValue({
        labels: ['Vehicle'],
        confidenceScore: 85,
        damagePercentage: 45,
        method: 'vision',
      });
      let result = await assessDamage(['https://cloudinary.com/photo.jpg'], 30000);
      expect(result.damageSeverity).toBe('minor');

      // Test moderate damage (60-80%)
      vi.spyOn(visionService, 'assessDamageWithVision').mockResolvedValue({
        labels: ['Vehicle'],
        confidenceScore: 85,
        damagePercentage: 70,
        method: 'vision',
      });
      result = await assessDamage(['https://cloudinary.com/photo.jpg'], 30000);
      expect(result.damageSeverity).toBe('moderate');

      // Test severe damage (80-95%)
      vi.spyOn(visionService, 'assessDamageWithVision').mockResolvedValue({
        labels: ['Vehicle'],
        confidenceScore: 85,
        damagePercentage: 85,
        method: 'vision',
      });
      result = await assessDamage(['https://cloudinary.com/photo.jpg'], 30000);
      expect(result.damageSeverity).toBe('severe');
    });
  });
});
