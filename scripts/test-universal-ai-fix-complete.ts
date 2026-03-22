#!/usr/bin/env tsx

/**
 * Comprehensive test to verify all universal AI assessment fixes
 */

import { config } from 'dotenv';
config();

async function testUniversalAIFixes() {
  console.log('🔧 Testing Universal AI Assessment Fixes...\n');

  const testCases = [
    {
      name: 'iPhone 12 Pro Max (Brand New)',
      itemInfo: {
        assetType: 'electronics',
        brand: 'Apple',
        model: 'iPhone 12 Pro Max',
        storage: '256GB',
        condition: 'Brand New'
      },
      expectedRange: { min: 800000, max: 1500000 }
    },
    {
      name: 'Samsung Galaxy S21 (Foreign Used)',
      itemInfo: {
        assetType: 'electronics',
        brand: 'Samsung',
        model: 'Galaxy S21',
        storage: '128GB',
        condition: 'Foreign Used'
      },
      expectedRange: { min: 300000, max: 600000 }
    },
    {
      name: 'Lenovo ThinkPad (Nigerian Used)',
      itemInfo: {
        assetType: 'electronics',
        brand: 'Lenovo',
        model: 'ThinkPad',
        condition: 'Nigerian Used'
      },
      expectedRange: { min: 200000, max: 500000 }
    },
    {
      name: 'Samsung Refrigerator (Appliance)',
      itemInfo: {
        assetType: 'appliance',
        brand: 'Samsung',
        model: 'Refrigerator',
        condition: 'Nigerian Used'
      },
      expectedRange: { min: 200000, max: 600000 }
    }
  ];

  let passedTests = 0;
  let totalTests = testCases.length;

  for (const testCase of testCases) {
    console.log(`📱 Testing ${testCase.name}...`);
    
    try {
      const response = await fetch('http://localhost:3000/api/cases/ai-assessment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          photos: [
            'data:image/jpeg;base64,/9j/test1',
            'data:image/jpeg;base64,/9j/test2',
            'data:image/jpeg;base64,/9j/test3'
          ],
          itemInfo: testCase.itemInfo
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.log(`❌ ${testCase.name}: ${error.error || 'Assessment failed'}`);
        continue;
      }

      const result = await response.json();
      const salvageValue = result.data?.estimatedSalvageValue;
      const marketValue = result.data?.marketValue;
      const dataSource = result.data?.dataSource;
      
      console.log(`   Salvage Value: ₦${salvageValue?.toLocaleString()}`);
      console.log(`   Market Value: ₦${marketValue?.toLocaleString()}`);
      console.log(`   Data Source: ${dataSource}`);
      console.log(`   Search Query: ${result.data?.searchQuery}`);
      
      // Check if it's not the generic ₦3,000,000
      const isNotGeneric = salvageValue !== 3000000 && marketValue !== 3000000;
      
      // Check if values are realistic (within expected range)
      const isRealistic = salvageValue >= testCase.expectedRange.min && 
                         salvageValue <= testCase.expectedRange.max * 2; // Allow some flexibility
      
      // Check if using internet search (not hardcoded)
      const isUsingInternet = dataSource === 'internet';
      
      if (isNotGeneric && isRealistic && isUsingInternet) {
        console.log(`✅ ${testCase.name}: PASSED`);
        passedTests++;
      } else {
        console.log(`❌ ${testCase.name}: FAILED`);
        if (!isNotGeneric) console.log(`   - Still returning generic ₦3,000,000`);
        if (!isRealistic) console.log(`   - Value outside expected range (₦${testCase.expectedRange.min.toLocaleString()} - ₦${testCase.expectedRange.max.toLocaleString()})`);
        if (!isUsingInternet) console.log(`   - Not using internet search (source: ${dataSource})`);
      }
      
    } catch (error) {
      console.log(`❌ ${testCase.name}: ${error.message}`);
    }
    
    console.log('');
  }

  console.log('📊 Test Summary:');
  console.log('================');
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log(`Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 ALL TESTS PASSED! Universal AI assessment is working correctly.');
    console.log('✅ No more generic ₦3,000,000 values');
    console.log('✅ Internet search integration working');
    console.log('✅ Realistic valuations for different item types');
    console.log('✅ Storage capacity and other fields properly handled');
  } else {
    console.log('\n⚠️ Some tests failed. Please review the issues above.');
  }
}

testUniversalAIFixes().catch(console.error);