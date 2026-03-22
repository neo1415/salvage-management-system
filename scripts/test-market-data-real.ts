/**
 * Test Market Data Service with Real Scraping
 * 
 * This script tests the full market data service with real web scraping
 */

import { getMarketPrice } from '@/features/market-data/services/market-data.service';
import type { PropertyIdentifier } from '@/features/market-data/types';

async function testMarketDataService() {
  console.log('🚗 Testing Market Data Service with Real Scraping\n');
  
  try {
    // Test with Toyota Camry 2020
    const property: PropertyIdentifier = {
      type: 'vehicle',
      make: 'Toyota',
      model: 'Camry',
      year: 2020,
    };
    
    console.log('📊 Fetching market price for:', property);
    console.log('This will scrape real data from Jiji.ng...\n');
    
    const startTime = Date.now();
    const result = await getMarketPrice(property);
    const duration = Date.now() - startTime;
    
    console.log('✅ Market Price Retrieved!\n');
    console.log('Results:');
    console.log(`  Median Price: ₦${result.median.toLocaleString()}`);
    console.log(`  Min Price: ₦${result.min.toLocaleString()}`);
    console.log(`  Max Price: ₦${result.max.toLocaleString()}`);
    console.log(`  Source Count: ${result.count}`);
    console.log(`  Confidence: ${result.confidence}%`);
    console.log(`  Is Fresh: ${result.isFresh}`);
    console.log(`  Cache Age: ${result.cacheAge} days`);
    console.log(`  Duration: ${duration}ms\n`);
    
    if (result.sources.length > 0) {
      console.log('📋 Sample Listings:');
      result.sources.slice(0, 5).forEach((source, i) => {
        console.log(`\n  ${i + 1}. ${source.listingTitle}`);
        console.log(`     Price: ₦${source.price.toLocaleString()}`);
        console.log(`     Source: ${source.source}`);
        console.log(`     URL: ${source.listingUrl}`);
      });
    }
    
    // Validate results
    console.log('\n🔍 Validation:');
    
    if (result.median < 1000000) {
      console.log('  ⚠️  WARNING: Median price seems too low for a 2020 Toyota Camry');
    } else if (result.median > 50000000) {
      console.log('  ⚠️  WARNING: Median price seems too high for a 2020 Toyota Camry');
    } else {
      console.log('  ✅ Median price is within reasonable range');
    }
    
    if (result.count < 3) {
      console.log('  ⚠️  WARNING: Low source count - confidence may be reduced');
    } else {
      console.log(`  ✅ Good source count (${result.count} listings)`);
    }
    
    if (result.confidence < 50) {
      console.log('  ⚠️  WARNING: Low confidence score');
    } else {
      console.log(`  ✅ Good confidence score (${result.confidence}%)`);
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

testMarketDataService()
  .then(() => {
    console.log('\n✅ All tests passed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });
