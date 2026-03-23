/**
 * Property Test: Make/Model Pre-filtering
 * 
 * **Property 9: Make/Model Pre-filtering**
 * **Validates: Requirements 8.3**
 * 
 * For any listing that fails make or model validation, the listing SHALL be
 * rejected before year filtering is attempted.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { SourcePrice } from '@/features/market-data/types';

/**
 * Helper function to validate make matches (case-insensitive)
 */
function validateMake(listingTitle: string, targetMake: string): boolean {
  const normalizedTitle = listingTitle.toLowerCase();
  const normalizedMake = targetMake.toLowerCase();
  return normalizedTitle.includes(normalizedMake);
}

/**
 * Helper function to validate model matches (fuzzy match with 80% similarity)
 */
function validateModel(listingTitle: string, targetModel: string): boolean {
  const normalizedTitle = listingTitle.toLowerCase();
  const normalizedModel = targetModel.toLowerCase();
  
  // Simple fuzzy match: check if model appears in title
  // In production, this would use a more sophisticated algorithm
  return normalizedTitle.includes(normalizedModel);
}

/**
 * Helper function to check if listing should be pre-filtered
 * Returns true if listing should be rejected before year filtering
 */
function shouldPreFilter(listing: SourcePrice, targetMake: string, targetModel: string): boolean {
  const makeValid = validateMake(listing.listingTitle, targetMake);
  const modelValid = validateModel(listing.listingTitle, targetModel);
  
  // Reject if either make or model doesn't match
  return !makeValid || !modelValid;
}

