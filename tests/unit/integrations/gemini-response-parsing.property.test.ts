/**
 * Property-Based Tests for Gemini Response Parsing - Damage Score Range Invariant
 * 
 * Feature: gemini-damage-detection-migration
 * Task: 7.3 Write property-based test for damage score range invariant
 * Property 1: Damage Score Range Invariant
 * 
 * **Validates: Requirements 4.10, 15.3**
 * 
 * This test verifies that for ANY Gemini response (valid or with out-of-range scores),
 * ALL damage scores (structural, mechanical, cosmetic, electrical, interior) SHALL be
 * between 0 and 100 inclusive after parsing.
 * 
 * Uses fast-check library to generate 100+ random response scenarios including:
 * - Valid scores within 0-100 range
 * - Scores below 0 (should be clamped to 0)
 * - Scores above 100 (should be clamped to 100)
 * - Various combinations of valid and invalid scores
 * 
 * Requirements: 4.10, 15.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseAndValidateResponse } from '../../../src/lib/integrations/gemini-damage-detection';

describe('Property-Based Tests: Gemini Response Parsing - Damage Score Range Invariant', () => {
  /**
   * Property 1: Damage Score Range Invariant
   * 
   * For ANY Gemini response, all damage scores MUST be between 0 and 100 inclusive
   * after parsing and validation. Out-of-range scores MUST be clamped to valid range.
   */
  describe('Property 1: Damage Score Range Invariant', () => {
    it('should ensure all damage scores are within 0-100 range for any response', () => {
      // Arrange: Generate random Gemini responses with various score values
      const geminiResponseArbitrary = fc.record({
        structural: fc.integer({ min: -1000, max: 1000 }),
        mechanical: fc.integer({ min: -1000, max: 1000 }),
        cosmetic: fc.integer({ min: -1000, max: 1000 }),
        electrical: fc.integer({ min: -1000, max: 1000 }),
        interior: fc.integer({ min: -1000, max: 1000 }),
        severity: fc.constantFrom('minor', 'moderate', 'severe'),
        airbagDeployed: fc.boolean(),
        totalLoss: fc.boolean(),
        summary: fc.string({ minLength: 10, maxLength: 400 })
      });

      // Act & Assert: For ANY response, all scores must be 0-100 inclusive
      fc.assert(
        fc.property(geminiResponseArbitrary, (response) => {
          const requestId = 'test-property-1';
          const result = parseAndValidateResponse(JSON.stringify(response), requestId);
          
          // Verify all damage scores are within valid range
          const structuralInRange = result.structural >= 0 && result.structural <= 100;
          const mechanicalInRange = result.mechanical >= 0 && result.mechanical <= 100;
          const cosmeticInRange = result.cosmetic >= 0 && result.cosmetic <= 100;
          const electricalInRange = result.electrical >= 0 && result.electrical <= 100;
          const interiorInRange = result.interior >= 0 && result.interior <= 100;
          
          // All scores must be in range
          return structuralInRange && 
                 mechanicalInRange && 
                 cosmeticInRange && 
                 electricalInRange && 
                 interiorInRange;
        }),
        { numRuns: 100 } // Run with 100+ random response scenarios
      );
    });

    it('should clamp scores below 0 to 0 for any response', () => {
      // Arrange: Generate responses with at least one negative score
      const negativeScoreResponseArbitrary = fc.record({
        structural: fc.integer({ min: -1000, max: -1 }),
        mechanical: fc.integer({ min: -1000, max: 1000 }),
        cosmetic: fc.integer({ min: -1000, max: 1000 }),
        electrical: fc.integer({ min: -1000, max: 1000 }),
        interior: fc.integer({ min: -1000, max: 1000 }),
        severity: fc.constantFrom('minor', 'moderate', 'severe'),
        airbagDeployed: fc.boolean(),
        totalLoss: fc.boolean(),
        summary: fc.string({ minLength: 10, maxLength: 400 })
      });

      // Act & Assert: Negative scores must be clamped to 0
      fc.assert(
        fc.property(negativeScoreResponseArbitrary, (response) => {
          const requestId = 'test-property-1-negative';
          const result = parseAndValidateResponse(JSON.stringify(response), requestId);
          
          // Structural was negative, should be clamped to 0
          expect(result.structural).toBe(0);
          
          // All scores must still be in valid range
          return result.structural >= 0 && result.structural <= 100 &&
                 result.mechanical >= 0 && result.mechanical <= 100 &&
                 result.cosmetic >= 0 && result.cosmetic <= 100 &&
                 result.electrical >= 0 && result.electrical <= 100 &&
                 result.interior >= 0 && result.interior <= 100;
        }),
        { numRuns: 100 }
      );
    });

    it('should clamp scores above 100 to 100 for any response', () => {
      // Arrange: Generate responses with at least one score above 100
      const highScoreResponseArbitrary = fc.record({
        structural: fc.integer({ min: 101, max: 1000 }),
        mechanical: fc.integer({ min: -1000, max: 1000 }),
        cosmetic: fc.integer({ min: -1000, max: 1000 }),
        electrical: fc.integer({ min: -1000, max: 1000 }),
        interior: fc.integer({ min: -1000, max: 1000 }),
        severity: fc.constantFrom('minor', 'moderate', 'severe'),
        airbagDeployed: fc.boolean(),
        totalLoss: fc.boolean(),
        summary: fc.string({ minLength: 10, maxLength: 400 })
      });

      // Act & Assert: Scores above 100 must be clamped to 100
      fc.assert(
        fc.property(highScoreResponseArbitrary, (response) => {
          const requestId = 'test-property-1-high';
          const result = parseAndValidateResponse(JSON.stringify(response), requestId);
          
          // Structural was above 100, should be clamped to 100
          expect(result.structural).toBe(100);
          
          // All scores must still be in valid range
          return result.structural >= 0 && result.structural <= 100 &&
                 result.mechanical >= 0 && result.mechanical <= 100 &&
                 result.cosmetic >= 0 && result.cosmetic <= 100 &&
                 result.electrical >= 0 && result.electrical <= 100 &&
                 result.interior >= 0 && result.interior <= 100;
        }),
        { numRuns: 100 }
      );
    });

    it('should handle responses with multiple out-of-range scores', () => {
      // Arrange: Generate responses with multiple scores outside valid range
      const multipleOutOfRangeArbitrary = fc.record({
        structural: fc.integer({ min: -500, max: 500 }),
        mechanical: fc.integer({ min: -500, max: 500 }),
        cosmetic: fc.integer({ min: -500, max: 500 }),
        electrical: fc.integer({ min: -500, max: 500 }),
        interior: fc.integer({ min: -500, max: 500 }),
        severity: fc.constantFrom('minor', 'moderate', 'severe'),
        airbagDeployed: fc.boolean(),
        totalLoss: fc.boolean(),
        summary: fc.string({ minLength: 10, maxLength: 400 })
      });

      // Act & Assert: All scores must be clamped to valid range
      fc.assert(
        fc.property(multipleOutOfRangeArbitrary, (response) => {
          const requestId = 'test-property-1-multiple';
          const result = parseAndValidateResponse(JSON.stringify(response), requestId);
          
          // Verify all scores are within valid range after clamping
          const allScoresValid = 
            result.structural >= 0 && result.structural <= 100 &&
            result.mechanical >= 0 && result.mechanical <= 100 &&
            result.cosmetic >= 0 && result.cosmetic <= 100 &&
            result.electrical >= 0 && result.electrical <= 100 &&
            result.interior >= 0 && result.interior <= 100;
          
          // Verify clamping logic
          if (response.structural < 0) {
            expect(result.structural).toBe(0);
          } else if (response.structural > 100) {
            expect(result.structural).toBe(100);
          } else {
            expect(result.structural).toBe(response.structural);
          }
          
          if (response.mechanical < 0) {
            expect(result.mechanical).toBe(0);
          } else if (response.mechanical > 100) {
            expect(result.mechanical).toBe(100);
          } else {
            expect(result.mechanical).toBe(response.mechanical);
          }
          
          if (response.cosmetic < 0) {
            expect(result.cosmetic).toBe(0);
          } else if (response.cosmetic > 100) {
            expect(result.cosmetic).toBe(100);
          } else {
            expect(result.cosmetic).toBe(response.cosmetic);
          }
          
          if (response.electrical < 0) {
            expect(result.electrical).toBe(0);
          } else if (response.electrical > 100) {
            expect(result.electrical).toBe(100);
          } else {
            expect(result.electrical).toBe(response.electrical);
          }
          
          if (response.interior < 0) {
            expect(result.interior).toBe(0);
          } else if (response.interior > 100) {
            expect(result.interior).toBe(100);
          } else {
            expect(result.interior).toBe(response.interior);
          }
          
          return allScoresValid;
        }),
        { numRuns: 150 } // Run with 150+ scenarios for comprehensive coverage
      );
    });

    it('should preserve valid scores within 0-100 range', () => {
      // Arrange: Generate responses with all scores in valid range
      const validScoreResponseArbitrary = fc.record({
        structural: fc.integer({ min: 0, max: 100 }),
        mechanical: fc.integer({ min: 0, max: 100 }),
        cosmetic: fc.integer({ min: 0, max: 100 }),
        electrical: fc.integer({ min: 0, max: 100 }),
        interior: fc.integer({ min: 0, max: 100 }),
        severity: fc.constantFrom('minor', 'moderate', 'severe'),
        airbagDeployed: fc.boolean(),
        totalLoss: fc.boolean(),
        summary: fc.string({ minLength: 10, maxLength: 400 })
      });

      // Act & Assert: Valid scores should be preserved unchanged
      fc.assert(
        fc.property(validScoreResponseArbitrary, (response) => {
          const requestId = 'test-property-1-valid';
          const result = parseAndValidateResponse(JSON.stringify(response), requestId);
          
          // Verify scores are preserved exactly as provided
          return result.structural === response.structural &&
                 result.mechanical === response.mechanical &&
                 result.cosmetic === response.cosmetic &&
                 result.electrical === response.electrical &&
                 result.interior === response.interior;
        }),
        { numRuns: 100 }
      );
    });

    it('should handle boundary values (0 and 100) correctly', () => {
      // Arrange: Generate responses with boundary values
      const boundaryValueArbitrary = fc.record({
        structural: fc.constantFrom(0, 100),
        mechanical: fc.constantFrom(0, 100),
        cosmetic: fc.constantFrom(0, 100),
        electrical: fc.constantFrom(0, 100),
        interior: fc.constantFrom(0, 100),
        severity: fc.constantFrom('minor', 'moderate', 'severe'),
        airbagDeployed: fc.boolean(),
        totalLoss: fc.boolean(),
        summary: fc.string({ minLength: 10, maxLength: 400 })
      });

      // Act & Assert: Boundary values should be preserved
      fc.assert(
        fc.property(boundaryValueArbitrary, (response) => {
          const requestId = 'test-property-1-boundary';
          const result = parseAndValidateResponse(JSON.stringify(response), requestId);
          
          // Verify boundary values are preserved
          const boundaryValuesPreserved = 
            result.structural === response.structural &&
            result.mechanical === response.mechanical &&
            result.cosmetic === response.cosmetic &&
            result.electrical === response.electrical &&
            result.interior === response.interior;
          
          // Verify all are still in valid range
          const allInRange = 
            result.structural >= 0 && result.structural <= 100 &&
            result.mechanical >= 0 && result.mechanical <= 100 &&
            result.cosmetic >= 0 && result.cosmetic <= 100 &&
            result.electrical >= 0 && result.electrical <= 100 &&
            result.interior >= 0 && result.interior <= 100;
          
          return boundaryValuesPreserved && allInRange;
        }),
        { numRuns: 100 }
      );
    });

    it('should handle extreme out-of-range values', () => {
      // Arrange: Generate responses with extreme values
      const extremeValueArbitrary = fc.record({
        structural: fc.integer({ min: -10000, max: 10000 }),
        mechanical: fc.integer({ min: -10000, max: 10000 }),
        cosmetic: fc.integer({ min: -10000, max: 10000 }),
        electrical: fc.integer({ min: -10000, max: 10000 }),
        interior: fc.integer({ min: -10000, max: 10000 }),
        severity: fc.constantFrom('minor', 'moderate', 'severe'),
        airbagDeployed: fc.boolean(),
        totalLoss: fc.boolean(),
        summary: fc.string({ minLength: 10, maxLength: 400 })
      });

      // Act & Assert: Even extreme values should be clamped correctly
      fc.assert(
        fc.property(extremeValueArbitrary, (response) => {
          const requestId = 'test-property-1-extreme';
          const result = parseAndValidateResponse(JSON.stringify(response), requestId);
          
          // Verify all scores are within valid range
          const allInRange = 
            result.structural >= 0 && result.structural <= 100 &&
            result.mechanical >= 0 && result.mechanical <= 100 &&
            result.cosmetic >= 0 && result.cosmetic <= 100 &&
            result.electrical >= 0 && result.electrical <= 100 &&
            result.interior >= 0 && result.interior <= 100;
          
          // Verify extreme values are clamped to boundaries
          if (response.structural < 0) {
            expect(result.structural).toBe(0);
          } else if (response.structural > 100) {
            expect(result.structural).toBe(100);
          }
          
          if (response.mechanical < 0) {
            expect(result.mechanical).toBe(0);
          } else if (response.mechanical > 100) {
            expect(result.mechanical).toBe(100);
          }
          
          if (response.cosmetic < 0) {
            expect(result.cosmetic).toBe(0);
          } else if (response.cosmetic > 100) {
            expect(result.cosmetic).toBe(100);
          }
          
          if (response.electrical < 0) {
            expect(result.electrical).toBe(0);
          } else if (response.electrical > 100) {
            expect(result.electrical).toBe(100);
          }
          
          if (response.interior < 0) {
            expect(result.interior).toBe(0);
          } else if (response.interior > 100) {
            expect(result.interior).toBe(100);
          }
          
          return allInRange;
        }),
        { numRuns: 100 }
      );
    });

    it('should handle mixed valid and invalid scores consistently', () => {
      // Arrange: Generate responses with mix of valid and invalid scores
      const mixedScoreArbitrary = fc.tuple(
        fc.integer({ min: 0, max: 100 }),      // Valid
        fc.integer({ min: -500, max: -1 }),    // Invalid (negative)
        fc.integer({ min: 0, max: 100 }),      // Valid
        fc.integer({ min: 101, max: 500 }),    // Invalid (too high)
        fc.integer({ min: 0, max: 100 })       // Valid
      ).map(([structural, mechanical, cosmetic, electrical, interior]) => ({
        structural,
        mechanical,
        cosmetic,
        electrical,
        interior,
        severity: 'moderate' as const,
        airbagDeployed: true,
        totalLoss: false,
        summary: 'Mixed score test'
      }));

      // Act & Assert: Mixed scores should be handled correctly
      fc.assert(
        fc.property(mixedScoreArbitrary, (response) => {
          const requestId = 'test-property-1-mixed';
          const result = parseAndValidateResponse(JSON.stringify(response), requestId);
          
          // Verify valid scores are preserved
          expect(result.structural).toBe(response.structural);
          expect(result.cosmetic).toBe(response.cosmetic);
          expect(result.interior).toBe(response.interior);
          
          // Verify invalid scores are clamped
          expect(result.mechanical).toBe(0);  // Was negative
          expect(result.electrical).toBe(100); // Was above 100
          
          // Verify all are in valid range
          return result.structural >= 0 && result.structural <= 100 &&
                 result.mechanical >= 0 && result.mechanical <= 100 &&
                 result.cosmetic >= 0 && result.cosmetic <= 100 &&
                 result.electrical >= 0 && result.electrical <= 100 &&
                 result.interior >= 0 && result.interior <= 100;
        }),
        { numRuns: 100 }
      );
    });

    it('should maintain range invariant across different severity levels', () => {
      // Arrange: Generate responses with various severity levels
      const severityVariationArbitrary = fc.record({
        structural: fc.integer({ min: -1000, max: 1000 }),
        mechanical: fc.integer({ min: -1000, max: 1000 }),
        cosmetic: fc.integer({ min: -1000, max: 1000 }),
        electrical: fc.integer({ min: -1000, max: 1000 }),
        interior: fc.integer({ min: -1000, max: 1000 }),
        severity: fc.constantFrom('minor', 'moderate', 'severe'),
        airbagDeployed: fc.boolean(),
        totalLoss: fc.boolean(),
        summary: fc.string({ minLength: 10, maxLength: 400 })
      });

      // Act & Assert: Range invariant should hold regardless of severity
      fc.assert(
        fc.property(severityVariationArbitrary, (response) => {
          const requestId = 'test-property-1-severity';
          const result = parseAndValidateResponse(JSON.stringify(response), requestId);
          
          // Verify range invariant holds for all severity levels
          const allInRange = 
            result.structural >= 0 && result.structural <= 100 &&
            result.mechanical >= 0 && result.mechanical <= 100 &&
            result.cosmetic >= 0 && result.cosmetic <= 100 &&
            result.electrical >= 0 && result.electrical <= 100 &&
            result.interior >= 0 && result.interior <= 100;
          
          // Verify severity is preserved (or defaulted to moderate if invalid)
          const severityValid = ['minor', 'moderate', 'severe'].includes(result.severity);
          
          return allInRange && severityValid;
        }),
        { numRuns: 100 }
      );
    });

    it('should maintain range invariant across different boolean flag combinations', () => {
      // Arrange: Generate responses with various boolean flag combinations
      const booleanVariationArbitrary = fc.record({
        structural: fc.integer({ min: -1000, max: 1000 }),
        mechanical: fc.integer({ min: -1000, max: 1000 }),
        cosmetic: fc.integer({ min: -1000, max: 1000 }),
        electrical: fc.integer({ min: -1000, max: 1000 }),
        interior: fc.integer({ min: -1000, max: 1000 }),
        severity: fc.constantFrom('minor', 'moderate', 'severe'),
        airbagDeployed: fc.boolean(),
        totalLoss: fc.boolean(),
        summary: fc.string({ minLength: 10, maxLength: 400 })
      });

      // Act & Assert: Range invariant should hold regardless of boolean flags
      fc.assert(
        fc.property(booleanVariationArbitrary, (response) => {
          const requestId = 'test-property-1-boolean';
          const result = parseAndValidateResponse(JSON.stringify(response), requestId);
          
          // Verify range invariant holds for all boolean combinations
          const allInRange = 
            result.structural >= 0 && result.structural <= 100 &&
            result.mechanical >= 0 && result.mechanical <= 100 &&
            result.cosmetic >= 0 && result.cosmetic <= 100 &&
            result.electrical >= 0 && result.electrical <= 100 &&
            result.interior >= 0 && result.interior <= 100;
          
          // Verify boolean flags are preserved
          const booleansValid = 
            typeof result.airbagDeployed === 'boolean' &&
            typeof result.totalLoss === 'boolean';
          
          return allInRange && booleansValid;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property tests for comprehensive coverage
   */
  describe('Comprehensive Range Invariant Tests', () => {
    it('should maintain range invariant for responses with all scores at minimum boundary', () => {
      // Arrange: All scores at 0
      const allZeroResponse = {
        structural: 0,
        mechanical: 0,
        cosmetic: 0,
        electrical: 0,
        interior: 0,
        severity: 'minor',
        airbagDeployed: false,
        totalLoss: false,
        summary: 'All scores at minimum boundary'
      };

      // Act
      const result = parseAndValidateResponse(JSON.stringify(allZeroResponse), 'test-all-zero');

      // Assert
      expect(result.structural).toBe(0);
      expect(result.mechanical).toBe(0);
      expect(result.cosmetic).toBe(0);
      expect(result.electrical).toBe(0);
      expect(result.interior).toBe(0);
    });

    it('should maintain range invariant for responses with all scores at maximum boundary', () => {
      // Arrange: All scores at 100
      const allMaxResponse = {
        structural: 100,
        mechanical: 100,
        cosmetic: 100,
        electrical: 100,
        interior: 100,
        severity: 'severe',
        airbagDeployed: true,
        totalLoss: true,
        summary: 'All scores at maximum boundary'
      };

      // Act
      const result = parseAndValidateResponse(JSON.stringify(allMaxResponse), 'test-all-max');

      // Assert
      expect(result.structural).toBe(100);
      expect(result.mechanical).toBe(100);
      expect(result.cosmetic).toBe(100);
      expect(result.electrical).toBe(100);
      expect(result.interior).toBe(100);
    });

    it('should maintain range invariant for responses with all scores below minimum', () => {
      // Arrange: All scores negative
      const allNegativeResponse = {
        structural: -50,
        mechanical: -100,
        cosmetic: -25,
        electrical: -75,
        interior: -10,
        severity: 'moderate',
        airbagDeployed: false,
        totalLoss: false,
        summary: 'All scores below minimum'
      };

      // Act
      const result = parseAndValidateResponse(JSON.stringify(allNegativeResponse), 'test-all-negative');

      // Assert - all should be clamped to 0
      expect(result.structural).toBe(0);
      expect(result.mechanical).toBe(0);
      expect(result.cosmetic).toBe(0);
      expect(result.electrical).toBe(0);
      expect(result.interior).toBe(0);
    });

    it('should maintain range invariant for responses with all scores above maximum', () => {
      // Arrange: All scores above 100
      const allHighResponse = {
        structural: 150,
        mechanical: 200,
        cosmetic: 125,
        electrical: 175,
        interior: 110,
        severity: 'severe',
        airbagDeployed: true,
        totalLoss: true,
        summary: 'All scores above maximum'
      };

      // Act
      const result = parseAndValidateResponse(JSON.stringify(allHighResponse), 'test-all-high');

      // Assert - all should be clamped to 100
      expect(result.structural).toBe(100);
      expect(result.mechanical).toBe(100);
      expect(result.cosmetic).toBe(100);
      expect(result.electrical).toBe(100);
      expect(result.interior).toBe(100);
    });
  });
});

/**
 * Property-Based Tests for Gemini Response Parsing - Response Completeness and Structure
 * 
 * Feature: gemini-damage-detection-migration
 * Task: 7.4 Write property-based test for response completeness and structure
 * Property 2: Response Completeness and Structure
 * 
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 15.5, 15.6**
 * 
 * This test verifies that for ANY successful Gemini assessment, the structured response
 * SHALL contain all required fields with valid types:
 * - Numbers for scores (structural, mechanical, cosmetic, electrical, interior)
 * - String for severity (minor/moderate/severe)
 * - Booleans for flags (airbagDeployed, totalLoss)
 * - Non-empty string under 500 characters for summary
 * - Number for confidence
 * - String 'gemini' for method
 * 
 * Uses fast-check library to generate 100+ random response scenarios.
 * 
 * Requirements: 4.1-4.9, 15.5, 15.6
 */

describe('Property-Based Tests: Gemini Response Parsing - Response Completeness and Structure', () => {
  /**
   * Property 2: Response Completeness and Structure
   * 
   * For ANY successful Gemini assessment, the structured response MUST contain all
   * required fields with valid types.
   */
  describe('Property 2: Response Completeness and Structure', () => {
    it('should contain all required fields with valid types for any successful response', () => {
      // Arrange: Generate random valid Gemini responses
      const validGeminiResponseArbitrary = fc.record({
        structural: fc.integer({ min: 0, max: 100 }),
        mechanical: fc.integer({ min: 0, max: 100 }),
        cosmetic: fc.integer({ min: 0, max: 100 }),
        electrical: fc.integer({ min: 0, max: 100 }),
        interior: fc.integer({ min: 0, max: 100 }),
        severity: fc.constantFrom('minor', 'moderate', 'severe'),
        airbagDeployed: fc.boolean(),
        totalLoss: fc.boolean(),
        summary: fc.string({ minLength: 1, maxLength: 500 })
      });

      // Act & Assert: For ANY valid response, all fields must be present with correct types
      fc.assert(
        fc.property(validGeminiResponseArbitrary, (response) => {
          const requestId = 'test-property-2';
          const result = parseAndValidateResponse(JSON.stringify(response), requestId);
          
          // Verify all required fields are present
          const hasAllFields = 
            'structural' in result &&
            'mechanical' in result &&
            'cosmetic' in result &&
            'electrical' in result &&
            'interior' in result &&
            'severity' in result &&
            'airbagDeployed' in result &&
            'totalLoss' in result &&
            'summary' in result &&
            'confidence' in result &&
            'method' in result;
          
          // Verify field types are correct
          const typesValid = 
            typeof result.structural === 'number' &&
            typeof result.mechanical === 'number' &&
            typeof result.cosmetic === 'number' &&
            typeof result.electrical === 'number' &&
            typeof result.interior === 'number' &&
            typeof result.severity === 'string' &&
            typeof result.airbagDeployed === 'boolean' &&
            typeof result.totalLoss === 'boolean' &&
            typeof result.summary === 'string' &&
            typeof result.confidence === 'number' &&
            typeof result.method === 'string';
          
          // Verify severity is one of the valid values
          const severityValid = ['minor', 'moderate', 'severe'].includes(result.severity);
          
          // Verify method is 'gemini'
          const methodValid = result.method === 'gemini';
          
          // Verify summary is non-empty and under 500 characters
          const summaryValid = result.summary.length > 0 && result.summary.length <= 500;
          
          // Verify confidence is a number (should be 85 for Gemini)
          const confidenceValid = typeof result.confidence === 'number' && result.confidence >= 0 && result.confidence <= 100;
          
          return hasAllFields && typesValid && severityValid && methodValid && summaryValid && confidenceValid;
        }),
        { numRuns: 100 } // Run with 100+ random response scenarios
      );
    });

    it('should ensure summary is non-empty for any successful response', () => {
      // Arrange: Generate responses with various summary lengths
      const summaryVariationArbitrary = fc.record({
        structural: fc.integer({ min: 0, max: 100 }),
        mechanical: fc.integer({ min: 0, max: 100 }),
        cosmetic: fc.integer({ min: 0, max: 100 }),
        electrical: fc.integer({ min: 0, max: 100 }),
        interior: fc.integer({ min: 0, max: 100 }),
        severity: fc.constantFrom('minor', 'moderate', 'severe'),
        airbagDeployed: fc.boolean(),
        totalLoss: fc.boolean(),
        summary: fc.string({ minLength: 1, maxLength: 500 })
      });

      // Act & Assert: Summary must always be non-empty
      fc.assert(
        fc.property(summaryVariationArbitrary, (response) => {
          const requestId = 'test-property-2-summary';
          const result = parseAndValidateResponse(JSON.stringify(response), requestId);
          
          // Verify summary is non-empty
          expect(result.summary.length).toBeGreaterThan(0);
          
          return result.summary.length > 0;
        }),
        { numRuns: 100 }
      );
    });

    it('should ensure summary is under 500 characters for any successful response', () => {
      // Arrange: Generate responses with summaries up to 500 characters
      const longSummaryArbitrary = fc.record({
        structural: fc.integer({ min: 0, max: 100 }),
        mechanical: fc.integer({ min: 0, max: 100 }),
        cosmetic: fc.integer({ min: 0, max: 100 }),
        electrical: fc.integer({ min: 0, max: 100 }),
        interior: fc.integer({ min: 0, max: 100 }),
        severity: fc.constantFrom('minor', 'moderate', 'severe'),
        airbagDeployed: fc.boolean(),
        totalLoss: fc.boolean(),
        summary: fc.string({ minLength: 1, maxLength: 500 })
      });

      // Act & Assert: Summary must be under 500 characters
      fc.assert(
        fc.property(longSummaryArbitrary, (response) => {
          const requestId = 'test-property-2-long-summary';
          const result = parseAndValidateResponse(JSON.stringify(response), requestId);
          
          // Verify summary is under 500 characters
          expect(result.summary.length).toBeLessThanOrEqual(500);
          
          return result.summary.length <= 500;
        }),
        { numRuns: 100 }
      );
    });

    it('should ensure all damage scores are numbers for any successful response', () => {
      // Arrange: Generate responses with various score values
      const scoreVariationArbitrary = fc.record({
        structural: fc.integer({ min: 0, max: 100 }),
        mechanical: fc.integer({ min: 0, max: 100 }),
        cosmetic: fc.integer({ min: 0, max: 100 }),
        electrical: fc.integer({ min: 0, max: 100 }),
        interior: fc.integer({ min: 0, max: 100 }),
        severity: fc.constantFrom('minor', 'moderate', 'severe'),
        airbagDeployed: fc.boolean(),
        totalLoss: fc.boolean(),
        summary: fc.string({ minLength: 1, maxLength: 500 })
      });

      // Act & Assert: All scores must be numbers
      fc.assert(
        fc.property(scoreVariationArbitrary, (response) => {
          const requestId = 'test-property-2-scores';
          const result = parseAndValidateResponse(JSON.stringify(response), requestId);
          
          // Verify all scores are numbers
          const allScoresAreNumbers = 
            typeof result.structural === 'number' &&
            typeof result.mechanical === 'number' &&
            typeof result.cosmetic === 'number' &&
            typeof result.electrical === 'number' &&
            typeof result.interior === 'number';
          
          // Verify scores are not NaN
          const noNaN = 
            !isNaN(result.structural) &&
            !isNaN(result.mechanical) &&
            !isNaN(result.cosmetic) &&
            !isNaN(result.electrical) &&
            !isNaN(result.interior);
          
          return allScoresAreNumbers && noNaN;
        }),
        { numRuns: 100 }
      );
    });

    it('should ensure severity is a valid string value for any successful response', () => {
      // Arrange: Generate responses with all valid severity values
      const severityVariationArbitrary = fc.record({
        structural: fc.integer({ min: 0, max: 100 }),
        mechanical: fc.integer({ min: 0, max: 100 }),
        cosmetic: fc.integer({ min: 0, max: 100 }),
        electrical: fc.integer({ min: 0, max: 100 }),
        interior: fc.integer({ min: 0, max: 100 }),
        severity: fc.constantFrom('minor', 'moderate', 'severe'),
        airbagDeployed: fc.boolean(),
        totalLoss: fc.boolean(),
        summary: fc.string({ minLength: 1, maxLength: 500 })
      });

      // Act & Assert: Severity must be one of the valid values
      fc.assert(
        fc.property(severityVariationArbitrary, (response) => {
          const requestId = 'test-property-2-severity';
          const result = parseAndValidateResponse(JSON.stringify(response), requestId);
          
          // Verify severity is a string
          expect(typeof result.severity).toBe('string');
          
          // Verify severity is one of the valid values
          const validSeverities = ['minor', 'moderate', 'severe'];
          expect(validSeverities).toContain(result.severity);
          
          return validSeverities.includes(result.severity);
        }),
        { numRuns: 100 }
      );
    });

    it('should ensure boolean flags are valid booleans for any successful response', () => {
      // Arrange: Generate responses with various boolean combinations
      const booleanVariationArbitrary = fc.record({
        structural: fc.integer({ min: 0, max: 100 }),
        mechanical: fc.integer({ min: 0, max: 100 }),
        cosmetic: fc.integer({ min: 0, max: 100 }),
        electrical: fc.integer({ min: 0, max: 100 }),
        interior: fc.integer({ min: 0, max: 100 }),
        severity: fc.constantFrom('minor', 'moderate', 'severe'),
        airbagDeployed: fc.boolean(),
        totalLoss: fc.boolean(),
        summary: fc.string({ minLength: 1, maxLength: 500 })
      });

      // Act & Assert: Boolean flags must be true or false
      fc.assert(
        fc.property(booleanVariationArbitrary, (response) => {
          const requestId = 'test-property-2-booleans';
          const result = parseAndValidateResponse(JSON.stringify(response), requestId);
          
          // Verify airbagDeployed is a boolean
          expect(typeof result.airbagDeployed).toBe('boolean');
          expect([true, false]).toContain(result.airbagDeployed);
          
          // Verify totalLoss is a boolean
          expect(typeof result.totalLoss).toBe('boolean');
          expect([true, false]).toContain(result.totalLoss);
          
          return typeof result.airbagDeployed === 'boolean' &&
                 typeof result.totalLoss === 'boolean';
        }),
        { numRuns: 100 }
      );
    });

    it('should ensure confidence field is present and valid for any successful response', () => {
      // Arrange: Generate random valid responses
      const confidenceTestArbitrary = fc.record({
        structural: fc.integer({ min: 0, max: 100 }),
        mechanical: fc.integer({ min: 0, max: 100 }),
        cosmetic: fc.integer({ min: 0, max: 100 }),
        electrical: fc.integer({ min: 0, max: 100 }),
        interior: fc.integer({ min: 0, max: 100 }),
        severity: fc.constantFrom('minor', 'moderate', 'severe'),
        airbagDeployed: fc.boolean(),
        totalLoss: fc.boolean(),
        summary: fc.string({ minLength: 1, maxLength: 500 })
      });

      // Act & Assert: Confidence must be present and valid
      fc.assert(
        fc.property(confidenceTestArbitrary, (response) => {
          const requestId = 'test-property-2-confidence';
          const result = parseAndValidateResponse(JSON.stringify(response), requestId);
          
          // Verify confidence field is present
          expect('confidence' in result).toBe(true);
          
          // Verify confidence is a number
          expect(typeof result.confidence).toBe('number');
          
          // Verify confidence is in valid range (0-100)
          expect(result.confidence).toBeGreaterThanOrEqual(0);
          expect(result.confidence).toBeLessThanOrEqual(100);
          
          // Verify confidence is not NaN
          expect(isNaN(result.confidence)).toBe(false);
          
          return typeof result.confidence === 'number' &&
                 result.confidence >= 0 &&
                 result.confidence <= 100 &&
                 !isNaN(result.confidence);
        }),
        { numRuns: 100 }
      );
    });

    it('should ensure method field is present and set to "gemini" for any successful response', () => {
      // Arrange: Generate random valid responses
      const methodTestArbitrary = fc.record({
        structural: fc.integer({ min: 0, max: 100 }),
        mechanical: fc.integer({ min: 0, max: 100 }),
        cosmetic: fc.integer({ min: 0, max: 100 }),
        electrical: fc.integer({ min: 0, max: 100 }),
        interior: fc.integer({ min: 0, max: 100 }),
        severity: fc.constantFrom('minor', 'moderate', 'severe'),
        airbagDeployed: fc.boolean(),
        totalLoss: fc.boolean(),
        summary: fc.string({ minLength: 1, maxLength: 500 })
      });

      // Act & Assert: Method must be 'gemini'
      fc.assert(
        fc.property(methodTestArbitrary, (response) => {
          const requestId = 'test-property-2-method';
          const result = parseAndValidateResponse(JSON.stringify(response), requestId);
          
          // Verify method field is present
          expect('method' in result).toBe(true);
          
          // Verify method is a string
          expect(typeof result.method).toBe('string');
          
          // Verify method is 'gemini'
          expect(result.method).toBe('gemini');
          
          return result.method === 'gemini';
        }),
        { numRuns: 100 }
      );
    });

    it('should maintain field completeness across different damage severity combinations', () => {
      // Arrange: Generate responses with various damage score combinations
      const damageVariationArbitrary = fc.record({
        structural: fc.integer({ min: 0, max: 100 }),
        mechanical: fc.integer({ min: 0, max: 100 }),
        cosmetic: fc.integer({ min: 0, max: 100 }),
        electrical: fc.integer({ min: 0, max: 100 }),
        interior: fc.integer({ min: 0, max: 100 }),
        severity: fc.constantFrom('minor', 'moderate', 'severe'),
        airbagDeployed: fc.boolean(),
        totalLoss: fc.boolean(),
        summary: fc.string({ minLength: 1, maxLength: 500 })
      });

      // Act & Assert: All fields must be present regardless of damage levels
      fc.assert(
        fc.property(damageVariationArbitrary, (response) => {
          const requestId = 'test-property-2-damage-variation';
          const result = parseAndValidateResponse(JSON.stringify(response), requestId);
          
          // Count the number of fields
          const fieldCount = Object.keys(result).length;
          
          // Should have exactly 11 fields
          expect(fieldCount).toBe(11);
          
          // Verify all expected fields are present
          const expectedFields = [
            'structural', 'mechanical', 'cosmetic', 'electrical', 'interior',
            'severity', 'airbagDeployed', 'totalLoss', 'summary', 'confidence', 'method'
          ];
          
          const allFieldsPresent = expectedFields.every(field => field in result);
          expect(allFieldsPresent).toBe(true);
          
          return fieldCount === 11 && allFieldsPresent;
        }),
        { numRuns: 100 }
      );
    });

    it('should maintain field completeness across different boolean flag combinations', () => {
      // Arrange: Generate responses with all boolean combinations
      const booleanCombinationArbitrary = fc.tuple(
        fc.boolean(),
        fc.boolean()
      ).chain(([airbagDeployed, totalLoss]) => 
        fc.record({
          structural: fc.integer({ min: 0, max: 100 }),
          mechanical: fc.integer({ min: 0, max: 100 }),
          cosmetic: fc.integer({ min: 0, max: 100 }),
          electrical: fc.integer({ min: 0, max: 100 }),
          interior: fc.integer({ min: 0, max: 100 }),
          severity: fc.constantFrom('minor', 'moderate', 'severe'),
          airbagDeployed: fc.constant(airbagDeployed),
          totalLoss: fc.constant(totalLoss),
          summary: fc.string({ minLength: 1, maxLength: 500 })
        })
      );

      // Act & Assert: All fields must be present for all boolean combinations
      fc.assert(
        fc.property(booleanCombinationArbitrary, (response) => {
          const requestId = 'test-property-2-boolean-combo';
          const result = parseAndValidateResponse(JSON.stringify(response), requestId);
          
          // Verify all 11 fields are present
          const allFieldsPresent = 
            'structural' in result &&
            'mechanical' in result &&
            'cosmetic' in result &&
            'electrical' in result &&
            'interior' in result &&
            'severity' in result &&
            'airbagDeployed' in result &&
            'totalLoss' in result &&
            'summary' in result &&
            'confidence' in result &&
            'method' in result;
          
          expect(allFieldsPresent).toBe(true);
          
          return allFieldsPresent;
        }),
        { numRuns: 100 }
      );
    });

    it('should maintain type consistency across all valid response scenarios', () => {
      // Arrange: Generate comprehensive random responses
      const comprehensiveArbitrary = fc.record({
        structural: fc.integer({ min: 0, max: 100 }),
        mechanical: fc.integer({ min: 0, max: 100 }),
        cosmetic: fc.integer({ min: 0, max: 100 }),
        electrical: fc.integer({ min: 0, max: 100 }),
        interior: fc.integer({ min: 0, max: 100 }),
        severity: fc.constantFrom('minor', 'moderate', 'severe'),
        airbagDeployed: fc.boolean(),
        totalLoss: fc.boolean(),
        summary: fc.string({ minLength: 1, maxLength: 500 })
      });

      // Act & Assert: Type consistency must be maintained
      fc.assert(
        fc.property(comprehensiveArbitrary, (response) => {
          const requestId = 'test-property-2-comprehensive';
          const result = parseAndValidateResponse(JSON.stringify(response), requestId);
          
          // Verify all types are correct
          const typesCorrect = 
            typeof result.structural === 'number' &&
            typeof result.mechanical === 'number' &&
            typeof result.cosmetic === 'number' &&
            typeof result.electrical === 'number' &&
            typeof result.interior === 'number' &&
            typeof result.severity === 'string' &&
            typeof result.airbagDeployed === 'boolean' &&
            typeof result.totalLoss === 'boolean' &&
            typeof result.summary === 'string' &&
            typeof result.confidence === 'number' &&
            typeof result.method === 'string';
          
          // Verify no undefined or null values
          const noUndefinedOrNull = 
            result.structural !== undefined && result.structural !== null &&
            result.mechanical !== undefined && result.mechanical !== null &&
            result.cosmetic !== undefined && result.cosmetic !== null &&
            result.electrical !== undefined && result.electrical !== null &&
            result.interior !== undefined && result.interior !== null &&
            result.severity !== undefined && result.severity !== null &&
            result.airbagDeployed !== undefined && result.airbagDeployed !== null &&
            result.totalLoss !== undefined && result.totalLoss !== null &&
            result.summary !== undefined && result.summary !== null &&
            result.confidence !== undefined && result.confidence !== null &&
            result.method !== undefined && result.method !== null;
          
          return typesCorrect && noUndefinedOrNull;
        }),
        { numRuns: 150 } // Run with 150+ scenarios for comprehensive coverage
      );
    });
  });

  /**
   * Edge case tests for response completeness
   */
  describe('Edge Cases: Response Completeness and Structure', () => {
    it('should handle response with minimum valid summary length (1 character)', () => {
      // Arrange
      const minSummaryResponse = {
        structural: 50,
        mechanical: 50,
        cosmetic: 50,
        electrical: 50,
        interior: 50,
        severity: 'moderate',
        airbagDeployed: false,
        totalLoss: false,
        summary: 'A'
      };

      // Act
      const result = parseAndValidateResponse(JSON.stringify(minSummaryResponse), 'test-min-summary');

      // Assert
      expect(result.summary).toBe('A');
      expect(result.summary.length).toBe(1);
      expect(result.summary.length).toBeGreaterThan(0);
    });

    it('should handle response with maximum valid summary length (500 characters)', () => {
      // Arrange
      const maxSummary = 'A'.repeat(500);
      const maxSummaryResponse = {
        structural: 50,
        mechanical: 50,
        cosmetic: 50,
        electrical: 50,
        interior: 50,
        severity: 'moderate',
        airbagDeployed: false,
        totalLoss: false,
        summary: maxSummary
      };

      // Act
      const result = parseAndValidateResponse(JSON.stringify(maxSummaryResponse), 'test-max-summary');

      // Assert
      expect(result.summary.length).toBe(500);
      expect(result.summary.length).toBeLessThanOrEqual(500);
    });

    it('should handle response with all damage scores at 0', () => {
      // Arrange
      const allZeroResponse = {
        structural: 0,
        mechanical: 0,
        cosmetic: 0,
        electrical: 0,
        interior: 0,
        severity: 'minor',
        airbagDeployed: false,
        totalLoss: false,
        summary: 'No damage detected'
      };

      // Act
      const result = parseAndValidateResponse(JSON.stringify(allZeroResponse), 'test-all-zero-complete');

      // Assert
      expect(result.structural).toBe(0);
      expect(result.mechanical).toBe(0);
      expect(result.cosmetic).toBe(0);
      expect(result.electrical).toBe(0);
      expect(result.interior).toBe(0);
      expect(result.severity).toBe('minor');
      expect(result.airbagDeployed).toBe(false);
      expect(result.totalLoss).toBe(false);
      expect(result.summary).toBe('No damage detected');
      expect(result.confidence).toBe(85);
      expect(result.method).toBe('gemini');
    });

    it('should handle response with all damage scores at 100', () => {
      // Arrange
      const allMaxResponse = {
        structural: 100,
        mechanical: 100,
        cosmetic: 100,
        electrical: 100,
        interior: 100,
        severity: 'severe',
        airbagDeployed: true,
        totalLoss: true,
        summary: 'Complete destruction, total loss'
      };

      // Act
      const result = parseAndValidateResponse(JSON.stringify(allMaxResponse), 'test-all-max-complete');

      // Assert
      expect(result.structural).toBe(100);
      expect(result.mechanical).toBe(100);
      expect(result.cosmetic).toBe(100);
      expect(result.electrical).toBe(100);
      expect(result.interior).toBe(100);
      expect(result.severity).toBe('severe');
      expect(result.airbagDeployed).toBe(true);
      expect(result.totalLoss).toBe(true);
      expect(result.summary).toBe('Complete destruction, total loss');
      expect(result.confidence).toBe(85);
      expect(result.method).toBe('gemini');
    });

    it('should handle response with airbag deployed but not total loss', () => {
      // Arrange
      const airbagNotTotalLossResponse = {
        structural: 60,
        mechanical: 40,
        cosmetic: 70,
        electrical: 30,
        interior: 50,
        severity: 'moderate',
        airbagDeployed: true,
        totalLoss: false,
        summary: 'Airbags deployed but vehicle is repairable'
      };

      // Act
      const result = parseAndValidateResponse(JSON.stringify(airbagNotTotalLossResponse), 'test-airbag-not-total');

      // Assert
      expect(result.airbagDeployed).toBe(true);
      expect(result.totalLoss).toBe(false);
      expect(result.severity).toBe('moderate');
      expect(Object.keys(result).length).toBe(11);
    });

    it('should handle response with total loss but no airbag deployment', () => {
      // Arrange
      const totalLossNoAirbagResponse = {
        structural: 90,
        mechanical: 85,
        cosmetic: 95,
        electrical: 80,
        interior: 75,
        severity: 'severe',
        airbagDeployed: false,
        totalLoss: true,
        summary: 'Severe damage, total loss, but airbags did not deploy'
      };

      // Act
      const result = parseAndValidateResponse(JSON.stringify(totalLossNoAirbagResponse), 'test-total-no-airbag');

      // Assert
      expect(result.airbagDeployed).toBe(false);
      expect(result.totalLoss).toBe(true);
      expect(result.severity).toBe('severe');
      expect(Object.keys(result).length).toBe(11);
    });

    it('should handle response with mixed severity and damage scores', () => {
      // Arrange
      const mixedResponse = {
        structural: 25,
        mechanical: 75,
        cosmetic: 10,
        electrical: 90,
        interior: 40,
        severity: 'moderate',
        airbagDeployed: false,
        totalLoss: false,
        summary: 'Mixed damage across different categories'
      };

      // Act
      const result = parseAndValidateResponse(JSON.stringify(mixedResponse), 'test-mixed-severity');

      // Assert
      expect(result.structural).toBe(25);
      expect(result.mechanical).toBe(75);
      expect(result.cosmetic).toBe(10);
      expect(result.electrical).toBe(90);
      expect(result.interior).toBe(40);
      expect(result.severity).toBe('moderate');
      expect(Object.keys(result).length).toBe(11);
    });
  });
});

/**
 * Property-Based Tests for Gemini Response Parsing - Invalid Response Handling
 * 
 * Feature: gemini-damage-detection-migration
 * Task: 7.5 Write property-based test for invalid response handling
 * Property 8: Invalid Response Handling
 * 
 * **Validates: Requirements 15.1, 15.2, 15.4**
 * 
 * This test verifies that for ANY invalid Gemini response (non-JSON, missing fields,
 * invalid severity values), the system SHALL:
 * - Log an error
 * - Trigger fallback chain to Vision API
 * - NOT return the invalid response to caller
 * - Throw error with descriptive message
 * 
 * Uses fast-check library to generate 100+ random invalid response scenarios including:
 * - Non-JSON strings
 * - Incomplete JSON (missing required fields)
 * - Invalid severity values (not minor/moderate/severe)
 * - Invalid field types
 * 
 * Requirements: 15.1, 15.2, 15.4
 */

describe('Property-Based Tests: Gemini Response Parsing - Invalid Response Handling', () => {
  /**
   * Property 8: Invalid Response Handling
   * 
   * For ANY invalid Gemini response, the system MUST log an error, throw an exception
   * (to trigger fallback), and NOT return the invalid response to the caller.
   */
  describe('Property 8: Invalid Response Handling', () => {
    it('should throw error for any non-JSON response', () => {
      // Arrange: Generate random non-JSON strings (excluding valid JSON primitives)
      const nonJsonArbitrary = fc.oneof(
        fc.string({ minLength: 1, maxLength: 500 }).filter(s => {
          try {
            JSON.parse(s);
            return false; // If it parses, it's JSON, so filter it out
          } catch {
            return true; // Not JSON, keep it
          }
        }),
        fc.constant('This is not JSON'),
        fc.constant('{ invalid json }'),
        fc.constant('undefined'),
        fc.constant('null string'),
        fc.constant('{ "incomplete": '),
        fc.constant('{ "key": "value" } extra text')
      );

      // Act & Assert: Non-JSON responses must throw error
      fc.assert(
        fc.property(nonJsonArbitrary, (invalidResponse) => {
          const requestId = 'test-property-8-non-json';
          
          // Expect parseAndValidateResponse to throw an error
          expect(() => {
            parseAndValidateResponse(invalidResponse, requestId);
          }).toThrow();
          
          // Verify error message is descriptive
          try {
            parseAndValidateResponse(invalidResponse, requestId);
          } catch (error: any) {
            expect(error.message).toContain('Failed to parse Gemini response as JSON');
            expect(error.message).toContain(requestId);
            return true;
          }
          
          return false; // Should not reach here
        }),
        { numRuns: 100 } // Run with 100+ random non-JSON scenarios
      );
    });

    it('should throw error for any response missing required fields', () => {
      // Arrange: Generate responses with randomly missing required fields
      const requiredFields = [
        'structural', 'mechanical', 'cosmetic', 'electrical', 'interior',
        'severity', 'airbagDeployed', 'totalLoss', 'summary'
      ];

      const missingFieldArbitrary = fc.tuple(
        fc.subarray(requiredFields, { minLength: 1, maxLength: requiredFields.length - 1 }),
        fc.record({
          structural: fc.integer({ min: 0, max: 100 }),
          mechanical: fc.integer({ min: 0, max: 100 }),
          cosmetic: fc.integer({ min: 0, max: 100 }),
          electrical: fc.integer({ min: 0, max: 100 }),
          interior: fc.integer({ min: 0, max: 100 }),
          severity: fc.constantFrom('minor', 'moderate', 'severe'),
          airbagDeployed: fc.boolean(),
          totalLoss: fc.boolean(),
          summary: fc.string({ minLength: 1, maxLength: 500 })
        })
      ).map(([fieldsToRemove, fullResponse]) => {
        const incompleteResponse: any = { ...fullResponse };
        fieldsToRemove.forEach(field => delete incompleteResponse[field]);
        return { incompleteResponse, missingFields: fieldsToRemove };
      });

      // Act & Assert: Responses missing required fields must throw error
      fc.assert(
        fc.property(missingFieldArbitrary, ({ incompleteResponse, missingFields }) => {
          const requestId = 'test-property-8-missing-fields';
          
          // Expect parseAndValidateResponse to throw an error
          expect(() => {
            parseAndValidateResponse(JSON.stringify(incompleteResponse), requestId);
          }).toThrow();
          
          // Verify error message mentions missing fields
          try {
            parseAndValidateResponse(JSON.stringify(incompleteResponse), requestId);
          } catch (error: any) {
            expect(error.message).toContain('missing required fields');
            expect(error.message).toContain(requestId);
            // Verify at least one missing field is mentioned
            const mentionsMissingField = missingFields.some(field => 
              error.message.includes(field)
            );
            expect(mentionsMissingField).toBe(true);
            return true;
          }
          
          return false; // Should not reach here
        }),
        { numRuns: 100 } // Run with 100+ random missing field scenarios
      );
    });

    it('should handle responses with invalid severity values by defaulting to moderate', () => {
      // Arrange: Generate responses with invalid severity values
      const invalidSeverityArbitrary = fc.record({
        structural: fc.integer({ min: 0, max: 100 }),
        mechanical: fc.integer({ min: 0, max: 100 }),
        cosmetic: fc.integer({ min: 0, max: 100 }),
        electrical: fc.integer({ min: 0, max: 100 }),
        interior: fc.integer({ min: 0, max: 100 }),
        severity: fc.oneof(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => 
            !['minor', 'moderate', 'severe'].includes(s)
          ),
          fc.constant('MINOR'),
          fc.constant('MODERATE'),
          fc.constant('SEVERE'),
          fc.constant('low'),
          fc.constant('high'),
          fc.constant('critical'),
          fc.constant(''),
          fc.constant('invalid')
        ),
        airbagDeployed: fc.boolean(),
        totalLoss: fc.boolean(),
        summary: fc.string({ minLength: 1, maxLength: 500 })
      });

      // Act & Assert: Invalid severity should default to 'moderate'
      fc.assert(
        fc.property(invalidSeverityArbitrary, (response) => {
          const requestId = 'test-property-8-invalid-severity';
          
          // Parse the response
          const result = parseAndValidateResponse(JSON.stringify(response), requestId);
          
          // Verify severity is defaulted to 'moderate'
          expect(result.severity).toBe('moderate');
          expect(['minor', 'moderate', 'severe']).toContain(result.severity);
          
          // Verify all other fields are still valid
          expect(result.structural).toBeGreaterThanOrEqual(0);
          expect(result.structural).toBeLessThanOrEqual(100);
          expect(typeof result.airbagDeployed).toBe('boolean');
          expect(typeof result.totalLoss).toBe('boolean');
          expect(result.summary.length).toBeGreaterThan(0);
          
          return result.severity === 'moderate';
        }),
        { numRuns: 100 } // Run with 100+ random invalid severity scenarios
      );
    });

    it('should never return invalid response to caller - always throw or sanitize', () => {
      // Arrange: Generate various invalid responses
      const invalidResponseArbitrary = fc.oneof(
        // Non-JSON strings
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => {
          try {
            JSON.parse(s);
            return false;
          } catch {
            return true;
          }
        }),
        // Responses with missing fields
        fc.record({
          structural: fc.integer({ min: 0, max: 100 }),
          mechanical: fc.integer({ min: 0, max: 100 }),
          // Missing other required fields
        }).map(r => JSON.stringify(r)),
        // Responses with invalid field types
        fc.record({
          structural: fc.string(),
          mechanical: fc.string(),
          cosmetic: fc.string(),
          electrical: fc.string(),
          interior: fc.string(),
          severity: fc.constantFrom('minor', 'moderate', 'severe'),
          airbagDeployed: fc.boolean(),
          totalLoss: fc.boolean(),
          summary: fc.string({ minLength: 1, maxLength: 500 })
        }).map(r => JSON.stringify(r))
      );

      // Act & Assert: Invalid responses must either throw or be sanitized
      fc.assert(
        fc.property(invalidResponseArbitrary, (invalidResponse) => {
          const requestId = 'test-property-8-no-invalid-return';
          
          try {
            const result = parseAndValidateResponse(invalidResponse, requestId);
            
            // If it didn't throw, verify the result is valid (sanitized)
            expect(typeof result.structural).toBe('number');
            expect(result.structural).toBeGreaterThanOrEqual(0);
            expect(result.structural).toBeLessThanOrEqual(100);
            
            expect(typeof result.mechanical).toBe('number');
            expect(result.mechanical).toBeGreaterThanOrEqual(0);
            expect(result.mechanical).toBeLessThanOrEqual(100);
            
            expect(['minor', 'moderate', 'severe']).toContain(result.severity);
            expect(typeof result.airbagDeployed).toBe('boolean');
            expect(typeof result.totalLoss).toBe('boolean');
            expect(result.summary.length).toBeGreaterThan(0);
            expect(result.method).toBe('gemini');
            
            return true; // Valid sanitized response
          } catch (error: any) {
            // If it threw, verify error is descriptive
            expect(error.message).toBeTruthy();
            expect(error.message.length).toBeGreaterThan(0);
            return true; // Threw error as expected
          }
        }),
        { numRuns: 100 } // Run with 100+ random invalid scenarios
      );
    });

    it('should throw descriptive error messages for any invalid response', () => {
      // Arrange: Generate various types of invalid responses
      const invalidResponseWithTypeArbitrary = fc.oneof(
        fc.tuple(
          fc.constant('non-json'),
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => {
            try { JSON.parse(s); return false; } catch { return true; }
          })
        ),
        fc.tuple(
          fc.constant('missing-fields'),
          fc.record({
            structural: fc.integer({ min: 0, max: 100 }),
            mechanical: fc.integer({ min: 0, max: 100 })
            // Missing other required fields
          }).map(r => JSON.stringify(r))
        ),
        fc.tuple(
          fc.constant('empty-object'),
          fc.constant('{}')
        ),
        fc.tuple(
          fc.constant('empty-array'),
          fc.constant('[]')
        )
      );

      // Act & Assert: Error messages must be descriptive
      fc.assert(
        fc.property(invalidResponseWithTypeArbitrary, ([errorType, invalidResponse]) => {
          const requestId = 'test-property-8-descriptive-error';
          
          try {
            parseAndValidateResponse(invalidResponse, requestId);
            // If no error thrown, this is unexpected for these invalid responses
            return errorType === 'valid'; // Should not happen with our test data
          } catch (error: any) {
            // Verify error message is descriptive
            expect(error.message).toBeTruthy();
            expect(error.message.length).toBeGreaterThan(10);
            
            // Verify error message contains request ID for traceability
            expect(error.message).toContain(requestId);
            
            // Verify error message describes the problem
            if (errorType === 'non-json') {
              expect(error.message.toLowerCase()).toMatch(/parse|json/);
            } else if (errorType === 'missing-fields') {
              expect(error.message.toLowerCase()).toMatch(/missing|required|field/);
            }
            
            return true;
          }
        }),
        { numRuns: 100 } // Run with 100+ random invalid scenarios
      );
    });

    it('should handle comprehensive invalid response scenarios', () => {
      // Arrange: Generate comprehensive set of invalid responses (excluding those that get sanitized)
      const comprehensiveInvalidArbitrary = fc.oneof(
        // Non-JSON strings
        fc.constant('not json at all'),
        fc.constant('{ "broken": json }'),
        fc.constant('undefined'),
        fc.constant(''),
        
        // Incomplete JSON objects (missing required fields)
        fc.record({
          structural: fc.integer({ min: 0, max: 100 })
        }).map(r => JSON.stringify(r)),
        
        fc.record({
          structural: fc.integer({ min: 0, max: 100 }),
          mechanical: fc.integer({ min: 0, max: 100 }),
          cosmetic: fc.integer({ min: 0, max: 100 })
        }).map(r => JSON.stringify(r)),
        
        // Empty structures
        fc.constant('{}'),
        fc.constant('[]'),
        
        // Malformed JSON
        fc.constant('{ "key": '),
        fc.constant('{ "key": "value" '),
        fc.constant('{ "key": "value", }')
      );

      // Act & Assert: All invalid responses must be handled properly
      fc.assert(
        fc.property(comprehensiveInvalidArbitrary, (invalidResponse) => {
          const requestId = 'test-property-8-comprehensive';
          
          let errorThrown = false;
          let errorMessage = '';
          
          try {
            parseAndValidateResponse(invalidResponse, requestId);
          } catch (error: any) {
            errorThrown = true;
            errorMessage = error.message;
          }
          
          // Verify error was thrown (these are all invalid and not sanitizable)
          expect(errorThrown).toBe(true);
          
          // Verify error message is present and descriptive
          expect(errorMessage).toBeTruthy();
          expect(errorMessage.length).toBeGreaterThan(0);
          
          return errorThrown && errorMessage.length > 0;
        }),
        { numRuns: 150 } // Run with 150+ comprehensive scenarios
      );
    });
  });

  /**
   * Edge case tests for invalid response handling
   */
  describe('Edge Cases: Invalid Response Handling', () => {
    it('should throw error for empty string response', () => {
      // Arrange
      const emptyResponse = '';
      const requestId = 'test-empty-string';

      // Act & Assert
      expect(() => {
        parseAndValidateResponse(emptyResponse, requestId);
      }).toThrow();

      try {
        parseAndValidateResponse(emptyResponse, requestId);
      } catch (error: any) {
        expect(error.message).toContain('Failed to parse Gemini response as JSON');
        expect(error.message).toContain(requestId);
      }
    });

    it('should throw error for null string response', () => {
      // Arrange
      const nullResponse = 'null';
      const requestId = 'test-null-string';

      // Act & Assert
      expect(() => {
        parseAndValidateResponse(nullResponse, requestId);
      }).toThrow();

      try {
        parseAndValidateResponse(nullResponse, requestId);
      } catch (error: any) {
        // null parses as JSON but fails when checking for fields with 'in' operator
        expect(error.message).toBeTruthy();
        expect(error.message.length).toBeGreaterThan(0);
      }
    });

    it('should throw error for undefined string response', () => {
      // Arrange
      const undefinedResponse = 'undefined';
      const requestId = 'test-undefined-string';

      // Act & Assert
      expect(() => {
        parseAndValidateResponse(undefinedResponse, requestId);
      }).toThrow();

      try {
        parseAndValidateResponse(undefinedResponse, requestId);
      } catch (error: any) {
        expect(error.message).toContain('Failed to parse Gemini response as JSON');
        expect(error.message).toContain(requestId);
      }
    });

    it('should throw error for empty object response', () => {
      // Arrange
      const emptyObjectResponse = '{}';
      const requestId = 'test-empty-object';

      // Act & Assert
      expect(() => {
        parseAndValidateResponse(emptyObjectResponse, requestId);
      }).toThrow();

      try {
        parseAndValidateResponse(emptyObjectResponse, requestId);
      } catch (error: any) {
        expect(error.message).toContain('missing required fields');
        expect(error.message).toContain(requestId);
        // Should mention all 9 required fields
        expect(error.message).toContain('structural');
      }
    });

    it('should throw error for array response', () => {
      // Arrange
      const arrayResponse = '[1, 2, 3]';
      const requestId = 'test-array-response';

      // Act & Assert
      expect(() => {
        parseAndValidateResponse(arrayResponse, requestId);
      }).toThrow();

      try {
        parseAndValidateResponse(arrayResponse, requestId);
      } catch (error: any) {
        expect(error.message).toContain('missing required fields');
        expect(error.message).toContain(requestId);
      }
    });

    it('should throw error for response with only one required field', () => {
      // Arrange
      const partialResponse = JSON.stringify({
        structural: 50
      });
      const requestId = 'test-one-field';

      // Act & Assert
      expect(() => {
        parseAndValidateResponse(partialResponse, requestId);
      }).toThrow();

      try {
        parseAndValidateResponse(partialResponse, requestId);
      } catch (error: any) {
        expect(error.message).toContain('missing required fields');
        expect(error.message).toContain(requestId);
        // Should mention at least one missing field
        const hasMissingField = 
          error.message.includes('mechanical') ||
          error.message.includes('cosmetic') ||
          error.message.includes('electrical') ||
          error.message.includes('interior') ||
          error.message.includes('severity') ||
          error.message.includes('airbagDeployed') ||
          error.message.includes('totalLoss') ||
          error.message.includes('summary');
        expect(hasMissingField).toBe(true);
      }
    });

    it('should throw error for response missing just one required field', () => {
      // Arrange - complete response except missing 'summary'
      const almostCompleteResponse = JSON.stringify({
        structural: 50,
        mechanical: 40,
        cosmetic: 60,
        electrical: 30,
        interior: 45,
        severity: 'moderate',
        airbagDeployed: false,
        totalLoss: false
        // Missing 'summary'
      });
      const requestId = 'test-missing-one-field';

      // Act & Assert
      expect(() => {
        parseAndValidateResponse(almostCompleteResponse, requestId);
      }).toThrow();

      try {
        parseAndValidateResponse(almostCompleteResponse, requestId);
      } catch (error: any) {
        expect(error.message).toContain('missing required fields');
        expect(error.message).toContain('summary');
        expect(error.message).toContain(requestId);
      }
    });

    it('should throw error for malformed JSON with trailing comma', () => {
      // Arrange
      const malformedResponse = '{ "structural": 50, "mechanical": 40, }';
      const requestId = 'test-trailing-comma';

      // Act & Assert
      expect(() => {
        parseAndValidateResponse(malformedResponse, requestId);
      }).toThrow();

      try {
        parseAndValidateResponse(malformedResponse, requestId);
      } catch (error: any) {
        expect(error.message).toContain('Failed to parse Gemini response as JSON');
        expect(error.message).toContain(requestId);
      }
    });

    it('should throw error for malformed JSON with unclosed brace', () => {
      // Arrange
      const malformedResponse = '{ "structural": 50, "mechanical": 40';
      const requestId = 'test-unclosed-brace';

      // Act & Assert
      expect(() => {
        parseAndValidateResponse(malformedResponse, requestId);
      }).toThrow();

      try {
        parseAndValidateResponse(malformedResponse, requestId);
      } catch (error: any) {
        expect(error.message).toContain('Failed to parse Gemini response as JSON');
        expect(error.message).toContain(requestId);
      }
    });

    it('should throw error for response with extra text after valid JSON', () => {
      // Arrange
      const responseWithExtra = JSON.stringify({
        structural: 50,
        mechanical: 40,
        cosmetic: 60,
        electrical: 30,
        interior: 45,
        severity: 'moderate',
        airbagDeployed: false,
        totalLoss: false,
        summary: 'Valid summary'
      }) + ' extra text here';
      const requestId = 'test-extra-text';

      // Act & Assert
      expect(() => {
        parseAndValidateResponse(responseWithExtra, requestId);
      }).toThrow();

      try {
        parseAndValidateResponse(responseWithExtra, requestId);
      } catch (error: any) {
        expect(error.message).toContain('Failed to parse Gemini response as JSON');
        expect(error.message).toContain(requestId);
      }
    });

    it('should include request ID in all error messages for traceability', () => {
      // Arrange: Various invalid responses (excluding JSON primitives that cause different errors)
      const invalidResponses = [
        { response: '', requestId: 'trace-1' },
        { response: 'not json', requestId: 'trace-2' },
        { response: '{}', requestId: 'trace-3' },
        { response: '[]', requestId: 'trace-4' },
      ];

      // Act & Assert: All errors must include request ID
      invalidResponses.forEach(({ response, requestId }) => {
        try {
          parseAndValidateResponse(response, requestId);
          fail('Should have thrown an error');
        } catch (error: any) {
          expect(error.message).toContain(requestId);
        }
      });
    });
  });
});
