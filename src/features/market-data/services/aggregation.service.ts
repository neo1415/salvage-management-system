/**
 * Price Aggregation Service
 * 
 * Aggregates prices from multiple sources and calculates statistics.
 * Filters invalid prices and handles edge cases.
 * 
 * Requirements: 3.1-3.6
 */

import type { SourcePrice } from '../types';

/**
 * Aggregated price statistics
 */
export interface AggregatedPrices {
  median: number;
  min: number;
  max: number;
  count: number;
  validPrices: number[];
  outliersRemoved?: number; // NEW: Count of outliers removed
}

/**
 * Calculate median from an array of numbers
 * Assumes array is already sorted
 */
function calculateMedian(sortedPrices: number[]): number {
  const length = sortedPrices.length;
  
  if (length === 0) {
    throw new Error('Cannot calculate median of empty array');
  }
  
  if (length === 1) {
    return sortedPrices[0];
  }
  
  if (length === 2) {
    return (sortedPrices[0] + sortedPrices[1]) / 2;
  }
  
  // For 3+ prices
  const midIndex = Math.floor(length / 2);
  
  if (length % 2 === 0) {
    // Even number of prices - average the two middle values
    return (sortedPrices[midIndex - 1] + sortedPrices[midIndex]) / 2;
  } else {
    // Odd number of prices - return the middle value
    return sortedPrices[midIndex];
  }
}

/**
 * Filter out invalid prices
 * Invalid prices are: null, undefined, NaN, <= 0, or > 10 billion
 */
function filterValidPrices(prices: number[]): number[] {
  return prices.filter(price => {
    return (
      price !== null &&
      price !== undefined &&
      !isNaN(price) &&
      price > 0 &&
      price <= 10000000000
    );
  });
}

/**
 * Aggregate prices from multiple sources
 * Calculates min, max, and median
 * Filters out invalid prices
 * 
 * @param sourcePrices - Array of source prices to aggregate
 * @param options - Optional configuration for aggregation
 * @param options.removeOutliers - Whether to remove outliers (default: false)
 * @param options.outlierThreshold - Multiplier for outlier detection (default: 2.0)
 */
export function aggregatePrices(
  sourcePrices: SourcePrice[],
  options?: {
    removeOutliers?: boolean;
    outlierThreshold?: number;
  }
): AggregatedPrices {
  const { removeOutliers = false, outlierThreshold = 2.0 } = options || {};
  
  // Extract price values
  const priceValues = sourcePrices.map(sp => sp.price);
  
  // Filter valid prices
  let validPrices = filterValidPrices(priceValues);
  
  if (validPrices.length === 0) {
    throw new Error('No valid prices to aggregate');
  }
  
  // Sort prices for median calculation
  let sortedPrices = [...validPrices].sort((a, b) => a - b);
  let outliersRemoved = 0;
  
  // Remove outliers if requested
  if (removeOutliers && sortedPrices.length >= 3) {
    // Calculate initial median
    const initialMedian = calculateMedian(sortedPrices);
    
    // Identify outliers: prices > threshold * median
    const maxAllowedPrice = initialMedian * outlierThreshold;
    const pricesWithoutOutliers = sortedPrices.filter(price => price <= maxAllowedPrice);
    
    // Only apply outlier removal if we still have enough data
    if (pricesWithoutOutliers.length >= 3) {
      outliersRemoved = sortedPrices.length - pricesWithoutOutliers.length;
      sortedPrices = pricesWithoutOutliers;
    }
  }
  
  // Calculate statistics
  const min = sortedPrices[0];
  const max = sortedPrices[sortedPrices.length - 1];
  const median = calculateMedian(sortedPrices);
  
  return {
    median,
    min,
    max,
    count: sortedPrices.length,
    validPrices: sortedPrices,
    outliersRemoved,
  };
}
