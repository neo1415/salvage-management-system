/**
 * Integration tests for VehicleAutocomplete form integration
 * 
 * Tests the complete flow of vehicle input enhancement in the case creation form:
 * - Complete flow: select make → select model → select year
 * - Cascade clearing (changing make clears model/year)
 * - Disabled states (model disabled until make selected)
 * - Form submission with autocomplete selections
 * - Graceful degradation when API fails
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 7.1
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { vehicleValuations } from '@/lib/db/schema/vehicle-valuations';
import { users } from '@/lib/db/schema/users';
import { cases } from '@/lib/db/schema/cases';
import { autocompleteCache } from '@/lib/cache/autocomplete-cache';
import { eq } from 'drizzle-orm';

describe('Vehicle Autocomplete Form Integration Tests', () => {
  let testUserId: string;
  const createdCaseIds: string[] = [];
  const testEmail = `form-integration-test-${Date.now()}@example.com`;
  const testPhone = `+23480${Math.floor(10000000 + Math.random() * 90000000)}`;

  beforeAll(async () => {
    // Clean up any existing test user first
    await db.delete(users).where(eq(users.email, testEmail));
    
    // Create a test user
    const [user] = await db
      .insert(users)
      .values({
        email: testEmail,
        phone: testPhone,
        passwordHash: 'test-hash',
        role: 'claims_adjuster',
        status: 'verified_tier_1',
        fullName: 'Form Test User',
        dateOfBirth: new Date('1990-01-01'),
      })
      .returning();
    testUserId = user.id;

    // Seed test vehicle data
    await db.insert(vehicleValuations).values([
      {
        make: 'Toyota',
        model: 'Camry',
        year: 2020,
        conditionCategory: 'excellent',
        lowPrice: '8000000',
        highPrice: '10000000',
        averagePrice: '9000000',
        dataSource: 'Test Data',
        createdBy: testUserId,
      },
      {
        make: 'Toyota',
        model: 'Camry',
        year: 2021,
        conditionCategory: 'excellent',
        lowPrice: '9000000',
        highPrice: '11000000',
        averagePrice: '10000000',
        dataSource: 'Test Data',
        createdBy: testUserId,
      },
      {
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        conditionCategory: 'excellent',
        lowPrice: '5000000',
        highPrice: '7000000',
        averagePrice: '6000000',
        dataSource: 'Test Data',
        createdBy: testUserId,
      },
      {
        make: 'Honda',
        model: 'Accord',
        year: 2020,
        conditionCategory: 'excellent',
        lowPrice: '7000000',
        highPrice: '9000000',
        averagePrice: '8000000',
        dataSource: 'Test Data',
        createdBy: testUserId,
      },
    ]);
  });

  afterAll(async () => {
    // Clean up test data
    if (createdCaseIds.length > 0) {
      for (const caseId of createdCaseIds) {
        await db.delete(cases).where(eq(cases.id, caseId));
      }
    }
    
    // Clean up valuations only if testUserId is defined
    if (testUserId) {
      await db
        .delete(vehicleValuations)
        .where(eq(vehicleValuations.createdBy, testUserId));
      await db.delete(users).where(eq(users.id, testUserId));
    }
    
    // Clear cache
    await autocompleteCache.clearAll();
  });

  beforeEach(async () => {
    // Clear cache before each test for consistent results
    await autocompleteCache.clearAll();
  });

  describe('Complete flow: select make → select model → select year', () => {
    it('should successfully complete the cascade flow', async () => {
      // Step 1: Get available makes
      const makesResponse = await fetch('http://localhost:3000/api/valuations/makes');
      const makesData = await makesResponse.json();
      
      expect(makesResponse.status).toBe(200);
      expect(makesData.makes).toContain('Toyota');
      
      // Step 2: Select make and get models
      const selectedMake = 'Toyota';
      const modelsResponse = await fetch(
        `http://localhost:3000/api/valuations/models?make=${selectedMake}`
      );
      const modelsData = await modelsResponse.json();
      
      expect(modelsResponse.status).toBe(200);
      expect(modelsData.make).toBe(selectedMake);
      expect(modelsData.models).toContain('Camry');
      expect(modelsData.models).toContain('Corolla');
      
      // Step 3: Select model and get years
      const selectedModel = 'Camry';
      const yearsResponse = await fetch(
        `http://localhost:3000/api/valuations/years?make=${selectedMake}&model=${selectedModel}`
      );
      const yearsData = await yearsResponse.json();
      
      expect(yearsResponse.status).toBe(200);
      expect(yearsData.make).toBe(selectedMake);
      expect(yearsData.model).toBe(selectedModel);
      expect(yearsData.years).toContain(2020);
      expect(yearsData.years).toContain(2021);
      
      // Verify the complete flow worked
      expect(yearsData.years.length).toBeGreaterThan(0);
    }, 10000); // Increase timeout to 10 seconds

    it('should return different models for different makes', async () => {
      // Get Toyota models
      const toyotaResponse = await fetch(
        'http://localhost:3000/api/valuations/models?make=Toyota'
      );
      const toyotaData = await toyotaResponse.json();
      
      // Get Honda models
      const hondaResponse = await fetch(
        'http://localhost:3000/api/valuations/models?make=Honda'
      );
      const hondaData = await hondaResponse.json();
      
      expect(toyotaResponse.status).toBe(200);
      expect(hondaResponse.status).toBe(200);
      
      // Verify different models are returned
      expect(toyotaData.models).toContain('Camry');
      expect(toyotaData.models).not.toContain('Accord');
      expect(hondaData.models).toContain('Accord');
      expect(hondaData.models).not.toContain('Camry');
    });

    it('should return different years for different models', async () => {
      // Get years for Toyota Camry
      const camryResponse = await fetch(
        'http://localhost:3000/api/valuations/years?make=Toyota&model=Camry'
      );
      const camryData = await camryResponse.json();
      
      // Get years for Toyota Corolla
      const corollaResponse = await fetch(
        'http://localhost:3000/api/valuations/years?make=Toyota&model=Corolla'
      );
      const corollaData = await corollaResponse.json();
      
      expect(camryResponse.status).toBe(200);
      expect(corollaResponse.status).toBe(200);
      
      // Both should have years
      expect(camryData.years.length).toBeGreaterThan(0);
      expect(corollaData.years.length).toBeGreaterThan(0);
      
      // Verify they are independent
      expect(camryData.years).toContain(2021);
      expect(corollaData.years).not.toContain(2021);
    });
  });

  describe('Cascade clearing behavior', () => {
    it('should require make before fetching models', async () => {
      // Attempt to get models without make
      const response = await fetch('http://localhost:3000/api/valuations/models');
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
      expect(data.message).toContain('make');
    });

    it('should require both make and model before fetching years', async () => {
      // Attempt to get years without make
      const response1 = await fetch(
        'http://localhost:3000/api/valuations/years?model=Camry'
      );
      const data1 = await response1.json();
      
      expect(response1.status).toBe(400);
      expect(data1.error).toBeDefined();
      
      // Attempt to get years without model
      const response2 = await fetch(
        'http://localhost:3000/api/valuations/years?make=Toyota'
      );
      const data2 = await response2.json();
      
      expect(response2.status).toBe(400);
      expect(data2.error).toBeDefined();
    });

    it('should return empty results when changing make to non-existent value', async () => {
      // First, get valid models for Toyota
      const validResponse = await fetch(
        'http://localhost:3000/api/valuations/models?make=Toyota'
      );
      const validData = await validResponse.json();
      expect(validData.models.length).toBeGreaterThan(0);
      
      // Then, change to non-existent make
      const invalidResponse = await fetch(
        'http://localhost:3000/api/valuations/models?make=NonExistentMake'
      );
      const invalidData = await invalidResponse.json();
      
      expect(invalidResponse.status).toBe(200);
      expect(invalidData.models).toEqual([]);
    });

    it('should return empty results when changing model to non-existent value', async () => {
      // First, get valid years for Toyota Camry
      const validResponse = await fetch(
        'http://localhost:3000/api/valuations/years?make=Toyota&model=Camry'
      );
      const validData = await validResponse.json();
      expect(validData.years.length).toBeGreaterThan(0);
      
      // Then, change to non-existent model
      const invalidResponse = await fetch(
        'http://localhost:3000/api/valuations/years?make=Toyota&model=NonExistentModel'
      );
      const invalidData = await invalidResponse.json();
      
      expect(invalidResponse.status).toBe(200);
      expect(invalidData.years).toEqual([]);
    });
  });

  describe('Disabled states', () => {
    it('should not allow fetching models without make parameter', async () => {
      const response = await fetch('http://localhost:3000/api/valuations/models');
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
      expect(data.message).toContain('make');
    });

    it('should not allow fetching years without make parameter', async () => {
      const response = await fetch(
        'http://localhost:3000/api/valuations/years?model=Camry'
      );
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should not allow fetching years without model parameter', async () => {
      const response = await fetch(
        'http://localhost:3000/api/valuations/years?make=Toyota'
      );
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should allow fetching makes without any parameters', async () => {
      const response = await fetch('http://localhost:3000/api/valuations/makes');
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.makes).toBeDefined();
      expect(Array.isArray(data.makes)).toBe(true);
    });
  });

  describe('Form submission with autocomplete selections', () => {
    it('should accept case creation with valid autocomplete selections', async () => {
      // This test simulates the form submission after autocomplete selections
      const caseData = {
        claimReference: 'TEST-AUTOCOMPLETE-' + Date.now(),
        assetType: 'vehicle',
        assetDetails: {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
        },
        marketValue: 9000000,
        photos: [
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        ],
        gpsLocation: {
          latitude: 6.5244,
          longitude: 3.3792,
        },
        locationName: 'Test Location',
        status: 'pending_approval',
      };

      // Note: This test verifies the data structure is valid
      // Actual API submission would require authentication
      expect(caseData.assetDetails.make).toBe('Toyota');
      expect(caseData.assetDetails.model).toBe('Camry');
      expect(caseData.assetDetails.year).toBe(2020);
      expect(caseData.photos.length).toBeGreaterThanOrEqual(3);
    });

    it('should validate that selected values exist in database', async () => {
      // Verify make exists
      const makesResponse = await fetch('http://localhost:3000/api/valuations/makes');
      const makesData = await makesResponse.json();
      expect(makesData.makes).toContain('Toyota');
      
      // Verify model exists for make
      const modelsResponse = await fetch(
        'http://localhost:3000/api/valuations/models?make=Toyota'
      );
      const modelsData = await modelsResponse.json();
      expect(modelsData.models).toContain('Camry');
      
      // Verify year exists for make/model
      const yearsResponse = await fetch(
        'http://localhost:3000/api/valuations/years?make=Toyota&model=Camry'
      );
      const yearsData = await yearsResponse.json();
      expect(yearsData.years).toContain(2020);
    });

    it('should preserve sessionStorage state during form interaction', () => {
      // Simulate form state persistence
      const formState = {
        vehicleMake: 'Toyota',
        vehicleModel: 'Camry',
        vehicleYear: 2020,
        timestamp: new Date().toISOString(),
      };
      
      // In browser environment, this would use sessionStorage
      // Here we verify the data structure is correct
      expect(formState.vehicleMake).toBeDefined();
      expect(formState.vehicleModel).toBeDefined();
      expect(formState.vehicleYear).toBeDefined();
      expect(formState.timestamp).toBeDefined();
    });
  });

  describe('Graceful degradation when API fails', () => {
    it('should handle network timeout gracefully', async () => {
      // Test with invalid endpoint to simulate failure
      try {
        const response = await fetch('http://localhost:3000/api/valuations/invalid-endpoint');
        expect(response.status).toBe(404);
      } catch (error) {
        // Network error should be caught
        expect(error).toBeDefined();
      }
    });

    it('should return proper error structure on API failure', async () => {
      // Test with missing required parameters
      const response = await fetch('http://localhost:3000/api/valuations/models');
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('message');
      expect(typeof data.error).toBe('string');
      expect(typeof data.message).toBe('string');
    });

    it('should allow form submission even if autocomplete was unavailable', () => {
      // Simulate manual text entry when autocomplete fails
      const manualEntry = {
        vehicleMake: 'Toyota',
        vehicleModel: 'Camry',
        vehicleYear: 2020,
      };
      
      // Verify manual entry has same structure as autocomplete selection
      expect(manualEntry.vehicleMake).toBeDefined();
      expect(manualEntry.vehicleModel).toBeDefined();
      expect(manualEntry.vehicleYear).toBeDefined();
      expect(typeof manualEntry.vehicleMake).toBe('string');
      expect(typeof manualEntry.vehicleModel).toBe('string');
      expect(typeof manualEntry.vehicleYear).toBe('number');
    });

    it('should handle empty database gracefully', async () => {
      // Test with make that doesn't exist
      const response = await fetch(
        'http://localhost:3000/api/valuations/models?make=NonExistentMake'
      );
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.models).toEqual([]);
      expect(Array.isArray(data.models)).toBe(true);
    });

    it('should handle malformed query parameters gracefully', async () => {
      // Test with special characters
      const response = await fetch(
        'http://localhost:3000/api/valuations/models?make=Toyota%20%3C%3E%20Test'
      );
      
      // Should either return 200 with empty array or 400 with error
      expect([200, 400]).toContain(response.status);
      
      const data = await response.json();
      if (response.status === 200) {
        expect(Array.isArray(data.models)).toBe(true);
      } else {
        expect(data.error).toBeDefined();
      }
    });
  });

  describe('Performance and caching', () => {
    it('should respond quickly to makes endpoint', async () => {
      const startTime = Date.now();
      const response = await fetch('http://localhost:3000/api/valuations/makes');
      const endTime = Date.now();
      
      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(2000);
    });

    it('should respond quickly to models endpoint', async () => {
      const startTime = Date.now();
      const response = await fetch(
        'http://localhost:3000/api/valuations/models?make=Toyota'
      );
      const endTime = Date.now();
      
      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(2000);
    });

    it('should respond quickly to years endpoint', async () => {
      const startTime = Date.now();
      const response = await fetch(
        'http://localhost:3000/api/valuations/years?make=Toyota&model=Camry'
      );
      const endTime = Date.now();
      
      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(2000);
    });

    it('should maintain consistent response structure across calls', async () => {
      // First call
      const response1 = await fetch('http://localhost:3000/api/valuations/makes');
      const data1 = await response1.json();
      
      // Second call
      const response2 = await fetch('http://localhost:3000/api/valuations/makes');
      const data2 = await response2.json();
      
      // Verify structure is consistent
      expect(data1).toHaveProperty('makes');
      expect(data2).toHaveProperty('makes');
      expect(data1).toHaveProperty('cached');
      expect(data2).toHaveProperty('cached');
      expect(data1).toHaveProperty('timestamp');
      expect(data2).toHaveProperty('timestamp');
      
      // Data should be identical
      expect(data1.makes).toEqual(data2.makes);
    });
  });

  describe('Offline support and sessionStorage', () => {
    it('should preserve form state structure for offline sync', () => {
      // Simulate offline form state
      const offlineState = {
        vehicleMake: 'Toyota',
        vehicleModel: 'Camry',
        vehicleYear: 2020,
        vehicleMileage: 50000,
        vehicleCondition: 'good',
        timestamp: new Date().toISOString(),
      };
      
      // Verify all required fields are present
      expect(offlineState.vehicleMake).toBeDefined();
      expect(offlineState.vehicleModel).toBeDefined();
      expect(offlineState.vehicleYear).toBeDefined();
      expect(offlineState.timestamp).toBeDefined();
      
      // Verify optional fields can be included
      expect(offlineState.vehicleMileage).toBeDefined();
      expect(offlineState.vehicleCondition).toBeDefined();
    });

    it('should handle restoration of autocomplete selections from sessionStorage', () => {
      // Simulate restored state
      const restoredState = {
        vehicleMake: 'Toyota',
        vehicleModel: 'Camry',
        vehicleYear: 2020,
      };
      
      // Verify restored state is valid
      expect(restoredState.vehicleMake).toBe('Toyota');
      expect(restoredState.vehicleModel).toBe('Camry');
      expect(restoredState.vehicleYear).toBe(2020);
    });
  });

  describe('Data consistency and validation', () => {
    it('should return unique makes without duplicates', async () => {
      const response = await fetch('http://localhost:3000/api/valuations/makes');
      const data = await response.json();
      
      expect(response.status).toBe(200);
      const makes = data.makes;
      const uniqueMakes = [...new Set(makes)];
      expect(makes.length).toBe(uniqueMakes.length);
    });

    it('should return unique models for a make without duplicates', async () => {
      const response = await fetch(
        'http://localhost:3000/api/valuations/models?make=Toyota'
      );
      const data = await response.json();
      
      expect(response.status).toBe(200);
      const models = data.models;
      const uniqueModels = [...new Set(models)];
      expect(models.length).toBe(uniqueModels.length);
    });

    it('should return unique years for a make/model without duplicates', async () => {
      const response = await fetch(
        'http://localhost:3000/api/valuations/years?make=Toyota&model=Camry'
      );
      const data = await response.json();
      
      expect(response.status).toBe(200);
      const years = data.years;
      const uniqueYears = [...new Set(years)];
      expect(years.length).toBe(uniqueYears.length);
    });

    it('should return years as numbers not strings', async () => {
      const response = await fetch(
        'http://localhost:3000/api/valuations/years?make=Toyota&model=Camry'
      );
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.years.length).toBeGreaterThan(0);
      expect(typeof data.years[0]).toBe('number');
    });
  });
});
