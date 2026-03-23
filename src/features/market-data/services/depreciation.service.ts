/**
 * Depreciation Service
 * 
 * Applies age-based price adjustments when insufficient year-matched data exists.
 * Uses tiered depreciation rates based on vehicle age.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

import type { SourcePrice } from '../types';
import { extractYear } from './year-extraction.service';

/**
 * Configuration for depreciation calculation
 */
export interface DepreciationConfig {
  targetYear: number;
  currentYear: number;
}

/**
 * Result of depreciation calculation
 */
export interface DepreciationResult {
  adjustedPrices: SourcePrice[];
  appliedCount: number;
  confidencePenalty: number; // 0-50 points
}

/**
 * Minimum floor price after depreciation
 */
const MIN_FLOOR_PRICE = 100000; // ₦100,000

/**
 * Calculate depreciation rate based on vehicle age
 * 
 * Tiered rates:
 * - Years 1-5: 15% per year
 * - Years 6-10: 10% per year
 * - Years 11+: 5% per year
 */
export function getDepreciationRate(yearsDifference: number): number {
  if (yearsDifference <= 0) {
    return 0;
  }

  if (yearsDifference <= 5) {
    return 0.15; // 15%
  } else if (yearsDifference <= 10) {
    return 0.10; // 10%
  } else {
    return 0.05; // 5%
  }
}

/**
 * Apply depreciation to newer vehicles
 * Adjusts prices downward to match target year
 * 
 * Only adjusts prices from newer vehicles (year > targetYear)
 * Applies compound depreciation: adjustedPrice = originalPrice * (1 - rate)^years
 * Sets minimum floor price of ₦100,000
 * Calculates confidence penalty: 10 points per year (max 50)
 */
export function applyDepreciation(
  listings: SourcePrice[],
  config: DepreciationConfig
): DepreciationResult {
  const { targetYear } = config;
  const adjustedPrices: SourcePrice[] = [];
  let appliedCount = 0;
  let maxYearDifference = 0;

  for (const listing of listings) {
    // Extract year from listing title
    const listingYear = extractYear(listing.listingTitle);

    // Only adjust newer vehicles
    if (listingYear === null || listingYear <= targetYear) {
      adjustedPrices.push(listing);
      continue;
    }

    // Calculate years difference
    const yearsDifference = listingYear - targetYear;
    maxYearDifference = Math.max(maxYearDifference, yearsDifference);

    // Apply compound depreciation for each year
    let adjustedPrice = listing.price;
    
    for (let i = 0; i < yearsDifference; i++) {
      const currentAge = i + 1;
      const rate = getDepreciationRate(currentAge);
      adjustedPrice = adjustedPrice * (1 - rate);
    }

    // Apply floor price
    adjustedPrice = Math.max(adjustedPrice, MIN_FLOOR_PRICE);

    // Create adjusted listing
    adjustedPrices.push({
      ...listing,
      price: Math.round(adjustedPrice),
    });

    appliedCount++;
  }

  // Calculate confidence penalty: 10 points per year, max 50
  const confidencePenalty = Math.min(maxYearDifference * 10, 50);

  return {
    adjustedPrices,
    appliedCount,
    confidencePenalty,
  };
}
