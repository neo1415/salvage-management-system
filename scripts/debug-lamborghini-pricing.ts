import { InternetSearchService } from '../src/features/internet-search/services/internet-search.service';
import { PriceExtractionService } from '../src/features/internet-search/services/price-extraction.service';

async function debugLamborghiniPricing() {
  console.log('🔍 Debugging Lamborghini Revuelto pricing...');
  
  const internetSearchService = new InternetSearchService();
  const priceExtractionService = new PriceExtractionService();
  
  const testItem = {
    type: 'vehicle' as const,
    make: 'Lamborghini',
    model: 'Revuelto',
    year: 2023,
    mileage: 50000,
    condition: 'excellent'
  };
  
  try {
    console.log('📋 Test Item:', testItem);
    
    // Test the internet search
    const result = await internetSearchService.searchMarketPrice({ item: testItem });
    console.log('🌐 Internet Search Result:', JSON.stringify(result, null, 2));
    
    // If we have search results, let's examine the raw data
    if (result && 'searchResults' in result) {
      console.log('\n📊 Raw Search Results Analysis:');
      result.searchResults?.forEach((searchResult: any, index: number) => {
        console.log(`\n--- Result ${index + 1} ---`);
        console.log('Title:', searchResult.title);
        console.log('Snippet:', searchResult.snippet);
        console.log('URL:', searchResult.link);
        
        // Try to extract prices from this specific result
        const extractedPrices = priceExtractionService.extractPrices([searchResult], testItem.type);
        console.log('Extracted Prices:', extractedPrices.prices);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugLamborghiniPricing().catch(console.error);