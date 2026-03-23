#!/usr/bin/env tsx

/**
 * Test Condition Pricing Differentiation Fix
 * 
 * Tests that different conditions return meaningfully different prices
 * and that mileage adjustment is reasonable for luxury vehicles.
 */

import { assessDamageEnhanced } from '../src/features/cases/services/ai-assessment-enhanced.service';

async function testConditionPricingFix() {
  console.log('🧪 Testing Condition Pricing Differentiation Fix\n');
  
  const baseVehicle = {
    make: 'Lamborghini',
    model: 'Revuelto',
    year: 2023,
    mileage: 50000, // Low mileage
    vin: 'TEST123'
  };
  
  const testPhotos = [
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
  ];
  
  console.log('='.repeat(80));
  console.log('TEST 1: Condition Differentiation (Low Mileage)');
  console.log('='.repeat(80));
  
  // Test different conditions with low mileage
  const conditions = [
    { condition: 'excellent', label: 'Excellent (Brand New)' },
    { condition: 'good', label: 'Good (Foreign Used)' },
    { condition: 'fair', label: 'Fair (Nigerian Used)' }
  ];
  
  const results: Array<{ condition: string; marketValue: number; salvageValue: number }> = [];
  
  for (const { condition, label } of conditions) {
    try {
      console.log(`\n🔍 Testing ${label}...`);
      
      const assessment = await assessDamageEnhanced({
        photos: testPhotos,
        vehicleInfo: { ...baseVehicle, condition }
      });
      
      results.push({
        condition: label,
        marketValue: assessment.marketValue,
        salvageValue: assessment.estimatedSalvageValue
      });
      
      console.log(`   Market Value: ₦${assessment.marketValue.toLocaleString()}`);
      console.log(`   Salvage Value: ₦${assessment.estimatedSalvageValue.toLocaleString()}`);
      
    } catch (error) {
      console.error(`❌ Error testing ${label}:`, error);
    }
  }
  
  // Analyze condition differentiation
  console.log('\n📊 CONDITION DIFFERENTIATION ANALYSIS:');
  console.log('-'.repeat(60));
  
  if (results.length >= 2) {
    const excellent = results.find(r => r.condition.includes('Excellent'));
    const good = results.find(r => r.condition.includes('Good'));
    const fair = results.find(r => r.condition.includes('Fair'));
    
    if (excellent && good) {
      const diff1 = ((excellent.marketValue - good.marketValue) / excellent.marketValue) * 100;
      console.log(`Excellent vs Good: ${diff1.toFixed(1)}% difference`);
      
      if (diff1 >= 10) {
        console.log('✅ PASS: Meaningful price difference between conditions');
      } else {
        console.log('❌ FAIL: Insufficient price difference between conditions');
      }
    }
    
    if (good && fair) {
      const diff2 = ((good.marketValue - fair.marketValue) / good.marketValue) * 100;
      console.log(`Good vs Fair: ${diff2.toFixed(1)}% difference`);
    }
  }
  
  console.log('\n='.repeat(80));
  console.log('TEST 2: Mileage Impact (High Mileage Luxury Vehicle)');
  console.log('='.repeat(80));
  
  // Test high mileage impact
  try {
    console.log('\n🔍 Testing high mileage Lamborghini...');
    
    const highMileageAssessment = await assessDamageEnhanced({
      photos: testPhotos,
      vehicleInfo: { 
        ...baseVehicle, 
        condition: 'excellent',
        mileage: 500000 // Very high mileage
      }
    });
    
    const lowMileageResult = results.find(r => r.condition.includes('Excellent'));
    
    if (lowMileageResult) {
      const mileageImpact = ((lowMileageResult.salvageValue - highMileageAssessment.estimatedSalvageValue) / lowMileageResult.salvageValue) * 100;
      
      console.log(`\nLow Mileage (50k km): ₦${lowMileageResult.salvageValue.toLocaleString()}`);
      console.log(`High Mileage (500k km): ₦${highMileageAssessment.estimatedSalvageValue.toLocaleString()}`);
      console.log(`Mileage Impact: ${mileageImpact.toFixed(1)}% reduction`);
      
      if (mileageImpact <= 30) {
        console.log('✅ PASS: Reasonable mileage impact for luxury vehicle');
      } else {
        console.log('❌ FAIL: Excessive mileage impact for luxury vehicle');
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing high mileage:', error);
  }
  
  console.log('\n='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  
  console.log('\n✅ Fix Applied:');
  console.log('- Condition adjustments skipped for internet search results');
  console.log('- Luxury vehicles have reduced mileage depreciation');
  console.log('- Maximum mileage impact capped at 25% for luxury vehicles');
  
  console.log('\n🎯 Expected Results:');
  console.log('- Different conditions should show 10-20% price differences');
  console.log('- High mileage should impact luxury vehicles by ≤25%');
  console.log('- Internet search prices should be preserved (not double-adjusted)');
}

// Run the test
testConditionPricingFix().catch(console.error);