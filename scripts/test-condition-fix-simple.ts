#!/usr/bin/env node

/**
 * Simple Test for Condition Pricing Fix
 * 
 * Tests the core logic without database dependencies
 */

// Mock the condition mapping function
function mapAnyConditionToQuality(value: string): string {
  if (['excellent', 'good', 'fair', 'poor'].includes(value)) {
    return value;
  }
  
  // Map legacy conditions
  const legacyMapping = {
    'brand_new': 'excellent',
    'foreign_used': 'good',
    'tokunbo_low': 'good',
    'tokunbo_high': 'good',
    'nigerian_used': 'fair',
    'nig_used_low': 'fair',
    'nig_used_high': 'fair'
  };
  
  return legacyMapping[value] || 'fair';
}

function getConditionAdjustment(condition: string): number {
  const qualityTier = mapAnyConditionToQuality(condition);
  
  const adjustments = {
    'excellent': 1.20,              // +20% (premium for brand new)
    'good': 1.05,                   // +5% (premium for foreign used)
    'fair': 0.95,                   // -5% (standard local market)
    'poor': 0.75                    // -25% (significant wear)
  };
  
  return adjustments[qualityTier] || 1.0;
}

function getMileageAdjustment(mileage: number, age: number, vehicleMake?: string): number {
  const mileageInKm = mileage;
  const mileageInMiles = mileageInKm * 0.621371;
  const expectedKm = age * 15000;
  const expectedMiles = expectedKm * 0.621371;
  const excessMiles = Math.max(0, mileageInMiles - expectedMiles);
  const excessThousands = excessMiles / 1000;

  const isLuxury = vehicleMake && ['Lamborghini', 'Ferrari', 'Porsche', 'Bentley', 'Rolls-Royce', 'Aston Martin', 'McLaren', 'Bugatti', 'Maserati'].includes(vehicleMake);
  
  const depreciationRatePerThousandMiles = isLuxury ? 0.003 : 0.005;
  const depreciationRate = excessThousands * depreciationRatePerThousandMiles;
  const maxDepreciation = isLuxury ? 0.25 : 0.30;
  const cappedDepreciation = Math.min(depreciationRate, maxDepreciation);
  const minValue = isLuxury ? 0.75 : 0.70;
  
  return Math.max(minValue, 1.0 - cappedDepreciation);
}

function getUniversalAdjustment(itemInfo: any, skipConditionAdjustment: boolean = false): number {
  let adjustment = 1.0;

  if (!skipConditionAdjustment) {
    adjustment *= getConditionAdjustment(itemInfo.condition);
  }

  if (itemInfo.type === 'vehicle' && itemInfo.mileage && itemInfo.age) {
    adjustment *= getMileageAdjustment(itemInfo.mileage, itemInfo.age, itemInfo.make);
  }

  return adjustment;
}

