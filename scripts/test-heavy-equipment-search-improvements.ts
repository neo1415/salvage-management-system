/**
 * Test Script: Heavy Equipment Search Query Improvements
 * 
 * This script tests the improvements made to the search query strategy
 * for heavy equipment pricing in Nigeria, specifically for CAT 320 excavators.
 * 
 * Expected improvements:
 * 1. Prioritize Nigerian marketplaces (Jiji.ng, Cheki.ng)
 * 2. Better query structure with site: operators
 * 3. Improved price extraction for Jiji.ng format (₦ 120,000,000)
 * 4. Increased num parameter (15 instead of 10)
 * 5. Detailed logging of queries and price sources
 */

import { internetSearchService } from '@/features/internet-search/services/internet-search.service';
import type { MachineryIdentifier } from '@/features/internet-search/services/query-builder.service';

async function testHeavyEquipmentSearch() {
  console.log('='.repeat(80));
  console.log('TESTING HEAVY EQUIPMENT SEARCH IMPROVEMENTS');
  console.log('='.repeat(80));
  console.log();

  // Test Case 1: CAT 320 Foreign Used (the problematic case from the issue)
  console.log('TEST CASE 1: CAT 320 2022 Foreign Used Excavator');
  console.log('-'.repeat(80));
  
  const cat320: MachineryIdentifier = {
    type: 'machinery',
    brand: 'Caterpillar',
    machineryType: 'excavator',
    model: 'CAT 320',
    year: 2022,
    condition: 'Foreign Used (Tokunbo)'
  };

  try {
    const result = await internetSearchService.searchMarketPrice({
      item: cat320,
      maxResults: 15, // Should be default for machinery now
      timeout: 5000
    });

    console.log();
    console.log('SEARCH RESULTS:');
    console.log('-'.repeat(80));
    console.log(`Query Used: "${result.query}"`);
    console.log(`Results Processed: ${result.resultsProcessed}`);
    console.log(`Execution Time: ${result.executionTime}ms`);
    console.log(`Success: ${result.success}`);
    console.log();

    if (result.success && result.priceData.prices.length > 0) {
      console.log('EXTRACTED PRICES:');
      console.log('-'.repeat(80));
      
      result.priceData.prices.forEach((price, index) => {
        console.log(`${index + 1}. ₦${price.price.toLocaleString()}`);
        console.log(`   Source: ${price.source}`);
        console.log(`   Original Text: ${price.originalText}`);
        console.log(`   Confidence: ${price.confidence}%`);
        console.log(`   URL: ${price.url}`);
        console.log();
      });

      console.log('PRICE STATISTICS:');
      console.log('-'.repeat(80));
      console.log(`Average Price: ₦${result.priceData.averagePrice?.toLocaleString() || 'N/A'}`);
      console.log(`Median Price: ₦${result.priceData.medianPrice?.toLocaleString() || 'N/A'}`);
      console.log(`Price Range: ₦${result.priceData.priceRange?.min.toLocaleString()} - ₦${result.priceData.priceRange?.max.toLocaleString()}`);
      console.log(`Overall Confidence: ${result.priceData.confidence}%`);
      console.log();

      // Check if we're getting prices in the expected range (₦100M-₦130M)
      const expectedMin = 100_000_000; // ₦100M
      const expectedMax = 130_000_000; // ₦130M
      
      const pricesInRange = result.priceData.prices.filter(
        p => p.price >= expectedMin && p.price <= expectedMax
      );

      console.log('VALIDATION:');
      console.log('-'.repeat(80));
      console.log(`Expected Range: ₦${expectedMin.toLocaleString()} - ₦${expectedMax.toLocaleString()}`);
      console.log(`Prices in Expected Range: ${pricesInRange.length}/${result.priceData.prices.length}`);
      
      if (pricesInRange.length > 0) {
        console.log('✅ SUCCESS: Found prices in the expected range!');
      } else {
        console.log('⚠️  WARNING: No prices found in the expected range');
      }
      console.log();

      // Check if we're getting results from Nigerian marketplaces
      const nigerianMarketplaces = ['jiji.ng', 'cheki.ng', 'olx.ng'];
      const marketplacePrices = result.priceData.prices.filter(
        p => nigerianMarketplaces.some(marketplace => p.source.includes(marketplace))
      );

      console.log('MARKETPLACE ANALYSIS:');
      console.log('-'.repeat(80));
      console.log(`Prices from Nigerian Marketplaces: ${marketplacePrices.length}/${result.priceData.prices.length}`);
      
      if (marketplacePrices.length > 0) {
        console.log('✅ SUCCESS: Found prices from Nigerian marketplaces!');
        marketplacePrices.forEach(p => {
          console.log(`   - ${p.source}: ₦${p.price.toLocaleString()}`);
        });
      } else {
        console.log('⚠️  WARNING: No prices from Nigerian marketplaces found');
      }
      console.log();

    } else {
      console.log('❌ FAILED: No prices extracted');
      if (result.error) {
        console.log(`Error: ${result.error}`);
      }
    }

  } catch (error) {
    console.error('❌ TEST FAILED:', error);
  }

  console.log();
  console.log('='.repeat(80));
  console.log('TEST COMPLETE');
  console.log('='.repeat(80));
}

// Run the test
testHeavyEquipmentSearch()
  .then(() => {
    console.log('\n✅ Test script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test script failed:', error);
    process.exit(1);
  });
