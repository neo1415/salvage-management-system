#!/usr/bin/env tsx

import { config } from 'dotenv';
config();

import { PriceExtractionService } from '@/features/internet-search/services/price-extraction.service';

async function testPriceExtraction() {
  console.log('🧪 Testing Price Extraction Service...\n');

  const priceExtractor = new PriceExtractionService();

  // Test with real search results from Serper
  const mockResults = [
    {
      title: "Toyota Camry 2014 Gray",
      snippet: "Toyota Camry 2014 Gray. ₦ 11,200,000. Toyota Camry 2014 Gray ; Toyota Camry XLE 4dr Sedan (2.5L 4cyl 6A) 2012 Silver. ₦ 15,200,000. Toyota Camry XLE 4dr Sedan",
      link: "https://jiji.ng/cars/toyota-camry"
    },
    {
      title: "2008 Toyota Camry",
      snippet: "2008 Toyota Camry. local. 80K miles. 6-cylinder. 3.0. ₦ 7,000,000. ,. ₦ 558,626 / Mo. 40% Down payment. Contact Seller. Apply for loan. Toyota Camry.",
      link: "https://autochek.africa/ng/cars-for-sale/toyota/camry"
    },
    {
      title: "Toyota Camry for sale in Nigeria",
      snippet: "cars45.com ✓ Toyota Camry for sale ❤ Verified Toyota Camry and sellers in Nigeria ➔ The best offer on the market!",
      link: "https://www.cars45.com/listing/toyota/camry"
    }
  ];

  console.log('📋 Test Data:');
  mockResults.forEach((result, index) => {
    console.log(`  ${index + 1}. ${result.title}`);
    console.log(`     Snippet: ${result.snippet}`);
    console.log(`     URL: ${result.link}`);
    console.log('');
  });

  try {
    console.log('🔍 Extracting prices...');
    
    const result = priceExtractor.extractPrices(mockResults, 'vehicle');

    console.log('✅ Extraction Result:', {
      pricesFound: result.prices.length,
      averagePrice: result.averagePrice,
      medianPrice: result.medianPrice,
      priceRange: result.priceRange,
      confidence: result.confidence,
      currency: result.currency
    });

    if (result.prices.length > 0) {
      console.log('\n💰 Extracted Prices:');
      result.prices.forEach((price, index) => {
        console.log(`  ${index + 1}. ₦${price.price.toLocaleString()} (${price.confidence}% confidence)`);
        console.log(`     Original: "${price.originalText}"`);
        console.log(`     Source: ${price.source}`);
        console.log('');
      });
    } else {
      console.log('\n❌ No prices extracted!');
    }

  } catch (error) {
    console.error('❌ Price extraction failed:', error);
  }
}

testPriceExtraction().catch(console.error);