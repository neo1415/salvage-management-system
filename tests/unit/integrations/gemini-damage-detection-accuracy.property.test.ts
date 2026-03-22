/**
 * Property-Based Test: Damage Detection Accuracy Bounds
 * 
 * Feature: gemini-damage-detection-migration
 * Property 13: Damage Detection Accuracy Bounds
 * 
 * Validates: Requirements 8.2, 8.4
 * 
 * This property test verifies that:
 * - For visibly damaged vehicles, at least one damage score is above 30
 * - For undamaged vehicles, all damage scores are below 30
 * 
 * The test uses the real vehicle photo dataset to validate accuracy bounds.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { assessDamageWithGemini, initializeGeminiService } from '@/lib/integrations/gemini-damage-detection';

describe('Property 13: Damage Detection Accuracy Bounds', () => {
  beforeAll(async () => {
    // Initialize Gemini service before tests
    await initializeGeminiService();
  });

  describe('Requirement 8.2: Damaged Vehicle Detection', () => {
    it('should return damage scores above 30 for visibly damaged vehicles', async () => {
      // Test with light damage photo
      const lightDamageUrl = 'file://.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/light-severity/images (1).jpg';
      const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };
      
      const result = await assessDamageWithGemini([lightDamageUrl], vehicleContext);
      
      // At least one damage category should be above 30
      const maxDamageScore = Math.max(
        result.structural,
        result.mechanical,
        result.cosmetic,
        result.electrical,
        result.interior
      );
      
      expect(maxDamageScore).toBeGreaterThan(30);
      expect(result.severity).toMatch(/minor|moderate|severe/);
    });

    it('should detect moderate damage with scores 40-70', async () => {
      // Test with moderate damage photo
      const moderateDamageUrl = 'file://.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/moderate-severity/images (8).jpg';
      const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };
      
      const result = await assessDamageWithGemini([moderateDamageUrl], vehicleContext);
      
      // At least one damage category should be in moderate range
      const maxDamageScore = Math.max(
        result.structural,
        result.mechanical,
        result.cosmetic,
        result.electrical,
        result.interior
      );
      
      expect(maxDamageScore).toBeGreaterThan(40);
      expect(result.severity).toMatch(/moderate|severe/);
    });

    it('should detect severe damage with scores above 70', async () => {
      // Test with high severity damage photo
      const severeDamageUrl = 'file://.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/Toyota-camry-2021-high-severity/images (3).jpg';
      const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };
      
      const result = await assessDamageWithGemini([severeDamageUrl], vehicleContext);
      
      // At least one damage category should be in severe range
      const maxDamageScore = Math.max(
        result.structural,
        result.mechanical,
        result.cosmetic,
        result.electrical,
        result.interior
      );
      
      expect(maxDamageScore).toBeGreaterThan(70);
      expect(result.severity).toBe('severe');
    });

    it('should detect airbag deployment in damaged vehicles', async () => {
      // Test with airbag deployed photo
      const airbagUrl = 'file://.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/airbags-deployed/images (13).jpg';
      const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };
      
      const result = await assessDamageWithGemini([airbagUrl], vehicleContext);
      
      // Should detect airbag deployment
      expect(result.airbagDeployed).toBe(true);
      
      // Should have significant damage
      const maxDamageScore = Math.max(
        result.structural,
        result.mechanical,
        result.cosmetic,
        result.electrical,
        result.interior
      );
      expect(maxDamageScore).toBeGreaterThan(50);
    });

    it('should identify total loss vehicles', async () => {
      // Test with total loss photo
      const totalLossUrl = 'file://.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/Totalled/images (15).jpg';
      const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };
      
      const result = await assessDamageWithGemini([totalLossUrl], vehicleContext);
      
      // Should identify as total loss
      expect(result.totalLoss).toBe(true);
      expect(result.severity).toBe('severe');
      
      // Should have very high damage scores
      const maxDamageScore = Math.max(
        result.structural,
        result.mechanical,
        result.cosmetic,
        result.electrical,
        result.interior
      );
      expect(maxDamageScore).toBeGreaterThan(75);
    });
  });

  describe('Requirement 8.4: Undamaged Vehicle Detection', () => {
    it('should return damage scores below 30 for undamaged vehicles', async () => {
      // Test with undamaged photo
      const undamagedUrl = 'file://.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/Toyota camry 2021-no-damage/images (10).jpg';
      const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };
      
      const result = await assessDamageWithGemini([undamagedUrl], vehicleContext);
      
      // All damage categories should be below 30
      expect(result.structural).toBeLessThan(30);
      expect(result.mechanical).toBeLessThan(30);
      expect(result.cosmetic).toBeLessThan(30);
      expect(result.electrical).toBeLessThan(30);
      expect(result.interior).toBeLessThan(30);
      
      // Severity should be minor
      expect(result.severity).toBe('minor');
      
      // No airbag deployment
      expect(result.airbagDeployed).toBe(false);
      
      // Not total loss
      expect(result.totalLoss).toBe(false);
    });

    it('should consistently identify pristine vehicles across multiple photos', async () => {
      // Test with multiple undamaged photos
      const undamagedPhotos = [
        'file://.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/Toyota camry 2021-no-damage/344x258.jpg',
        'file://.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/Toyota camry 2021-no-damage/images (11).jpg',
        'file://.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/Toyota camry 2021-no-damage/images (12).jpg',
      ];
      
      const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };
      
      for (const photoUrl of undamagedPhotos) {
        const result = await assessDamageWithGemini([photoUrl], vehicleContext);
        
        // All scores should be low
        const maxDamageScore = Math.max(
          result.structural,
          result.mechanical,
          result.cosmetic,
          result.electrical,
          result.interior
        );
        
        expect(maxDamageScore).toBeLessThan(30);
        expect(result.severity).toBe('minor');
        expect(result.airbagDeployed).toBe(false);
        expect(result.totalLoss).toBe(false);
      }
    });
  });

  describe('Accuracy Bounds Validation', () => {
    it('should maintain accuracy bounds across damage severity spectrum', async () => {
      const testCases = [
        {
          url: 'file://.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/Toyota camry 2021-no-damage/images (10).jpg',
          expectedMaxDamage: 30,
          expectedSeverity: 'minor',
          description: 'undamaged',
        },
        {
          url: 'file://.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/light-severity/images (1).jpg',
          expectedMinDamage: 30,
          expectedMaxDamage: 50,
          expectedSeverity: 'minor',
          description: 'light damage',
        },
        {
          url: 'file://.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/moderate-severity/images (8).jpg',
          expectedMinDamage: 40,
          expectedMaxDamage: 70,
          expectedSeverity: 'moderate',
          description: 'moderate damage',
        },
        {
          url: 'file://.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/Toyota-camry-2021-high-severity/images (3).jpg',
          expectedMinDamage: 70,
          expectedSeverity: 'severe',
          description: 'severe damage',
        },
      ];
      
      const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };
      
      for (const testCase of testCases) {
        const result = await assessDamageWithGemini([testCase.url], vehicleContext);
        
        const maxDamageScore = Math.max(
          result.structural,
          result.mechanical,
          result.cosmetic,
          result.electrical,
          result.interior
        );
        
        // Validate damage score bounds
        if (testCase.expectedMinDamage !== undefined) {
          expect(maxDamageScore).toBeGreaterThanOrEqual(testCase.expectedMinDamage);
        }
        if (testCase.expectedMaxDamage !== undefined) {
          expect(maxDamageScore).toBeLessThanOrEqual(testCase.expectedMaxDamage);
        }
        
        // Validate severity classification
        expect(result.severity).toBe(testCase.expectedSeverity);
      }
    });

    it('should have low false positive rate for undamaged vehicles', async () => {
      // Test all undamaged photos
      const undamagedPhotos = [
        'file://.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/Toyota camry 2021-no-damage/344x258.jpg',
        'file://.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/Toyota camry 2021-no-damage/images (10).jpg',
        'file://.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/Toyota camry 2021-no-damage/images (11).jpg',
        'file://.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/Toyota camry 2021-no-damage/images (12).jpg',
      ];
      
      const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };
      let falsePositives = 0;
      
      for (const photoUrl of undamagedPhotos) {
        const result = await assessDamageWithGemini([photoUrl], vehicleContext);
        
        const maxDamageScore = Math.max(
          result.structural,
          result.mechanical,
          result.cosmetic,
          result.electrical,
          result.interior
        );
        
        // False positive if undamaged vehicle has damage score > 30
        if (maxDamageScore > 30) {
          falsePositives++;
        }
      }
      
      const falsePositiveRate = (falsePositives / undamagedPhotos.length) * 100;
      
      // False positive rate should be less than 10%
      expect(falsePositiveRate).toBeLessThan(10);
    });

    it('should have low false negative rate for damaged vehicles', async () => {
      // Test damaged photos
      const damagedPhotos = [
        'file://.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/light-severity/images (1).jpg',
        'file://.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/moderate-severity/images (8).jpg',
        'file://.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/Toyota-camry-2021-high-severity/images (3).jpg',
      ];
      
      const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };
      let falseNegatives = 0;
      
      for (const photoUrl of damagedPhotos) {
        const result = await assessDamageWithGemini([photoUrl], vehicleContext);
        
        const maxDamageScore = Math.max(
          result.structural,
          result.mechanical,
          result.cosmetic,
          result.electrical,
          result.interior
        );
        
        // False negative if damaged vehicle has all damage scores < 30
        if (maxDamageScore < 30) {
          falseNegatives++;
        }
      }
      
      const falseNegativeRate = (falseNegatives / damagedPhotos.length) * 100;
      
      // False negative rate should be less than 5%
      expect(falseNegativeRate).toBeLessThan(5);
    });
  });
});
