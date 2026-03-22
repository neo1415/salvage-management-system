#!/usr/bin/env tsx

/**
 * Test script to verify condition pricing hierarchy
 */

import { assessDamageEnhanced } from '@/features/cases/services/ai-assessment-enhanced.service';

async function testConditionHierarchy() {
  console.log('📊 Testing Condition Pricing Hierarchy...\n');

  const baseItem = {
    photos: [
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
    ],
    universalItemInfo: {
      type: 'electronics' as const,
      brand: 'Apple',
      model: 'iPhone 13',
      storageCapacity: '128GB',
      batteryHealth: 90,
      age: 2
    }
  };

  const conditions = [
    'Brand New',
    'Foreign Used (Tokunbo)',
    'Nigerian Used',
    'Heavily Used'
  ];

  const results: Array<{condition: string, price: number}> = [];

  try {
    for (const condition of conditions) {
      console.log(`🔍 Testing ${condition}...`);
      
      const assessment = await assessDamageEnhanced({
        ...baseItem,
        universalItemInfo: {
          ...baseItem.universalItemInfo,
          condition: condition as any
        }
      });

      results.push({
        condition,
        price: assessment.estimatedSalvageValue
      });

      console.log(`   Salvage Value: ₦${assessment.estimatedSalvageValue.toLocaleString()}\n`);
    }

    // Sort by price (highest to lowest)
    results.sort((a, b) => b.price - a.price);

    console.log('📊 Pricing Hierarchy (Highest to Lowest):');
    results.forEach((result, index) => {
      console.log(`   ${index + 1}. ${result.condition}: ₦${result.price.toLocaleString()}`);
    });

    // Validate hierarchy
    console.log('\n🔍 Hierarchy Validation:');
    const expectedOrder = ['Brand New', 'Foreign Used (Tokunbo)', 'Nigerian Used', 'Heavily Used'];
    let isCorrect = true;

    for (let i = 0; i < expectedOrder.length; i++) {
      if (results[i].condition !== expectedOrder[i]) {
        isCorrect = false;
        break;
      }
    }

    if (isCorrect) {
      console.log('✅ CORRECT: Pricing hierarchy follows expected order');
      console.log('   Brand New > Foreign Used > Nigerian Used > Heavily Used');
    } else {
      console.log('❌ INCORRECT: Pricing hierarchy is wrong');
      console.log('   Expected: Brand New > Foreign Used > Nigerian Used > Heavily Used');
      console.log('   Actual:', results.map(r => r.condition).join(' > '));
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testConditionHierarchy().catch(console.error);