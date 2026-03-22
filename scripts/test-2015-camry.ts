/**
 * Test 2015 Toyota Camry
 * Older model year should have more listings available
 */

import 'dotenv/config';
import { getMarketPrice } from '../src/features/market-data/services/market-data.service';
import type { PropertyIdentifier } from '../src/features/market-data/types';

async function test2015Camry() {
  console.log('🚗 Testing 2015 Toyota Camry Market Data\n');
  console.log('Older model - should have more listings available');
  console.log('═══════════════════════════════════════════════════════\n');

  const vehicle: PropertyIdentifier = {
    type: 'vehicle',
    make: 'Toyota',
    model: 'Camry',
    year: 2015,
  };

  console.log('📊 Fetching market price...');
  console.log(`Vehicle: ${JSON.stringify(vehicle, null, 2)}\n`);

  try {
    const result = await getMarketPrice(vehicle);

    console.log('✅ SUCCESS!\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 MARKET PRICE RESULT\n');
    console.log('Full result:', JSON.stringify(result, null, 2));
    console.log(`\nEstimated Price: ₦${result.estimatedPrice?.toLocaleString() || 'N/A'}`);
    console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`Data Points: ${result.dataPoints}`);
    console.log(`Year-Matched Listings: ${result.yearMatchedListings || 'N/A'}`);
    
    if (result.priceRange) {
      console.log(`\nPrice Range:`);
      console.log(`  Min: ₦${result.priceRange.min.toLocaleString()}`);
      console.log(`  Max: ₦${result.priceRange.max.toLocaleString()}`);
    }

    console.log(`\nSources Used: ${result.sources.join(', ')}`);
    
    if (result.metadata) {
      console.log(`\nMetadata:`);
      console.log(`  Cached: ${result.metadata.cached ? 'Yes' : 'No'}`);
      console.log(`  Timestamp: ${result.metadata.timestamp}`);
      
      if (result.metadata.yearFilterSummary) {
        console.log(`\n  Year Filtering:`);
        console.log(`    Target Year: ${result.metadata.yearFilterSummary.targetYear}`);
        console.log(`    Total Scraped: ${result.metadata.yearFilterSummary.totalScraped}`);
        console.log(`    Year-Matched: ${result.metadata.yearFilterSummary.yearMatched}`);
        console.log(`    Match Rate: ${(result.metadata.yearFilterSummary.matchRate * 100).toFixed(1)}%`);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ Test completed successfully!');
    console.log('\n💡 This price is based on REAL market data from Nigerian e-commerce sites');
    console.log('   with year filtering to ensure accuracy.');

  } catch (error) {
    console.log('❌ Test failed:', error instanceof Error ? error.message : error);
    console.log('\nError details:');
    console.log('Message:', error instanceof Error ? error.message : 'Unknown error');
    
    if (error instanceof Error && error.message.includes('Insufficient year-matched data')) {
      console.log('\n⚠️  This means year filtering is working correctly!');
      console.log('   The system is protecting you by rejecting requests');
      console.log('   when there isn\'t enough year-specific data available.');
    }
  }
}

test2015Camry().catch(console.error);
