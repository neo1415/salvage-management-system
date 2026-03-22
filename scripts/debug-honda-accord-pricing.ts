/**
 * Debug script to investigate Honda Accord 2022 pricing bug
 * 
 * Issue: Serper API returns 10 results but system logs "no results"
 * Expected: ~₦8-12 million (Nigerian market)
 * Actual: ₦4,160,000 (incorrect fallback)
 */

import 'dotenv/config';
import { serperApi } from '@/lib/integrations/serper-api';
import { queryBuilder } from '@/features/internet-search/services/query-builder.service';
import { priceExtractor } from '@/features/internet-search/services/price-extraction.service';
import { internetSearchService } from '@/features/internet-search/services/internet-search.service';
import type { ItemIdentifier } from '@/features/internet-search/services/query-builder.service';

async function debugHondaAccordPricing() {
  console.log('🔍 DEBUGGING HONDA ACCORD 2022 PRICING BUG\n');
  console.log('=' .repeat(80));
  
  // Test case: Honda Accord 2022 tokunbo
  const vehicleItem: ItemIdentifier = {
    type: 'vehicle',
    make: 'Honda',
    model: 'Accord',
    year: 2022,
    condition: 'Foreign Used (Tokunbo)'
  };
  
  console.log('\n📋 Test Vehicle:', vehicleItem);
  
  // Step 1: Build query
  console.log('\n' + '='.repeat(80));
  console.log('STEP 1: QUERY BUILDING');
  console.log('='.repeat(80));
  
  const query = queryBuilder.buildMarketQuery(vehicleItem);
  console.log('Query built:', query);
  
  // Step 2: Call Serper API directly
  console.log('\n' + '='.repeat(80));
  console.log('STEP 2: SERPER API CALL');
  console.log('='.repeat(80));
  
  const serperResults = await serperApi.search(query, { num: 15 });
  
  console.log('\nSerper API Response:');
  console.log('- Success:', serperResults.success);
  console.log('- Result count:', serperResults.organic?.length || 0);
  console.log('- Search information:', serperResults.searchInformation);
  
  if (serperResults.organic && serperResults.organic.length > 0) {
    console.log('\n📄 First 3 Results:');
    serperResults.organic.slice(0, 3).forEach((result, index) => {
      console.log(`\n  Result ${index + 1}:`);
      console.log(`  - Title: ${result.title}`);
      console.log(`  - Link: ${result.link}`);
      console.log(`  - Snippet: ${result.snippet.substring(0, 150)}...`);
      if (result.price) {
        console.log(`  - Structured Price: ${result.currency} ${result.price}`);
      }
    });
  }
  
  // Step 3: Extract prices
  console.log('\n' + '='.repeat(80));
  console.log('STEP 3: PRICE EXTRACTION');
  console.log('='.repeat(80));
  
  let extractionResult;
  if (serperResults.organic && serperResults.organic.length > 0) {
    extractionResult = priceExtractor.extractPrices(serperResults.organic, 'vehicle');
    
    console.log('\nPrice Extraction Result:');
    console.log('- Prices extracted:', extractionResult.prices.length);
    console.log('- Average price:', extractionResult.averagePrice?.toLocaleString());
    console.log('- Median price:', extractionResult.medianPrice?.toLocaleString());
    console.log('- Confidence:', extractionResult.confidence);
    
    if (extractionResult.prices.length > 0) {
      console.log('\n💰 Extracted Prices:');
      extractionResult.prices.forEach((price, index) => {
        console.log(`\n  Price ${index + 1}:`);
        console.log(`  - Amount: ₦${price.price.toLocaleString()}`);
        console.log(`  - Original text: ${price.originalText}`);
        console.log(`  - Confidence: ${price.confidence}%`);
        console.log(`  - Source: ${price.source}`);
        console.log(`  - Title: ${price.title.substring(0, 80)}...`);
      });
    } else {
      console.log('\n❌ NO PRICES EXTRACTED!');
      console.log('\n🔍 Analyzing why prices were not extracted...');
      
      // Check each result for price patterns
      console.log('\n📊 Manual Price Pattern Analysis:');
      serperResults.organic.slice(0, 5).forEach((result, index) => {
        console.log(`\n  Result ${index + 1}:`);
        console.log(`  Title: ${result.title}`);
        console.log(`  Snippet: ${result.snippet}`);
        
        // Check for Naira symbols
        const hasNairaSymbol = result.snippet.includes('₦') || result.title.includes('₦');
        const hasNGN = result.snippet.includes('NGN') || result.title.includes('NGN');
        const hasNairaWord = /naira/i.test(result.snippet) || /naira/i.test(result.title);
        const hasMillionK = /\d+[mk]/i.test(result.snippet) || /\d+[mk]/i.test(result.title);
        
        console.log(`  - Has ₦ symbol: ${hasNairaSymbol}`);
        console.log(`  - Has NGN: ${hasNGN}`);
        console.log(`  - Has "naira": ${hasNairaWord}`);
        console.log(`  - Has million/k: ${hasMillionK}`);
        
        if (result.price) {
          console.log(`  - Structured price: ${result.currency} ${result.price}`);
        }
      });
    }
  }
  
  // Step 4: Call full internet search service
  console.log('\n' + '='.repeat(80));
  console.log('STEP 4: FULL INTERNET SEARCH SERVICE');
  console.log('='.repeat(80));
  
  const searchResult = await internetSearchService.searchMarketPrice({
    item: vehicleItem,
    maxResults: 15,
    timeout: 5000
  });
  
  console.log('\nInternet Search Service Result:');
  console.log('- Success:', searchResult.success);
  console.log('- Prices found:', searchResult.priceData.prices.length);
  console.log('- Average price:', searchResult.priceData.averagePrice?.toLocaleString());
  console.log('- Confidence:', searchResult.priceData.confidence);
  console.log('- Results processed:', searchResult.resultsProcessed);
  
  // Step 5: Compare with part search (which works)
  console.log('\n' + '='.repeat(80));
  console.log('STEP 5: PART SEARCH COMPARISON (WORKING)');
  console.log('='.repeat(80));
  
  const partResult = await internetSearchService.searchPartPrice({
    item: vehicleItem,
    partName: 'bumper',
    maxResults: 10,
    timeout: 3000
  });
  
  console.log('\nPart Search Result (bumper):');
  console.log('- Success:', partResult.success);
  console.log('- Prices found:', partResult.priceData.prices.length);
  console.log('- Average price:', partResult.priceData.averagePrice?.toLocaleString());
  console.log('- Confidence:', partResult.priceData.confidence);
  
  if (partResult.priceData.prices.length > 0) {
    console.log('\n💰 Part Prices (first 3):');
    partResult.priceData.prices.slice(0, 3).forEach((price, index) => {
      console.log(`  ${index + 1}. ₦${price.price.toLocaleString()} - ${price.originalText}`);
    });
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`\n✅ Serper returned: ${serperResults.organic?.length || 0} results`);
  console.log(`❌ Prices extracted: ${extractionResult?.prices.length || 0} prices`);
  console.log(`${partResult.success ? '✅' : '❌'} Part search: ${partResult.priceData.prices.length} prices`);
  console.log('\n🔍 ROOT CAUSE: Vehicle search fails price extraction, part search succeeds');
  console.log('   This suggests the issue is in how vehicle search results are formatted');
  console.log('   or how the price extraction patterns match vehicle listings vs part listings');
}

// Run the debug script
debugHondaAccordPricing()
  .then(() => {
    console.log('\n✅ Debug complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Debug failed:', error);
    process.exit(1);
  });
