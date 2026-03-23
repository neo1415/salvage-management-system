#!/usr/bin/env tsx

/**
 * Performance Testing Script for Multiple Part Search Optimizations
 * 
 * This script tests the performance improvements for multiple part searches
 * in the Universal AI Internet Search System, specifically for Task 8.8.
 */

import { internetSearchService } from '@/features/internet-search/services/internet-search.service';
import type { ItemIdentifier } from '@/features/internet-search/services/query-builder.service';

interface PerformanceTestResult {
  testName: string;
  partsCount: number;
  totalTime: number;
  averageTimePerPart: number;
  successfulSearches: number;
  cacheHits: number;
  apiCalls: number;
  averageConfidence: number;
  withinPerformanceTarget: boolean;
}

/**
 * Test multiple part search performance with various scenarios
 */
async function testMultiplePartSearchPerformance(): Promise<void> {
  console.log('🚀 Starting Multiple Part Search Performance Tests');
  console.log('=' .repeat(60));

  const testResults: PerformanceTestResult[] = [];

  // Test Case 1: Small batch (2-3 parts) - typical damage scenario
  console.log('\n📊 Test 1: Small Batch Performance (2-3 parts)');
  const smallBatchResult = await runPerformanceTest(
    'Small Batch (2-3 parts)',
    {
      type: 'vehicle',
      make: 'Toyota',
      model: 'Camry',
      year: 2021
    },
    [
      { name: 'front bumper', damageType: 'moderate' },
      { name: 'headlight', damageType: 'minor' },
      { name: 'windshield', damageType: 'severe' }
    ],
    {
      concurrencyLimit: 2,
      enableBatching: false, // No batching needed for small sets
      prioritizeCommonParts: true,
      timeout: 2000
    }
  );
  testResults.push(smallBatchResult);

  // Test Case 2: Medium batch (4-6 parts) - moderate damage scenario
  console.log('\n📊 Test 2: Medium Batch Performance (4-6 parts)');
  const mediumBatchResult = await runPerformanceTest(
    'Medium Batch (4-6 parts)',
    {
      type: 'vehicle',
      make: 'Honda',
      model: 'Accord',
      year: 2020
    },
    [
      { name: 'front bumper', damageType: 'severe' },
      { name: 'rear bumper', damageType: 'moderate' },
      { name: 'headlight', damageType: 'minor' },
      { name: 'taillight', damageType: 'minor' },
      { name: 'side mirror', damageType: 'moderate' },
      { name: 'door panel', damageType: 'severe' }
    ],
    {
      concurrencyLimit: 3,
      enableBatching: true,
      prioritizeCommonParts: true,
      timeout: 1500
    }
  );
  testResults.push(mediumBatchResult);

  // Test Case 3: Large batch (7-10 parts) - extensive damage scenario
  console.log('\n📊 Test 3: Large Batch Performance (7-10 parts)');
  const largeBatchResult = await runPerformanceTest(
    'Large Batch (7-10 parts)',
    {
      type: 'vehicle',
      make: 'Lexus',
      model: 'ES350',
      year: 2019
    },
    [
      { name: 'front bumper', damageType: 'severe' },
      { name: 'rear bumper', damageType: 'moderate' },
      { name: 'hood', damageType: 'severe' },
      { name: 'trunk', damageType: 'moderate' },
      { name: 'headlight', damageType: 'severe' },
      { name: 'taillight', damageType: 'minor' },
      { name: 'windshield', damageType: 'severe' },
      { name: 'side mirror', damageType: 'moderate' },
      { name: 'door panel', damageType: 'severe' },
      { name: 'fender', damageType: 'moderate' }
    ],
    {
      concurrencyLimit: 3,
      enableBatching: true,
      prioritizeCommonParts: true,
      timeout: 1500
    }
  );
  testResults.push(largeBatchResult);

  // Test Case 4: Cache performance test (repeat previous search)
  console.log('\n📊 Test 4: Cache Performance (Repeat Search)');
  const cacheTestResult = await runPerformanceTest(
    'Cache Performance Test',
    {
      type: 'vehicle',
      make: 'Toyota',
      model: 'Camry',
      year: 2021
    },
    [
      { name: 'front bumper', damageType: 'moderate' },
      { name: 'headlight', damageType: 'minor' },
      { name: 'windshield', damageType: 'severe' }
    ],
    {
      concurrencyLimit: 2,
      enableBatching: false,
      prioritizeCommonParts: true,
      timeout: 2000
    }
  );
  testResults.push(cacheTestResult);

  // Test Case 5: Concurrency stress test
  console.log('\n📊 Test 5: Concurrency Stress Test');
  const concurrencyTestResult = await runConcurrencyStressTest();
  testResults.push(concurrencyTestResult);

  // Display comprehensive results
  displayPerformanceResults(testResults);

  // Test health check
  console.log('\n🏥 Testing Internet Search Service Health');
  await testServiceHealth();

  console.log('\n✅ Performance testing completed!');
}

