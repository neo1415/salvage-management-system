/**
 * Property-Based Tests for Price Validation
 * 
 * Feature: case-creation-and-approval-enhancements
 * Property 8: Price Relationship Validation
 * 
 * Validates: Requirements 5.1, 5.2, 5.3, 11.2
 * 
 * Tests that price validation enforces correct relationships:
 * - Market value > 0
 * - Salvage value ≤ market value
 * - Reserve price ≤ salvage value
 * - All values non-negative
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validatePriceOverrides } from '@/lib/validation/price-validation';

describe('Feature: case-creation-and-approval-enhancements', () => {
  describe('Property 8: Price Relationship Validation', () => {
    it('should enforce market value > 0', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000000, max: 0 }), // Non-positive market value
          fc.integer({ min: 1, max: 10000000 }), // Salvage value
          fc.integer({ min: 1, max: 10000000 }), // Reserve price
          (marketValue, salvageValue, reservePrice) => {
            const result = validatePriceOverrides(
              { marketValue },
              { marketValue: 5000000, salvageValue: 3000000, reservePrice: 2100000 }
            );
            
            // Should have error about market value
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.includes('Market value must be greater than zero'))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should enforce salvage value ≤ market value', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000000 }), // Market value
          fc.integer({ min: 1, max: 10000000 }), // Salvage value offset
          (marketValue, offset) => {
            const salvageValue = marketValue + offset; // Salvage > market
            
            const result = validatePriceOverrides(
              { marketValue, salvageValue },
              { marketValue: 5000000, salvageValue: 3000000, reservePrice: 2100000 }
            );
            
            // Should have error about salvage exceeding market
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.includes('cannot exceed market value'))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should enforce reserve price ≤ salvage value', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000000 }), // Salvage value
          fc.integer({ min: 1, max: 10000000 }), // Reserve price offset
          (salvageValue, offset) => {
            const reservePrice = salvageValue + offset; // Reserve > salvage
            
            const result = validatePriceOverrides(
              { salvageValue, reservePrice },
              { marketValue: 10000000, salvageValue: 5000000, reservePrice: 3500000 }
            );
            
            // Should have error about reserve exceeding salvage
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.includes('cannot exceed salvage value'))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject negative salvage value', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -10000000, max: -1 }), // Negative salvage value
          (salvageValue) => {
            const result = validatePriceOverrides(
              { salvageValue },
              { marketValue: 5000000, salvageValue: 3000000, reservePrice: 2100000 }
            );
            
            // Should have error about negative salvage
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.includes('Salvage value cannot be negative'))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject negative reserve price', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -10000000, max: -1 }), // Negative reserve price
          (reservePrice) => {
            const result = validatePriceOverrides(
              { reservePrice },
              { marketValue: 5000000, salvageValue: 3000000, reservePrice: 2100000 }
            );
            
            // Should have error about negative reserve
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.includes('Reserve price cannot be negative'))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept valid price relationships', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000000, max: 10000000 }), // Market value
          fc.float({ min: Math.fround(0.1), max: Math.fround(0.9) }), // Salvage ratio
          fc.float({ min: Math.fround(0.5), max: Math.fround(0.9) }), // Reserve ratio
          (marketValue, salvageRatio, reserveRatio) => {
            const salvageValue = Math.floor(marketValue * salvageRatio);
            const reservePrice = Math.floor(salvageValue * reserveRatio);
            
            const result = validatePriceOverrides(
              { marketValue, salvageValue, reservePrice },
              { marketValue: 5000000, salvageValue: 3000000, reservePrice: 2100000 }
            );
            
            // Should be valid (no errors)
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should warn when salvage value > 90% of market value', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000000, max: 10000000 }), // Market value
          fc.float({ min: Math.fround(0.91), max: Math.fround(1.0) }), // High salvage ratio
          (marketValue, salvageRatio) => {
            // Skip if salvageRatio is NaN or invalid
            if (!Number.isFinite(salvageRatio)) {
              return true;
            }
            
            const salvageValue = Math.floor(marketValue * salvageRatio);
            const reservePrice = Math.floor(salvageValue * 0.7);
            
            const result = validatePriceOverrides(
              { marketValue, salvageValue, reservePrice },
              { marketValue: 5000000, salvageValue: 3000000, reservePrice: 2100000 }
            );
            
            // Should be valid but have warning
            expect(result.isValid).toBe(true);
            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.warnings.some(w => w.includes('Salvage value is'))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should warn when reserve price < 50% of salvage value', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000000, max: 10000000 }), // Salvage value
          fc.integer({ min: 10, max: 49 }), // Low reserve ratio (10-49%)
          (salvageValue, reserveRatioPercent) => {
            const marketValue = Math.floor(salvageValue * 1.5);
            const reservePrice = Math.floor(salvageValue * (reserveRatioPercent / 100));
            
            const result = validatePriceOverrides(
              { marketValue, salvageValue, reservePrice },
              { marketValue: 5000000, salvageValue: 3000000, reservePrice: 2100000 }
            );
            
            // Should be valid but have warning
            expect(result.isValid).toBe(true);
            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.warnings.some(w => w.includes('Reserve price is only'))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle partial overrides correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000000 }), // Override value
          fc.constantFrom('marketValue', 'salvageValue', 'reservePrice'), // Which field to override
          (overrideValue, field) => {
            const overrides = { [field]: overrideValue };
            const aiEstimates = {
              marketValue: 5000000,
              salvageValue: 3000000,
              reservePrice: 2100000,
            };
            
            const result = validatePriceOverrides(overrides, aiEstimates);
            
            // Result should be deterministic based on the override
            // If override creates invalid relationship, should have errors
            const finalMarketValue = field === 'marketValue' ? overrideValue : aiEstimates.marketValue;
            const finalSalvageValue = field === 'salvageValue' ? overrideValue : aiEstimates.salvageValue;
            const finalReservePrice = field === 'reservePrice' ? overrideValue : aiEstimates.reservePrice;
            
            const hasValidRelationships = 
              finalMarketValue > 0 &&
              finalSalvageValue >= 0 &&
              finalReservePrice >= 0 &&
              finalSalvageValue <= finalMarketValue &&
              finalReservePrice <= finalSalvageValue;
            
            expect(result.isValid).toBe(hasValidRelationships);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate all price relationships together', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000000, max: 10000000 }), // Market value
          fc.integer({ min: -1000000, max: 10000000 }), // Salvage value
          fc.integer({ min: -1000000, max: 10000000 }), // Reserve price
          (marketValue, salvageValue, reservePrice) => {
            const result = validatePriceOverrides(
              { marketValue, salvageValue, reservePrice },
              { marketValue: 5000000, salvageValue: 3000000, reservePrice: 2100000 }
            );
            
            // Check all validation rules
            const shouldBeValid = 
              marketValue > 0 &&
              salvageValue >= 0 &&
              reservePrice >= 0 &&
              salvageValue <= marketValue &&
              reservePrice <= salvageValue;
            
            expect(result.isValid).toBe(shouldBeValid);
            
            // If invalid, should have at least one error
            if (!shouldBeValid) {
              expect(result.errors.length).toBeGreaterThan(0);
            }
            
            // If valid, should have no errors
            if (shouldBeValid) {
              expect(result.errors).toHaveLength(0);
            }
          }
        ),
        { numRuns: 200 }
      );
    });
  });
});
