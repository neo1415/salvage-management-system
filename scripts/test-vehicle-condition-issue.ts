#!/usr/bin/env tsx

/**
 * Test script to reproduce the vehicle condition issue
 */

import { assessDamageEnhanced } from '@/features/cases/services/ai-assessment-enhanced.service';

async function testVehicleConditionIssue() {
  console.log('🚗 Testing Vehicle Condition Issue...\n');

  const baseVehicle = {
    photos: [
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
    ]
  };

  try {
    // Test 1: Brand New Ford Explorer 2023
    console.log('🆕 Testing Brand New Ford Explorer 2023...');
    const brandNewAssessment = await assessDamageEnhanced({
      ...baseVehicle,
      universalItemInfo: {
        type: 'vehicle',
        make: 'Ford',
        model: 'Explorer',
        year: 2023,
        mileage: 5000,
        condition: 'Brand New',
        age: 1
      }
    });

    console.log('Brand New Results:');
    console.log(`  Market Value: ₦${brandNewAssessment.marketValue.toLocaleString()}`);
    console.log(`  Salvage Value: ₦${brandNewAssessment.estimatedSalvageValue.toLocaleString()}`);
    console.log(`  Confidence: ${brandNewAssessment.confidenceScore}%\n`);

    // Test 2: Foreign Used Ford Explorer 2023
    console.log('🌍 Testing Foreign Used Ford Explorer 2023...');
    const foreignUsedAssessment = await assessDamageEnhanced({
      ...baseVehicle,
      universalItemInfo: {
        type: 'vehicle',
        make: 'Ford',
        model: 'Explorer',
        year: 2023,
        mileage: 5000,
        condition: 'Foreign Used (Tokunbo)',
        age: 1
      }
    });

    console.log('Foreign Used Results:');
    console.log(`  Market Value: ₦${foreignUsedAssessment.marketValue.toLocaleString()}`);
    console.log(`  Salvage Value: ₦${foreignUsedAssessment.estimatedSalvageValue.toLocaleString()}`);
    console.log(`  Confidence: ${foreignUsedAssessment.confidenceScore}%\n`);

    // Compare results
    console.log('📊 Comparison:');
    const brandNewPrice = brandNewAssessment.estimatedSalvageValue;
    const foreignUsedPrice = foreignUsedAssessment.estimatedSalvageValue;
    
    console.log(`Brand New: ₦${brandNewPrice.toLocaleString()}`);
    console.log(`Foreign Used: ₦${foreignUsedPrice.toLocaleString()}`);
    
    if (brandNewPrice > foreignUsedPrice) {
      console.log('✅ CORRECT: Brand New is more expensive than Foreign Used');
      console.log(`   Difference: ₦${(brandNewPrice - foreignUsedPrice).toLocaleString()}`);
    } else if (brandNewPrice < foreignUsedPrice) {
      console.log('❌ PROBLEM: Foreign Used is more expensive than Brand New!');
      console.log(`   Difference: ₦${(foreignUsedPrice - brandNewPrice).toLocaleString()}`);
      console.log('   This violates basic market logic.');
    } else {
      console.log('⚠️  WARNING: Both conditions have the same price');
    }

    // Test 3: Test with vehicleInfo (legacy format) to see if that's the issue
    console.log('\n🔍 Testing with legacy vehicleInfo format...');
    const legacyAssessment = await assessDamageEnhanced({
      ...baseVehicle,
      vehicleInfo: {
        type: 'vehicle',
        make: 'Ford',
        model: 'Explorer',
        year: 2023,
        mileage: 5000,
        condition: 'Foreign Used (Tokunbo)'
      }
    });

    console.log('Legacy Format Results:');
    console.log(`  Market Value: ₦${legacyAssessment.marketValue.toLocaleString()}`);
    console.log(`  Salvage Value: ₦${legacyAssessment.estimatedSalvageValue.toLocaleString()}`);
    console.log(`  Confidence: ${legacyAssessment.confidenceScore}%`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testVehicleConditionIssue().catch(console.error);