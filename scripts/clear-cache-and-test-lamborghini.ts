import { config } from 'dotenv';
config(); // Load environment variables

import { internetSearchService } from '../src/features/internet-search/services/internet-search.service';
import { cacheIntegrationService } from '../src/features/internet-search/services/cache-integration.service';

async function clearCacheAndTestLamborghini() {
  console.log('🧹 Clearing cache and testing Lamborghini...');
  
  // Clear all cache first
  try {
    await internetSearchService.clearCache();
    console.log('✅ Cache cleared successfully');
  } catch (error) {
    console.log('⚠️ Cache clear failed (might not exist):', error);
  }
  
  // Test item
  const item = {
    type: 'vehicle' as const,
    make: 'Lamborghini',
    model: 'Revuelto',
    year: 2023,
    mileage: 50000,
    condition: 'excellent' as const
  };
  
  console.log('\n🔍 Testing fresh search (no cache)...');
  
  const searchResult = await internetSearchService.searchMarketPrice({
    item,
    maxResults: 15,
    timeout: 5000
  });
  
  console.log('Fresh Search Result:');
  console.log(`- Success: ${searchResult.success}`);
  console.log(`- Prices found: ${searchResult.priceData.prices.length}`);
  console.log(`- Average price: ₦${searchResult.priceData.averagePrice?.toLocaleString()}`);
  console.log(`- Median price: ₦${searchResult.priceData.medianPrice?.toLocaleString()}`);
  console.log(`- Confidence: ${searchResult.priceData.confidence}%`);
  console.log(`- Execution time: ${searchResult.executionTime}ms`);
  
  console.log('\n📋 Individual Prices:');
  searchResult.priceData.prices.forEach((price, index) => {
    console.log(`${index + 1}. ₦${price.price.toLocaleString()}`);
    console.log(`   Original: ${price.originalText}`);
    console.log(`   Confidence: ${price.confidence}%`);
    console.log('');
  });
  
  // Test again to see if cache is working correctly
  console.log('\n🔄 Testing cached search...');
  
  const cachedResult = await internetSearchService.searchMarketPrice({
    item,
    maxResults: 15,
    timeout: 5000
  });
  
  console.log('Cached Search Result:');
  console.log(`- Success: ${cachedResult.success}`);
  console.log(`- Prices found: ${cachedResult.priceData.prices.length}`);
  console.log(`- Average price: ₦${cachedResult.priceData.averagePrice?.toLocaleString()}`);
  console.log(`- Median price: ₦${cachedResult.priceData.medianPrice?.toLocaleString()}`);
  console.log(`- Confidence: ${cachedResult.priceData.confidence}%`);
  console.log(`- Execution time: ${cachedResult.executionTime}ms`);
  
  // Check if results match
  if (searchResult.priceData.averagePrice !== cachedResult.priceData.averagePrice) {
    console.log('\n❌ CACHE INCONSISTENCY DETECTED!');
    console.log(`Fresh result: ₦${searchResult.priceData.averagePrice?.toLocaleString()}`);
    console.log(`Cached result: ₦${cachedResult.priceData.averagePrice?.toLocaleString()}`);
  } else {
    console.log('\n✅ Cache consistency verified');
  }
}

clearCacheAndTestLamborghini().catch(console.error);