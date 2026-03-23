/**
 * Test 2004 Honda Accord Market Data
 * 
 * This script tests the specific case mentioned in the bug report:
 * - 2004 Honda Accord returning ₦10,200,000
 * - Expected range: ₦2,000,000 - ₦4,500,000
 */

import { getMarketPrice } from '@/features/market-data/services/market-data.service';
import type { PropertyIdentifier } from '@/features/market-data/types';

async function test2004HondaAccord() {
  console.log('🚗 Testing 2004 Honda Accord Market Data\n');
  console.log('Expected Range: ₦2,000,000 - ₦4,500,000');
  console.log('Reported Issue: System returning ₦10,200,000\n');
  console.log('═══════════════════════════════════════════════════════\n');
  
  try {
    const property: PropertyIdentifier = {
      type: 'vehicle',
      make: 'Honda',
      model: 'Accord',
      year: 2004,
    };
    
    console.log('📊 Fetching market price...');
    console.log('Vehicle:', property);
    console.log('');
    
    const startTime = Date.now();
    const result = await getMarketPrice(property);
    const duration = Date.now() - startTime;
    
    console.log('✅ Market Price Retrieved!\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 RESULTS');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log('💰 Pricing:');
    console.log(`  Median Price: ₦${result.median.toLocaleString()}`);
    console.log(`  Min Price: ₦${result.min.toLocaleString()}`);
    console.log(`  Max Price: ₦${result.max.toLocaleString()}`);
    console.log('');
    
    console.log('📈 Data Quality:');
    console.log(`  Source Count: ${result.count} listings`);
    console.log(`  Confidence: ${result.confidence}%`);
    console.log(`  Is Fresh: ${result.isFresh ? 'Yes' : 'No'}`);
    console.log(`  Cache Age: ${result.cacheAge} days`);
    console.log(`  Duration: ${duration}ms`);
    console.log('');
    
    console.log('🔍 Year Filtering:');
    console.log(`  Year Match Rate: ${result.yearMatchRate?.toFixed(1) ?? 'N/A'}%`);
    console.log(`  Depreciation Applied: ${result.depreciationApplied ? 'Yes' : 'No'}`);
    
    // Count outliers removed and depreciation-adjusted listings
    const depreciatedListings = result.sources.filter(s => s.depreciationApplied);
    const yearMatchedListings = result.sources.filter(s => s.yearMatched);
    
    console.log(`  Year-Matched Listings: ${yearMatchedListings.length}/${result.count}`);
    if (depreciatedListings.length > 0) {
      console.log(`  Depreciation-Adjusted: ${depreciatedListings.length} listings`);
    }
    console.log('');
    
    if (result.sources.length > 0) {
      console.log('═══════════════════════════════════════════════════════');
      console.log('📋 SAMPLE LISTINGS');
      console.log('═══════════════════════════════════════════════════════\n');
      
      result.sources.slice(0, 10).forEach((source, i) => {
        console.log(`${i + 1}. ${source.listingTitle}`);
        console.log(`   Price: ₦${source.price.toLocaleString()}`);
        
        // Show year extraction and matching
        if (source.extractedYear) {
          console.log(`   Year: ${source.extractedYear} ${source.yearMatched ? '✓ matched' : '✗ not matched'}`);
        } else {
          console.log(`   Year: Not extracted`);
        }
        
        // Show depreciation if applied
        if (source.depreciationApplied && source.originalPrice) {
          const adjustment = ((source.originalPrice - source.price) / source.originalPrice * 100).toFixed(1);
          console.log(`   Depreciation: -${adjustment}% (from ₦${source.originalPrice.toLocaleString()})`);
        }
        
        console.log(`   Source: ${source.source}`);
        console.log(`   URL: ${source.listingUrl}`);
        console.log('');
      });
    }
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔍 VALIDATION');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const expectedMin = 2000000;
    const expectedMax = 4500000;
    
    // Check year match rate
    if (result.yearMatchRate !== undefined) {
      if (result.yearMatchRate >= 70) {
        console.log(`✅ PASS: Year match rate (${result.yearMatchRate.toFixed(1)}%) is excellent (≥70%)`);
      } else if (result.yearMatchRate >= 40) {
        console.log(`⚠️  WARNING: Year match rate (${result.yearMatchRate.toFixed(1)}%) is moderate (40-69%)`);
      } else {
        console.log(`❌ FAIL: Year match rate (${result.yearMatchRate.toFixed(1)}%) is low (<40%)`);
      }
      console.log('');
    }
    
    // Check if median is in expected range
    if (result.median < expectedMin) {
      console.log(`❌ FAIL: Median (₦${result.median.toLocaleString()}) is BELOW expected range`);
      console.log(`   Expected: ₦${expectedMin.toLocaleString()} - ₦${expectedMax.toLocaleString()}`);
    } else if (result.median > expectedMax) {
      console.log(`❌ FAIL: Median (₦${result.median.toLocaleString()}) is ABOVE expected range`);
      console.log(`   Expected: ₦${expectedMin.toLocaleString()} - ₦${expectedMax.toLocaleString()}`);
      console.log(`   Difference: +₦${(result.median - expectedMax).toLocaleString()}`);
    } else {
      console.log(`✅ PASS: Median (₦${result.median.toLocaleString()}) is within expected range`);
      console.log(`   Expected: ₦${expectedMin.toLocaleString()} - ₦${expectedMax.toLocaleString()}`);
    }
    console.log('');
    
    // Check source count
    if (result.count < 3) {
      console.log(`⚠️  WARNING: Low source count (${result.count}) - confidence may be reduced`);
    } else {
      console.log(`✅ PASS: Good source count (${result.count} listings)`);
    }
    console.log('');
    
    // Check confidence
    if (result.confidence < 50) {
      console.log(`⚠️  WARNING: Low confidence score (${result.confidence}%)`);
    } else if (result.confidence >= 80) {
      console.log(`✅ PASS: Excellent confidence score (${result.confidence}%)`);
    } else {
      console.log(`✅ PASS: Good confidence score (${result.confidence}%)`);
    }
    console.log('');
    
    // Analyze price distribution
    if (result.sources.length > 0) {
      const prices = result.sources.map(s => s.price);
      const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      const stdDev = Math.sqrt(
        prices.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / prices.length
      );
      
      console.log('📊 Price Distribution:');
      console.log(`   Average: ₦${Math.round(avg).toLocaleString()}`);
      console.log(`   Std Dev: ₦${Math.round(stdDev).toLocaleString()}`);
      console.log(`   Range: ₦${(result.max - result.min).toLocaleString()}`);
      console.log('');
      
      // Check for outliers (prices > 2x median)
      const outliers = prices.filter(p => p > result.median * 2);
      if (outliers.length > 0) {
        console.log(`⚠️  WARNING: ${outliers.length} outlier(s) detected (>2x median):`);
        outliers.forEach(price => {
          const listing = result.sources.find(s => s.price === price);
          console.log(`   - ₦${price.toLocaleString()}: ${listing?.listingTitle || 'Unknown'}`);
        });
        console.log('');
      } else {
        console.log(`✅ No outliers detected (all prices ≤2x median)`);
        console.log('');
      }
      
      // Check for brand new prices (likely > ₦8M for 2004 model)
      const likelyNew = prices.filter(p => p > 8000000);
      if (likelyNew.length > 0) {
        console.log(`⚠️  WARNING: ${likelyNew.length} listing(s) may be brand new or newer models:`);
        likelyNew.forEach(price => {
          const listing = result.sources.find(s => s.price === price);
          console.log(`   - ₦${price.toLocaleString()}: ${listing?.listingTitle || 'Unknown'}`);
        });
        console.log('');
      }
    }
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('📝 DIAGNOSIS');
    console.log('═══════════════════════════════════════════════════════\n');
    
    if (result.median > expectedMax) {
      console.log('🔍 Possible causes of high price:');
      console.log('  1. Scraper not filtering by year (pulling newer models)');
      console.log('  2. Scraper including brand new vehicles');
      console.log('  3. Listings are for Tokunbo (foreign used) at premium prices');
      console.log('  4. Query construction too broad');
      console.log('  5. Price validation not rejecting outliers');
      console.log('');
      
      console.log('🔧 Recommended fixes:');
      console.log('  1. Add year filtering to query construction');
      console.log('  2. Exclude "brand new" listings');
      console.log('  3. Implement price validation based on vehicle age');
      console.log('  4. Extract and validate year from listing titles');
      console.log('  5. Apply depreciation-based outlier detection');
    } else if (result.median < expectedMin) {
      console.log('🔍 Possible causes of low price:');
      console.log('  1. Scraper finding damaged/salvage vehicles');
      console.log('  2. Listings are for parts/scrap');
      console.log('  3. Data quality issues');
      console.log('');
    } else {
      console.log('✅ Price is within expected range - system working correctly!');
    }
    
    console.log('\n✅ Test complete!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

test2004HondaAccord()
  .then(() => {
    console.log('\n✅ Test execution complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });
