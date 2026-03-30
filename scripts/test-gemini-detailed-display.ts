/**
 * Test script to verify Gemini detailed display fix
 * 
 * This script tests:
 * 1. API returns itemDetails and damagedParts
 * 2. Total loss criteria are conservative
 * 3. Mercedes GLE example is marked as repairable
 */

import { assessDamageEnhanced } from '@/features/cases/services/ai-assessment-enhanced.service';
import { initializeGeminiService } from '@/lib/integrations/gemini-damage-detection';

async function testGeminiDetailedDisplay() {
  console.log('🧪 Testing Gemini Detailed Display Fix...\n');

  // Initialize Gemini service
  await initializeGeminiService();

  // Test case: Mercedes GLE with front and rear damage (should NOT be total loss)
  const testPhotos = [
    'data:image/jpeg;base64,/9j/4AAQSkZJRg...', // Placeholder - replace with actual base64
    'data:image/jpeg;base64,/9j/4AAQSkZJRg...', // Placeholder - replace with actual base64
    'data:image/jpeg;base64,/9j/4AAQSkZJRg...', // Placeholder - replace with actual base64
  ];

  const vehicleInfo = {
    make: 'Mercedes-Benz',
    model: 'GLE',
    year: 2020,
    condition: 'Foreign Used (Tokunbo)' as const,
  };

  console.log('📸 Testing with Mercedes GLE 2020...');
  console.log('Expected: itemDetails and damagedParts should be present');
  console.log('Expected: totalLoss should be FALSE (body panel damage is repairable)\n');

  try {
    const assessment = await assessDamageEnhanced({
      photos: testPhotos,
      vehicleInfo,
    });

    console.log('✅ Assessment completed!\n');

    // Test 1: Check if itemDetails is present
    console.log('TEST 1: Item Details Present');
    if (assessment.itemDetails) {
      console.log('✅ PASS: itemDetails is present');
      console.log('   Details:', JSON.stringify(assessment.itemDetails, null, 2));
    } else {
      console.log('❌ FAIL: itemDetails is missing');
    }
    console.log('');

    // Test 2: Check if damagedParts is present
    console.log('TEST 2: Damaged Parts Present');
    if (assessment.damagedParts && assessment.damagedParts.length > 0) {
      console.log(`✅ PASS: damagedParts is present (${assessment.damagedParts.length} parts)`);
      console.log('   Parts:');
      assessment.damagedParts.forEach((part, index) => {
        console.log(`   ${index + 1}. ${part.part} - ${part.severity} (${part.confidence}% confidence)`);
      });
    } else {
      console.log('❌ FAIL: damagedParts is missing or empty');
    }
    console.log('');

    // Test 3: Check total loss determination
    console.log('TEST 3: Total Loss Determination');
    if (assessment.isTotalLoss === false) {
      console.log('✅ PASS: Vehicle correctly marked as repairable (NOT total loss)');
    } else if (assessment.isTotalLoss === true) {
      console.log('❌ FAIL: Vehicle incorrectly marked as total loss');
      console.log('   This is body panel damage and should be repairable!');
    } else {
      console.log('⚠️  WARNING: isTotalLoss is undefined');
    }
    console.log('');

    // Test 4: Check analysis method
    console.log('TEST 4: Analysis Method');
    console.log(`   Method: ${assessment.analysisMethod}`);
    if (assessment.analysisMethod === 'gemini') {
      console.log('✅ PASS: Using Gemini for analysis');
    } else {
      console.log('⚠️  WARNING: Not using Gemini (may be using Vision API fallback)');
    }
    console.log('');

    // Summary
    console.log('📊 SUMMARY:');
    console.log(`   Severity: ${assessment.damageSeverity}`);
    console.log(`   Confidence: ${assessment.confidenceScore}%`);
    console.log(`   Market Value: ₦${assessment.marketValue.toLocaleString()}`);
    console.log(`   Salvage Value: ₦${assessment.estimatedSalvageValue.toLocaleString()}`);
    console.log(`   Repair Cost: ₦${assessment.estimatedRepairCost.toLocaleString()}`);
    console.log(`   Total Loss: ${assessment.isTotalLoss ? 'YES' : 'NO'}`);
    console.log(`   Analysis Method: ${assessment.analysisMethod}`);

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
  }
}

// Run the test
testGeminiDetailedDisplay()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
