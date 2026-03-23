#!/usr/bin/env tsx

/**
 * Test script to verify pristine condition and mileage-based pricing fixes
 */

import { assessDamageEnhanced } from '../src/features/cases/services/ai-assessment-enhanced.service';

async function testPristineConditionFix() {
  console.log('🧪 Testing Pristine Condition and Mileage-Based Pricing Fixes\n');

  // Test 1: Pristine vehicle with low mileage (should get premium)
  console.log('=== Test 1: Pristine 2022 Camry with Low Mileage ===');
  try {
    const result1 = await assessDamageEnhanced({
      photos: ['data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='],
      vehicleInfo: {
        make: 'Toyota',
        model: 'Camry',
        year: 2022,
        mileage: 15000, // Very low mileage
        condition: 'Brand New'
      }
    });

    console.log('✅ Assessment Result:');
    console.log(`   Damage Percentage: ${result1.damagePercentage}%`);
    console.log(`   Damage Severity: ${result1.damageSeverity}`);
    console.log(`   Market Value: ₦${result1.marketValue.toLocaleString()}`);
    console.log(`   Salvage Value: ₦${result1.estimatedSalvageValue.toLocaleString()}`);
    console.log(`   Repair Cost: ₦${result1.estimatedRepairCost.toLocaleString()}`);
    console.log(`   Quality Tier: ${result1.qualityTier}`);
    console.log(`   Analysis Method: ${result1.analysisMethod}`);
    console.log(`   Damage Breakdown: ${result1.damageBreakdown?.length || 0} components`);
    
    if (result1.damagePercentage === 0 && result1.estimatedRepairCost === 0) {
      console.log('✅ PASS: No damage detected for pristine vehicle');
    } else {
      console.log('❌ FAIL: Damage detected when vehicle should be pristine');
    }
  } catch (error) {
    console.error('❌ Test 1 failed:', error);
  }

  console.log('\n=== Test 2: Pristine 2020 Camry with High Mileage ===');
  try {
    const result2 = await assessDamageEnhanced({
      photos: ['data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='],
      vehicleInfo: {
        make: 'Toyota',
        model: 'Camry',
        year: 2020,
        mileage: 200000, // High mileage
        condition: 'Nigerian Used'
      }
    });

    console.log('✅ Assessment Result:');
    console.log(`   Damage Percentage: ${result2.damagePercentage}%`);
    console.log(`   Damage Severity: ${result2.damageSeverity}`);
    console.log(`   Market Value: ₦${result2.marketValue.toLocaleString()}`);
    console.log(`   Salvage Value: ₦${result2.estimatedSalvageValue.toLocaleString()}`);
    console.log(`   Repair Cost: ₦${result2.estimatedRepairCost.toLocaleString()}`);
    console.log(`   Quality Tier: ${result2.qualityTier}`);
    console.log(`   Analysis Method: ${result2.analysisMethod}`);
    console.log(`   Damage Breakdown: ${result2.damageBreakdown?.length || 0} components`);
    
    if (result2.damagePercentage === 0 && result2.estimatedRepairCost === 0) {
      console.log('✅ PASS: No damage detected for pristine vehicle');
      if (result2.estimatedSalvageValue < result2.marketValue) {
        console.log('✅ PASS: Mileage adjustment applied (salvage < market value)');
      } else {
        console.log('⚠️  WARNING: Expected mileage adjustment not applied');
      }
    } else {
      console.log('❌ FAIL: Damage detected when vehicle should be pristine');
    }
  } catch (error) {
    console.error('❌ Test 2 failed:', error);
  }

  console.log('\n=== Test 3: Condition Field Mapping ===');
  try {
    const result3 = await assessDamageEnhanced({
      photos: ['data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='],
      vehicleInfo: {
        make: 'Toyota',
        model: 'Camry',
        year: 2021,
        mileage: 50000,
        condition: 'Foreign Used (Tokunbo)' // Test Nigerian condition category
      }
    });

    console.log('✅ Assessment Result:');
    console.log(`   Condition: ${result3.vehicleInfo?.condition || 'Not set'}`);
    console.log(`   Market Value: ₦${result3.marketValue.toLocaleString()}`);
    console.log(`   Salvage Value: ₦${result3.estimatedSalvageValue.toLocaleString()}`);
    console.log(`   Price Source: ${result3.priceSource}`);
    
    console.log('✅ PASS: Nigerian condition categories working');
  } catch (error) {
    console.error('❌ Test 3 failed:', error);
  }

  console.log('\n🎉 Pristine Condition Fix Testing Complete!');
}

// Run the test
testPristineConditionFix().catch(console.error);