/**
 * Run a single performance test
 */
async function runPerformanceTest(
  testName: string,
  item: ItemIdentifier,
  parts: Array<{ name: string; damageType?: string }>,
  options: any
): Promise<PerformanceTestResult> {
  const startTime = Date.now();
  
  try {
    console.log(`   🔍 Searching for ${parts.length} parts...`);
    
    const results = await internetSearchService.searchMultiplePartPrices(
      item,
      parts,
      options
    );

    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const averageTimePerPart = totalTime / parts.length;
    const successfulSearches = results.filter(r => r.success).length;
    const cacheHits = results.filter(r => r.resultsProcessed === 0).length;
    const apiCalls = results.length - cacheHits;
    
    const confidences = results
      .filter(r => r.success)
      .map(r => r.priceData.confidence);
    const averageConfidence = confidences.length > 0 
      ? confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length 
      : 0;

    const withinPerformanceTarget = totalTime < 2000; // < 2 seconds requirement

    console.log(`   ⏱️  Total time: ${totalTime}ms`);
    console.log(`   📈 Success rate: ${successfulSearches}/${parts.length} (${Math.round(successfulSearches/parts.length*100)}%)`);
    console.log(`   🎯 Cache hits: ${cacheHits}, API calls: ${apiCalls}`);
    console.log(`   📊 Average confidence: ${Math.round(averageConfidence)}%`);
    console.log(`   ✅ Performance target met: ${withinPerformanceTarget ? 'YES' : 'NO'}`);

    return {
      testName,
      partsCount: parts.length,
      totalTime,
      averageTimePerPart,
      successfulSearches,
      cacheHits,
      apiCalls,
      averageConfidence,
      withinPerformanceTarget
    };

  } catch (error) {
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    console.log(`   ❌ Test failed: ${error}`);
    
    return {
      testName,
      partsCount: parts.length,
      totalTime,
      averageTimePerPart: totalTime / parts.length,
      successfulSearches: 0,
      cacheHits: 0,
      apiCalls: 0,
      averageConfidence: 0,
      withinPerformanceTarget: false
    };
  }
}

/**
 * Run concurrency stress test
 */
async function runConcurrencyStressTest(): Promise<PerformanceTestResult> {
  console.log('   🔥 Running concurrent searches...');
  
  const startTime = Date.now();
  
  // Run multiple searches concurrently to test system under load
  const concurrentSearches = [
    internetSearchService.searchMultiplePartPrices(
      { type: 'vehicle', make: 'Toyota', model: 'Corolla', year: 2020 },
      [{ name: 'bumper', damageType: 'moderate' }, { name: 'headlight', damageType: 'minor' }],
      { concurrencyLimit: 2, timeout: 1500 }
    ),
    internetSearchService.searchMultiplePartPrices(
      { type: 'vehicle', make: 'Honda', model: 'Civic', year: 2021 },
      [{ name: 'windshield', damageType: 'severe' }, { name: 'door', damageType: 'moderate' }],
      { concurrencyLimit: 2, timeout: 1500 }
    ),
    internetSearchService.searchMultiplePartPrices(
      { type: 'vehicle', make: 'Nissan', model: 'Altima', year: 2019 },
      [{ name: 'fender', damageType: 'minor' }, { name: 'mirror', damageType: 'moderate' }],
      { concurrencyLimit: 2, timeout: 1500 }
    )
  ];

  try {
    const results = await Promise.all(concurrentSearches);
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    const allResults = results.flat();
    const successfulSearches = allResults.filter(r => r.success).length;
    const totalParts = allResults.length;
    
    console.log(`   ⏱️  Concurrent execution time: ${totalTime}ms`);
    console.log(`   📈 Overall success rate: ${successfulSearches}/${totalParts}`);
    
    return {
      testName: 'Concurrency Stress Test',
      partsCount: totalParts,
      totalTime,
      averageTimePerPart: totalTime / totalParts,
      successfulSearches,
      cacheHits: 0, // Not tracked in this test
      apiCalls: totalParts,
      averageConfidence: 0, // Not calculated in this test
      withinPerformanceTarget: totalTime < 3000 // More lenient for concurrent test
    };
    
  } catch (error) {
    console.log(`   ❌ Concurrency test failed: ${error}`);
    
    return {
      testName: 'Concurrency Stress Test',
      partsCount: 6,
      totalTime: Date.now() - startTime,
      averageTimePerPart: 0,
      successfulSearches: 0,
      cacheHits: 0,
      apiCalls: 0,
      averageConfidence: 0,
      withinPerformanceTarget: false
    };
  }
}

