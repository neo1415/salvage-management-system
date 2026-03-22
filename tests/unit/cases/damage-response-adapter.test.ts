/**
 * Unit Tests: Damage Response Adapter
 * 
 * Tests the response adapter functions that convert different AI assessment formats
 * (Gemini, Vision, Neutral) into a unified DamageAssessmentResult format.
 * 
 * Test Coverage:
 * 1. Gemini response conversion - all fields mapped correctly
 * 2. Vision response conversion - legacy format preserved
 * 3. Neutral response generation - all scores = 50, severity = 'moderate'
 * 4. Backward compatibility - all existing fields present
 * 5. New optional fields - present when using Gemini, absent when using Vision
 * 
 * Requirements: 11.1, 11.2, 11.3, 11.4
 */

import { describe, test, expect } from 'vitest';
import {
  adaptGeminiResponse,
  adaptVisionResponse,
  generateNeutralResponse,
  type DamageAssessmentResult,
} from '@/features/cases/services/damage-response-adapter';
import type { GeminiDamageAssessment } from '@/lib/integrations/gemini-damage-detection';
import type { VisionDamageAssessment } from '@/lib/integrations/vision-damage-detection';

describe('Damage Response Adapter', () => {
  const testMarketValue = 10000; // $10,000 test vehicle

  /**
   * Test Suite 1: Gemini Response Conversion
   * 
   * Validates that Gemini's structured damage assessment is correctly
   * converted to the unified format with all fields mapped properly.
   */
  describe('adaptGeminiResponse', () => {
    /**
     * Test 1.1: Complete Gemini response with all fields
     * 
     * Validates that a complete Gemini assessment with all damage scores,
     * flags, and summary is correctly converted to unified format.
     * 
     * Requirements: 11.1, 11.2, 11.3, 11.4
     */
    test('should convert complete Gemini response with all fields', () => {
      // Arrange
      const geminiAssessment: GeminiDamageAssessment = {
        structural: 60,
        mechanical: 40,
        cosmetic: 70,
        electrical: 20,
        interior: 30,
        severity: 'moderate',
        airbagDeployed: true,
        totalLoss: false,
        summary: 'Front-end collision with moderate damage. Airbags deployed. Vehicle is repairable.',
        confidence: 85,
        method: 'gemini',
      };

      // Act
      const result = adaptGeminiResponse(geminiAssessment, testMarketValue);

      // Assert - Existing required fields (backward compatibility)
      expect(result.labels).toBeDefined();
      expect(Array.isArray(result.labels)).toBe(true);
      expect(result.labels.length).toBeGreaterThan(0);
      expect(result.labels).toContain('Vehicle');
      expect(result.labels).toContain('Car');
      expect(result.confidenceScore).toBe(85);
      expect(result.damagePercentage).toBeGreaterThan(0);
      expect(result.damagePercentage).toBeLessThanOrEqual(100);
      expect(result.processedAt).toBeInstanceOf(Date);
      expect(result.damageSeverity).toBe('moderate');
      expect(result.estimatedSalvageValue).toBeGreaterThan(0);
      expect(result.reservePrice).toBeGreaterThan(0);

      // Assert - New optional fields (Gemini-specific)
      expect(result.method).toBe('gemini');
      expect(result.detailedScores).toBeDefined();
      expect(result.detailedScores?.structural).toBe(60);
      expect(result.detailedScores?.mechanical).toBe(40);
      expect(result.detailedScores?.cosmetic).toBe(70);
      expect(result.detailedScores?.electrical).toBe(20);
      expect(result.detailedScores?.interior).toBe(30);
      expect(result.airbagDeployed).toBe(true);
      expect(result.totalLoss).toBe(false);
      expect(result.summary).toBe(geminiAssessment.summary);
    });

    /**
     * Test 1.2: Damage percentage calculation from individual scores
     * 
     * Validates that the overall damage percentage is correctly calculated
     * from individual category scores using weighted average.
     * 
     * Weights: structural 30%, mechanical 25%, cosmetic 20%, electrical 15%, interior 10%
     * 
     * Requirements: 11.1
     */
    test('should calculate damage percentage using weighted average', () => {
      // Arrange - Known scores for predictable calculation
      const geminiAssessment: GeminiDamageAssessment = {
        structural: 50,   // 50 * 0.30 = 15
        mechanical: 40,   // 40 * 0.25 = 10
        cosmetic: 60,     // 60 * 0.20 = 12
        electrical: 30,   // 30 * 0.15 = 4.5
        interior: 20,     // 20 * 0.10 = 2
        severity: 'moderate',
        airbagDeployed: false,
        totalLoss: false,
        summary: 'Test weighted calculation',
        confidence: 85,
        method: 'gemini',
      };
      // Expected: 15 + 10 + 12 + 4.5 + 2 = 43.5, rounded = 44

      // Act
      const result = adaptGeminiResponse(geminiAssessment, testMarketValue);

      // Assert
      expect(result.damagePercentage).toBe(44);
    });

    /**
     * Test 1.3: Salvage value and reserve price calculation
     * 
     * Validates that estimated salvage value and reserve price are
     * correctly calculated based on damage percentage.
     * 
     * Formula:
     * - Salvage Value = marketValue × (100 - damagePercentage) / 100
     * - Reserve Price = salvageValue × 0.7
     * 
     * Requirements: 11.1
     */
    test('should calculate salvage value and reserve price correctly', () => {
      // Arrange - 50% damage
      const geminiAssessment: GeminiDamageAssessment = {
        structural: 50,
        mechanical: 50,
        cosmetic: 50,
        electrical: 50,
        interior: 50,
        severity: 'moderate',
        airbagDeployed: false,
        totalLoss: false,
        summary: 'Test value calculation',
        confidence: 85,
        method: 'gemini',
      };
      // Expected damage: 50% (all scores are 50)
      // Expected salvage: 10000 × (100 - 50) / 100 = 5000
      // Expected reserve: 5000 × 0.7 = 3500

      // Act
      const result = adaptGeminiResponse(geminiAssessment, testMarketValue);

      // Assert
      expect(result.damagePercentage).toBe(50);
      expect(result.estimatedSalvageValue).toBe(5000);
      expect(result.reservePrice).toBe(3500);
    });

    /**
     * Test 1.4: Label generation from Gemini assessment
     * 
     * Validates that descriptive labels are generated based on damage scores,
     * severity, and flags to maintain compatibility with label-based systems.
     * 
     * Requirements: 11.1, 11.4
     */
    test('should generate appropriate labels based on damage scores and flags', () => {
      // Arrange - High structural damage with airbag deployment
      const geminiAssessment: GeminiDamageAssessment = {
        structural: 80,   // High - should add structural labels
        mechanical: 30,   // Low - no mechanical labels
        cosmetic: 60,     // High - should add cosmetic labels
        electrical: 20,   // Low - no electrical labels
        interior: 55,     // High - should add interior labels
        severity: 'severe',
        airbagDeployed: true,
        totalLoss: false,
        summary: 'Test label generation',
        confidence: 85,
        method: 'gemini',
      };

      // Act
      const result = adaptGeminiResponse(geminiAssessment, testMarketValue);

      // Assert - Base labels
      expect(result.labels).toContain('Vehicle');
      expect(result.labels).toContain('Car');
      
      // Assert - Severity labels
      expect(result.labels).toContain('Severe Damage');
      
      // Assert - Category labels (scores > 50)
      expect(result.labels).toContain('Structural Damage');
      expect(result.labels).toContain('Cosmetic Damage');
      expect(result.labels).toContain('Interior Damage');
      
      // Assert - Flag labels
      expect(result.labels).toContain('Airbag Deployed');
      
      // Assert - Should NOT contain labels for low scores
      expect(result.labels).not.toContain('Mechanical Damage');
      expect(result.labels).not.toContain('Electrical Damage');
      expect(result.labels).not.toContain('Total Loss');
    });

    /**
     * Test 1.5: Minor severity labels
     * 
     * Validates that minor severity generates appropriate labels.
     * 
     * Requirements: 11.1
     */
    test('should generate minor severity labels', () => {
      // Arrange
      const geminiAssessment: GeminiDamageAssessment = {
        structural: 20,
        mechanical: 15,
        cosmetic: 25,
        electrical: 10,
        interior: 18,
        severity: 'minor',
        airbagDeployed: false,
        totalLoss: false,
        summary: 'Minor damage test',
        confidence: 85,
        method: 'gemini',
      };

      // Act
      const result = adaptGeminiResponse(geminiAssessment, testMarketValue);

      // Assert
      expect(result.labels).toContain('Minor Damage');
      expect(result.labels).toContain('Light Damage');
    });

    /**
     * Test 1.6: Total loss flag in labels
     * 
     * Validates that total loss flag adds appropriate labels.
     * 
     * Requirements: 11.1
     */
    test('should add total loss labels when flag is true', () => {
      // Arrange
      const geminiAssessment: GeminiDamageAssessment = {
        structural: 90,
        mechanical: 85,
        cosmetic: 80,
        electrical: 75,
        interior: 70,
        severity: 'severe',
        airbagDeployed: true,
        totalLoss: true,
        summary: 'Total loss vehicle',
        confidence: 85,
        method: 'gemini',
      };

      // Act
      const result = adaptGeminiResponse(geminiAssessment, testMarketValue);

      // Assert
      expect(result.labels).toContain('Total Loss');
      expect(result.labels).toContain('Beyond Repair');
    });

    /**
     * Test 1.7: Rounding of monetary values
     * 
     * Validates that salvage value and reserve price are rounded
     * to 2 decimal places for currency precision.
     * 
     * Requirements: 11.1
     */
    test('should round monetary values to 2 decimal places', () => {
      // Arrange - Values that will produce decimals
      const geminiAssessment: GeminiDamageAssessment = {
        structural: 33,
        mechanical: 33,
        cosmetic: 33,
        electrical: 33,
        interior: 33,
        severity: 'moderate',
        airbagDeployed: false,
        totalLoss: false,
        summary: 'Test rounding',
        confidence: 85,
        method: 'gemini',
      };

      // Act
      const result = adaptGeminiResponse(geminiAssessment, testMarketValue);

      // Assert - Values should be rounded to 2 decimal places
      expect(result.estimatedSalvageValue).toBeCloseTo(6700, 2);
      expect(result.reservePrice).toBeCloseTo(4690, 2);
      
      // Assert - Should not have more than 2 decimal places
      const salvageDecimals = (result.estimatedSalvageValue.toString().split('.')[1] || '').length;
      const reserveDecimals = (result.reservePrice.toString().split('.')[1] || '').length;
      expect(salvageDecimals).toBeLessThanOrEqual(2);
      expect(reserveDecimals).toBeLessThanOrEqual(2);
    });
  });

  /**
   * Test Suite 2: Vision Response Conversion
   * 
   * Validates that Vision API's keyword-based assessment is correctly
   * converted to the unified format while preserving legacy behavior.
   */
  describe('adaptVisionResponse', () => {
    /**
     * Test 2.1: Complete Vision response with legacy format
     * 
     * Validates that a Vision assessment maintains the legacy format
     * with existing fields and does NOT add Gemini-specific optional fields.
     * 
     * Requirements: 11.1, 11.2, 11.3, 11.4
     */
    test('should convert Vision response preserving legacy format', () => {
      // Arrange
      const visionAssessment: VisionDamageAssessment = {
        labels: ['Vehicle', 'Car', 'Damaged', 'Collision', 'Dent', 'Scratch'],
        confidenceScore: 75,
        damagePercentage: 65,
        method: 'vision',
      };

      // Act
      const result = adaptVisionResponse(visionAssessment, testMarketValue);

      // Assert - Existing required fields (backward compatibility)
      expect(result.labels).toEqual(visionAssessment.labels);
      expect(result.confidenceScore).toBe(75);
      expect(result.damagePercentage).toBe(65);
      expect(result.processedAt).toBeInstanceOf(Date);
      expect(result.damageSeverity).toBe('moderate'); // 65% falls in moderate range
      expect(result.estimatedSalvageValue).toBeGreaterThan(0);
      expect(result.reservePrice).toBeGreaterThan(0);

      // Assert - Method field present
      expect(result.method).toBe('vision');

      // Assert - Gemini-specific fields should NOT be present
      expect(result.detailedScores).toBeUndefined();
      expect(result.airbagDeployed).toBeUndefined();
      expect(result.totalLoss).toBeUndefined();
      expect(result.summary).toBeUndefined();
    });

    /**
     * Test 2.2: Severity determination - Minor (40-60%)
     * 
     * Validates that damage percentage in the 40-60% range
     * is classified as 'minor' severity.
     * 
     * Requirements: 11.1
     */
    test('should classify 40-60% damage as minor severity', () => {
      // Arrange
      const visionAssessment: VisionDamageAssessment = {
        labels: ['Vehicle', 'Car', 'Minor Damage'],
        confidenceScore: 70,
        damagePercentage: 50, // Mid-range of minor
        method: 'vision',
      };

      // Act
      const result = adaptVisionResponse(visionAssessment, testMarketValue);

      // Assert
      expect(result.damageSeverity).toBe('minor');
    });

    /**
     * Test 2.3: Severity determination - Moderate (60-80%)
     * 
     * Validates that damage percentage in the 60-80% range
     * is classified as 'moderate' severity.
     * 
     * Requirements: 11.1
     */
    test('should classify 60-80% damage as moderate severity', () => {
      // Arrange
      const visionAssessment: VisionDamageAssessment = {
        labels: ['Vehicle', 'Car', 'Moderate Damage'],
        confidenceScore: 70,
        damagePercentage: 70, // Mid-range of moderate
        method: 'vision',
      };

      // Act
      const result = adaptVisionResponse(visionAssessment, testMarketValue);

      // Assert
      expect(result.damageSeverity).toBe('moderate');
    });

    /**
     * Test 2.4: Severity determination - Severe (80-95%)
     * 
     * Validates that damage percentage above 80% is classified as 'severe' severity.
     * 
     * Requirements: 11.1
     */
    test('should classify 80%+ damage as severe severity', () => {
      // Arrange
      const visionAssessment: VisionDamageAssessment = {
        labels: ['Vehicle', 'Car', 'Severe Damage'],
        confidenceScore: 70,
        damagePercentage: 85, // Severe range
        method: 'vision',
      };

      // Act
      const result = adaptVisionResponse(visionAssessment, testMarketValue);

      // Assert
      expect(result.damageSeverity).toBe('severe');
    });

    /**
     * Test 2.5: Severity boundary - 40% (minor lower bound)
     * 
     * Validates boundary condition at 40% damage.
     * 
     * Requirements: 11.1
     */
    test('should classify exactly 40% damage as minor severity', () => {
      // Arrange
      const visionAssessment: VisionDamageAssessment = {
        labels: ['Vehicle', 'Car'],
        confidenceScore: 70,
        damagePercentage: 40,
        method: 'vision',
      };

      // Act
      const result = adaptVisionResponse(visionAssessment, testMarketValue);

      // Assert
      expect(result.damageSeverity).toBe('minor');
    });

    /**
     * Test 2.6: Severity boundary - 60% (minor/moderate boundary)
     * 
     * Validates boundary condition at 60% damage.
     * 
     * Requirements: 11.1
     */
    test('should classify exactly 60% damage as minor severity', () => {
      // Arrange
      const visionAssessment: VisionDamageAssessment = {
        labels: ['Vehicle', 'Car'],
        confidenceScore: 70,
        damagePercentage: 60,
        method: 'vision',
      };

      // Act
      const result = adaptVisionResponse(visionAssessment, testMarketValue);

      // Assert
      expect(result.damageSeverity).toBe('minor');
    });

    /**
     * Test 2.7: Severity boundary - 80% (moderate/severe boundary)
     * 
     * Validates boundary condition at 80% damage.
     * 
     * Requirements: 11.1
     */
    test('should classify exactly 80% damage as moderate severity', () => {
      // Arrange
      const visionAssessment: VisionDamageAssessment = {
        labels: ['Vehicle', 'Car'],
        confidenceScore: 70,
        damagePercentage: 80,
        method: 'vision',
      };

      // Act
      const result = adaptVisionResponse(visionAssessment, testMarketValue);

      // Assert
      expect(result.damageSeverity).toBe('moderate');
    });

    /**
     * Test 2.8: Severity edge case - Below 40%
     * 
     * Validates that damage below 40% defaults to severe
     * (based on the existing logic).
     * 
     * Requirements: 11.1
     */
    test('should classify damage below 40% as severe severity', () => {
      // Arrange
      const visionAssessment: VisionDamageAssessment = {
        labels: ['Vehicle', 'Car'],
        confidenceScore: 70,
        damagePercentage: 30,
        method: 'vision',
      };

      // Act
      const result = adaptVisionResponse(visionAssessment, testMarketValue);

      // Assert
      expect(result.damageSeverity).toBe('severe');
    });

    /**
     * Test 2.9: Severity edge case - Above 80%
     * 
     * Validates that damage above 80% is classified as severe.
     * 
     * Requirements: 11.1
     */
    test('should classify damage above 80% as severe severity', () => {
      // Arrange
      const visionAssessment: VisionDamageAssessment = {
        labels: ['Vehicle', 'Car'],
        confidenceScore: 70,
        damagePercentage: 95,
        method: 'vision',
      };

      // Act
      const result = adaptVisionResponse(visionAssessment, testMarketValue);

      // Assert
      expect(result.damageSeverity).toBe('severe');
    });

    /**
     * Test 2.10: Salvage value calculation for Vision
     * 
     * Validates that salvage value and reserve price are calculated
     * correctly for Vision assessments.
     * 
     * Requirements: 11.1
     */
    test('should calculate salvage value and reserve price for Vision', () => {
      // Arrange - 50% damage
      const visionAssessment: VisionDamageAssessment = {
        labels: ['Vehicle', 'Car'],
        confidenceScore: 70,
        damagePercentage: 50,
        method: 'vision',
      };
      // Expected salvage: 10000 × (100 - 50) / 100 = 5000
      // Expected reserve: 5000 × 0.7 = 3500

      // Act
      const result = adaptVisionResponse(visionAssessment, testMarketValue);

      // Assert
      expect(result.estimatedSalvageValue).toBe(5000);
      expect(result.reservePrice).toBe(3500);
    });
  });

  /**
   * Test Suite 3: Neutral Response Generation
   * 
   * Validates that neutral responses are generated correctly when
   * all AI methods fail, providing safe default values.
   */
  describe('generateNeutralResponse', () => {
    /**
     * Test 3.1: Neutral response with all default values
     * 
     * Validates that neutral response contains all required fields
     * with safe default values (50 for all scores, 'moderate' severity).
     * 
     * Requirements: 11.1, 11.2, 11.3, 11.4
     */
    test('should generate neutral response with all default values', () => {
      // Act
      const result = generateNeutralResponse(testMarketValue);

      // Assert - Existing required fields
      expect(result.labels).toEqual(['Vehicle', 'Car', 'Moderate Damage']);
      expect(result.confidenceScore).toBe(0); // No AI assessment
      expect(result.damagePercentage).toBe(50); // Neutral
      expect(result.processedAt).toBeInstanceOf(Date);
      expect(result.damageSeverity).toBe('moderate'); // Neutral
      expect(result.estimatedSalvageValue).toBeGreaterThan(0);
      expect(result.reservePrice).toBeGreaterThan(0);

      // Assert - Method field
      expect(result.method).toBe('neutral');

      // Assert - Neutral detailed scores (all 50)
      expect(result.detailedScores).toBeDefined();
      expect(result.detailedScores?.structural).toBe(50);
      expect(result.detailedScores?.mechanical).toBe(50);
      expect(result.detailedScores?.cosmetic).toBe(50);
      expect(result.detailedScores?.electrical).toBe(50);
      expect(result.detailedScores?.interior).toBe(50);

      // Assert - Neutral flags
      expect(result.airbagDeployed).toBe(false);
      expect(result.totalLoss).toBe(false);

      // Assert - Summary indicates manual review needed
      expect(result.summary).toContain('AI assessment unavailable');
      expect(result.summary).toContain('Manual review recommended');
    });

    /**
     * Test 3.2: Neutral salvage value calculation
     * 
     * Validates that salvage value and reserve price are calculated
     * correctly for neutral responses (50% damage).
     * 
     * Requirements: 11.1
     */
    test('should calculate salvage value for 50% damage', () => {
      // Expected salvage: 10000 × (100 - 50) / 100 = 5000
      // Expected reserve: 5000 × 0.7 = 3500

      // Act
      const result = generateNeutralResponse(testMarketValue);

      // Assert
      expect(result.estimatedSalvageValue).toBe(5000);
      expect(result.reservePrice).toBe(3500);
    });

    /**
     * Test 3.3: Neutral response with different market values
     * 
     * Validates that neutral response calculations work correctly
     * with various market values.
     * 
     * Requirements: 11.1
     */
    test.each([
      { marketValue: 5000, expectedSalvage: 2500, expectedReserve: 1750 },
      { marketValue: 20000, expectedSalvage: 10000, expectedReserve: 7000 },
      { marketValue: 50000, expectedSalvage: 25000, expectedReserve: 17500 },
    ])('should calculate correctly for market value $marketValue', ({ marketValue, expectedSalvage, expectedReserve }) => {
      // Act
      const result = generateNeutralResponse(marketValue);

      // Assert
      expect(result.estimatedSalvageValue).toBe(expectedSalvage);
      expect(result.reservePrice).toBe(expectedReserve);
    });
  });

  /**
   * Test Suite 4: Backward Compatibility
   * 
   * Validates that all response formats maintain backward compatibility
   * with existing API contracts and downstream systems.
   */
  describe('Backward Compatibility', () => {
    /**
     * Test 4.1: All existing fields present in Gemini response
     * 
     * Validates that Gemini responses contain all existing required fields
     * that downstream systems expect.
     * 
     * Requirements: 11.1, 11.2, 11.3, 11.4
     */
    test('should include all existing required fields in Gemini response', () => {
      // Arrange
      const geminiAssessment: GeminiDamageAssessment = {
        structural: 50,
        mechanical: 50,
        cosmetic: 50,
        electrical: 50,
        interior: 50,
        severity: 'moderate',
        airbagDeployed: false,
        totalLoss: false,
        summary: 'Test backward compatibility',
        confidence: 85,
        method: 'gemini',
      };

      // Act
      const result = adaptGeminiResponse(geminiAssessment, testMarketValue);

      // Assert - All existing required fields must be present
      expect(result).toHaveProperty('labels');
      expect(result).toHaveProperty('confidenceScore');
      expect(result).toHaveProperty('damagePercentage');
      expect(result).toHaveProperty('processedAt');
      expect(result).toHaveProperty('damageSeverity');
      expect(result).toHaveProperty('estimatedSalvageValue');
      expect(result).toHaveProperty('reservePrice');

      // Assert - Field types must match existing contracts
      expect(Array.isArray(result.labels)).toBe(true);
      expect(typeof result.confidenceScore).toBe('number');
      expect(typeof result.damagePercentage).toBe('number');
      expect(result.processedAt).toBeInstanceOf(Date);
      expect(['minor', 'moderate', 'severe']).toContain(result.damageSeverity);
      expect(typeof result.estimatedSalvageValue).toBe('number');
      expect(typeof result.reservePrice).toBe('number');
    });

    /**
     * Test 4.2: All existing fields present in Vision response
     * 
     * Validates that Vision responses contain all existing required fields.
     * 
     * Requirements: 11.1, 11.2, 11.3, 11.4
     */
    test('should include all existing required fields in Vision response', () => {
      // Arrange
      const visionAssessment: VisionDamageAssessment = {
        labels: ['Vehicle', 'Car'],
        confidenceScore: 70,
        damagePercentage: 50,
        method: 'vision',
      };

      // Act
      const result = adaptVisionResponse(visionAssessment, testMarketValue);

      // Assert - All existing required fields must be present
      expect(result).toHaveProperty('labels');
      expect(result).toHaveProperty('confidenceScore');
      expect(result).toHaveProperty('damagePercentage');
      expect(result).toHaveProperty('processedAt');
      expect(result).toHaveProperty('damageSeverity');
      expect(result).toHaveProperty('estimatedSalvageValue');
      expect(result).toHaveProperty('reservePrice');

      // Assert - Field types must match existing contracts
      expect(Array.isArray(result.labels)).toBe(true);
      expect(typeof result.confidenceScore).toBe('number');
      expect(typeof result.damagePercentage).toBe('number');
      expect(result.processedAt).toBeInstanceOf(Date);
      expect(['minor', 'moderate', 'severe']).toContain(result.damageSeverity);
      expect(typeof result.estimatedSalvageValue).toBe('number');
      expect(typeof result.reservePrice).toBe('number');
    });

    /**
     * Test 4.3: All existing fields present in Neutral response
     * 
     * Validates that Neutral responses contain all existing required fields.
     * 
     * Requirements: 11.1, 11.2, 11.3, 11.4
     */
    test('should include all existing required fields in Neutral response', () => {
      // Act
      const result = generateNeutralResponse(testMarketValue);

      // Assert - All existing required fields must be present
      expect(result).toHaveProperty('labels');
      expect(result).toHaveProperty('confidenceScore');
      expect(result).toHaveProperty('damagePercentage');
      expect(result).toHaveProperty('processedAt');
      expect(result).toHaveProperty('damageSeverity');
      expect(result).toHaveProperty('estimatedSalvageValue');
      expect(result).toHaveProperty('reservePrice');

      // Assert - Field types must match existing contracts
      expect(Array.isArray(result.labels)).toBe(true);
      expect(typeof result.confidenceScore).toBe('number');
      expect(typeof result.damagePercentage).toBe('number');
      expect(result.processedAt).toBeInstanceOf(Date);
      expect(['minor', 'moderate', 'severe']).toContain(result.damageSeverity);
      expect(typeof result.estimatedSalvageValue).toBe('number');
      expect(typeof result.reservePrice).toBe('number');
    });

    /**
     * Test 4.4: New optional fields only in Gemini response
     * 
     * Validates that new optional fields (detailedScores, airbagDeployed,
     * totalLoss, summary) are present in Gemini responses but not in Vision.
     * 
     * Requirements: 11.4
     */
    test('should include new optional fields only in Gemini response', () => {
      // Arrange
      const geminiAssessment: GeminiDamageAssessment = {
        structural: 50,
        mechanical: 50,
        cosmetic: 50,
        electrical: 50,
        interior: 50,
        severity: 'moderate',
        airbagDeployed: true,
        totalLoss: false,
        summary: 'Test optional fields',
        confidence: 85,
        method: 'gemini',
      };

      const visionAssessment: VisionDamageAssessment = {
        labels: ['Vehicle', 'Car'],
        confidenceScore: 70,
        damagePercentage: 50,
        method: 'vision',
      };

      // Act
      const geminiResult = adaptGeminiResponse(geminiAssessment, testMarketValue);
      const visionResult = adaptVisionResponse(visionAssessment, testMarketValue);

      // Assert - Gemini should have optional fields
      expect(geminiResult.detailedScores).toBeDefined();
      expect(geminiResult.airbagDeployed).toBeDefined();
      expect(geminiResult.totalLoss).toBeDefined();
      expect(geminiResult.summary).toBeDefined();

      // Assert - Vision should NOT have optional fields
      expect(visionResult.detailedScores).toBeUndefined();
      expect(visionResult.airbagDeployed).toBeUndefined();
      expect(visionResult.totalLoss).toBeUndefined();
      expect(visionResult.summary).toBeUndefined();
    });

    /**
     * Test 4.5: Method field present in all responses
     * 
     * Validates that the method field is present in all response types
     * to indicate which assessment method was used.
     * 
     * Requirements: 11.4
     */
    test('should include method field in all response types', () => {
      // Arrange
      const geminiAssessment: GeminiDamageAssessment = {
        structural: 50,
        mechanical: 50,
        cosmetic: 50,
        electrical: 50,
        interior: 50,
        severity: 'moderate',
        airbagDeployed: false,
        totalLoss: false,
        summary: 'Test method field',
        confidence: 85,
        method: 'gemini',
      };

      const visionAssessment: VisionDamageAssessment = {
        labels: ['Vehicle', 'Car'],
        confidenceScore: 70,
        damagePercentage: 50,
        method: 'vision',
      };

      // Act
      const geminiResult = adaptGeminiResponse(geminiAssessment, testMarketValue);
      const visionResult = adaptVisionResponse(visionAssessment, testMarketValue);
      const neutralResult = generateNeutralResponse(testMarketValue);

      // Assert
      expect(geminiResult.method).toBe('gemini');
      expect(visionResult.method).toBe('vision');
      expect(neutralResult.method).toBe('neutral');
    });
  });
});

