#!/usr/bin/env tsx

import { config } from 'dotenv';
config();

import { assessDamageEnhanced } from '../src/features/cases/services/ai-assessment-enhanced.service';
import { InternetSearchService } from '../src/features/internet-search/services/internet-search.service';

async function testIPhoneStorageWithoutCache() {
  console.log('🧪 Testing iPhone Storage Capacity Pricing (Cache Cleared)...\n');

  // Clear cache first
  const internetSearchService = new InternetSearchService();
  await internetSearchService.clearCache();
  console.log('🗑️ Cache cleared\n');

  // Test only two different storage capacities to see if they get different results
  const testCases = [
    {
      name: 'iPhone 17 Pro Max 128GB',
      universalItemInfo: {
        type: 'electronics' as const,
        condition: 'Brand New' as const,
        brand: 'Apple',
        model: 'iPhone 17 Pro Max',
        storageCapacity: '128GB',
        brandPrestige: 'luxury' as const
      }
    },
    {
      name: 'iPhone 17 Pro Max 1TB',
      universalItemInfo: {
        type: 'electronics' as const,
        condition: 'Brand New' as const,
        brand: 'Apple',
        model: 'iPhone 17 Pro Max',
        storageCapacity: '1TB',
        brandPrestige: 'luxury' as const
      }
    }
  ];

  const photos = [
    'https://res.cloudinary.com/test/image/upload/v1/test1.jpg',
    'https://res.cloudinary.com/test/image/upload/v1/test2.jpg',
    'https://res.cloudinary.com/test/image/upload/v1/test3.jpg'
  ];

  const results = [];

  for (const testCase of testCases) {
    console.log(`📱 Testing ${testCase.name}...`);
    console.log(`Storage: ${testCase.universalItemInfo.storageCapacity}`);
    
    try {
      const result = await assessDamageEnhanced({
        photos,
        universalItemInfo: testCase.universalItemInfo
      });

      results.push({
        name: testCase.name,
        storage: testCase.universalItemInfo.storageCapacity,
        marketValue: result.marketValue,
        salvageValue: result.estimatedSalvageValue,
        priceSource: result.priceSource,
        confidence: result.confidence?.overall || 0
      });

      console.log(`✅ Market Value: ₦${result.marketValue?.toLocaleString()}`);
      console.log(`✅ Salvage Value: ₦${result.estimatedSalvageValue?.toLocaleString()}`);
      console.log(`✅ Price Source: ${result.priceSource}`);
      console.log(`✅ Confidence: ${result.confidence?.overall}%\n`);

      // Add delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(`❌ Error testing ${testCase.name}:`, error);
      results.push({
        name: testCase.name,
        storage: testCase.universalItemInfo.storageCapacity,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Compare results
  console.log('\n📊 PRICING COMPARISON SUMMARY:');
  console.log('=' .repeat(80));
  
  results.forEach(result => {
    if ('error' in result) {
      console.log(`❌ ${result.name}: ERROR - ${result.error}`);
    } else {
      console.log(`📱 ${result.name}:`);
      console.log(`   Storage: ${result.storage}`);
      console.log(`   Market Value: ₦${result.marketValue?.toLocaleString()}`);
      console.log(`   Salvage Value: ₦${result.salvageValue?.toLocaleString()}`);
      console.log(`   Price Source: ${result.priceSource}`);
      console.log(`   Confidence: ${result.confidence}%`);
      console.log('');
    }
  });

  // Analysis
  const validResults = results.filter(r => !('error' in r)) as any[];
  if (validResults.length > 1) {
    console.log('\n🔍 ANALYSIS:');
    console.log('=' .repeat(50));
    
    const uniqueMarketValues = [...new Set(validResults.map(r => r.marketValue))];
    
    if (uniqueMarketValues.length === 1) {
      console.log('⚠️  BOTH STORAGE CAPACITIES HAVE THE SAME MARKET VALUE!');
      console.log(`   This confirms storage capacity is not affecting pricing.`);
    } else {
      console.log('✅ Different storage capacities have different market values.');
      
      const minMarket = Math.min(...validResults.map(r => r.marketValue));
      const maxMarket = Math.max(...validResults.map(r => r.marketValue));
      const priceDifference = maxMarket - minMarket;
      
      console.log(`\n💰 Price Range:`);
      console.log(`   128GB: ₦${validResults.find(r => r.storage === '128GB')?.marketValue.toLocaleString()}`);
      console.log(`   1TB: ₦${validResults.find(r => r.storage === '1TB')?.marketValue.toLocaleString()}`);
      console.log(`   Difference: ₦${priceDifference.toLocaleString()}`);
    }
  }
}

testIPhoneStorageWithoutCache().catch(console.error);