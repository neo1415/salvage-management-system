/**
 * Diagnostic script to test salvage value calculation with realistic damage scenarios
 */

import { damageCalculationService } from '@/features/valuations/services/damage-calculation.service';

async function testSalvageCalculation() {
  console.log('🔍 Testing Salvage Value Calculation\n');
  
  // Test case from your logs: 2013 Toyota Yaris with severe damage
  const marketValue = 5725000; // ₦5,725,000
  const damages = [
    { component: 'bumper', damageLevel: 'severe' as const },
    { component: 'headlight', damageLevel: 'severe' as const },
    { component: 'hood', damageLevel: 'severe' as const },
    { component: 'fender', damageLevel: 'severe' as const },
    { component: 'door', damageLevel: 'severe' as const },
    { component: 'mirror', damageLevel: 'severe' as const },
    { component: 'windshield', damageLevel: 'severe' as const },
    { component: 'grille', damageLevel: 'severe' as const },
    { component: 'wheel', damageLevel: 'severe' as const },
    { component: 'taillight', damageLevel: 'severe' as const },
    { component: 'trunk', damageLevel: 'severe' as const },
    { component: 'quarter panel', damageLevel: 'severe' as const },
    { component: 'rocker panel', damageLevel: 'severe' as const },
  ];
  
  console.log('📊 Test Scenario:');
  console.log(`   Vehicle: 2013 Toyota Yaris`);
  console.log(`   Market Value: ₦${marketValue.toLocaleString()}`);
  console.log(`   Damaged Parts: ${damages.length}`);
  console.log(`   Severity: All severe\n`);
  
  // Test without part prices (traditional calculation)
  console.log('🔧 Test 1: Traditional Calculation (no part prices)');
  console.log('─'.repeat(60));
  const result1 = await damageCalculationService.calculateSalvageValue(
    marketValue,
    damages,
    'Toyota'
  );
  
  console.log('\n📊 Results:');
  console.log(`   Total Deduction: ${(result1.totalDeductionPercent * 100).toFixed(1)}%`);
  console.log(`   Deduction Amount: ₦${result1.totalDeductionAmount.toLocaleString()}`);
  console.log(`   Salvage Value: ₦${result1.salvageValue.toLocaleString()}`);
  console.log(`   Is Total Loss: ${result1.isTotalLoss}`);
  console.log(`   Confidence: ${(result1.confidence * 100).toFixed(0)}%\n`);
  
  // Test with partial part prices (like your scenario)
  console.log('🔧 Test 2: With Partial Part Prices (1 out of 13)');
  console.log('─'.repeat(60));
  const partPrices = [
    { component: 'bumper', partPrice: 410000, confidence: 0.95, source: 'internet_search' as const },
  ];
  
  const result2 = await damageCalculationService.calculateSalvageValueWithPartPrices(
    marketValue,
    damages,
    partPrices,
    'Toyota'
  );
  
  console.log('\n📊 Results:');
  console.log(`   Total Deduction: ${(result2.totalDeductionPercent * 100).toFixed(1)}%`);
  console.log(`   Deduction Amount: ₦${result2.totalDeductionAmount.toLocaleString()}`);
  console.log(`   Salvage Value: ₦${result2.salvageValue.toLocaleString()}`);
  console.log(`   Is Total Loss: ${result2.isTotalLoss}`);
  console.log(`   Part Prices Used: ${result2.partPricesUsed}`);
  console.log(`   Real Parts Cost: ₦${result2.realPartsCost?.toLocaleString() || 0}\n`);
  
  // Test with moderate damage
  console.log('🔧 Test 3: Moderate Damage (5 parts)');
  console.log('─'.repeat(60));
  const moderateDamages = [
    { component: 'bumper', damageLevel: 'moderate' as const },
    { component: 'headlight', damageLevel: 'moderate' as const },
    { component: 'hood', damageLevel: 'minor' as const },
    { component: 'fender', damageLevel: 'moderate' as const },
    { component: 'door', damageLevel: 'minor' as const },
  ];
  
  const result3 = await damageCalculationService.calculateSalvageValue(
    marketValue,
    moderateDamages,
    'Toyota'
  );
  
  console.log('\n📊 Results:');
  console.log(`   Total Deduction: ${(result3.totalDeductionPercent * 100).toFixed(1)}%`);
  console.log(`   Deduction Amount: ₦${result3.totalDeductionAmount.toLocaleString()}`);
  console.log(`   Salvage Value: ₦${result3.salvageValue.toLocaleString()}`);
  console.log(`   Is Total Loss: ${result3.isTotalLoss}\n`);
  
  // Test with minor damage
  console.log('🔧 Test 4: Minor Damage (3 parts)');
  console.log('─'.repeat(60));
  const minorDamages = [
    { component: 'bumper', damageLevel: 'minor' as const },
    { component: 'headlight', damageLevel: 'minor' as const },
    { component: 'mirror', damageLevel: 'minor' as const },
  ];
  
  const result4 = await damageCalculationService.calculateSalvageValue(
    marketValue,
    minorDamages,
    'Toyota'
  );
  
  console.log('\n📊 Results:');
  console.log(`   Total Deduction: ${(result4.totalDeductionPercent * 100).toFixed(1)}%`);
  console.log(`   Deduction Amount: ₦${result4.totalDeductionAmount.toLocaleString()}`);
  console.log(`   Salvage Value: ₦${result4.salvageValue.toLocaleString()}`);
  console.log(`   Is Total Loss: ${result4.isTotalLoss}\n`);
  
  console.log('✅ Diagnostic complete!');
}

testSalvageCalculation().catch(console.error);
