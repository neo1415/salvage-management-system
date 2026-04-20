/**
 * Comprehensive test for all damage scenarios
 * Tests minor, moderate, and severe damage with various part counts
 */

import { damageCalculationService } from '@/features/valuations/services/damage-calculation.service';

async function testAllScenarios() {
  console.log('🧪 Comprehensive Salvage Value Testing\n');
  console.log('═'.repeat(70));
  
  const marketValue = 5000000; // ₦5M base for all tests
  
  // Test 1: Minor damage (1-3 parts)
  console.log('\n📋 Test 1: Minor Damage (3 parts)');
  console.log('─'.repeat(70));
  const minorDamages = [
    { component: 'bumper', damageLevel: 'minor' as const },
    { component: 'headlight', damageLevel: 'minor' as const },
    { component: 'mirror', damageLevel: 'minor' as const },
  ];
  
  const result1 = await damageCalculationService.calculateSalvageValue(marketValue, minorDamages);
  console.log(`✅ Deduction: ${(result1.totalDeductionPercent * 100).toFixed(1)}% | Salvage: ₦${result1.salvageValue.toLocaleString()} | Total Loss: ${result1.isTotalLoss}`);
  
  // Test 2: Moderate damage (4-6 parts)
  console.log('\n📋 Test 2: Moderate Damage (5 parts)');
  console.log('─'.repeat(70));
  const moderateDamages = [
    { component: 'bumper', damageLevel: 'moderate' as const },
    { component: 'headlight', damageLevel: 'moderate' as const },
    { component: 'hood', damageLevel: 'moderate' as const },
    { component: 'fender', damageLevel: 'minor' as const },
    { component: 'door', damageLevel: 'minor' as const },
  ];
  
  const result2 = await damageCalculationService.calculateSalvageValue(marketValue, moderateDamages);
  console.log(`✅ Deduction: ${(result2.totalDeductionPercent * 100).toFixed(1)}% | Salvage: ₦${result2.salvageValue.toLocaleString()} | Total Loss: ${result2.isTotalLoss}`);
  
  // Test 3: Severe damage (7-9 parts)
  console.log('\n📋 Test 3: Severe Damage (8 parts)');
  console.log('─'.repeat(70));
  const severeDamages = [
    { component: 'bumper', damageLevel: 'severe' as const },
    { component: 'headlight', damageLevel: 'severe' as const },
    { component: 'hood', damageLevel: 'severe' as const },
    { component: 'fender', damageLevel: 'moderate' as const },
    { component: 'door', damageLevel: 'moderate' as const },
    { component: 'mirror', damageLevel: 'moderate' as const },
    { component: 'windshield', damageLevel: 'minor' as const },
    { component: 'grille', damageLevel: 'minor' as const },
  ];
  
  const result3 = await damageCalculationService.calculateSalvageValue(marketValue, severeDamages);
  console.log(`✅ Deduction: ${(result3.totalDeductionPercent * 100).toFixed(1)}% | Salvage: ₦${result3.salvageValue.toLocaleString()} | Total Loss: ${result3.isTotalLoss}`);
  
  // Test 4: Massive damage (10-12 parts)
  console.log('\n📋 Test 4: Massive Damage (11 parts)');
  console.log('─'.repeat(70));
  const massiveDamages = [
    { component: 'bumper', damageLevel: 'severe' as const },
    { component: 'headlight', damageLevel: 'severe' as const },
    { component: 'hood', damageLevel: 'severe' as const },
    { component: 'fender', damageLevel: 'severe' as const },
    { component: 'door', damageLevel: 'severe' as const },
    { component: 'mirror', damageLevel: 'moderate' as const },
    { component: 'windshield', damageLevel: 'moderate' as const },
    { component: 'grille', damageLevel: 'moderate' as const },
    { component: 'wheel', damageLevel: 'moderate' as const },
    { component: 'taillight', damageLevel: 'minor' as const },
    { component: 'trunk', damageLevel: 'minor' as const },
  ];
  
  const result4 = await damageCalculationService.calculateSalvageValue(marketValue, massiveDamages);
  console.log(`✅ Deduction: ${(result4.totalDeductionPercent * 100).toFixed(1)}% | Salvage: ₦${result4.salvageValue.toLocaleString()} | Total Loss: ${result4.isTotalLoss}`);
  
  // Test 5: Total loss (13+ parts, all severe)
  console.log('\n📋 Test 5: Total Loss (13 parts, all severe)');
  console.log('─'.repeat(70));
  const totalLossDamages = [
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
  
  const result5 = await damageCalculationService.calculateSalvageValue(marketValue, totalLossDamages);
  console.log(`✅ Deduction: ${(result5.totalDeductionPercent * 100).toFixed(1)}% | Salvage: ₦${result5.salvageValue.toLocaleString()} | Total Loss: ${result5.isTotalLoss}`);
  
  // Test 6: With real part prices (moderate damage)
  console.log('\n📋 Test 6: Moderate Damage with Real Part Prices');
  console.log('─'.repeat(70));
  const partPrices = [
    { component: 'bumper', partPrice: 250000, confidence: 0.95, source: 'internet_search' as const },
    { component: 'headlight', partPrice: 180000, confidence: 0.90, source: 'internet_search' as const },
    { component: 'hood', partPrice: 320000, confidence: 0.92, source: 'internet_search' as const },
  ];
  
  const result6 = await damageCalculationService.calculateSalvageValueWithPartPrices(
    marketValue,
    moderateDamages,
    partPrices
  );
  console.log(`✅ Deduction: ${(result6.totalDeductionPercent * 100).toFixed(1)}% | Salvage: ₦${result6.salvageValue.toLocaleString()} | Total Loss: ${result6.isTotalLoss}`);
  console.log(`   Part prices used: ${result6.partPricesUsed} | Real parts cost: ₦${result6.realPartsCost?.toLocaleString()}`);
  
  // Summary
  console.log('\n═'.repeat(70));
  console.log('📊 Summary of Expected Behavior:');
  console.log('─'.repeat(70));
  console.log('Minor (1-3 parts):     10-20% deduction, NOT total loss');
  console.log('Moderate (4-6 parts):  40-65% deduction, NOT total loss');
  console.log('Severe (7-9 parts):    60-75% deduction, MAY BE total loss');
  console.log('Massive (10-12 parts): 70-85% deduction, LIKELY total loss');
  console.log('Total Loss (13+ severe): 75-90% deduction, DEFINITELY total loss');
  console.log('═'.repeat(70));
  console.log('\n✅ All tests complete!');
}

testAllScenarios().catch(console.error);
