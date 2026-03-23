import { config } from 'dotenv';
config(); // Load environment variables

import { internetSearchService } from '../src/features/internet-search/services/internet-search.service';
import { queryBuilder } from '../src/features/internet-search/services/query-builder.service';
import { priceExtractor } from '../src/features/internet-search/services/price-extraction.service';
import { serperApi } from '../src/lib/integrations/serper-api';

async function debugLamborghiniLiveIssue() {
  console.log('🔍 Debugging Live Lamborghini Issue...');
  
  // Exact same item as in the logs
  const item = {
    type: 'vehicle' as const,
    make: 'Lamborghini',
    model: 'Revuelto',
    year: 2023,
    mileage: 50000,
    condition: 'excellent' as const
  };
  
  console.log('\n📋 Item Details:');
  console.log(JSON.stringify(item, null, 2));
  
  // Step 1: Test query building
  console.log('\n🔧 Step 1: Query Building');
  const query = queryBuilder.buildMarketQuery(item);
  console.log(`Generated query: "${query}"`);
  
  // Step 2: Test Serper API call
  console.log('\n🌐 Step 2: Serper API Call');
  try {
    const searchResults = await serperApi.search(query, { num: 15 });
    console.log('API Response:', {
      success: searchResults.success,
      resultCount: searchResults.organic?.length || 0,
      hasStructuredData: searchResults.organic?.some(r => r.price && r.currency) || false
    });
    
    if (searchResults.organic && searchResults.organic.length > 0) {
      console.log('\n📊 Raw Search Results:');
      searchResults.organic.forEach((result, index) => {
        console.log(`${index + 1}. ${result.title}`);
        console.log(`   Snippet: "${result.snippet}"`);
        if (result.price && result.currency) {
          console.log(`   Structured: ${result.currency} ${result.price}`);
        }
        console.log(`   URL: ${result.link}`);
        console.log('');
      });
      
      // Step 3: Test price extraction
      console.log('\n💰 Step 3: Price Extraction');
      
      // Log each result being processed
      console.log('\n🔍 Processing each search result:');
      searchResults.organic.forEach((result, index) => {
        console.log(`\n--- Processing Result ${index + 1} ---`);
        console.log(`Title: "${result.title}"`);
        console.log(`Snippet: "${result.snippet}"`);
        
        // Test extraction on this individual result
        const singleResultExtraction = priceExtractor.extractPrices([result], 'vehicle');
        if (singleResultExtraction.prices.length > 0) {
          singleResultExtraction.prices.forEach(price => {
            console.log(`  → Extracted: ₦${price.price.toLocaleString()} from "${price.originalText}"`);
          });
        } else {
          console.log('  → No prices extracted from this result');
        }
      });
      
      const extractedPrices = priceExtractor.extractPrices(searchResults.organic, 'vehicle');
      
      console.log('Extraction Results:');
      console.log(`- Total prices found: ${extractedPrices.prices.length}`);
      console.log(`- Average price: ₦${extractedPrices.averagePrice?.toLocaleString()}`);
      console.log(`- Median price: ₦${extractedPrices.medianPrice?.toLocaleString()}`);
      console.log(`- Confidence: ${extractedPrices.confidence}%`);
      
      console.log('\n📋 Individual Extracted Prices:');
      extractedPrices.prices.forEach((price, index) => {
        console.log(`${index + 1}. ₦${price.price.toLocaleString()}`);
        console.log(`   Original: ${price.originalText}`);
        console.log(`   Confidence: ${price.confidence}%`);
        console.log(`   Source: ${price.source}`);
        console.log('');
      });
      
      // Step 4: Test full internet search service
      console.log('\n🔄 Step 4: Full Internet Search Service');
      const searchResult = await internetSearchService.searchMarketPrice({
        item,
        maxResults: 15,
        timeout: 5000
      });
      
      console.log('Internet Search Service Result:');
      console.log(`- Success: ${searchResult.success}`);
      console.log(`- Prices found: ${searchResult.priceData.prices.length}`);
      console.log(`- Average price: ₦${searchResult.priceData.averagePrice?.toLocaleString()}`);
      console.log(`- Median price: ₦${searchResult.priceData.medianPrice?.toLocaleString()}`);
      console.log(`- Confidence: ${searchResult.priceData.confidence}%`);
      console.log(`- Execution time: ${searchResult.executionTime}ms`);
      
      // Check if there's a discrepancy
      if (extractedPrices.averagePrice !== searchResult.priceData.averagePrice) {
        console.log('\n⚠️ DISCREPANCY DETECTED!');
        console.log(`Direct extraction average: ₦${extractedPrices.averagePrice?.toLocaleString()}`);
        console.log(`Service result average: ₦${searchResult.priceData.averagePrice?.toLocaleString()}`);
      }
      
    } else {
      console.log('❌ No search results returned');
    }
    
  } catch (error) {
    console.error('❌ Error during debugging:', error);
  }
}

debugLamborghiniLiveIssue().catch(console.error);