import { PriceExtractionService } from '../src/features/internet-search/services/price-extraction.service';

async function debugPriceExtraction() {
  console.log('🔍 Debugging Price Extraction...');
  
  const priceExtractor = new PriceExtractionService();
  
  // Test different price formats
  const testTexts = [
    'The new Lamborghini Revuelto costs ₦960,000 down payment',
    'Brand new Lamborghini Revuelto price is ₦450 million in Nigeria',
    'Lamborghini Revuelto 2023 - ₦450m',
    'Price: ₦450,000,000',
    'Cost: 450 million naira',
    'Starting from $300,000 USD',
    'Price range: ₦400m - ₦500m'
  ];
  
  console.log('\n📋 Testing Price Extraction Patterns:');
  
  testTexts.forEach((text, index) => {
    console.log(`\n--- Test ${index + 1}: "${text}" ---`);
    
    const mockResult = {
      title: 'Test Title',
      snippet: text,
      link: 'https://example.com'
    };
    
    const extracted = priceExtractor.extractPrices([mockResult], 'vehicle');
    console.log('Extracted:', extracted.prices.map(p => ({
      price: p.price,
      originalText: p.originalText,
      confidence: p.confidence
    })));
  });
}

debugPriceExtraction().catch(console.error);