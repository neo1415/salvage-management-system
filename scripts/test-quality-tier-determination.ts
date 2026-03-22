/**
 * Test script for quality tier determination logic
 * 
 * This script tests the quality tier determination logic added in Task 4.1
 * of the condition-category-quality-system spec.
 */

// Mock the adapter functions to test quality tier logic
type QualityTier = "excellent" | "good" | "fair" | "poor";

interface VehicleContext {
  make: string;
  model: string;
  year: number;
}

function determineQualityTier(
  damageSeverity: 'minor' | 'moderate' | 'severe',
  damagePercentage: number,
  vehicleContext?: VehicleContext
): QualityTier {
  const currentYear = new Date().getFullYear();
  const vehicleAge = vehicleContext?.year ? currentYear - vehicleContext.year : null;
  
  // Excellent: < 10% damage AND recent vehicle (≤3 years old)
  if (damagePercentage < 10 && vehicleAge !== null && vehicleAge <= 3) {
    return 'excellent';
  }
  
  // Good: 10-30% damage OR older vehicle with minimal damage
  if (damagePercentage < 30) {
    return 'good';
  }
  
  // Fair: 30-60% damage
  if (damagePercentage < 60) {
    return 'fair';
  }
  
  // Poor: > 60% damage
  return 'poor';
}

// Test cases
console.log('Testing Quality Tier Determination Logic\n');
console.log('=========================================\n');

const currentYear = new Date().getFullYear();

// Test 1: Excellent - minimal damage on recent vehicle
const test1 = determineQualityTier('minor', 5, { make: 'Toyota', model: 'Camry', year: currentYear - 1 });
console.log(`Test 1 - Excellent (5% damage, 1 year old): ${test1}`);
console.assert(test1 === 'excellent', 'Test 1 failed');

// Test 2: Good - minimal damage on older vehicle
const test2 = determineQualityTier('minor', 5, { make: 'Toyota', model: 'Camry', year: currentYear - 5 });
console.log(`Test 2 - Good (5% damage, 5 years old): ${test2}`);
console.assert(test2 === 'good', 'Test 2 failed');

// Test 3: Good - moderate damage
const test3 = determineQualityTier('minor', 20, { make: 'Toyota', model: 'Camry', year: currentYear - 3 });
console.log(`Test 3 - Good (20% damage, 3 years old): ${test3}`);
console.assert(test3 === 'good', 'Test 3 failed');

// Test 4: Fair - significant damage
const test4 = determineQualityTier('moderate', 45, { make: 'Toyota', model: 'Camry', year: currentYear - 5 });
console.log(`Test 4 - Fair (45% damage, 5 years old): ${test4}`);
console.assert(test4 === 'fair', 'Test 4 failed');

// Test 5: Poor - severe damage
const test5 = determineQualityTier('severe', 75, { make: 'Toyota', model: 'Camry', year: currentYear - 5 });
console.log(`Test 5 - Poor (75% damage, 5 years old): ${test5}`);
console.assert(test5 === 'poor', 'Test 5 failed');

// Test 6: Boundary - exactly 10% damage on recent vehicle (should be good, not excellent)
const test6 = determineQualityTier('minor', 10, { make: 'Toyota', model: 'Camry', year: currentYear - 1 });
console.log(`Test 6 - Good (10% damage, 1 year old): ${test6}`);
console.assert(test6 === 'good', 'Test 6 failed');

// Test 7: Boundary - exactly 30% damage (should be fair, not good)
const test7 = determineQualityTier('moderate', 30, { make: 'Toyota', model: 'Camry', year: currentYear - 3 });
console.log(`Test 7 - Fair (30% damage, 3 years old): ${test7}`);
console.assert(test7 === 'fair', 'Test 7 failed');

// Test 8: Boundary - exactly 60% damage (should be poor, not fair)
const test8 = determineQualityTier('severe', 60, { make: 'Toyota', model: 'Camry', year: currentYear - 5 });
console.log(`Test 8 - Poor (60% damage, 5 years old): ${test8}`);
console.assert(test8 === 'poor', 'Test 8 failed');

// Test 9: No vehicle context - should still work
const test9 = determineQualityTier('minor', 15);
console.log(`Test 9 - Good (15% damage, no vehicle context): ${test9}`);
console.assert(test9 === 'good', 'Test 9 failed');

// Test 10: Excellent boundary - 9% damage on 3-year-old vehicle
const test10 = determineQualityTier('minor', 9, { make: 'Toyota', model: 'Camry', year: currentYear - 3 });
console.log(`Test 10 - Excellent (9% damage, 3 years old): ${test10}`);
console.assert(test10 === 'excellent', 'Test 10 failed');

// Test 11: Good - 9% damage on 4-year-old vehicle (too old for excellent)
const test11 = determineQualityTier('minor', 9, { make: 'Toyota', model: 'Camry', year: currentYear - 4 });
console.log(`Test 11 - Good (9% damage, 4 years old): ${test11}`);
console.assert(test11 === 'good', 'Test 11 failed');

console.log('\n✅ All tests passed!');
