/**
 * Unit tests for Gemini prompt construction
 * 
 * Tests Task 5.1 requirements:
 * - Include vehicle make, model, and year in prompt
 * - Request all five damage categories (structural, mechanical, cosmetic, electrical, interior)
 * - Provide examples of damage severity levels (minor 10-30, moderate 40-60, severe 70-90)
 * - Include guidance on identifying airbag deployment
 * - Include criteria for determining total loss status (>75% of vehicle value)
 * - Specify JSON response schema with all required fields
 * 
 * Requirements: 3.4, 3.5, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6
 */

import { describe, it, expect } from 'vitest';
import { constructDamageAssessmentPrompt, VehicleContext } from '../../../src/lib/integrations/gemini-damage-detection';

describe('Gemini Prompt Construction', () => {
  describe('Vehicle Context Inclusion', () => {
    it('should include vehicle make in prompt', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt).toContain('Toyota');
    });

    it('should include vehicle model in prompt', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Honda',
        model: 'Accord',
        year: 2020
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt).toContain('Accord');
    });

    it('should include vehicle year in prompt', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Ford',
        model: 'F-150',
        year: 2019
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt).toContain('2019');
    });

    it('should include complete vehicle context in correct format', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Tesla',
        model: 'Model 3',
        year: 2022
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt).toContain('2022 Tesla Model 3');
    });
  });

  describe('Damage Categories', () => {
    it('should request structural damage category', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt.toLowerCase()).toContain('structural');
    });

    it('should request mechanical damage category', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt.toLowerCase()).toContain('mechanical');
    });

    it('should request cosmetic damage category', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt.toLowerCase()).toContain('cosmetic');
    });

    it('should request electrical damage category', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt.toLowerCase()).toContain('electrical');
    });

    it('should request interior damage category', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt.toLowerCase()).toContain('interior');
    });

    it('should request all five damage categories', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);
      const lowerPrompt = prompt.toLowerCase();

      // Assert
      expect(lowerPrompt).toContain('structural');
      expect(lowerPrompt).toContain('mechanical');
      expect(lowerPrompt).toContain('cosmetic');
      expect(lowerPrompt).toContain('electrical');
      expect(lowerPrompt).toContain('interior');
    });
  });

  describe('Damage Severity Examples', () => {
    it('should provide minor damage severity range (10-30)', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt).toMatch(/minor.*10-30/i);
    });

    it('should provide moderate damage severity range (40-60)', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt).toMatch(/moderate.*40-60/i);
    });

    it('should provide severe damage severity range (70-90)', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt).toMatch(/severe.*70-90/i);
    });

    it('should provide examples for all three severity levels', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);
      const lowerPrompt = prompt.toLowerCase();

      // Assert
      expect(lowerPrompt).toContain('minor');
      expect(lowerPrompt).toContain('moderate');
      expect(lowerPrompt).toContain('severe');
    });
  });

  describe('Airbag Deployment Guidance', () => {
    it('should include guidance on identifying airbag deployment', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt.toLowerCase()).toContain('airbag');
    });

    it('should mention deployed airbags as a detection criterion', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt.toLowerCase()).toMatch(/deployed.*airbag|airbag.*deploy/);
    });

    it('should include airbagDeployed as a boolean field', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt).toContain('airbagDeployed');
      expect(prompt.toLowerCase()).toContain('boolean');
    });
  });

  describe('Total Loss Criteria', () => {
    it('should include total loss determination criteria', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt.toLowerCase()).toContain('total loss');
    });

    it('should specify 75% threshold for total loss', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt).toContain('75%');
    });

    it('should mention vehicle value in total loss criteria', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt.toLowerCase()).toMatch(/vehicle.*value|value.*vehicle/);
    });

    it('should include totalLoss as a boolean field', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt).toContain('totalLoss');
      expect(prompt.toLowerCase()).toContain('boolean');
    });
  });

  describe('JSON Response Schema', () => {
    it('should specify JSON response format', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt.toLowerCase()).toContain('json');
    });

    it('should include structural field in schema', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt).toMatch(/"structural".*:/);
    });

    it('should include mechanical field in schema', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt).toMatch(/"mechanical".*:/);
    });

    it('should include cosmetic field in schema', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt).toMatch(/"cosmetic".*:/);
    });

    it('should include electrical field in schema', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt).toMatch(/"electrical".*:/);
    });

    it('should include interior field in schema', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt).toMatch(/"interior".*:/);
    });

    it('should include severity field in schema', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt).toMatch(/"severity".*:/);
    });

    it('should include airbagDeployed field in schema', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt).toMatch(/"airbagDeployed".*:/);
    });

    it('should include totalLoss field in schema', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt).toMatch(/"totalLoss".*:/);
    });

    it('should include summary field in schema', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt).toMatch(/"summary".*:/);
    });

    it('should specify all required fields in schema', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert - All 9 required fields should be present
      expect(prompt).toMatch(/"structural".*:/);
      expect(prompt).toMatch(/"mechanical".*:/);
      expect(prompt).toMatch(/"cosmetic".*:/);
      expect(prompt).toMatch(/"electrical".*:/);
      expect(prompt).toMatch(/"interior".*:/);
      expect(prompt).toMatch(/"severity".*:/);
      expect(prompt).toMatch(/"airbagDeployed".*:/);
      expect(prompt).toMatch(/"totalLoss".*:/);
      expect(prompt).toMatch(/"summary".*:/);
    });

    it('should specify number type for damage scores', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt).toMatch(/number.*\(0-100\)/);
    });

    it('should specify severity enum values', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt).toMatch(/"minor".*\|.*"moderate".*\|.*"severe"/);
    });

    it('should specify 500 character limit for summary', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt).toContain('500');
    });
  });

  describe('Prompt Quality', () => {
    it('should return a non-empty prompt', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      expect(prompt).toBeTruthy();
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('should return a reasonably long prompt with sufficient detail', () => {
      // Arrange
      const vehicleContext: VehicleContext = {
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      // Act
      const prompt = constructDamageAssessmentPrompt(vehicleContext);

      // Assert
      // Prompt should be at least 1000 characters to include all required guidance
      expect(prompt.length).toBeGreaterThan(1000);
    });

    it('should work with different vehicle makes', () => {
      // Arrange
      const vehicles = [
        { make: 'Toyota', model: 'Camry', year: 2021 },
        { make: 'Honda', model: 'Accord', year: 2020 },
        { make: 'Ford', model: 'F-150', year: 2019 },
        { make: 'Tesla', model: 'Model 3', year: 2022 }
      ];

      // Act & Assert
      vehicles.forEach(vehicle => {
        const prompt = constructDamageAssessmentPrompt(vehicle);
        expect(prompt).toContain(vehicle.make);
        expect(prompt).toContain(vehicle.model);
        expect(prompt).toContain(vehicle.year.toString());
      });
    });
  });
});
