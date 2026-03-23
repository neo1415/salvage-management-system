/**
 * Unit Test: Year Filtering Logic
 * 
 * Tests the year filtering logic in isolation to verify the newer listings filter.
 */

import { describe, it, expect } from 'vitest';
import type { SourcePrice } from '../../../src/features/market-data/types';

describe('Year Filtering Logic', () => {
  it('should correctly identify newer listings that are NOT year-matched', () => {
    const allPrices: SourcePrice[] = [
      {
        source: 'jiji',
        price: 2500000,
        currency: 'NGN',
        listingUrl: 'https://jiji.ng/1',
        listingTitle: 'Honda Accord 2004',
        scrapedAt: new Date(),
        extractedYear: 2004,
        yearMatched: true,
      },
      {
        source: 'jiji',
        price: 2800000,
        currency: 'NGN',
        listingUrl: 'https://jiji.ng/2',
        listingTitle: 'Honda Accord 2005',
        scrapedAt: new Date(),
        extractedYear: 2005,
        yearMatched: true,
      },
    ];

    const targetYear = 2004;

    // Filter for newer listings that are NOT year-matched
    const newerListings = allPrices.filter(p => {
      const year = p.extractedYear;
      return p.yearMatched !== true && year !== null && year > targetYear;
    });

    // Both listings are year-matched, so newerListings should be empty
    expect(newerListings).toHaveLength(0);
  });

  it('should identify newer listings that are NOT year-matched', () => {
    const allPrices: SourcePrice[] = [
      {
        source: 'jiji',
        price: 2500000,
        currency: 'NGN',
        listingUrl: 'https://jiji.ng/1',
        listingTitle: 'Honda Accord 2004',
        scrapedAt: new Date(),
        extractedYear: 2004,
        yearMatched: true,
      },
      {
        source: 'jiji',
        price: 3200000,
        currency: 'NGN',
        listingUrl: 'https://jiji.ng/2',
        listingTitle: 'Honda Accord 2007',
        scrapedAt: new Date(),
        extractedYear: 2007,
        yearMatched: false, // Not year-matched (outside ±1 tolerance)
      },
    ];

    const targetYear = 2004;

    // Filter for newer listings that are NOT year-matched
    const newerListings = allPrices.filter(p => {
      const year = p.extractedYear;
      return p.yearMatched !== true && year !== null && year > targetYear;
    });

    // One listing is newer and NOT year-matched
    expect(newerListings).toHaveLength(1);
    expect(newerListings[0].extractedYear).toBe(2007);
  });
});
