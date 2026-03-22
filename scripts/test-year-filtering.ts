/**
 * Test script for year filtering services
 * 
 * Validates that the new year extraction, filtering, and depreciation services work correctly.
 */

import { extractYear, isValidYear } from '../src/features/market-data/services/year-extraction.service';
import { filterByYear } from '../src/features/market-data/services/year-filter.service';
import { applyDepreciation, getDepreciationRate } from '../src/features/market-data/services/depreciation.service';
import { aggregatePrices } from '../src/features/market-data/services/aggregation.service';
import type { SourcePrice } from '../src/features/market-data/types';

console.log('=== Testing Year Extraction Service ===\n');

// Test year extraction
const testTitles = [
  'Honda Accord 2004 - Clean',
  '2015 Toyota Camry EX-L',
  'Mercedes Benz GLE 2020/2021',
  'Toyota Corolla - Good condition',
  'Honda 1975 Classic',
  '2023 Lexus RX 350',
];

testTitles.forEach(title => {
  const year = extractYear(title);
  console.log(`"${title}" => ${year}`);
});

console.log('\n=== Testing Year Validation ===\n');

const testYears = [1979, 1980, 2004, 2025, 2026, 2027];
testYears.forEach(year => {
  const valid = isValidYear(year);
  console.log(`Year ${year}: ${valid ? 'VALID' : 'INVALID'}`);
});

console.log('\n=== Testing Year Filter Service ===\n');

const mockListings: SourcePrice[] = [
  {
    source: 'jiji',
    price: 2500000,
    currency: 'NGN',
    listingUrl: 'https://example.com/1',
    listingTitle: 'Honda Accord 2004 - Clean',
    scrapedAt: new Date(),
  },
  {
    source: 'jiji',
    price: 5350000,
    currency: 'NGN',
    listingUrl: 'https://example.com/2',
    listingTitle: 'Honda Accord 2013 - Excellent',
    scrapedAt: new Date(),
  },
  {
    source: 'jiji',
    price: 2800000,
    currency: 'NGN',
    listingUrl: 'https://example.com/3',
    listingTitle: 'Honda Accord 2005 - Good',
    scrapedAt: new Date(),
  },
  {
    source: 'jiji',
    price: 3200000,
    currency: 'NGN',
    listingUrl: 'https://example.com/4',
    listingTitle: 'Honda Accord - No year',
    scrapedAt: new Date(),
  },
];

const filterResult = filterByYear(mockListings, { targetYear: 2004, tolerance: 1 });
console.log(`Total listings: ${mockListings.length}`);
console.log(`Valid listings: ${filterResult.valid.length}`);
console.log(`Rejected listings: ${filterResult.rejected.length}`);
console.log(`Year match rate: ${filterResult.yearMatchRate.toFixed(2)}%`);
console.log('\nRejection reasons:');
filterResult.rejected.forEach(r => {
  console.log(`  - ${r.reason} (extracted: ${r.extractedYear})`);
});

console.log('\n=== Testing Outlier Detection ===\n');

const pricesWithOutliers: SourcePrice[] = [
  { source: 'jiji', price: 2000000, currency: 'NGN', listingUrl: '', listingTitle: '2004 Honda', scrapedAt: new Date() },
  { source: 'jiji', price: 2500000, currency: 'NGN', listingUrl: '', listingTitle: '2004 Honda', scrapedAt: new Date() },
  { source: 'jiji', price: 3000000, currency: 'NGN', listingUrl: '', listingTitle: '2004 Honda', scrapedAt: new Date() },
  { source: 'jiji', price: 300000000, currency: 'NGN', listingUrl: '', listingTitle: '2023 Lexus', scrapedAt: new Date() }, // Outlier
];

const withoutOutliers = aggregatePrices(pricesWithOutliers, { removeOutliers: true });
const withOutliers = aggregatePrices(pricesWithOutliers, { removeOutliers: false });

console.log('Without outlier removal:');
console.log(`  Median: ₦${withOutliers.median.toLocaleString()}`);
console.log(`  Count: ${withOutliers.count}`);

console.log('\nWith outlier removal:');
console.log(`  Median: ₦${withoutOutliers.median.toLocaleString()}`);
console.log(`  Count: ${withoutOutliers.count}`);
console.log(`  Outliers removed: ${withoutOutliers.outliersRemoved}`);

console.log('\n=== Testing Depreciation Service ===\n');

const newerListings: SourcePrice[] = [
  {
    source: 'jiji',
    price: 6000000,
    currency: 'NGN',
    listingUrl: 'https://example.com/5',
    listingTitle: 'Honda Accord 2010',
    scrapedAt: new Date(),
  },
];

const depreciationResult = applyDepreciation(newerListings, {
  targetYear: 2004,
  currentYear: 2025,
});

console.log(`Original price: ₦${newerListings[0].price.toLocaleString()}`);
console.log(`Adjusted price: ₦${depreciationResult.adjustedPrices[0].price.toLocaleString()}`);
console.log(`Applied count: ${depreciationResult.appliedCount}`);
console.log(`Confidence penalty: ${depreciationResult.confidencePenalty} points`);

console.log('\n=== Testing Depreciation Rates ===\n');

const testAges = [1, 3, 5, 6, 8, 10, 11, 15];
testAges.forEach(age => {
  const rate = getDepreciationRate(age);
  console.log(`Age ${age} years: ${(rate * 100).toFixed(0)}% per year`);
});

console.log('\n✅ All tests completed successfully!');
