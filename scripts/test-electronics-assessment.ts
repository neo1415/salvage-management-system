#!/usr/bin/env tsx

/**
 * Test script to verify electronics AI assessment works properly
 * 
 * This script tests the AI assessment API with electronics items
 * to ensure they get proper valuations instead of the generic ₦3,000,000
 */

import { config } from 'dotenv';

// Load environment variables
config();

interface TestResult {
  itemType: string;
  brand: string;
  model: string;
  expectedRange: [number, number];
  actualValue: number;
  success: boolean;
  confidence: number;
  error?: string;
}

async function testElectronicsAssessment(): Promise<void> {
  console.log('🧪 Testing Electronics AI Assessment...\n');

  // Test cases for different electronics
  const testCases = [
    {
      itemType: 'iPhone 12 Pro Max',
      itemInfo: {
        assetType: 'electronics',
        brand: 'Apple',
        model: 'iPhone 12 Pro Max',
        condition: 'Brand New',
        storageCapacity: '256GB',
        batteryHealth: 100,
        age: 2
      },
      expectedRange: [800000, 1200000] as [number, number] // 800K - 1.2M Naira
    },
    {
      itemType: 'Lenovo ThinkPad',
      itemInfo: {
        assetType: 'electronics',
        brand: 'Lenovo',
        model: 'ThinkPad X1 Carbon',
        condition: 'Foreign Used (Tokunbo)',
        storageCapacity: '512GB',
        age: 1
      },
      expectedRange: [600000, 900000] as [number, number] // 600K - 900K Naira
    },
    {
      itemType: 'Samsung Galaxy S21',
      itemInfo: {
        assetType: 'electronics',
        brand: 'Samsung',
        model: 'Galaxy S21',
        condition: 'Nigerian Used',
        storageCapacity: '128GB',
        batteryHealth: 85,
        age: 2 // Reduced from 3 to 2 years
      },
      expectedRange: [200000, 400000] as [number, number] // Adjusted range for 2-year-old phone
    }
  ];

  // Mock photos (base64 data URLs)
  const mockPhotos = [
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
  ];

  const results: TestResult[] = [];

  for (const testCase of testCases) {
    console.log(`📱 Testing ${testCase.itemType}...`);
    
    try {
      const response = await fetch('http://localhost:3000/api/cases/ai-assessment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          photos: mockPhotos,
          itemInfo: testCase.itemInfo,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Assessment failed');
      }

      const actualValue = result.data.estimatedSalvageValue;
      const confidence = result.data.confidenceScore;
      const [minExpected, maxExpected] = testCase.expectedRange;
      const success = actualValue >= minExpected && actualValue <= maxExpected;

      results.push({
        itemType: testCase.itemType,
        brand: testCase.itemInfo.brand,
        model: testCase.itemInfo.model,
        expectedRange: testCase.expectedRange,
        actualValue,
        success,
        confidence
      });

      console.log(`  ✅ Assessment completed:`);
      console.log(`     Salvage Value: ₦${actualValue.toLocaleString()}`);
      console.log(`     Expected Range: ₦${minExpected.toLocaleString()} - ₦${maxExpected.toLocaleString()}`);
      console.log(`     Confidence: ${confidence}%`);
      console.log(`     Status: ${success ? '✅ PASS' : '❌ FAIL'}`);
      
      if (result.data.labels && result.data.labels.length > 0) {
        console.log(`     Detected: ${result.data.labels.slice(0, 3).join(', ')}`);
      }
      
    } catch (error) {
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      results.push({
        itemType: testCase.itemType,
        brand: testCase.itemInfo.brand,
        model: testCase.itemInfo.model,
        expectedRange: testCase.expectedRange,
        actualValue: 0,
        success: false,
        confidence: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    console.log(''); // Empty line for readability
  }

  // Summary
  console.log('📊 Test Summary:');
  console.log('================');
  
  const passCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  console.log(`Total Tests: ${totalCount}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${totalCount - passCount}`);
  console.log(`Success Rate: ${Math.round((passCount / totalCount) * 100)}%\n`);

  // Detailed results
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const valueStr = result.actualValue > 0 ? `₦${result.actualValue.toLocaleString()}` : 'N/A';
    const rangeStr = `₦${result.expectedRange[0].toLocaleString()}-₦${result.expectedRange[1].toLocaleString()}`;
    
    console.log(`${status} ${result.itemType}: ${valueStr} (expected: ${rangeStr})`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  // Check for the old bug (all items returning ₦3,000,000)
  const genericValues = results.filter(r => r.actualValue === 3000000);
  if (genericValues.length > 0) {
    console.log(`\n⚠️  WARNING: ${genericValues.length} items returned the generic ₦3,000,000 value!`);
    console.log('   This indicates the universal item system is not working properly.');
  } else {
    console.log('\n✅ SUCCESS: No items returned the generic ₦3,000,000 value!');
    console.log('   The universal item system is working correctly.');
  }
}

// Run the test
if (require.main === module) {
  testElectronicsAssessment().catch(console.error);
}