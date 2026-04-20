/**
 * Test script to verify that real part prices are prioritized over multipliers
 * 
 * This test demonstrates:
 * 1. Parts with real prices use actual cost (NO multipliers)
 * 2. Parts without prices use traditional deductions (WITH multipliers)
 * 3. The system prioritizes real data over assumptions
 */

import { damageCalculationService } from '../src/features/valuations/services/damage-calculation.service';

async function testRealDataPriority() {
  console.log('🧪 Testing Real Data Priority Over Assumptions\n');
  console.log('='.repeat(80));
  
  const basePrice = 5700000; // ₦5.7M market value
  
  // Scenario: 13 severely damaged parts
  // - 10 parts have REAL prices from internet search
  // - 3 parts have NO prices (will use traditional deductions)
  const damages = [
    { component: 'front bumper', damageLevel: 'severe' as const },
    { component: 'hood', damageLevel: 'severe' as const },
    { component: 'headlight', damageLevel: 'severe' as const },
    { component: 'windshield', damageLevel: 'severe' as const },
    { component: 'front fender', damageLevel: 'severe' as const },
    { component: 'door', damageLevel: 'severe' as const },
    { component: 'side mirror', damageLevel: 'severe' as const },
    { component: 'rear bumper', damageLevel: 'severe' as const },
    { component: 'taillight', damageLevel: 'severe' as const },
    { component: 'trunk', damageLevel: 'severe' as const },
    // These 3 have no real prices
    { component: 'engine', damageLevel: 'severe' as const },
    { component: 'transmission', damageLevel: 'severe' as const },
    { component: 'suspension', damageLevel: 'severe' as const },
  ];
  
  // Real part prices from internet search (10 parts)
  const partPrices = [
    { component: 'front bumper', partPrice: 150000, confidence: 0.9, source: 'internet_search' as const },
    { component: 'hood', partPrice: 200000, confidence: 0.85, source: 'internet_search' as const },
    { component: 'headlight', partPrice: 80000, confidence: 0.95, source: 'internet_search' as const },
    { component: 'windshield', partPrice: 120000, confidence: 0.9, source: 'internet_search' as const },
    { component: 'front fender', partPrice: 100000, confidence: 0.85, source: 'internet_search' as const },
    { component: 'door', partPrice: 180000, confidence: 0.9, source: 'internet_search' as const },
    { component: 'side mirror', partPrice: 50000, confidence: 0.95, source: 'internet_search' as const },
    { component: 'rear bumper', partPrice: 140000, confidence: 0.85, source: 'internet_search' as const },
    { component: 'taillight', partPrice: 70000, confidence: 0.9, source: 'internet_search' as const },
    { component: 'trunk', partPrice: 110000, confidence: 0.85, source: 'internet_search' as const },
    // These 3 have no prices - will use traditional deductions
    { component: 'engine', source: 'not_found' as const },
    { component: 'transmission', source: 'not_found' as const },
    { component: 'suspension', source: 'not_found' as const },
  ];
  
  console.log('\n📋 Test Scenario:');
  console.log(`   Base price: ₦${basePrice.toLocaleString()}`);
  console.log(`   Total damaged parts: ${damages.length} (all severe)`);
  console.log(`   Parts with REAL prices: ${partPrices.filter(p => p.partPrice).length}`);
  console.log(`   Parts WITHOUT prices: ${partPrices.filter(p => !p.partPrice).length}`);
  
  const totalRealCost = partPrices
    .filter(p => p.partPrice)
    .reduce((sum, p) => sum + (p.partPrice || 0), 0);
  
  console.log(`\n💰 Total REAL parts cost: ₦${totalRealCost.toLocaleString()}`);
  console.log(`   (This is ${((totalRealCost / basePrice) * 100).toFixed(1)}% of base price)`);
  
  console.log('\n' + '='.repeat(80));
  console.log('🔄 Running Calculation...\n');
  
  const result = await damageCalculationService.calculateSalvageValueWithPartPrices(
    basePrice,
    damages,
    partPrices
  );
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 RESULTS:\n');
  
  console.log(`✅ Salvage Value: ₦${result.salvageValue.toLocaleString()}`);
  console.log(`📉 Total Deduction: ${(result.totalDeductionPercent * 100).toFixed(1)}%`);
  console.log(`💵 Deduction Amount: ₦${result.totalDeductionAmount.toLocaleString()}`);
  console.log(`🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
  console.log(`🚨 Total Loss: ${result.isTotalLoss ? 'YES' : 'NO'}`);
  
  if (result.partPricesUsed) {
    console.log(`\n💡 Real Part Prices Used:`);
    console.log(`   Real parts cost: ₦${result.realPartsCost?.toLocaleString()}`);
    console.log(`   Part price confidence: ${((result.partPriceConfidence || 0) * 100).toFixed(1)}%`);
  }
  
  console.log(`\n📋 Deduction Breakdown:`);
  result.deductions.forEach((d, i) => {
    const source = d.source === 'internet_search' ? '🌐 REAL' : '🔧 TRAD';
    console.log(`   ${i + 1}. ${source} ${d.component}: ₦${d.deductionAmount.toLocaleString()} (${(d.deductionPercent * 100).toFixed(1)}%)`);
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Test Complete!\n');
  
  // Verify expectations
  console.log('🔍 Verification:');
  const realPriceDeductions = result.deductions.filter(d => d.source === 'internet_search');
  const traditionalDeductions = result.deductions.filter(d => d.source === 'database');
  
  console.log(`   ✓ Real price deductions: ${realPriceDeductions.length} (expected: 10)`);
  console.log(`   ✓ Traditional deductions: ${traditionalDeductions.length} (expected: 3)`);
  
  const realPriceTotal = realPriceDeductions.reduce((sum, d) => sum + d.deductionAmount, 0);
  console.log(`   ✓ Real price total: ₦${realPriceTotal.toLocaleString()} (expected: ₦${totalRealCost.toLocaleString()})`);
  
  if (Math.abs(realPriceTotal - totalRealCost) < 1) {
    console.log(`   ✅ PASS: Real prices used directly without multipliers!`);
  } else {
    console.log(`   ❌ FAIL: Real prices were modified by multipliers!`);
  }
}

testRealDataPriority().catch(console.error);
