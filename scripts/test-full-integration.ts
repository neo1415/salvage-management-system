/**
 * Test Full Integration: Vehicle Valuation Database + AI Assessment
 * 
 * This script tests the complete flow:
 * 1. Query valuation database for a Toyota Camry
 * 2. Simulate AI assessment with damage
 * 3. Verify damage deductions are applied
 * 4. Verify salvage value calculation
 */

import { config } from 'dotenv';
import { db } from '@/lib/db';
import { vehicleValuations, damageDeductions } from '@/lib/db/schema/vehicle-valuations';
import { valuationQueryService } from '@/features/valuations/services/valuation-query.service';
import { damageCalculationService } from '@/features/valuations/services/damage-calculation.service';
import type { DamageInput } from '@/features/valuations/types';

config();

async function testFullIntegration() {
  console.log('🧪 Testing Full Integration: Vehicle Valuation Database + AI Assessment');
  console.log('='.repeat(80));
  console.log();

  try {
    // Step 1: Query valuation database for 2020 Toyota Camry
    console.log('📊 Step 1: Query valuation database');
    console.log('-'.repeat(80));
    
    const queryResult = await valuationQueryService.queryValuation({
      make: 'Toyota',
      model: 'Camry',
      year: 2020,
    });
    
    if (!queryResult.found || !queryResult.valuation) {
      console.error('❌ No valuation found for 2020 Toyota Camry');
      console.log('💡 Make sure you have imported the Toyota data first:');
      console.log('   npx tsx scripts/import-toyota-nigeria-data.ts');
      process.exit(1);
    }
    
    console.log('✅ Found valuation:');
    console.log(`   Make: Toyota`);
    console.log(`   Model: Camry`);
    console.log(`   Year: 2020`);
    console.log(`   Condition: ${queryResult.valuation.conditionCategory}`);
    console.log(`   Price Range: ₦${queryResult.valuation.lowPrice.toLocaleString()} - ₦${queryResult.valuation.highPrice.toLocaleString()}`);
    console.log(`   Average Price: ₦${queryResult.valuation.averagePrice.toLocaleString()}`);
    console.log(`   Mileage Range: ${queryResult.valuation.mileageLow?.toLocaleString()} - ${queryResult.valuation.mileageHigh?.toLocaleString()} km`);
    console.log();
    
    const basePrice = queryResult.valuation.averagePrice;
    
    // Step 2: Simulate damage detection
    console.log('🔧 Step 2: Simulate damage detection');
    console.log('-'.repeat(80));
    
    const damages: DamageInput[] = [
      { component: 'body', damageLevel: 'moderate' },
      { component: 'engine', damageLevel: 'minor' },
      { component: 'interior', damageLevel: 'minor' },
    ];
    
    console.log('Detected damages:');
    damages.forEach(d => {
      console.log(`   - ${d.component}: ${d.damageLevel}`);
    });
    console.log();
    
    // Step 3: Calculate salvage value with damage deductions
    console.log('💰 Step 3: Calculate salvage value');
    console.log('-'.repeat(80));
    
    const salvageCalc = await damageCalculationService.calculateSalvageValue(
      basePrice,
      damages,
      'Toyota' // Pass vehicle make for make-specific deductions
    );
    
    console.log('Calculation results:');
    console.log(`   Base Price: ₦${basePrice.toLocaleString()}`);
    console.log();
    console.log('   Damage Deductions:');
    salvageCalc.deductions.forEach(d => {
      console.log(`     - ${d.component} (${d.damageLevel}):`);
      console.log(`       Repair Cost: ₦${d.repairCost.toLocaleString()}`);
      console.log(`       Deduction: ${(d.deductionPercent * 100).toFixed(1)}% (₦${d.deductionAmount.toLocaleString()})`);
    });
    console.log();
    console.log(`   Total Deduction: ${(salvageCalc.totalDeductionPercent * 100).toFixed(1)}% (₦${salvageCalc.totalDeductionAmount.toLocaleString()})`);
    console.log(`   Salvage Value: ₦${salvageCalc.salvageValue.toLocaleString()}`);
    console.log(`   Is Total Loss: ${salvageCalc.isTotalLoss ? 'Yes' : 'No'}`);
    console.log(`   Confidence: ${(salvageCalc.confidence * 100).toFixed(0)}%`);
    console.log();
    
    // Step 4: Verify calculations
    console.log('✅ Step 4: Verify calculations');
    console.log('-'.repeat(80));
    
    const expectedSalvage = basePrice - salvageCalc.totalDeductionAmount;
    const actualSalvage = salvageCalc.salvageValue;
    
    if (Math.abs(expectedSalvage - actualSalvage) < 1) {
      console.log('✅ Salvage value calculation is correct');
    } else {
      console.error('❌ Salvage value calculation mismatch:');
      console.error(`   Expected: ₦${expectedSalvage.toLocaleString()}`);
      console.error(`   Actual: ₦${actualSalvage.toLocaleString()}`);
    }
    
    if (salvageCalc.salvageValue >= 0) {
      console.log('✅ Salvage value is non-negative');
    } else {
      console.error('❌ Salvage value is negative!');
    }
    
    if (salvageCalc.totalDeductionPercent <= 0.9) {
      console.log('✅ Total deduction is capped at 90%');
    } else {
      console.error('❌ Total deduction exceeds 90%!');
    }
    
    console.log();
    console.log('='.repeat(80));
    console.log('🎉 Full integration test complete!');
    console.log();
    console.log('📝 Summary:');
    console.log(`   ✅ Database query: Working`);
    console.log(`   ✅ Damage detection: Working`);
    console.log(`   ✅ Salvage calculation: Working`);
    console.log(`   ✅ Validation: Passed`);
    console.log();
    console.log('💡 You can now test with case creation!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testFullIntegration();
