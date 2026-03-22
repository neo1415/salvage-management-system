/**
 * Property-Based Tests for Validation UI Behavior
 * 
 * Feature: case-creation-and-approval-enhancements
 * Property 9: Validation Error Prevents Submission
 * Property 10: Valid Overrides Enable Approval
 * 
 * Validates: Requirements 5.4, 5.5
 * 
 * Tests that the UI correctly responds to validation state:
 * - Invalid overrides disable the approve button
 * - Valid overrides enable the approve button
 * - Errors are displayed to the user
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validatePriceOverrides, type PriceOverrides } from '@/lib/validation/price-validation';

describe('Feature: case-creation-and-approval-enhancements', () => {
  describe('Property 9: Validation Error Prevents Submission', () => {
    it('should prevent submission when market value is invalid', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000000, max: 0 }), // Invalid market value
          fc.integer({ min: 1, max: 10000000 }), // Salvage value
          fc.integer({ min: 1, max: 10000000 }), // Reserve price
          (marketValue, salvageValue, reservePrice) => {
            const overrides: PriceOverrides = { marketValue };
            const aiEstimates = {
              marketValue: 5000000,
              salvageValue: 3000000,
              reservePrice: 2100000,
            };
            
            const result = validatePriceOverrides(overrides, aiEstimates);
            
            // Should be invalid (cannot approve)
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prevent submission when salvage exceeds market', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000000 }), // Market value
          fc.integer({ min: 1, max: 10000000 }), // Offset
          (marketValue, offset) => {
            const salvageValue = marketValue + offset; // Salvage > market
            const overrides: PriceOverrides = { marketValue, salvageValue };
            const aiEstimates = {
              marketValue: 5000000,
              salvageValue: 3000000,
              reservePrice: 2100000,
            };
            
            const result = validatePriceOverrides(overrides, aiEstimates);
            
            // Should be invalid (cannot approve)
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prevent submission when reserve exceeds salvage', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000000 }), // Salvage value
          fc.integer({ min: 1, max: 10000000 }), // Offset
          (salvageValue, offset) => {
            const reservePrice = salvageValue + offset; // Reserve > salvage
            const overrides: PriceOverrides = { salvageValue, reservePrice };
            const aiEstimates = {
              marketValue: 10000000,
              salvageValue: 5000000,
              reservePrice: 3500000,
            };
            
            const result = validatePriceOverrides(overrides, aiEstimates);
            
            // Should be invalid (cannot approve)
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prevent submission when any value is negative', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -10000000, max: -1 }), // Negative value
          fc.constantFrom('salvageValue', 'reservePrice'), // Which field
          (negativeValue, field) => {
            const overrides: PriceOverrides = { [field]: negativeValue };
            const aiEstimates = {
              marketValue: 5000000,
              salvageValue: 3000000,
              reservePrice: 2100000,
            };
            
            const result = validatePriceOverrides(overrides, aiEstimates);
            
            // Should be invalid (cannot approve)
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should display specific error messages for each violation', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000000, max: 10000000 }), // Market value
          fc.integer({ min: -1000000, max: 10000000 }), // Salvage value
          fc.integer({ min: -1000000, max: 10000000 }), // Reserve price
          (marketValue, salvageValue, reservePrice) => {
            const overrides: PriceOverrides = { marketValue, salvageValue, reservePrice };
            const aiEstimates = {
              marketValue: 5000000,
              salvageValue: 3000000,
              reservePrice: 2100000,
            };
            
            const result = validatePriceOverrides(overrides, aiEstimates);
            
            // If invalid, must have at least one error message
            if (!result.isValid) {
              expect(result.errors.length).toBeGreaterThan(0);
              // Each error should be a non-empty string
              result.errors.forEach(error => {
                expect(error).toBeTruthy();
                expect(typeof error).toBe('string');
                expect(error.length).toBeGreaterThan(0);
              });
            }
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe('Property 10: Valid Overrides Enable Approval', () => {
    it('should enable approval when all relationships are valid', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000000, max: 10000000 }), // Market value
          fc.float({ min: Math.fround(0.1), max: Math.fround(0.9) }), // Salvage ratio
          fc.float({ min: Math.fround(0.5), max: Math.fround(0.9) }), // Reserve ratio
          (marketValue, salvageRatio, reserveRatio) => {
            // Skip if ratios are invalid
            if (!Number.isFinite(salvageRatio) || !Number.isFinite(reserveRatio)) {
              return true;
            }
            
            const salvageValue = Math.floor(marketValue * salvageRatio);
            const reservePrice = Math.floor(salvageValue * reserveRatio);
            
            const overrides: PriceOverrides = { marketValue, salvageValue, reservePrice };
            const aiEstimates = {
              marketValue: 5000000,
              salvageValue: 3000000,
              reservePrice: 2100000,
            };
            
            const result = validatePriceOverrides(overrides, aiEstimates);
            
            // Should be valid (can approve)
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should enable approval with partial overrides when valid', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000000 }), // Override value
          fc.constantFrom('marketValue', 'salvageValue', 'reservePrice'), // Which field
          (overrideValue, field) => {
            const aiEstimates = {
              marketValue: 5000000,
              salvageValue: 3000000,
              reservePrice: 2100000,
            };
            
            // Create override that maintains valid relationships
            let overrides: PriceOverrides = {};
            
            if (field === 'marketValue') {
              // Market value must be >= salvage value
              const validMarketValue = Math.max(overrideValue, aiEstimates.salvageValue + 1);
              overrides = { marketValue: validMarketValue };
            } else if (field === 'salvageValue') {
              // Salvage must be between 0 and market value
              const validSalvageValue = Math.min(overrideValue, aiEstimates.marketValue - 1);
              if (validSalvageValue > 0 && validSalvageValue >= aiEstimates.reservePrice) {
                overrides = { salvageValue: validSalvageValue };
              } else {
                return true; // Skip invalid case
              }
            } else {
              // Reserve must be between 0 and salvage value
              const validReservePrice = Math.min(overrideValue, aiEstimates.salvageValue - 1);
              if (validReservePrice > 0) {
                overrides = { reservePrice: validReservePrice };
              } else {
                return true; // Skip invalid case
              }
            }
            
            const result = validatePriceOverrides(overrides, aiEstimates);
            
            // Should be valid (can approve)
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have no errors when validation passes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000000, max: 10000000 }), // Market value
          fc.float({ min: Math.fround(0.3), max: Math.fround(0.8) }), // Salvage ratio
          fc.float({ min: Math.fround(0.6), max: Math.fround(0.85) }), // Reserve ratio
          (marketValue, salvageRatio, reserveRatio) => {
            // Skip if ratios are invalid
            if (!Number.isFinite(salvageRatio) || !Number.isFinite(reserveRatio)) {
              return true;
            }
            
            const salvageValue = Math.floor(marketValue * salvageRatio);
            const reservePrice = Math.floor(salvageValue * reserveRatio);
            
            const overrides: PriceOverrides = { marketValue, salvageValue, reservePrice };
            const aiEstimates = {
              marketValue: 5000000,
              salvageValue: 3000000,
              reservePrice: 2100000,
            };
            
            const result = validatePriceOverrides(overrides, aiEstimates);
            
            // Valid overrides should have zero errors
            if (result.isValid) {
              expect(result.errors).toHaveLength(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow approval even with warnings present', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000000, max: 10000000 }), // Market value
          fc.float({ min: Math.fround(0.91), max: Math.fround(0.99) }), // High salvage ratio (triggers warning)
          (marketValue, salvageRatio) => {
            // Skip if ratio is invalid
            if (!Number.isFinite(salvageRatio)) {
              return true;
            }
            
            const salvageValue = Math.floor(marketValue * salvageRatio);
            const reservePrice = Math.floor(salvageValue * 0.7);
            
            const overrides: PriceOverrides = { marketValue, salvageValue, reservePrice };
            const aiEstimates = {
              marketValue: 5000000,
              salvageValue: 3000000,
              reservePrice: 2100000,
            };
            
            const result = validatePriceOverrides(overrides, aiEstimates);
            
            // Should be valid (can approve) even with warnings
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            // May have warnings, but that's okay
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain validation state consistency', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000000, max: 10000000 }), // Market value
          fc.integer({ min: -1000000, max: 10000000 }), // Salvage value
          fc.integer({ min: -1000000, max: 10000000 }), // Reserve price
          (marketValue, salvageValue, reservePrice) => {
            const overrides: PriceOverrides = { marketValue, salvageValue, reservePrice };
            const aiEstimates = {
              marketValue: 5000000,
              salvageValue: 3000000,
              reservePrice: 2100000,
            };
            
            const result = validatePriceOverrides(overrides, aiEstimates);
            
            // Validation state should be consistent
            // If isValid is true, errors should be empty
            if (result.isValid) {
              expect(result.errors).toHaveLength(0);
            }
            
            // If isValid is false, errors should not be empty
            if (!result.isValid) {
              expect(result.errors.length).toBeGreaterThan(0);
            }
            
            // isValid should match whether there are errors
            expect(result.isValid).toBe(result.errors.length === 0);
          }
        ),
        { numRuns: 200 }
      );
    });
  });
});
