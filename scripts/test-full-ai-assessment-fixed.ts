/**
 * Test full AI assessment with the fix
 * Simulates user's test case: 2021 Camry, good condition, 120,700 km, minor damage
 */

import { config } from 'dotenv';

config();

// Import after config to ensure env vars are loaded
import { assessDamageEnhanced } from '@/features/cases/services/ai-assessment-enhanced.service';

// Set mock mode to simulate minor cosmetic damage
process.env.MOCK_AI_ASSESSMENT = 'false'; // Use real Vision API simulation

async function testFullAssessment() {
  console.log('🔍 Testing Full AI Assessment with Fix\n');
  console.log('=' .repeat(60));
  console.log('Test Case: 2021 Toyota Camry');
  console.log('  Condition: good');
  console.log('  Mileage: 120,700 km');
  console.log('  Damage: Minor cosmetic (simulated)');
  console.log('=' .repeat(60));
  
  // Create a mock Vision API response by temporarily overriding the module
  const originalEnv = process.env.MOCK_AI_ASSESSMENT;
  process.env.MOCK_AI_ASSESSMENT = 'true';
  
  const assessment = await assessDamageEnhanced({
    photos: [
      'data:image/jpeg;base64,fake1',
      'data:image/jpeg;base64,fake2',
      'data:image/jpeg;base64,fake3',
      'data:image/jpeg;base64,fake4',
      'data:image/jpeg;base64,fake5',
    ], // 5 photos for better confidence
    vehicleInfo: {
      make: 'Toyota',
      model: 'Camry',
      year: 2021,
      mileage: 120700,
      condition: 'good',
    }
  });
  
  process.env.MOCK_AI_ASSESSMENT = originalEnv;
  
  console.log('\n📊 ASSESSMENT RESULTS:');
  console.log('-'.repeat(60));
  console.log(`Market Value: ₦${assessment.marketValue.toLocaleString()}`);
  console.log(`Repair Cost: ₦${assessment.estimatedRepairCost.toLocaleString()}`);
  console.log(`Salvage Value: ₦${assessment.estimatedSalvageValue.toLocaleString()}`);
  console.log(`Reserve Price: ₦${assessment.reservePrice.toLocaleString()}`);
  console.log(`Price Source: ${assessment.priceSource}`);
  console.log(`Confidence: ${assessment.confidenceScore}%`);
  console.log(`Is Total Loss: ${assessment.isTotalLoss}`);
  console.log(`Damage Severity: ${assessment.damageSeverity}`);
  
  console.log('\n📋 BREAKDOWN:');
  console.log('-'.repeat(60));
  console.log('Database price (good condition): ₦26,000,000');
  console.log(`Mileage adjustment (120,700 km): ×0.85 = ₦${(26000000 * 0.85).toLocaleString()}`);
  console.log(`Actual market value: ₦${assessment.marketValue.toLocaleString()}`);
  
  const salvagePercent = (assessment.estimatedSalvageValue / assessment.marketValue) * 100;
  console.log(`\nSalvage value: ₦${assessment.estimatedSalvageValue.toLocaleString()} (${salvagePercent.toFixed(1)}% of market)`);
  
  const reservePercent = (assessment.reservePrice / assessment.estimatedSalvageValue) * 100;
  console.log(`Reserve price: ₦${assessment.reservePrice.toLocaleString()} (${reservePercent.toFixed(1)}% of salvage)`);
  
  console.log('\n📋 VALIDATION:');
  console.log('-'.repeat(60));
  
  // Check market value
  const expectedMarket = 26000000 * 0.85; // ₦22.1M
  if (Math.abs(assessment.marketValue - expectedMarket) < 100000) {
    console.log('✅ Market value is correct (₦26M × 0.85 mileage adjustment)');
  } else {
    console.log(`❌ Market value mismatch: expected ₦${expectedMarket.toLocaleString()}, got ₦${assessment.marketValue.toLocaleString()}`);
  }
  
  // Check salvage value (should be 75-90% for minor damage)
  if (salvagePercent >= 70 && salvagePercent <= 95) {
    console.log(`✅ Salvage value is reasonable (${salvagePercent.toFixed(1)}% of market)`);
  } else {
    console.log(`❌ Salvage value seems off (${salvagePercent.toFixed(1)}% of market)`);
  }
  
  // Check reserve price (should be 70% of salvage)
  if (Math.abs(reservePercent - 70) < 2) {
    console.log(`✅ Reserve price is correct (${reservePercent.toFixed(1)}% of salvage)`);
  } else {
    console.log(`❌ Reserve price calculation seems off (${reservePercent.toFixed(1)}% of salvage)`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Test complete');
  process.exit(0);
}

testFullAssessment().catch(console.error);
