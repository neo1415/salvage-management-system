#!/usr/bin/env tsx

/**
 * Test script to verify the quality tier conversion fix
 * 
 * This script tests that quality tiers ("good", "excellent") are properly
 * converted to universal conditions ("Foreign Used (Tokunbo)", "Brand New")
 * before being used in internet search queries.
 */

import { assessDamageEnhanced } from '@/features/cases/services/ai-assessment-enhanced.service';

async function testQualityTierConversion() {
  console.log('🧪 Testing Quality Tier Conversion Fix');
  console.log('=====================================\n');

  // Test data: Same iPhone with different quality tiers
  const testPhotos = [
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
  ];

  // Test Case 1: "excellent" quality tier should convert to "Brand New"
  console.log('📱 Test Case 1: iPhone with "excellent" quality tier');
  console.log('Expected: Should convert "excellent" → "Brand New" for search');
  
  try {
    const excellentResult = await assessDamageEnhanced({
      photos: testPhotos,
      universalItemInfo: {
        type: 'electronics',
        brand: 'Apple',
        model: 'iPhone 14 Pro',
        condition: 'excellent', // This should be converted to "Brand New"
        storageCapacity: '256GB',
        age: 1,
        brandPrestige: 'luxury'
      }
    });

    console.log('✅ Excellent Quality Assessment Result:');
    console.log(`   Market Value: ₦${excellentResult.marketValue.toLocaleString()}`);
    console.log(`   Salvage Value: ₦${excellentResult.estimatedSalvageValue.toLocaleString()}`);
    console.log(`   Confidence: ${excellentResult.confidenceScore}%`);
    console.log(`   Quality Tier: ${excellentResult.qualityTier}`);
    console.log('');

  } catch (error) {
    console.error('❌ Test Case 1 failed:', error);
  }

  // Test Case 2: "good" quality tier should convert to "Foreign Used (Tokunbo)"
  console.log('📱 Test Case 2: iPhone with "good" quality tier');
  console.log('Expected: Should convert "good" → "Foreign Used (Tokunbo)" for search');
  
  try {
    const goodResult = await assessDamageEnhanced({
      photos: testPhotos,
      universalItemInfo: {
        type: 'electronics',
        brand: 'Apple',
        model: 'iPhone 14 Pro',
        condition: 'good', // This should be converted to "Foreign Used (Tokunbo)"
        storageCapacity: '256GB',
        age: 2,
        brandPrestige: 'luxury'
      }
    });

    console.log('✅ Good Quality Assessment Result:');
    console.log(`   Market Value: ₦${goodResult.marketValue.toLocaleString()}`);
    console.log(`   Salvage Value: ₦${goodResult.estimatedSalvageValue.toLocaleString()}`);
    console.log(`   Confidence: ${goodResult.confidenceScore}%`);
    console.log(`   Quality Tier: ${goodResult.qualityTier}`);
    console.log('');

  } catch (error) {
    console.error('❌ Test Case 2 failed:', error);
  }

  // Test Case 3: Vehicle with quality tiers
  console.log('🚗 Test Case 3: Vehicle with "excellent" quality tier');
  console.log('Expected: Should convert "excellent" → "Brand New" for search');
  
  try {
    const vehicleResult = await assessDamageEnhanced({
      photos: testPhotos,
      universalItemInfo: {
        type: 'vehicle',
        make: 'Toyota',
        model: 'Camry',
        year: 2023,
        condition: 'excellent', // This should be converted to "Brand New"
        mileage: 5000,
        age: 1,
        brandPrestige: 'standard'
      }
    });

    console.log('✅ Vehicle Excellent Quality Assessment Result:');
    console.log(`   Market Value: ₦${vehicleResult.marketValue.toLocaleString()}`);
    console.log(`   Salvage Value: ₦${vehicleResult.estimatedSalvageValue.toLocaleString()}`);
    console.log(`   Confidence: ${vehicleResult.confidenceScore}%`);
    console.log(`   Quality Tier: ${vehicleResult.qualityTier}`);
    console.log('');

  } catch (error) {
    console.error('❌ Test Case 3 failed:', error);
  }

  // Test Case 4: Compare "good" vs "excellent" to ensure proper pricing
  console.log('📊 Test Case 4: Price Comparison Analysis');
  console.log('Expected: "excellent" (Brand New) should be MORE expensive than "good" (Foreign Used)');
  
  try {
    // Test with same iPhone but different conditions
    const [excellentPrice, goodPrice] = await Promise.all([
      assessDamageEnhanced({
        photos: testPhotos,
        universalItemInfo: {
          type: 'electronics',
          brand: 'Apple',
          model: 'iPhone 14 Pro',
          condition: 'excellent',
          storageCapacity: '256GB',
          age: 1
        }
      }),
      assessDamageEnhanced({
        photos: testPhotos,
        universalItemInfo: {
          type: 'electronics',
          brand: 'Apple',
          model: 'iPhone 14 Pro',
          condition: 'good',
          storageCapacity: '256GB',
          age: 1
        }
      })
    ]);

    console.log('📊 Price Comparison Results:');
    console.log(`   Excellent (Brand New): ₦${excellentPrice.marketValue.toLocaleString()}`);
    console.log(`   Good (Foreign Used): ₦${goodPrice.marketValue.toLocaleString()}`);
    
    const priceDifference = excellentPrice.marketValue - goodPrice.marketValue;
    const percentDifference = ((priceDifference / goodPrice.marketValue) * 100).toFixed(1);
    
    if (excellentPrice.marketValue > goodPrice.marketValue) {
      console.log(`✅ CORRECT: Excellent is ₦${priceDifference.toLocaleString()} (${percentDifference}%) more expensive than Good`);
    } else {
      console.log(`❌ ERROR: Good (₦${goodPrice.marketValue.toLocaleString()}) is more expensive than Excellent (₦${excellentPrice.marketValue.toLocaleString()})`);
      console.log('   This indicates the quality tier conversion is not working properly!');
    }

  } catch (error) {
    console.error('❌ Test Case 4 failed:', error);
  }

  console.log('\n🎯 Test Summary:');
  console.log('================');
  console.log('The fix should ensure that:');
  console.log('1. Quality tiers are converted to universal conditions before search');
  console.log('2. "excellent" → "Brand New" → higher prices');
  console.log('3. "good" → "Foreign Used (Tokunbo)" → moderate prices');
  console.log('4. "fair" → "Nigerian Used" → lower prices');
  console.log('5. "poor" → "Heavily Used" → lowest prices');
  console.log('');
  console.log('If the conversion is working correctly, you should see:');
  console.log('- Log messages showing "Converted quality tier X → Y for search"');
  console.log('- Excellent condition items priced higher than good condition items');
  console.log('- No more cases where Foreign Used is more expensive than Brand New');
}

// Run the test
testQualityTierConversion().catch(console.error);