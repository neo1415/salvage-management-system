/**
 * Year Filter Service
 * 
 * Validates listings against target year with configurable tolerance.
 * Filters out year-mismatched listings and calculates match rate.
 * 
 * Requirements: 2.2, 2.3, 2.4, 4.1
 */

import type { SourcePrice } from '../types';
import { extractYear } from './year-extraction.service';

/**
 * Configuration for year filtering
 */
export interface YearFilterConfig {
  targetYear: number;
  tolerance: number; // ±N years
}

/**
 * Result of year filtering operation
 */
export interface YearFilterResult {
  valid: SourcePrice[];
  rejected: Array<{
    listing: SourcePrice;
    reason: string;
    extractedYear: number | null;
  }>;
  yearMatchRate: number; // 0-100 percentage
}

/**
 * Filter listings by year
 * Returns valid listings and rejection details
 * 
 * Default tolerance: ±1 year
 * Rejects listings where:
 * - Year cannot be extracted
 * - Year differs by more than tolerance
 */
export function filterByYear(
  listings: SourcePrice[],
  config: YearFilterConfig
): YearFilterResult {
  const { targetYear, tolerance } = config;
  const valid: SourcePrice[] = [];
  const rejected: Array<{
    listing: SourcePrice;
    reason: string;
    extractedYear: number | null;
  }> = [];

  for (const listing of listings) {
    const extractedYear = extractYear(listing.listingTitle);

    // Reject if year cannot be extracted
    if (extractedYear === null) {
      rejected.push({
        listing,
        reason: 'No year found in listing title',
        extractedYear: null,
      });
      continue;
    }

    // Check if year is within tolerance
    const yearDifference = Math.abs(extractedYear - targetYear);
    if (yearDifference <= tolerance) {
      valid.push(listing);
    } else {
      rejected.push({
        listing,
        reason: `Year ${extractedYear} outside tolerance (±${tolerance} years from ${targetYear})`,
        extractedYear,
      });
    }
  }

  // Calculate year match rate
  const totalCount = listings.length;
  const yearMatchRate = totalCount > 0 ? (valid.length / totalCount) * 100 : 0;

  return {
    valid,
    rejected,
    yearMatchRate,
  };
}
