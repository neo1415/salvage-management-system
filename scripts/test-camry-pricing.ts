#!/usr/bin/env tsx

/**
 * Test script to check Toyota Camry 2022 pricing logic
 */

async function testCamryPricing() {
  console.log('🚗 Testing Toyota Camry 2022 Pricing Logic\n');

  // Expected pricing for 2022 Toyota Camry in Nigeria:
  // - Brand New: ~₦25-30M (dealer price)
  // - Foreign Used (Tokunbo): ~₦15-20M (good condition, low mileage)
  // - Nigerian Used: ~₦8-12M (fair condition, higher mileage)

  const basePrice = 10000000; // 10M base (from estimateMarketValue function)
  const currentYear = 2026;
  const vehicleYear = 2022;
  const age = currentYear - vehicleYear; // 4 years
  const mileage = 45000; // 45k km

  console.log('📊 Pricing Calculation:');
  console.log(`   Base Price: ₦${basePrice.toLocaleString()}`);
  console.log(`   Vehicle Age: ${age} years`);
  console.log(`   Mileage: ${mileage.toLocaleString()} km`);

  // Apply depreciation (15% per year)
  let depreciatedValue = basePrice * Math.pow(0.85, age);
  console.log(`   After Depreciation (15%/year): ₦${Math.round(depreciatedValue).toLocaleString()}`);

  // Apply mileage adjustment (45k km is good for 4 years)
  const expectedMileagePerYear = 15000; // 15k km/year is average
  const expectedMileage = age * expectedMileagePerYear; // 60k km expected
  const actualMileage = mileage; // 45k km actual
  const mileageAdjustment = actualMileage < expectedMileage ? 1.05 : 0.95; // +5% for low mileage
  depreciatedValue *= mileageAdjustment;
  console.log(`   After Mileage Adjustment (+5% for low mileage): ₦${Math.round(depreciatedValue).toLocaleString()}`);

  // Apply condition adjustment for "Nigerian Used" (fair condition)
  const conditionAdjustment = 0.85; // -15% for fair condition
  depreciatedValue *= conditionAdjustment;
  console.log(`   After Condition Adjustment (-15% for Nigerian Used): ₦${Math.round(depreciatedValue).toLocaleString()}`);

  const finalPrice = Math.round(depreciatedValue);
  console.log(`\n🎯 Final Estimated Price: ₦${finalPrice.toLocaleString()}`);

  // Check if it's in reasonable range
  const reasonableRange = { min: 4000000, max: 8000000 };
  const isReasonable = finalPrice >= reasonableRange.min && finalPrice <= reasonableRange.max;
  
  console.log(`\n✅ Validation:`);
  console.log(`   Expected Range: ₦${reasonableRange.min.toLocaleString()} - ₦${reasonableRange.max.toLocaleString()}`);
  console.log(`   Calculated Price: ₦${finalPrice.toLocaleString()}`);
  console.log(`   Result: ${isReasonable ? '✅ REASONABLE' : '❌ TOO HIGH'}`);

  if (!isReasonable) {
    console.log(`\n💡 Suggestion: The base price of ₦10M might be too high for Nigerian market conditions.`);
    console.log(`   Consider using ₦6-7M as base for more realistic pricing.`);
  }
}

testCamryPricing().catch(console.error);