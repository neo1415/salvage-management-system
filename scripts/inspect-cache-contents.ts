import { config } from 'dotenv';
config();

import { cacheIntegrationService } from '../src/features/internet-search/services/cache-integration.service';

async function inspectCacheContents() {
  console.log('🔍 Inspecting Cache Contents...');
  
  const item = {
    type: 'vehicle' as const,
    make: 'Lamborghini',
    model: 'Revuelto',
    year: 2023,
    mileage: 50000,
    condition: 'excellent' as const
  };
  
  // Check what's in the cache
  const cachedResult = await cacheIntegrationService.getCachedMarketPrice(item);
  
  if (cachedResult) {
    console.log('📦 Found cached result:');
    console.log('- Query:', cachedResult.query);
    console.log('- Results processed:', cachedResult.resultsProcessed);
    console.log('- Execution time:', cachedResult.executionTime);
    console.log('- Price data:');
    console.log('  - Prices found:', cachedResult.priceData.prices.length);
    console.log('  - Average:', cachedResult.priceData.averagePrice?.toLocaleString());
    console.log('  - Median:', cachedResult.priceData.medianPrice?.toLocaleString());
    console.log('  - Confidence:', cachedResult.priceData.confidence);
    
    console.log('\n📋 Individual cached prices:');
    cachedResult.priceData.prices.forEach((price, index) => {
      console.log(`${index + 1}. ₦${price.price.toLocaleString()}`);
      console.log(`   Original: ${price.originalText}`);
      console.log(`   Confidence: ${price.confidence}%`);
      console.log('');
    });
    
    // Check cache age
    const cacheAge = Date.now() - cachedResult.priceData.extractedAt.getTime();
    console.log(`Cache age: ${Math.round(cacheAge / 1000)} seconds`);
    
  } else {
    console.log('📭 No cached result found');
  }
  
  // Get cache stats
  try {
    const stats = await cacheIntegrationService.getCacheStats();
    console.log('\n📊 Cache Statistics:');
    console.log(JSON.stringify(stats, null, 2));
  } catch (error) {
    console.log('⚠️ Could not get cache stats:', error);
  }
}

inspectCacheContents().catch(console.error);