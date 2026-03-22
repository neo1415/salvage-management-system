#!/usr/bin/env node

/**
 * Debug Mileage Adjustment Issue
 * 
 * Simple test to check why mileage adjustment is still showing 42.7% impact
 * when it should be capped at 25% for luxury vehicles.
 */

// Mock the functions to avoid database dependencies
function getMileageAdjustment(mileage: number, age: number, vehicleMake?: string): number {
  // Convert km to miles if needed (assuming input is in km for Nigerian market)
  const mileageInKm = mileage;
  const mileageInMiles = mileageInKm * 0.621371;

  // Expected mileage: ~15,000 km per year in Nigeria
  const expectedKm = age * 15000;
  const expectedMiles = expectedKm * 0.621371;

  // Calculate excess mileage in thousands of miles
  const excessMiles = Math.max(0, mileageInMiles - expectedMiles);
  const excessThousands = excessMiles / 1000;

  // Luxury vehicles depreciate less aggressively with mileage
  const isLuxury = vehicleMake && ['Lamborghini', 'Ferrari', 'Porsche', 'Bentley', 'Rolls-Royce', 'Aston Martin', 'McLaren', 'Bugatti', 'Maserati'].includes(vehicleMake);
  
  // Apply different depreciation rates for luxury vs regular vehicles
  const depreciationRatePerThousandMiles = isLuxury ? 0.003 : 0.005; // 0.3% vs 0.5% per 1,000 miles
  const depreciationRate = excessThousands * depreciationRatePerThousandMiles;

  // Cap maximum depreciation differently for luxury vs regular vehicles
  const maxDepreciation = isLuxury ? 0.25 : 0.30; // 25% vs 30% max
  const cappedDepreciation = Math.min(depreciationRate, maxDepreciation);

  // Return adjustment factor (1.0 = no change, 0.9 = 10% reduction)
  const minValue = isLuxury ? 0.75 : 0.70; // Minimum 75% vs 70% of value
  return Math.max(minValue, 1.0 - cappedDepreciation);
}

function getConditionAdjustment(condition: string): number {
  // Mock the mapAnyConditionToQuality function
  const mapAnyConditionToQuality = (value: string) => {
    if (['excellent', 'good', 'fair', 'poor'].includes(value)) {
      return value;
    }
    return 'fair'; // fallback
  };
  
  const qualityTier = mapAnyConditionToQuality(condition);
  
  const adjustments = {
    'excellent': 1.20,              // +20% (premium for brand new)
    'good': 1.05,                   // +5% (premium for foreign used)
    'fair': 0.95,                   // -5% (standard local market)
    'poor': 0.75                    // -25% (significant wear)
  };
  
  return adjustments[qualityTier] || 1.0; // Default to no adjustment
}

function getUniversalAdjustment(itemInfo: any, skipConditionAdjustment: boolean = false): number {
  let adjustment = 1.0;

  // Apply condition adjustment (universal for all items) - but skip if already condition-adjusted
  if (!skipConditionAdjustment) {
    adjustment *= getConditionAdjustment(itemInfo.condition);
  }

  // Apply mileage adjustment for vehicles
  if (itemInfo.type === 'vehicle' && itemInfo.mileage && itemInfo.age) {
    adjustment *= getMileageAdjustment(itemInfo.mileage, itemInfo.age, itemInfo.make);
  }

  return adjustment;
}

async function debugMileageAdjustment() {
  console.log('🔍 Debugging Mileage Adjustment Issue\n');
  
  const baseVehicle = {
    type: 'vehicle',
    make: 'Lamborghini',
    model: 'Revuelto',
    year: 2023,
    condition: 'excellent',
    age: new Date().getFullYear() - 2023 // Current age
  };
  
  console.log('Vehicle Info:', baseVehicle);
  console.log('Current Year:', new Date().getFullYear());
  console.log('Vehicle Age:', baseVehicle.age, 'years\n');
  
  // Test different mileage scenarios
  const scenarios = [
    { mileage: 50000, label: 'Low Mileage (50k km)' },
    { mileage: 500000, label: 'High Mileage (500k km)' }
  ];
  
  for (const scenario of scenarios) {
    console.log(`=== ${scenario.label} ===`);
    
    const vehicleWithMileage = { ...baseVehicle, mileage: scenario.mileage };
    
    // Test with condition adjustment (old behavior)
    const adjustmentWithCondition = getUniversalAdjustment(vehicleWithMileage, false);
    
    // Test without condition adjustment (new behavior for internet search)
    const adjustmentWithoutCondition = getUniversalAdjustment(vehicleWithMileage, true);
    
    // Calculate individual components
    const mileageOnly = getMileageAdjustment(scenario.mileage, baseVehicle.age, baseVehicle.make);
    const conditionOnly = getConditionAdjustment(baseVehicle.condition);
    
    console.log(`Mileage: ${scenario.mileage.toLocaleString()} km`);
    console.log(`Expected mileage for ${baseVehicle.age} years: ${(baseVehicle.age * 15000).toLocaleString()} km`);
    console.log(`Excess mileage: ${Math.max(0, scenario.mileage - (baseVehicle.age * 15000)).toLocaleString()} km`);
    console.log(`Condition adjustment: ${conditionOnly.toFixed(4)} (${((conditionOnly - 1) * 100).toFixed(1)}% change)`);
    console.log(`Mileage adjustment: ${mileageOnly.toFixed(4)} (${((1 - mileageOnly) * 100).toFixed(1)}% reduction)`);
    console.log(`Combined with condition: ${adjustmentWithCondition.toFixed(4)}`);
    console.log(`Mileage only (skip condition): ${adjustmentWithoutCondition.toFixed(4)}`);
    
    // Simulate price impact
    const basePrice = 1000000; // 1M for easy calculation
    const priceWithCondition = basePrice * adjustmentWithCondition;
    const priceWithoutCondition = basePrice * adjustmentWithoutCondition;
    
    console.log(`\nPrice Impact (base: ₦${basePrice.toLocaleString()}):`);
    console.log(`With condition: ₦${priceWithCondition.toLocaleString()}`);
    console.log(`Without condition: ₦${priceWithoutCondition.toLocaleString()}`);
    console.log(`Total reduction (with condition): ${((basePrice - priceWithCondition) / basePrice * 100).toFixed(1)}%`);
    console.log(`Total reduction (mileage only): ${((basePrice - priceWithoutCondition) / basePrice * 100).toFixed(1)}%`);
    console.log('');
  }
  
  // Test luxury detection
  console.log('=== Luxury Detection Test ===');
  const luxuryMakes = ['Lamborghini', 'Ferrari', 'Porsche', 'Toyota'];
  
  for (const make of luxuryMakes) {
    const isLuxury = ['Lamborghini', 'Ferrari', 'Porsche', 'Bentley', 'Rolls-Royce', 'Aston Martin', 'McLaren', 'Bugatti', 'Maserati'].includes(make);
    console.log(`${make}: ${isLuxury ? 'LUXURY' : 'REGULAR'}`);
  }
}

debugMileageAdjustment().catch(console.error);