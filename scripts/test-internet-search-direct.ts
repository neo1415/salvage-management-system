#!/usr/bin/env tsx

import { config } from 'dotenv';
config();

console.log('🔧 Environment Check:');
console.log('  SERPER_API_KEY:', process.env.SERPER_API_KEY ? `${process.env.SERPER_API_KEY.substring(0, 8)}...` : 'NOT SET');
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('');

import { internetSearchService } from '@/features/internet-search/services/internet-search.service';
import type { ItemIdentifier } from '@/features/internet-search/services/query-builder.service';

async function testInternetSearchDirect() {
  console.log('🧪 Testing Internet Search Service Directly...\n');

  const testItem: ItemIdentifier = {
    type: 'vehicle',
    make: 'Toyota',
    model: 'Camry',
    year: 2022,
    mileage: 45000,
    condition: 'Nigerian Used'
  };

  console.log('📋 Test Item:', testItem);
  console.log('🔑 Serper API Key:', process.env.SERPER_API_KEY ? `${process.env.SERPER_API_KEY.substring(0, 8)}...` : 'NOT SET');
  console.log('');

  try {
    console.log('🌐 Calling internetSearchService.searchMarketPrice...');
    
    const result = await internetSearchService.searchMarketPrice({
      item: testItem,
      maxResults: 10,
      timeout: 10000 // 10 second timeout
    });

    console.log('✅ Search Result:', {
      success: result.success,
      query: result.query,
      resultsProcessed: result.resultsProcessed,
      pricesFound: result.priceData.prices.length,
      confidence: result.priceData.confidence,
      executionTime: result.executionTime,
      dataSource: result.dataSource,
      error: result.error
    });

    if (result.priceData.prices.length > 0) {
      console.log('\n💰 Price Data:');
      result.priceData.prices.forEach((price, index) => {
        console.log(`  ${index + 1}. ₦${price.price.toLocaleString()} - ${price.title} (${price.confidence}% confidence)`);
      });
    }

    if (result.error) {
      console.log('\n❌ Error Details:', result.error);
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

testInternetSearchDirect().catch(console.error);