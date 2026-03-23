#!/usr/bin/env tsx

/**
 * Test script to compare Brand New vs Foreign Used pricing
 */

import { assessDamageEnhanced } from '@/features/cases/services/ai-assessment-enhanced.service';

async function testConditionPricingComparison() {
  console.log('📱 Testing Brand New vs Foreign Used Pricing...\n');

  const baseItem = {
    photos: [
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
    ],
    universalItemInfo: {
      type: 'electronics' as const,
      brand: 'Apple',
      model: 'iPhone 12 Pro Max',
      storageCapacity: '256GB',
      batteryHealth: 95,
      age: 1
    }
  };

  try {
    // Test Brand New condition
    console.log('🆕 Testing Brand New iPhone 12 Pro Max...');
    const brandNewAssessment = await assessDamageEnhanced({
      ...baseItem,
      universalItemInfo: {
        ...baseItem.universalItemInfo,
        condition: 'Brand New'
      }
    });

    console.log('Brand New Results:');
    console.log(`  Market Value: ₦${brandNewAssessment.marketValue.toLocaleString()}`);
    console.log(`  Salvage Value: ₦${brandNewAssessment.estimatedSalvageValue.toLocaleString()}`);
    console.log(`  Confidence: ${brandNewAssessment.confidenceScore}%\n`);

    // Test Foreign Used condition
    console.log('🌍 Testing Foreign Used iPhone 12 Pro Max...');
    const foreignUsedAssessment = await assessDamageEnhanced({
      ...baseItem,
      universalItemInfo: {
        ...baseItem.universalItemInfo,
        condition: 'Foreign Used (Tokunbo)'
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

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testConditionPricingComparison().catch(console.error);