/**
 * Display comprehensive performance results
 */
function displayPerformanceResults(results: PerformanceTestResult[]): void {
  console.log('\n📋 PERFORMANCE TEST SUMMARY');
  console.log('=' .repeat(80));
  
  console.log('| Test Name                    | Parts | Time(ms) | Avg/Part | Success | Cache | Target |');
  console.log('|------------------------------|-------|----------|----------|---------|-------|--------|');
  
  results.forEach(result => {
    const name = result.testName.padEnd(28);
    const parts = result.partsCount.toString().padStart(5);
    const time = result.totalTime.toString().padStart(8);
    const avgTime = Math.round(result.averageTimePerPart).toString().padStart(8);
    const success = `${result.successfulSearches}/${result.partsCount}`.padStart(7);
    const cache = result.cacheHits.toString().padStart(5);
    const target = (result.withinPerformanceTarget ? '✅' : '❌').padStart(6);
    
    console.log(`| ${name} | ${parts} | ${time} | ${avgTime} | ${success} | ${cache} | ${target} |`);
  });
  
  console.log('=' .repeat(80));
  
  // Calculate overall statistics
  const totalTests = results.length;
  const passedTests = results.filter(r => r.withinPerformanceTarget).length;
  const averageTime = results.reduce((sum, r) => sum + r.totalTime, 0) / totalTests;
  const totalSuccessRate = results.reduce((sum, r) => sum + (r.successfulSearches / r.partsCount), 0) / totalTests;
  
  console.log(`\n📊 OVERALL PERFORMANCE METRICS:`);
  console.log(`   Tests passed: ${passedTests}/${totalTests} (${Math.round(passedTests/totalTests*100)}%)`);
  console.log(`   Average execution time: ${Math.round(averageTime)}ms`);
  console.log(`   Average success rate: ${Math.round(totalSuccessRate*100)}%`);
  console.log(`   Performance target (<2s): ${passedTests >= totalTests * 0.8 ? '✅ MET' : '❌ NOT MET'}`);
}

/**
 * Test service health
 */
async function testServiceHealth(): Promise<void> {
  try {
    const healthResult = await internetSearchService.healthCheck();
    
    console.log(`   Status: ${healthResult.status}`);
    console.log(`   API Status: ${healthResult.apiStatus ? '✅ Online' : '❌ Offline'}`);
    console.log(`   Response Time: ${healthResult.responseTime}ms`);
    
    if (healthResult.error) {
      console.log(`   Error: ${healthResult.error}`);
    }
    
    // Get performance statistics
    const stats = internetSearchService.getPerformanceStats();
    console.log(`   Total Searches: ${stats.totalSearches}`);
    console.log(`   Success Rate: ${Math.round((stats.successfulSearches / stats.totalSearches) * 100)}%`);
    console.log(`   Average Response Time: ${Math.round(stats.averageResponseTime)}ms`);
    console.log(`   Cache Hit Rate: ${Math.round(stats.cacheHitRate)}%`);
    
  } catch (error) {
    console.log(`   ❌ Health check failed: ${error}`);
  }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  try {
    await testMultiplePartSearchPerformance();
  } catch (error) {
    console.error('❌ Performance testing failed:', error);
    process.exit(1);
  }
}

// Run the performance tests
if (require.main === module) {
  main().catch(console.error);
}

export { testMultiplePartSearchPerformance };