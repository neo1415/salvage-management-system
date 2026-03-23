/**
 * Test script for Cache Integration Service
 */

import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

// Set the API key explicitly if needed
if (!process.env.SERPER_API_KEY) {
  process.env.SERPER_API_KEY = 'deaf9e2d081861f916db5db41e7c0001de699881';
}

import { internetSearchService } from '@/features/internet-search/services/internet-search.service';
import { cacheIntegrationService } from '@/features/internet-search/services/cache-integration.service';

async function testCacheIntegration() {
  console.log('🔄 Testing Cache Integration Service...\n');

  try {
    const testItem = {
      type: 'vehicle' as const,
      make: 'Toyota',
      model: 'Camry',
      year: 2021,
      condition: 'Foreign Used (Tokunbo)' as const
    };

    // Test 1: Clear cache and verify miss
    console.log('1. Testing cache miss (first search)...');
    await cacheIntegrationService.clearAllCache();
    
    const startTime1 = Date.now();
    const result1 = await internetSearchService.searchMarketPrice({
      item: testItem,
      maxResults: 3,
      timeout: 5000
    });
    const duration1 = Date.now() - startTime1;

    console.log('First Search Success:', result1.success);
    console.log('First Search Duration:', duration1, 'ms');
    console.log('Prices Found:', result1.priceData.prices.length);
    if (result1.priceData.averagePrice) {
      console.log('Average Price:', result1.priceData.averagePrice.toLocaleString(), 'NGN');
    }
    console.log('');

    // Test 2: Immediate second search should hit cache
    console.log('2. Testing cache hit (second search)...');
    
    const startTime2 = Date.now();
    const result2 = await internetSearchService.searchMarketPrice({
      item: testItem,
      maxResults: 3,
      timeout: 5000
    });
    const duration2 = Date.now() - startTime2;

    console.log('Second Search Success:', result2.success);
    console.log('Second Search Duration:', duration2, 'ms');
    console.log('Cache Speed Improvement:', Math.round(((duration1 - duration2) / duration1) * 100) + '%');
    console.log('');

    // Test 3: Cache metrics
    console.log('3. Testing cache metrics...');
    const cacheStats = await internetSearchService.getCacheStats();
    
    console.log('Cache Health:', cacheStats.cacheHealth);
    console.log('Total Hits:', cacheStats.metrics.totalHits);
    console.log('Total Misses:', cacheStats.metrics.totalMisses);
    console.log('Hit Rate:', cacheStats.metrics.hitRate + '%');
    console.log('Popular Queries:', cacheStats.popularQueries.length);
    
    if (cacheStats.popularQueries.length > 0) {
      console.log('Most Popular Query:', cacheStats.popularQueries[0].query);
      console.log('Query Hits:', cacheStats.popularQueries[0].hits);
    }
    console.log('');

    // Test 4: Part price caching
    console.log('4. Testing part price caching...');
    
    const partResult1 = await internetSearchService.searchPartPrice({
      item: testItem,
      partName: 'windshield',
      damageType: 'glass',
      maxResults: 3,
      timeout: 5000
    });

    console.log('Part Search Success:', partResult1.success);
    console.log('Part Name:', partResult1.partName);
    console.log('Part Prices Found:', partResult1.priceData.prices.length);
    
    // Second part search should be faster (cached)
    const partStartTime = Date.now();
    const partResult2 = await internetSearchService.searchPartPrice({
      item: testItem,
      partName: 'windshield',
      damageType: 'glass',
      maxResults: 3,
      timeout: 5000
    });
    const partDuration = Date.now() - partStartTime;
    
    console.log('Cached Part Search Duration:', partDuration, 'ms');
    console.log('');

    // Test 5: Cache warming
    console.log('5. Testing cache warming...');
    
    const popularItems = [
      {
        type: 'vehicle' as const,
        make: 'Honda',
        model: 'Accord',
        year: 2020,
        condition: 'Foreign Used (Tokunbo)' as const
      },
      {
        type: 'vehicle' as const,
        make: 'Lexus',
        model: 'ES',
        year: 2019,
        condition: 'Foreign Used (Tokunbo)' as const
      }
    ];

    await internetSearchService.warmCache(popularItems);
    console.log('Cache warming completed for', popularItems.length, 'items');
    console.log('');

    // Test 6: Performance stats
    console.log('6. Testing performance statistics...');
    const perfStats = internetSearchService.getPerformanceStats();
    
    console.log('Total Searches:', perfStats.totalSearches);
    console.log('Successful Searches:', perfStats.successfulSearches);
    console.log('Average Response Time:', Math.round(perfStats.averageResponseTime), 'ms');
    console.log('Cache Hit Rate:', perfStats.cacheHitRate.toFixed(1) + '%');
    console.log('Error Rate:', perfStats.errorRate.toFixed(1) + '%');
    console.log('Searches by Type:', perfStats.searchesByType);
    console.log('');

    console.log('✅ Cache Integration test completed successfully!');

  } catch (error) {
    console.error('❌ Cache Integration test failed:', error);
    process.exit(1);
  }
}

// Run the test
testCacheIntegration();