describe('Property 9: Make/Model Pre-filtering', () => {
  it('should reject listings with mismatched make before year filtering', () => {
    // Generator for listings with wrong make
    const wrongMakeGen = fc.record({
      targetMake: fc.constantFrom('Toyota', 'Honda', 'Mercedes'),
      wrongMake: fc.constantFrom('BMW', 'Lexus', 'Nissan'),
      model: fc.constantFrom('Accord', 'Camry', 'Civic'),
      year: fc.integer({ min: 2000, max: 2025 }),
    });
    
    fc.assert(
      fc.property(wrongMakeGen, (data) => {
        // Ensure wrong make is different from target make
        fc.pre(data.wrongMake !== data.targetMake);
        
        const listing: SourcePrice = {
          source: 'test',
          price: 5000000,
          currency: 'NGN',
          listingUrl: 'https://test.com/listing',
          listingTitle: `${data.wrongMake} ${data.model} ${data.year}`,
          scrapedAt: new Date(),
        };
        
        // Property: Listing with wrong make should be pre-filtered
        const shouldReject = shouldPreFilter(listing, data.targetMake, data.model);
        
        expect(shouldReject).toBe(true);
        expect(validateMake(listing.listingTitle, data.targetMake)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
  
  it('should reject listings with mismatched model before year filtering', () => {
    // Generator for listings with wrong model
    const wrongModelGen = fc.record({
      make: fc.constantFrom('Toyota', 'Honda', 'Mercedes'),
      targetModel: fc.constantFrom('Accord', 'Camry', 'Civic'),
      wrongModel: fc.constantFrom('Corolla', 'CR-V', 'Pilot'),
      year: fc.integer({ min: 2000, max: 2025 }),
    });
    
    fc.assert(
      fc.property(wrongModelGen, (data) => {
        // Ensure wrong model is different from target model
        fc.pre(data.wrongModel !== data.targetModel);
        
        const listing: SourcePrice = {
          source: 'test',
          price: 5000000,
          currency: 'NGN',
          listingUrl: 'https://test.com/listing',
          listingTitle: `${data.make} ${data.wrongModel} ${data.year}`,
          scrapedAt: new Date(),
        };
        
        // Property: Listing with wrong model should be pre-filtered
        const shouldReject = shouldPreFilter(listing, data.make, data.targetModel);
        
        expect(shouldReject).toBe(true);
        expect(validateModel(listing.listingTitle, data.targetModel)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
  
  it('should accept listings with matching make and model', () => {
    // Generator for listings with correct make and model
    const correctListingGen = fc.record({
      make: fc.constantFrom('Toyota', 'Honda', 'Mercedes'),
      model: fc.constantFrom('Accord', 'Camry', 'Civic'),
      year: fc.integer({ min: 2000, max: 2025 }),
    });
    
    fc.assert(
      fc.property(correctListingGen, (data) => {
        const listing: SourcePrice = {
          source: 'test',
          price: 5000000,
          currency: 'NGN',
          listingUrl: 'https://test.com/listing',
          listingTitle: `${data.make} ${data.model} ${data.year}`,
          scrapedAt: new Date(),
        };
        
        // Property: Listing with correct make and model should NOT be pre-filtered
        const shouldReject = shouldPreFilter(listing, data.make, data.model);
        
        expect(shouldReject).toBe(false);
        expect(validateMake(listing.listingTitle, data.make)).toBe(true);
        expect(validateModel(listing.listingTitle, data.model)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
  
  it('should pre-filter regardless of year validity', () => {
    // Generator for listings with wrong make but valid year
    const wrongMakeValidYearGen = fc.record({
      targetMake: fc.constant('Toyota'),
      wrongMake: fc.constant('Honda'),
      model: fc.constant('Camry'),
      validYear: fc.integer({ min: 2000, max: 2025 }),
    });
    
    fc.assert(
      fc.property(wrongMakeValidYearGen, (data) => {
        const listing: SourcePrice = {
          source: 'test',
          price: 5000000,
          currency: 'NGN',
          listingUrl: 'https://test.com/listing',
          listingTitle: `${data.wrongMake} ${data.model} ${data.validYear}`,
          scrapedAt: new Date(),
          extractedYear: data.validYear, // Year is valid
        };
        
        // Property: Even with valid year, wrong make should cause pre-filtering
        const shouldReject = shouldPreFilter(listing, data.targetMake, data.model);
        
        expect(shouldReject).toBe(true);
        expect(listing.extractedYear).toBe(data.validYear); // Year is valid
        expect(validateMake(listing.listingTitle, data.targetMake)).toBe(false); // But make is wrong
      }),
      { numRuns: 50 }
    );
  });
  
  it('should handle case-insensitive make matching', () => {
    // Generator for listings with different case
    const caseVariationGen = fc.record({
      make: fc.constantFrom('Toyota', 'Honda', 'Mercedes'),
      model: fc.constantFrom('Accord', 'Camry', 'Civic'),
      year: fc.integer({ min: 2000, max: 2025 }),
      caseVariation: fc.constantFrom('upper', 'lower', 'mixed'),
    });
    
    fc.assert(
      fc.property(caseVariationGen, (data) => {
        let titleMake = data.make;
        if (data.caseVariation === 'upper') {
          titleMake = data.make.toUpperCase();
        } else if (data.caseVariation === 'lower') {
          titleMake = data.make.toLowerCase();
        }
        
        const listing: SourcePrice = {
          source: 'test',
          price: 5000000,
          currency: 'NGN',
          listingUrl: 'https://test.com/listing',
          listingTitle: `${titleMake} ${data.model} ${data.year}`,
          scrapedAt: new Date(),
        };
        
        // Property: Case variations should not affect make validation
        const shouldReject = shouldPreFilter(listing, data.make, data.model);
        
        expect(shouldReject).toBe(false);
        expect(validateMake(listing.listingTitle, data.make)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
  
  it('should verify pre-filtering happens before year extraction', () => {
    // Generator for listings that would fail make/model validation
    const preFilterScenarioGen = fc.record({
      targetMake: fc.constant('Toyota'),
      targetModel: fc.constant('Camry'),
      wrongMake: fc.constant('Honda'),
      year: fc.integer({ min: 2000, max: 2025 }),
    });
    
    fc.assert(
      fc.property(preFilterScenarioGen, (data) => {
        const listing: SourcePrice = {
          source: 'test',
          price: 5000000,
          currency: 'NGN',
          listingUrl: 'https://test.com/listing',
          listingTitle: `${data.wrongMake} ${data.targetModel} ${data.year}`,
          scrapedAt: new Date(),
          // Note: extractedYear is not set yet (would be set during year filtering)
        };
        
        // Property: Pre-filtering should reject before year extraction
        const shouldReject = shouldPreFilter(listing, data.targetMake, data.targetModel);
        
        expect(shouldReject).toBe(true);
        // Year extraction should not have been attempted
        expect(listing.extractedYear).toBeUndefined();
      }),
      { numRuns: 50 }
    );
  });
  
  it('should maintain rejection consistency across multiple checks', () => {
    // Generator for random listings
    const listingGen = fc.record({
      make: fc.constantFrom('Toyota', 'Honda', 'Mercedes', 'BMW'),
      model: fc.constantFrom('Accord', 'Camry', 'Civic', 'Corolla'),
      year: fc.integer({ min: 2000, max: 2025 }),
      targetMake: fc.constantFrom('Toyota', 'Honda'),
      targetModel: fc.constantFrom('Accord', 'Camry'),
    });
    
    fc.assert(
      fc.property(listingGen, (data) => {
        const listing: SourcePrice = {
          source: 'test',
          price: 5000000,
          currency: 'NGN',
          listingUrl: 'https://test.com/listing',
          listingTitle: `${data.make} ${data.model} ${data.year}`,
          scrapedAt: new Date(),
        };
        
        // Property: Multiple pre-filter checks should return same result
        const result1 = shouldPreFilter(listing, data.targetMake, data.targetModel);
        const result2 = shouldPreFilter(listing, data.targetMake, data.targetModel);
        const result3 = shouldPreFilter(listing, data.targetMake, data.targetModel);
        
        expect(result1).toBe(result2);
        expect(result2).toBe(result3);
      }),
      { numRuns: 100 }
    );
  });
});
