#!/usr/bin/env tsx

import { config } from 'dotenv';
config();

import { InternetSearchService } from '../src/features/internet-search/services/internet-search.service';

async function testSearchQueriesDirectly() {
  console.log('🔍 Testing Search Queries Directly...\n');

  const internetSearchService = new InternetSearchService();
  
  // Clear cache first
  await internetSearchService.clearCache();
  console.log('🗑️ Cache cleared\n');

  const testItems = [
    {
      name: 'iPhone 17 Pro Max 128GB',
      item: {
        type: 'electronics' as const,
        brand: 'Apple',
        model: 'iPhone 17 Pro Max',
        storage: '128GB',
        condition: 'Brand New' as const
      }
    },
    {
      name: 'iPhone 17 Pro Max 512GB',
      item: {
        type: 'electronics' as const,
        brand: 'Apple',
        model: 'iPhone 17 Pro Max',
        storage: '512GB',
        condition: 'Brand New' as const
      }
    },
    {
      name: 'iPhone 17 Pro Max 1TB',
      item: {
        type: 'electronics' as const,
        brand: 'Apple',
        model: 'iPhone 17 Pro Max',
        storage: '1TB',
        condition: 'Brand New' as const
      }
    }
  ];

  const results = [];

  for (const testItem of testItems) {
    console.log(`📱 Testing ${testItem.name}...`);
    
    try {
      const searchResult = await internetSearchService.searchMarketPrice({
        item: testItem.item,
        maxResults: 10,
        timeout: 10000
      });

      results.push({
        name: testItem.name,
        storage: testItem.item.storage,
        query: searchResult.query,
        success: searchResult.success,
        pricesFound: searchResult.priceData.prices.length,
        averagePrice: searchResult.priceData.prices.length > 0 
          ? searchResult.priceData.prices.reduce((sum, p) => sum + p.amount, 0) / searchResult.priceData.prices.length
          : 0,
        confidence: searchResult.priceData.confidence,
        resultsProcessed: searchResult.resultsProcessed
      });

      console.log(`✅ Query: "${searchResult.query}"`);
      console.log(`✅ Success: ${searchResult.success}`);
      console.log(`✅ Prices found: ${searchResult.priceData.prices.length}`);
      console.log(`✅ Average price: ₦${results[results.length - 1].averagePrice.toLocaleString()}`);
      console.log(`✅ Confidence: ${searchResult.priceData.confidence}%`);
      console.log(`✅ Results processed: ${searchResult.resultsProcessed}\n`);

      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 3000));

    } catch (error) {
      console.error(`❌ Error testing ${testItem.name}:`, error);
      results.push({
        name: testItem.name,
        storage: testItem.item.storage,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Analysis
  console.log('\n📊 SEARCH RESULTS COMPARISON:');
  console.log('=' .repeat(80));
  
  results.forEach(result => {
    if ('error' in result) {
      console.log(`❌ ${result.name}: ERROR - ${result.error}`);
    } else {
      console.log(`📱 ${result.name}:`);
      console.log(`   Storage: ${result.storage}`);
      console.log(`   Query: "${result.query}"`);
      console.log(`   Average Price: ₦${result.averagePrice.toLocaleString()}`);
      console.log(`   Prices Found: ${result.pricesFound}`);
      console.log(`   Confidence: ${result.confidence}%`);
      console.log('');
    }
  });

  // Check if queries are different
  const validResults = results.filter(r => !('error' in r)) as any[];
  if (validResults.length > 1) {
    console.log('\n🔍 QUERY ANALYSIS:');
    console.log('=' .repeat(50));
    
    const uniqueQueries = [...new Set(validResults.map(r => r.query))];
    console.log(`Unique queries generated: ${uniqueQueries.length}`);
    
    if (uniqueQueries.length === validResults.length) {
      console.log('✅ Each storage capacity generated a unique query');
      uniqueQueries.forEach((query, index) => {
        console.log(`   ${index + 1}. "${query}"`);
      });
    } else {
      console.log('⚠️  Some storage capacities generated the same query');
      uniqueQueries.forEach((query, index) => {
        const matchingResults = validResults.filter(r => r.query === query);
        console.log(`   ${index + 1}. "${query}" (used by: ${matchingResults.map(r => r.storage).join(', ')})`);
      });
    }

    // Check if prices are different
    const uniquePrices = [...new Set(validResults.map(r => Math.round(r.averagePrice)))];
    console.log(`\nUnique average prices: ${uniquePrices.length}`);
    
    if (uniquePrices.length === 1) {
      console.log('⚠️  ALL STORAGE CAPACITIES RETURNED THE SAME AVERAGE PRICE!');
      console.log(`   This suggests the search results are very similar or cached.`);
    } else {
      console.log('✅ Different storage capacities returned different average prices.');
    }
  }
}

testSearchQueriesDirectly().catch(console.error);