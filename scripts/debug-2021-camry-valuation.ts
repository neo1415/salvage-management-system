/**
 * Debug script for 2021 Camry valuation issue
 * 
 * This script tests the full valuation pipeline to identify where the ₦18M bug is coming from
 */

import { valuationQueryService } from '@/features/valuations/services/valuation-query.service';
import { damageCalculationService } from '@/features/valuations/services/damage-calculation.service';

async function debugCamryValuation() {
  console.log('🔍 Debugging 2021 Camry Valuation Issue\n');
  console.log('=' .repeat(60));
  
  // Test 1: Check if 2021 Camry exists in database
  console.log('\n📊 TEST 1: Database Query');
  console.log('-'.repeat(60));
  
  try {
    const dbResult = await valuationQueryService.queryValuation({
      make: 'Toyota',
      model: 'Camry',
      year: 2021,
    });
    
    if (dbResult.found && dbResult.valuation) {
      console.log('✅ Found in database!');
      console.log(`   Average Price: ₦${dbResult.valuation.averagePrice.toLocaleString()}`);
      console.log(`   Condition: ${dbResult.valuation.conditionCategory}`);
      console.log(`   Source: ${dbResult.valuation.source}`);
    } else {
      console.log('❌ NOT found in database!');
      console.log('   This is the problem - data not imported correctly');
    }
  } catch (error) {
    console.log('❌ Database query failed:', error);
  }
  
  // Test 2: Test condition adjustment
  console.log('\n📊 TEST 2: Condition Adjustment');
  console.log('-'.repeat(60));
  
  const basePrice = 40000000; // ₦40M from your data
  const condition = 'good';
  
  // Simulate condition adjustment
  const conditionAdjustments = {
    excellent: 1.15,  // +15%
    good: 1.0,        // No adjustment
    fair: 0.85,       // -15%
    poor: 0.70        // -30%
  };
  
  const adjustedPrice = basePrice * conditionAdjustments[condition];
  console.log(`   Base Price: ₦${basePrice.toLocaleString()}`);
  console.log(`   Condition: ${condition} (${conditionAdjustments[condition]}x)`);
  console.log(`   Adjusted Price: ₦${adjustedPrice.toLocaleString()}`);
  
  // Test 3: Test mileage adjustment
  console.log('\n📊 TEST 3: Mileage Adjustment');
  console.log('-'.repeat(60));
  
  const mileage = 120700;
  const age = 2026 - 2021; // 5 years
  const expectedMileage = age * 15000; // 75,000 km expected
  
  console.log(`   Actual Mileage: ${mileage.toLocaleString()} km`);
  console.log(`   Expected Mileage: ${expectedMileage.toLocaleString()} km (${age} years × 15k/year)`);
  console.log(`   Ratio: ${(mileage / expectedMileage).toFixed(2)}x expected`);
  
  // Mileage adjustment logic
  let mileageAdjustment = 1.0;
  if (mileage < expectedMileage * 0.5) {
    mileageAdjustment = 1.10; // +10%
  } else if (mileage < expectedMileage * 0.8) {
    mileageAdjustment = 1.05; // +5%
  } else if (mileage < expectedMileage * 1.2) {
    mileageAdjustment = 1.0; // No adjustment
  } else if (mileage < expectedMileage * 1.5) {
    mileageAdjustment = 0.95; // -5%
  } else {
    mileageAdjustment = 0.85; // -15%
  }
  
  const priceAfterMileage = adjustedPrice * mileageAdjustment;
  console.log(`   Mileage Adjustment: ${mileageAdjustment}x`);
  console.log(`   Price After Mileage: ₦${priceAfterMileage.toLocaleString()}`);
  
  // Test 4: Test damage calculation
  console.log('\n📊 TEST 4: Damage Calculation');
  console.log('-'.repeat(60));
  
  // Simulate "minor" damage
  const damageScore = {
    structural: 0,    // No structural damage
    mechanical: 0,    // No mechanical damage
    cosmetic: 45,     // Minor cosmetic damage
    electrical: 0,    // No electrical damage
    interior: 0       // No interior damage
  };
  
  console.log('   Damage Scores:');
  console.log(`     Structural: ${damageScore.structural}`);
  console.log(`     Mechanical: ${damageScore.mechanical}`);
  console.log(`     Cosmetic: ${damageScore.cosmetic} (MINOR)`);
  console.log(`     Electrical: ${damageScore.electrical}`);
  console.log(`     Interior: ${damageScore.interior}`);
  
  // Map to damage inputs
  const damages = [];
  if (damageScore.cosmetic > 0) {
    const level = damageScore.cosmetic > 70 ? 'severe' : 
                  damageScore.cosmetic > 40 ? 'moderate' : 'minor';
    damages.push({ component: 'body', damageLevel: level });
    console.log(`\n   Mapped to: body - ${level}`);
  }
  
  try {
    const salvageCalc = await damageCalculationService.calculateSalvageValue(
      priceAfterMileage,
      damages,
      'Toyota' // Pass vehicle make for make-specific deductions
    );
    
    console.log(`\n   ✅ Damage Calculation Results:`);
    console.log(`     Total Deduction: ${salvageCalc.totalDeductionPercent.toFixed(2)}%`);
    console.log(`     Deduction Amount: ₦${salvageCalc.totalDeductionAmount.toLocaleString()}`);
    console.log(`     Salvage Value: ₦${salvageCalc.salvageValue.toLocaleString()}`);
    console.log(`     Is Total Loss: ${salvageCalc.isTotalLoss}`);
    
    const reservePrice = salvageCalc.salvageValue * 0.7;
    console.log(`\n   Reserve Price (70%): ₦${reservePrice.toLocaleString()}`);
    
  } catch (error) {
    console.log('   ❌ Damage calculation failed:', error);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 EXPECTED vs ACTUAL');
  console.log('='.repeat(60));
  console.log(`Expected Market Value: ₦40,000,000`);
  console.log(`Expected Salvage Value: ₦32,000,000 - ₦34,000,000 (80-85%)`);
  console.log(`Expected Reserve Price: ₦22,000,000 - ₦24,000,000`);
  console.log('');
  console.log(`Actual Market Value: ₦15,300,000 ❌`);
  console.log(`Actual Salvage Value: ₦3,825,000 ❌`);
  console.log(`Actual Reserve Price: ₦2,677,500 ❌`);
  console.log('='.repeat(60));
}

// Run the debug
debugCamryValuation()
  .then(() => {
    console.log('\n✅ Debug complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Debug failed:', error);
    process.exit(1);
  });
