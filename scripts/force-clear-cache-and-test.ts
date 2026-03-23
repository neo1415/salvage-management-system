import { config } from 'dotenv';
config();

import { redis } from '../src/lib/redis/client';
import { internetSearchService } from '../src/features/internet-search/services/internet-search.service';

async function forceClearCacheAndTest() {
  console.log('🧹 Force clearing ALL cache and testing...');
  
  try {
    // Force clear Redis cache with pattern matching
    console.log('Clearing Redis cache with pattern matching...');
    
    // Get all keys that match internet search patterns
    const searchKeys = await redis.keys('internet_search:*');
    console.log(`Found ${searchKeys.length} internet search cache keys`);
    
    if (searchKeys.length > 0) {
      await redis.del(...searchKeys);
      console.log(`✅ Deleted ${searchKeys.length} cache keys`);
    }
    
    // Also clear any other cache patterns
    const allKeys = await redis.keys('*lamborghini*');
    console.log(`Found ${allKeys.length} Lamborghini-related keys`);
    
    if (allKeys.length > 0) {
      await redis.del(...allKeys);
      console.log(`✅ Deleted ${allKeys.length} Lamborghini keys`);
    }
    
    // Clear service cache
    await internetSearchService.clearCache();
    console.log('✅ Cleared service cache');
    
  } catch (error) {
    console.log('⚠️ Cache clearing error:', error);
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
  
  console.log('\n🔍 Testing with completely fresh cache...');
  
  const searchResult = await internetSearchService.searchMarketPrice({
    item,
    maxResults: 15,
    timeout: 5000
  });
  
  console.log('Fresh Search Result (no cache):');
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
  
  // Verify the fix
  if (searchResult.priceData.averagePrice && searchResult.priceData.averagePrice > 100000000) {
    console.log('✅ SUCCESS! Price is now in the correct range (> ₦100M)');
  } else {
    console.log('❌ STILL BROKEN! Price is still too low');
  }
}

forceClearCacheAndTest().catch(console.error);