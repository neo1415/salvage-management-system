#!/usr/bin/env tsx

import { config } from 'dotenv';
config();

import { assessDamageEnhanced } from '../src/features/cases/services/ai-assessment-enhanced.service';

async function testIPhoneStoragePricing() {
  console.log('🧪 Testing iPhone Storage Capacity Pricing Differences...\n');

  // Test iPhone 17 Pro Max with different storage capacities
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
      name: 'iPhone 17 Pro Max 256GB',
      universalItemInfo: {
        type: 'electronics' as const,
        condition: 'Brand New' as const,
        brand: 'Apple',
        model: 'iPhone 17 Pro Max',
        storageCapacity: '256GB',
        brandPrestige: 'luxury' as const
      }
    },
    {
      name: 'iPhone 17 Pro Max 512GB',
      universalItemInfo: {
        type: 'electronics' as const,
        condition: 'Brand New' as const,
        brand: 'Apple',
        model: 'iPhone 17 Pro Max',
        storageCapacity: '512GB',
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
    const uniqueSalvageValues = [...new Set(validResults.map(r => r.salvageValue))];
    
    if (uniqueMarketValues.length === 1) {
      console.log('⚠️  ALL STORAGE CAPACITIES HAVE THE SAME MARKET VALUE!');
      console.log(`   This suggests storage capacity is not being used in pricing.`);
    } else {
      console.log('✅ Different storage capacities have different market values.');
    }
    
    if (uniqueSalvageValues.length === 1) {
      console.log('⚠️  ALL STORAGE CAPACITIES HAVE THE SAME SALVAGE VALUE!');
    } else {
      console.log('✅ Different storage capacities have different salvage values.');
    }

    // Show price differences
    const minMarket = Math.min(...validResults.map(r => r.marketValue));
    const maxMarket = Math.max(...validResults.map(r => r.marketValue));
    const priceDifference = maxMarket - minMarket;
    
    console.log(`\n💰 Price Range:`);
    console.log(`   Lowest: ₦${minMarket.toLocaleString()}`);
    console.log(`   Highest: ₦${maxMarket.toLocaleString()}`);
    console.log(`   Difference: ₦${priceDifference.toLocaleString()}`);
    
    if (priceDifference === 0) {
      console.log('\n🚨 ISSUE CONFIRMED: Storage capacity parameter is not affecting pricing!');
    } else {
      console.log('\n✅ Storage capacity parameter is properly affecting pricing.');
    }
  }
}

testIPhoneStoragePricing().catch(console.error);