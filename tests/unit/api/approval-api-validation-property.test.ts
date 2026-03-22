/**
 * Property-Based Tests for Approval API Validation
 * 
 * Tests that the approval API correctly validates price overrides
 * and returns appropriate error responses.
 * 
 * Feature: case-creation-and-approval-enhancements
 * Property 18: API Invalid Override Error Response
 */

import fc from 'fast-check';
import { validatePriceOverrides } from '@/lib/validation/price-validation';

describe('Feature: case-creation-and-approval-enhancements', () => {
  describe('Property 18: API Invalid Override Error Response', () => {
    /**
     * **Validates: Requirements 11.5**
     * 
     * For any approval request with invalid price overrides, the API should return
     * a 400 status code with detailed validation error messages.
     * 
     * This test verifies that:
     * 1. Invalid overrides are detected by the validation function
     * 2. Detailed error messages are provided
     * 3. The validation function returns isValid: false
     */
    it('should return validation errors for invalid price overrides', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000000 }), // marketValue
          fc.integer({ min: 1, max: 10000000 }), // salvageValue
          fc.integer({ min: 1, max: 10000000 }), // reservePrice
          (marketValue, salvageValue, reservePrice) => {
            // AI estimates (baseline values)
            const aiEstimates = {
              marketValue: 5000000,
              salvageValue: 3000000,
              reservePrice: 2100000,
            };

            // Test overrides
            const overrides = {
              marketValue,
              salvageValue,
              reservePrice,
            };

            const result = validatePriceOverrides(overrides, aiEstimates);

            // If salvage > market, should have error
            if (salvageValue > marketValue) {
              expect(result.isValid).toBe(false);
              expect(result.errors.length).toBeGreaterThan(0);
              expect(result.errors.some(e => e.includes('Salvage value') && e.includes('cannot exceed market value'))).toBe(true);
            }

            // If reserve > salvage, should have error
            if (reservePrice > salvageValue) {
              expect(result.isValid).toBe(false);
              expect(result.errors.length).toBeGreaterThan(0);
              expect(result.errors.some(e => e.includes('Reserve price') && e.includes('cannot exceed salvage value'))).toBe(true);
            }

            // If all relationships are valid, should pass
            if (marketValue > 0 && salvageValue <= marketValue && reservePrice <= salvageValue) {
              expect(result.isValid).toBe(true);
              expect(result.errors).toHaveLength(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject zero or negative market values', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000000, max: 0 }), // invalid market value
          (marketValue) => {
            const aiEstimates = {
              marketValue: 5000000,
              salvageValue: 3000000,
              reservePrice: 2100000,
            };

            const overrides = {
              marketValue,
            };

            const result = validatePriceOverrides(overrides, aiEstimates);

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors.some(e => e.includes('Market value must be greater than zero'))).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject negative salvage or reserve values', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000000, max: -1 }), // negative value
          fc.constantFrom('salvageValue', 'reservePrice'), // which field
          (negativeValue, field) => {
            const aiEstimates = {
              marketValue: 5000000,
              salvageValue: 3000000,
              reservePrice: 2100000,
            };

            const overrides = {
              [field]: negativeValue,
            };

            const result = validatePriceOverrides(overrides, aiEstimates);

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors.some(e => e.includes('cannot be negative'))).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should provide detailed error messages with actual values', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000000, max: 5000000 }), // marketValue
          fc.integer({ min: 6000000, max: 10000000 }), // salvageValue (intentionally higher)
          (marketValue, salvageValue) => {
            const aiEstimates = {
              marketValue: 5000000,
              salvageValue: 3000000,
              reservePrice: 2100000,
            };

            const overrides = {
              marketValue,
              salvageValue,
            };

            const result = validatePriceOverrides(overrides, aiEstimates);

            expect(result.isValid).toBe(false);
            
            // Error message should include actual values
            const errorMessage = result.errors.find(e => e.includes('Salvage value') && e.includes('cannot exceed'));
            expect(errorMessage).toBeDefined();
            expect(errorMessage).toContain(salvageValue.toLocaleString());
            expect(errorMessage).toContain(marketValue.toLocaleString());
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle partial overrides correctly', () => {
      fc.assert(
        fc.property(
          fc.option(fc.integer({ min: 1, max: 10000000 }), { nil: undefined }), // marketValue
          fc.option(fc.integer({ min: 1, max: 10000000 }), { nil: undefined }), // salvageValue
          fc.option(fc.integer({ min: 1, max: 10000000 }), { nil: undefined }), // reservePrice
          (marketValue, salvageValue, reservePrice) => {
            const aiEstimates = {
              marketValue: 5000000,
              salvageValue: 3000000,
              reservePrice: 2100000,
            };

            const overrides: any = {};
            if (marketValue !== undefined) overrides.marketValue = marketValue;
            if (salvageValue !== undefined) overrides.salvageValue = salvageValue;
            if (reservePrice !== undefined) overrides.reservePrice = reservePrice;

            const result = validatePriceOverrides(overrides, aiEstimates);

            // Determine final values (override or AI estimate)
            const finalMarket = marketValue ?? aiEstimates.marketValue;
            const finalSalvage = salvageValue ?? aiEstimates.salvageValue;
            const finalReserve = reservePrice ?? aiEstimates.reservePrice;

            // Validate relationships with final values
            if (finalSalvage > finalMarket) {
              expect(result.isValid).toBe(false);
            }

            if (finalReserve > finalSalvage) {
              expect(result.isValid).toBe(false);
            }

            if (finalMarket > 0 && finalSalvage <= finalMarket && finalReserve <= finalSalvage && finalSalvage >= 0 && finalReserve >= 0) {
              expect(result.isValid).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