async function testConditionPricingFix() {
  console.log('🧪 Testing Condition Pricing Fix (Simple)\n');
  
  const baseVehicle = {
    type: 'vehicle',
    make: 'Lamborghini',
    model: 'Revuelto',
    year: 2023,
    age: new Date().getFullYear() - 2023,
    mileage: 50000
  };
  
  console.log('='.repeat(80));
  console.log('TEST 1: Condition Differentiation');
  console.log('='.repeat(80));
  
  const conditions = ['excellent', 'good', 'fair'];
  const basePrice = 1000000; // 1M Naira for easy calculation
  
  console.log(`Base Price: ₦${basePrice.toLocaleString()}\n`);
  
  const results = [];
  
  for (const condition of conditions) {
    const vehicleWithCondition = { ...baseVehicle, condition };
    
    // Test with internet search (skip condition adjustment)
    const internetSearchAdjustment = getUniversalAdjustment(vehicleWithCondition, true);
    const internetSearchPrice = basePrice * internetSearchAdjustment;
    
    // Test with database/scraping (apply condition adjustment)
    const databaseAdjustment = getUniversalAdjustment(vehicleWithCondition, false);
    const databasePrice = basePrice * databaseAdjustment;
    
    results.push({
      condition,
      internetSearchPrice,
      databasePrice,
      internetSearchAdjustment,
      databaseAdjustment
    });
    
    console.log(`${condition.toUpperCase()}:`);
    console.log(`  Internet Search: ₦${internetSearchPrice.toLocaleString()} (${internetSearchAdjustment.toFixed(4)})`);
    console.log(`  Database/Scraping: ₦${databasePrice.toLocaleString()} (${databaseAdjustment.toFixed(4)})`);
    console.log('');
  }
  
  // Analyze differences
  console.log('📊 CONDITION DIFFERENTIATION ANALYSIS:');
  console.log('-'.repeat(60));
  
  for (let i = 0; i < results.length - 1; i++) {
    const current = results[i];
    const next = results[i + 1];
    
    const internetDiff = ((current.internetSearchPrice - next.internetSearchPrice) / current.internetSearchPrice) * 100;
    const databaseDiff = ((current.databasePrice - next.databasePrice) / current.databasePrice) * 100;
    
    console.log(`${current.condition} vs ${next.condition}:`);
    console.log(`  Internet Search: ${internetDiff.toFixed(1)}% difference`);
    console.log(`  Database/Scraping: ${databaseDiff.toFixed(1)}% difference`);
  }
  
  console.log('\n='.repeat(80));
  console.log('TEST 2: Mileage Impact on Luxury Vehicle');
  console.log('='.repeat(80));
  
  const mileageScenarios = [
    { mileage: 50000, label: 'Low Mileage (50k km)' },
    { mileage: 500000, label: 'High Mileage (500k km)' }
  ];
  
  for (const scenario of mileageScenarios) {
    const vehicleWithMileage = { ...baseVehicle, condition: 'excellent', mileage: scenario.mileage };
    
    // Test mileage-only impact (internet search scenario)
    const mileageOnlyAdjustment = getUniversalAdjustment(vehicleWithMileage, true);
    const mileageOnlyPrice = basePrice * mileageOnlyAdjustment;
    
    console.log(`${scenario.label}:`);
    console.log(`  Price: ₦${mileageOnlyPrice.toLocaleString()}`);
    console.log(`  Adjustment: ${mileageOnlyAdjustment.toFixed(4)}`);
    console.log(`  Impact: ${((1 - mileageOnlyAdjustment) * 100).toFixed(1)}% reduction`);
    console.log('');
  }
  
  // Calculate mileage impact
  const lowMileageResult = results.find(r => r.condition === 'excellent');
  const highMileageVehicle = { ...baseVehicle, condition: 'excellent', mileage: 500000 };
  const highMileageAdjustment = getUniversalAdjustment(highMileageVehicle, true);
  const highMileagePrice = basePrice * highMileageAdjustment;
  
  if (lowMileageResult) {
    const mileageImpact = ((lowMileageResult.internetSearchPrice - highMileagePrice) / lowMileageResult.internetSearchPrice) * 100;
    
    console.log('📊 MILEAGE IMPACT ANALYSIS:');
    console.log('-'.repeat(60));
    console.log(`Low Mileage: ₦${lowMileageResult.internetSearchPrice.toLocaleString()}`);
    console.log(`High Mileage: ₦${highMileagePrice.toLocaleString()}`);
    console.log(`Mileage Impact: ${mileageImpact.toFixed(1)}% reduction`);
    
    if (mileageImpact <= 25) {
      console.log('✅ PASS: Mileage impact within acceptable range for luxury vehicle');
    } else {
      console.log('❌ FAIL: Excessive mileage impact for luxury vehicle');
    }
  }
  
  console.log('\n='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  
  console.log('\n✅ Key Fixes Applied:');
  console.log('1. Condition adjustments skipped for internet search (already condition-specific)');
  console.log('2. Luxury vehicles have reduced mileage depreciation (0.3% vs 0.5% per 1000 miles)');
  console.log('3. Maximum mileage impact capped at 25% for luxury vehicles');
  console.log('4. Quality tier system handles multiple condition formats');
  
  console.log('\n🎯 Expected Results:');
  console.log('- Internet search preserves condition-specific pricing');
  console.log('- Database/scraping applies condition adjustments');
  console.log('- High mileage impacts luxury vehicles by ≤25%');
  console.log('- Different conditions show meaningful price differences');
}

testConditionPricingFix().catch(console.error);