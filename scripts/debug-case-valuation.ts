/**
 * Debug Case Valuation
 * 
 * Investigates why a 2021 Toyota Camry in excellent condition with 50,000 km
 * is getting a market value of ₦33.6M and salvage value of ₦8.4M
 */

import { db } from '@/lib/db/drizzle';
import { vehicleValuations } from '@/lib/db/schema/vehicle-valuations';
import { eq, and } from 'drizzle-orm';
import { valuationQueryService } from '@/features/valuations/services/valuation-query.service';
import { damageCalculationService } from '@/features/valuations/services/damage-calculation.service';

async function debugCaseValuation() {
  console.log('🔍 Debugging 2021 Toyota Camry Excellent Condition Valuation\n');
  
  const vehicleInfo = {
    make: 'Toyota',
    model: 'Camry',
    year: 2021,
    condition: 'excellent' as const,
    mileage: 50000
  };
  
  console.log('📋 Input Data:');
  console.log(`   Make: ${vehicleInfo.make}`);
  console.log(`   Model: ${vehicleInfo.model}`);
  console.log(`   Year: ${vehicleInfo.year}`);
  console.log(`   Condition: ${vehicleInfo.condition}`);
  console.log(`   Mileage: ${vehicleInfo.mileage.toLocaleString()} km\n`);
  
  // Step 1: Check what's in the database
  console.log('🗄️ Step 1: Checking Valuation Database\n');
  
  const dbResult = await valuationQueryService.queryValuation({
    make: vehicleInfo.make,
    model: vehicleInfo.model,
    year: vehicleInfo.year,
    conditionCategory: vehicleInfo.condition,
  });
  
  if (dbResult.found && dbResult.valuation) {
    console.log('✅ Found in database:');
    console.log(`   Condition: ${dbResult.valuation.conditionCategory}`);
    console.log(`   Low Price: ₦${Number(dbResult.valuation.lowPrice).toLocaleString()}`);
    console.log(`   Average Price: ₦${Number(dbResult.valuation.averagePrice).toLocaleString()}`);
    console.log(`   High Price: ₦${Number(dbResult.valuation.highPrice).toLocaleString()}`);
    console.log(`   Mileage Range: ${dbResult.valuation.mileageLow?.toLocaleString()} - ${dbResult.valuation.mileageHigh?.toLocaleString()} km\n`);
    
    // Step 2: Calculate mileage adjustment
    console.log('🔧 Step 2: Mileage Adjustment\n');
    
    const age = new Date().getFullYear() - vehicleInfo.year;
    console.log(`   Vehicle Age: ${age} years`);
    console.log(`   Actual Mileage: ${vehicleInfo.mileage.toLocaleString()} km`);
    console.log(`   Expected Mileage Range: ${dbResult.valuation.mileageLow?.toLocaleString()} - ${dbResult.valuation.mileageHigh?.toLocaleString()} km`);
    
    // Calculate mileage adjustment (from ai-assessment-enhanced.service.ts)
    const expectedMileagePerYear = 15000;
    const expectedMileage = age * expectedMileagePerYear;
    const mileageDiff = vehicleInfo.mileage - expectedMileage;
    const mileageAdjustmentPercent = Math.max(-0.3, Math.min(0.1, -mileageDiff / 100000));
    const mileageAdjustment = 1 + mileageAdjustmentPercent;
    
    console.log(`   Expected Mileage: ${expectedMileage.toLocaleString()} km`);
    console.log(`   Mileage Difference: ${mileageDiff.toLocaleString()} km`);
    console.log(`   Adjustment Factor: ${mileageAdjustment.toFixed(4)} (${(mileageAdjustmentPercent * 100).toFixed(2)}%)`);
    
    const adjustedPrice = dbResult.valuation.averagePrice * mileageAdjustment;
    console.log(`   Adjusted Price: ₦${Math.round(adjustedPrice).toLocaleString()}\n`);
    
    // Step 3: Check damage deductions
    console.log('🔧 Step 3: Damage Deductions\n');
    
    // Simulate moderate damage (as shown in the user's case)
    const damages = [
      { component: 'BUMPER_DAMAGE', damageLevel: 'moderate' as const },
      { component: 'DOOR_DENT', damageLevel: 'moderate' as const },
      { component: 'MINOR_SCRATCH', damageLevel: 'minor' as const },
    ];
    
    console.log('   Simulated Damage:');
    damages.forEach(d => console.log(`   - ${d.component}: ${d.damageLevel}`));
    console.log('');
    
    try {
      const salvageCalc = await damageCalculationService.calculateSalvageValue(
        adjustedPrice,
        damages,
        vehicleInfo.make // Pass vehicle make for make-specific deductions
      );
      
      console.log('   Damage Breakdown:');
      salvageCalc.deductions.forEach(d => {
        console.log(`   - ${d.component} (${d.damageLevel}): -${(d.deductionPercent * 100).toFixed(2)}% = -₦${d.deductionAmount.toLocaleString()}`);
      });
      console.log('');
      console.log(`   Total Deduction: ${(salvageCalc.totalDeductionPercent * 100).toFixed(2)}%`);
      console.log(`   Total Deduction Amount: ₦${salvageCalc.totalDeductionAmount.toLocaleString()}`);
      console.log(`   Salvage Value: ₦${salvageCalc.salvageValue.toLocaleString()}`);
      console.log(`   Reserve Price (70%): ₦${Math.round(salvageCalc.salvageValue * 0.7).toLocaleString()}`);
      console.log(`   Is Total Loss: ${salvageCalc.isTotalLoss ? 'Yes' : 'No'}\n`);
      
      // Step 4: Analysis
      console.log('📊 Step 4: Analysis\n');
      
      const userReportedMarketValue = 33600000;
      const userReportedSalvageValue = 8400000;
      const userReportedReservePrice = 5880000;
      
      console.log('   User Reported Values:');
      console.log(`   - Market Value: ₦${userReportedMarketValue.toLocaleString()}`);
      console.log(`   - Salvage Value: ₦${userReportedSalvageValue.toLocaleString()}`);
      console.log(`   - Reserve Price: ₦${userReportedReservePrice.toLocaleString()}\n`);
      
      console.log('   Our Calculated Values:');
      console.log(`   - Market Value: ₦${Math.round(adjustedPrice).toLocaleString()}`);
      console.log(`   - Salvage Value: ₦${Math.round(salvageCalc.salvageValue).toLocaleString()}`);
      console.log(`   - Reserve Price: ₦${Math.round(salvageCalc.salvageValue * 0.7).toLocaleString()}\n`);
      
      const marketValueMatch = Math.abs(adjustedPrice - userReportedMarketValue) < 100000;
      const salvageValueMatch = Math.abs(salvageCalc.salvageValue - userReportedSalvageValue) < 100000;
      
      console.log('   Comparison:');
      console.log(`   - Market Value Match: ${marketValueMatch ? '✅ Yes' : '❌ No'}`);
      console.log(`   - Salvage Value Match: ${salvageValueMatch ? '✅ Yes' : '❌ No'}\n`);
      
      if (!salvageValueMatch) {
        const impliedDeduction = 1 - (userReportedSalvageValue / userReportedMarketValue);
        console.log('   ⚠️ ISSUE DETECTED:');
        console.log(`   - Implied Deduction: ${(impliedDeduction * 100).toFixed(2)}%`);
        console.log(`   - Our Deduction: ${(salvageCalc.totalDeductionPercent * 100).toFixed(2)}%`);
        console.log(`   - Difference: ${((impliedDeduction - salvageCalc.totalDeductionPercent) * 100).toFixed(2)}%\n`);
        
        console.log('   🔍 Possible Causes:');
        console.log('   1. AI is detecting more damage than expected');
        console.log('   2. Damage deduction percentages are too high');
        console.log('   3. Multiple damages are being applied cumulatively');
        console.log('   4. Photos show vehicle in better condition than AI interprets\n');
      }
      
    } catch (error) {
      console.error('❌ Error calculating salvage value:', error);
    }
    
  } else {
    console.log('❌ Not found in database\n');
    console.log('   This vehicle should be in the database.');
    console.log('   Run: npx tsx scripts/check-all-valuations.ts\n');
  }
  
  console.log('✅ Debug complete\n');
}

// Run if called directly
if (require.main === module) {
  debugCaseValuation()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { debugCaseValuation };
