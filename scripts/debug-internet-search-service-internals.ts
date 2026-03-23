import { config } from 'dotenv';
config();

import { serperApi } from '../src/lib/integrations/serper-api';
import { queryBuilder } from '../src/features/internet-search/services/query-builder.service';
import { priceExtractor } from '../src/features/internet-search/services/price-extraction.service';
import { cacheIntegrationService } from '../src/features/internet-search/services/cache-integration.service';

async function debugInternetSearchServiceInternals() {
  console.log('🔍 Debugging Internet Search Service Internals...');
  
  const item = {
    type: 'vehicle' as const,
    make: 'Lamborghini',
    model: 'Revuelto',
    year: 2023,
    mileage: 50000,
    condition: 'excellent' as const
  };
  
  // Clear cache first
  try {
    await cacheIntegrationService.clearAllCache();
    console.log('✅ Cache cleared');
  } catch (error) {
    console.log('⚠️ Cache clear failed:', error);
  }
  
  // Step 1: Manually replicate what the service does
  console.log('\n🔧 Step 1: Manual Service Replication');
  
  // Check cache (should be empty)
  const cachedResult = await cacheIntegrationService.getCachedMarketPrice(item);
  console.log('Cache check result:', cachedResult ? 'FOUND (unexpected!)' : 'EMPTY (expected)');
  
  // Build query
  const query = queryBuilder.buildMarketQuery(item);
  console.log('Generated query:', query);
  
  // Execute search
  console.log('\n🌐 Executing Serper search...');
  const searchResults = await serperApi.search(query, { num: 15 });
  console.log('Search results:', {
    success: searchResults.success,
    organicCount: searchResults.organic?.length || 0
  });
  
  if (!searchResults.organic || searchResults.organic.length === 0) {
    console.log('❌ No search results - this is the problem!');
    return;
  }
  
  console.log('\n📊 Search results preview:');
  searchResults.organic.slice(0, 3).forEach((result, index) => {
    console.log(`${index + 1}. ${result.title.substring(0, 60)}...`);
    console.log(`   Snippet: ${result.snippet.substring(0, 80)}...`);
  });
  
  // Extract prices
  console.log('\n💰 Extracting prices...');
  const priceData = priceExtractor.extractPrices(searchResults.organic, item.type);
  
  console.log('Price extraction result:');
  console.log(`- Prices found: ${priceData.prices.length}`);
  console.log(`- Average: ₦${priceData.averagePrice?.toLocaleString()}`);
  console.log(`- Median: ₦${priceData.medianPrice?.toLocaleString()}`);
  console.log(`- Confidence: ${priceData.confidence}%`);
  
  // Check if this matches what we expect
  if (priceData.prices.length === 1 && priceData.averagePrice === 960000) {
    console.log('\n❌ REPRODUCED THE BUG!');
    console.log('The issue is in the price extraction when called with these exact search results');
    
    // Let's debug the price extraction step by step
    console.log('\n🔍 Debugging price extraction step by step...');
    
    // Test each result individually
    searchResults.organic.forEach((result, index) => {
      console.log(`\n--- Testing result ${index + 1} individually ---`);
      console.log(`Title: ${result.title}`);
      console.log(`Snippet: ${result.snippet}`);
      
      const singleResult = priceExtractor.extractPrices([result], item.type);
      console.log(`Prices extracted: ${singleResult.prices.length}`);
      singleResult.prices.forEach(price => {
        console.log(`  → ₦${price.price.toLocaleString()} from "${price.originalText}"`);
      });
    });
    
  } else {
    console.log('\n✅ This manual replication works correctly');
    console.log('The bug must be elsewhere in the service');
  }
}

debugInternetSearchServiceInternals().catch(console.error);