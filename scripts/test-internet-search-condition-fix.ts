#!/usr/bin/env tsx

/**
 * Test script to verify the internet search condition mapping fix
 */

import { internetSearchService } from '../src/features/internet-search/services/internet-search.service';

async function testConditionFix() {
  console.log('🧪 Testing Internet Search Condition Fix...\n');

  // Test with the problematic 'excellent' condition
  const testItem = {
    type: 'vehicle' as const,
    make: 'Mercedes-Benz',
    model: 'GLE450 W167',
    year: 2023,
    mileage: 50000,
    condition: 'excellent' // This was causing the error
  };

  try {
    console.log('📋 Test Item:', testItem);
    console.log('\n🔍 Attempting internet search...');

    const result = await internetSearchService.searchMarketPrice({
      item: testItem,
      maxResults: 5,
      timeout: 10000
    });

    if (result.success) {
      console.log('✅ Internet search successful!');
      console.log(`   Found ${result.priceData.prices.length} prices`);
      console.log(`   Average price: ₦${result.priceData.averagePrice?.toLocaleString()}`);
      console.log(`   Confidence: ${result.priceData.confidence}%`);
    } else {
      console.log('❌ Internet search failed:', result.error);
    }

  } catch (error) {
    console.error('💥 Test failed with error:', error);
  }
}

// Run the test
testConditionFix().catch(console.error);