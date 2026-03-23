/**
 * Property-Based Tests for Gemini Prompt Construction Completeness
 * 
 * Feature: gemini-damage-detection-migration
 * Task: 5.3 Write property-based test for prompt construction completeness
 * Property 7: Prompt Construction Completeness
 * 
 * **Validates: Requirements 3.4, 3.5, 14.1, 14.2, 14.4**
 * 
 * This test verifies that for ANY vehicle context (random make, model, year),
 * the constructed prompt ALWAYS includes:
 * 1. Vehicle make, model, and year
 * 2. All five damage categories (structural, mechanical, cosmetic, electrical, interior)
 * 3. JSON response schema specification
 * 
 * Uses fast-check library to generate 100+ random vehicle contexts and verify
 * prompt completeness across all inputs.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { constructDamageAssessmentPrompt, VehicleContext } from '../../../src/lib/integrations/gemini-damage-detection';

describe('Property-Based Tests: Gemini Prompt Construction Completeness', () => {
  /**
   * Property 7: Prompt Construction Completeness
   * 
   * For ANY vehicle context, the prompt MUST include:
   * - Vehicle make, model, and year
   * - All five damage categories
   * - JSON response schema
   */
  describe('Property 7: Prompt Construction Completeness', () => {
    it('should always include vehicle make, model, and year in prompt for any vehicle context', () => {
      // Arrange: Generate random vehicle contexts
      const vehicleContextArbitrary = fc.record({
        make: fc.string({ minLength: 2, maxLength: 30 }),
        model: fc.string({ minLength: 1, maxLength: 50 }),
        year: fc.integer({ min: 1900, max: 2030 })
      });

      // Act & Assert: For ANY vehicle context, prompt must include make, model, year
      fc.assert(
        fc.property(vehicleContextArbitrary, (vehicleContext) => {
          const prompt = constructDamageAssessmentPrompt(vehicleContext);
          
          // Verify vehicle make is included
          const hasMake = prompt.includes(vehicleContext.make);
          
          // Verify vehicle model is included
          const hasModel = prompt.includes(vehicleContext.model);
          
          // Verify vehicle year is included
          const hasYear = prompt.includes(vehicleContext.year.toString());
          
          // All three must be present
          return hasMake && hasModel && hasYear;
        }),
        { numRuns: 100 } // Run with 100+ random vehicle contexts
      );
    });

    it('should always request all five damage categories for any vehicle context', () => {
      // Arrange: Generate random vehicle contexts
      const vehicleContextArbitrary = fc.record({
        make: fc.oneof(
          fc.constant('Toyota'),
          fc.constant('Honda'),
          fc.constant('Ford'),
          fc.constant('Chevrolet'),
          fc.constant('Tesla'),
          fc.constant('BMW'),
          fc.constant('Mercedes-Benz'),
          fc.constant('Nissan'),
          fc.constant('Hyundai'),
          fc.constant('Kia')
        ),
        model: fc.oneof(
          fc.constant('Camry'),
          fc.constant('Accord'),
          fc.constant('F-150'),
          fc.constant('Silverado'),
          fc.constant('Model 3'),
          fc.constant('3 Series'),
          fc.constant('C-Class'),
          fc.constant('Altima'),
          fc.constant('Elantra'),
          fc.constant('Optima')
        ),
        year: fc.integer({ min: 2000, max: 2024 })
      });

      // Act & Assert: For ANY vehicle context, prompt must request all 5 damage categories
      fc.assert(
        fc.property(vehicleContextArbitrary, (vehicleContext) => {
          const prompt = constructDamageAssessmentPrompt(vehicleContext);
          const lowerPrompt = prompt.toLowerCase();
          
          // Verify all five damage categories are requested
          const hasStructural = lowerPrompt.includes('structural');
          const hasMechanical = lowerPrompt.includes('mechanical');
          const hasCosmetic = lowerPrompt.includes('cosmetic');
          const hasElectrical = lowerPrompt.includes('electrical');
          const hasInterior = lowerPrompt.includes('interior');
          
          // All five categories must be present
          return hasStructural && hasMechanical && hasCosmetic && hasElectrical && hasInterior;
        }),
        { numRuns: 100 } // Run with 100+ random vehicle contexts
      );
    });

    it('should always specify JSON response schema for any vehicle context', () => {
      // Arrange: Generate random vehicle contexts with various characteristics
      const vehicleContextArbitrary = fc.record({
        make: fc.string({ minLength: 3, maxLength: 20 }),
        model: fc.string({ minLength: 2, maxLength: 30 }),
        year: fc.integer({ min: 1950, max: 2025 })
      });

      // Act & Assert: For ANY vehicle context, prompt must specify JSON schema
      fc.assert(
        fc.property(vehicleContextArbitrary, (vehicleContext) => {
          const prompt = constructDamageAssessmentPrompt(vehicleContext);
          const lowerPrompt = prompt.toLowerCase();
          
          // Verify JSON format is specified
          const hasJsonKeyword = lowerPrompt.includes('json');
          
          // Verify schema fields are specified
          const hasStructuralField = prompt.includes('"structural"');
          const hasMechanicalField = prompt.includes('"mechanical"');
          const hasCosmeticField = prompt.includes('"cosmetic"');
          const hasElectricalField = prompt.includes('"electrical"');
          const hasInteriorField = prompt.includes('"interior"');
          const hasSeverityField = prompt.includes('"severity"');
          const hasAirbagField = prompt.includes('"airbagDeployed"');
          const hasTotalLossField = prompt.includes('"totalLoss"');
          const hasSummaryField = prompt.includes('"summary"');
          
          // JSON keyword and all schema fields must be present
          return hasJsonKeyword && 
                 hasStructuralField && 
                 hasMechanicalField && 
                 hasCosmeticField && 
                 hasElectricalField && 
                 hasInteriorField && 
                 hasSeverityField && 
                 hasAirbagField && 
                 hasTotalLossField && 
                 hasSummaryField;
        }),
        { numRuns: 100 } // Run with 100+ random vehicle contexts
      );
    });

    it('should maintain prompt completeness across diverse vehicle contexts', () => {
      // Arrange: Generate diverse vehicle contexts including edge cases
      const vehicleContextArbitrary = fc.record({
        make: fc.oneof(
          // Common makes
          fc.constant('Toyota'),
          fc.constant('Honda'),
          fc.constant('Ford'),
          // Luxury makes
          fc.constant('Mercedes-Benz'),
          fc.constant('BMW'),
          fc.constant('Audi'),
          // Electric vehicles
          fc.constant('Tesla'),
          fc.constant('Rivian'),
          // Edge cases
          fc.constant('A'), // Very short make
          fc.constant('Rolls-Royce Motor Cars Limited'), // Very long make
          fc.string({ minLength: 1, maxLength: 50 }) // Random string
        ),
        model: fc.oneof(
          // Common models
          fc.constant('Camry'),
          fc.constant('Accord'),
          fc.constant('F-150'),
          // Complex model names
          fc.constant('Model S Plaid'),
          fc.constant('AMG GT 63 S'),
          // Edge cases
          fc.constant('X'), // Very short model
          fc.constant('Continental Flying Spur Speed'), // Very long model
          fc.string({ minLength: 1, maxLength: 50 }) // Random string
        ),
        year: fc.oneof(
          // Recent years
          fc.integer({ min: 2020, max: 2024 }),
          // Older vehicles
          fc.integer({ min: 1990, max: 2010 }),
          // Classic/vintage
          fc.integer({ min: 1950, max: 1989 }),
          // Edge cases
          fc.constant(1900), // Very old
          fc.constant(2030), // Future
          fc.integer({ min: 1900, max: 2030 }) // Full range
        )
      });

      // Act & Assert: Comprehensive completeness check
      fc.assert(
        fc.property(vehicleContextArbitrary, (vehicleContext) => {
          const prompt = constructDamageAssessmentPrompt(vehicleContext);
          const lowerPrompt = prompt.toLowerCase();
          
          // 1. Vehicle context must be included
          const hasVehicleContext = 
            prompt.includes(vehicleContext.make) &&
            prompt.includes(vehicleContext.model) &&
            prompt.includes(vehicleContext.year.toString());
          
          // 2. All five damage categories must be requested
          const hasAllCategories = 
            lowerPrompt.includes('structural') &&
            lowerPrompt.includes('mechanical') &&
            lowerPrompt.includes('cosmetic') &&
            lowerPrompt.includes('electrical') &&
            lowerPrompt.includes('interior');
          
          // 3. JSON schema must be specified
          const hasJsonSchema = 
            lowerPrompt.includes('json') &&
            prompt.includes('"structural"') &&
            prompt.includes('"mechanical"') &&
            prompt.includes('"cosmetic"') &&
            prompt.includes('"electrical"') &&
            prompt.includes('"interior"') &&
            prompt.includes('"severity"') &&
            prompt.includes('"airbagDeployed"') &&
            prompt.includes('"totalLoss"') &&
            prompt.includes('"summary"');
          
          // All three requirements must be met
          return hasVehicleContext && hasAllCategories && hasJsonSchema;
        }),
        { numRuns: 150 } // Run with 150+ random vehicle contexts for comprehensive coverage
      );
    });

    it('should include damage category score ranges (0-100) for any vehicle context', () => {
      // Arrange: Generate random vehicle contexts
      const vehicleContextArbitrary = fc.record({
        make: fc.string({ minLength: 2, maxLength: 30 }),
        model: fc.string({ minLength: 1, maxLength: 50 }),
        year: fc.integer({ min: 1900, max: 2030 })
      });

      // Act & Assert: Prompt should specify 0-100 range for damage scores
      fc.assert(
        fc.property(vehicleContextArbitrary, (vehicleContext) => {
          const prompt = constructDamageAssessmentPrompt(vehicleContext);
          
          // Verify 0-100 range is specified for damage scores
          const hasScoreRange = prompt.includes('0-100') || 
                                (prompt.includes('0') && prompt.includes('100'));
          
          return hasScoreRange;
        }),
        { numRuns: 100 }
      );
    });

    it('should include severity level guidance for any vehicle context', () => {
      // Arrange: Generate random vehicle contexts
      const vehicleContextArbitrary = fc.record({
        make: fc.string({ minLength: 2, maxLength: 30 }),
        model: fc.string({ minLength: 1, maxLength: 50 }),
        year: fc.integer({ min: 1900, max: 2030 })
      });

      // Act & Assert: Prompt should include severity level guidance
      fc.assert(
        fc.property(vehicleContextArbitrary, (vehicleContext) => {
          const prompt = constructDamageAssessmentPrompt(vehicleContext);
          const lowerPrompt = prompt.toLowerCase();
          
          // Verify all three severity levels are mentioned
          const hasMinor = lowerPrompt.includes('minor');
          const hasModerate = lowerPrompt.includes('moderate');
          const hasSevere = lowerPrompt.includes('severe');
          
          return hasMinor && hasModerate && hasSevere;
        }),
        { numRuns: 100 }
      );
    });

    it('should include airbag deployment guidance for any vehicle context', () => {
      // Arrange: Generate random vehicle contexts
      const vehicleContextArbitrary = fc.record({
        make: fc.string({ minLength: 2, maxLength: 30 }),
        model: fc.string({ minLength: 1, maxLength: 50 }),
        year: fc.integer({ min: 1900, max: 2030 })
      });

      // Act & Assert: Prompt should include airbag deployment guidance
      fc.assert(
        fc.property(vehicleContextArbitrary, (vehicleContext) => {
          const prompt = constructDamageAssessmentPrompt(vehicleContext);
          const lowerPrompt = prompt.toLowerCase();
          
          // Verify airbag guidance is included
          const hasAirbagGuidance = lowerPrompt.includes('airbag');
          const hasAirbagField = prompt.includes('airbagDeployed');
          
          return hasAirbagGuidance && hasAirbagField;
        }),
        { numRuns: 100 }
      );
    });

    it('should include total loss criteria for any vehicle context', () => {
      // Arrange: Generate random vehicle contexts
      const vehicleContextArbitrary = fc.record({
        make: fc.string({ minLength: 2, maxLength: 30 }),
        model: fc.string({ minLength: 1, maxLength: 50 }),
        year: fc.integer({ min: 1900, max: 2030 })
      });

      // Act & Assert: Prompt should include total loss criteria
      fc.assert(
        fc.property(vehicleContextArbitrary, (vehicleContext) => {
          const prompt = constructDamageAssessmentPrompt(vehicleContext);
          const lowerPrompt = prompt.toLowerCase();
          
          // Verify total loss criteria is included
          const hasTotalLoss = lowerPrompt.includes('total loss');
          const hasTotalLossField = prompt.includes('totalLoss');
          const hasPercentageThreshold = prompt.includes('75%');
          
          return hasTotalLoss && hasTotalLossField && hasPercentageThreshold;
        }),
        { numRuns: 100 }
      );
    });

    it('should produce non-empty prompts of reasonable length for any vehicle context', () => {
      // Arrange: Generate random vehicle contexts
      const vehicleContextArbitrary = fc.record({
        make: fc.string({ minLength: 1, maxLength: 50 }),
        model: fc.string({ minLength: 1, maxLength: 50 }),
        year: fc.integer({ min: 1900, max: 2030 })
      });

      // Act & Assert: Prompt should be non-empty and reasonably long
      fc.assert(
        fc.property(vehicleContextArbitrary, (vehicleContext) => {
          const prompt = constructDamageAssessmentPrompt(vehicleContext);
          
          // Verify prompt is non-empty
          const isNonEmpty = prompt.length > 0;
          
          // Verify prompt has reasonable length (at least 1000 characters for all guidance)
          const hasReasonableLength = prompt.length >= 1000;
          
          return isNonEmpty && hasReasonableLength;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property tests for edge cases and robustness
   */
  describe('Edge Cases and Robustness', () => {
    it('should handle vehicle contexts with special characters in make/model', () => {
      // Arrange: Generate vehicle contexts with special characters
      const vehicleContextArbitrary = fc.record({
        make: fc.oneof(
          fc.constant('Mercedes-Benz'),
          fc.constant("Land Rover"),
          fc.constant('Alfa Romeo'),
          fc.constant('Aston Martin'),
          fc.string({ minLength: 2, maxLength: 30 })
        ),
        model: fc.oneof(
          fc.constant('F-150'),
          fc.constant('Model S'),
          fc.constant('3 Series'),
          fc.constant('C-Class'),
          fc.string({ minLength: 1, maxLength: 50 })
        ),
        year: fc.integer({ min: 1900, max: 2030 })
      });

      // Act & Assert: Prompt should still be complete with special characters
      fc.assert(
        fc.property(vehicleContextArbitrary, (vehicleContext) => {
          const prompt = constructDamageAssessmentPrompt(vehicleContext);
          
          // Verify vehicle context is included (even with special characters)
          const hasVehicleContext = 
            prompt.includes(vehicleContext.make) &&
            prompt.includes(vehicleContext.model) &&
            prompt.includes(vehicleContext.year.toString());
          
          // Verify prompt is still complete
          const isComplete = prompt.length >= 1000;
          
          return hasVehicleContext && isComplete;
        }),
        { numRuns: 100 }
      );
    });

    it('should handle extreme year values (very old and future vehicles)', () => {
      // Arrange: Generate vehicle contexts with extreme years
      const vehicleContextArbitrary = fc.record({
        make: fc.constant('TestMake'),
        model: fc.constant('TestModel'),
        year: fc.oneof(
          fc.constant(1900), // Very old
          fc.constant(1950), // Classic
          fc.constant(2024), // Current
          fc.constant(2030), // Future
          fc.integer({ min: 1900, max: 2030 })
        )
      });

      // Act & Assert: Prompt should handle extreme years correctly
      fc.assert(
        fc.property(vehicleContextArbitrary, (vehicleContext) => {
          const prompt = constructDamageAssessmentPrompt(vehicleContext);
          
          // Verify year is included regardless of value
          const hasYear = prompt.includes(vehicleContext.year.toString());
          
          // Verify prompt is still complete
          const hasAllCategories = 
            prompt.toLowerCase().includes('structural') &&
            prompt.toLowerCase().includes('mechanical') &&
            prompt.toLowerCase().includes('cosmetic') &&
            prompt.toLowerCase().includes('electrical') &&
            prompt.toLowerCase().includes('interior');
          
          return hasYear && hasAllCategories;
        }),
        { numRuns: 100 }
      );
    });

    it('should maintain consistent prompt structure across all vehicle contexts', () => {
      // Arrange: Generate diverse vehicle contexts
      const vehicleContextArbitrary = fc.record({
        make: fc.string({ minLength: 1, maxLength: 50 }),
        model: fc.string({ minLength: 1, maxLength: 50 }),
        year: fc.integer({ min: 1900, max: 2030 })
      });

      // Act & Assert: All prompts should have consistent structure
      fc.assert(
        fc.property(vehicleContextArbitrary, (vehicleContext) => {
          const prompt = constructDamageAssessmentPrompt(vehicleContext);
          
          // Count occurrences of key structural elements
          const structuralCount = (prompt.match(/structural/gi) || []).length;
          const mechanicalCount = (prompt.match(/mechanical/gi) || []).length;
          const cosmeticCount = (prompt.match(/cosmetic/gi) || []).length;
          const electricalCount = (prompt.match(/electrical/gi) || []).length;
          const interiorCount = (prompt.match(/interior/gi) || []).length;
          
          // Each category should appear multiple times (in description and schema)
          const hasConsistentStructure = 
            structuralCount >= 2 &&
            mechanicalCount >= 2 &&
            cosmeticCount >= 2 &&
            electricalCount >= 2 &&
            interiorCount >= 2;
          
          return hasConsistentStructure;
        }),
        { numRuns: 100 }
      );
    });
  });
});
