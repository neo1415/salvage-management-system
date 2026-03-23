/**
 * Test script to verify Gemini is being used for damage detection
 * 
 * This script tests the fix for the issue where totaled cars were being
 * assessed as "minor" damage because the system was using Vision API
 * instead of Gemini.
 */

import { assessDamageEnhanced } from '@/features/cases/services/ai-assessment-enhanced.service';

async function testGeminiFix() {
  console.log('='.repeat(80));
  console.log('Testing Gemini Damage Detection Fix');
  console.log('='.repeat(80));
  console.log();
  
  // Test with a totaled Mercedes-Benz GLE350 W166 2016
  const vehicleInfo = {
    make: 'Mercedes-Benz',
    model: 'GLE350 W166',
    year: 2016,
    mileage: 50000,
    condition: 'excellent' as const,
  };
  
  // Use placeholder photos (in real scenario, these would be actual photos)
  const photos = [
    'https://example.com/photo1.jpg',
    'https://example.com/photo2.jpg',
    'https://example.com/photo3.jpg',
    'https://example.com/photo4.jpg',
  ];
  
  console.log('Vehicle:', vehicleInfo.make, vehicleInfo.model, vehicleInfo.year);
  console.log('Photos:', photos.length);
  console.log();
  console.log('Running assessment...');
  console.log();
  
  try {
    const result = await assessDamageEnhanced({
      photos,
      vehicleInfo,
    });
    
    console.log('='.repeat(80));
    console.log('Assessment Result:');
    console.log('='.repeat(80));
    console.log('Severity:', result.damageSeverity);
    console.log('Confidence:', result.confidenceScore);
    console.log('Market Value:', result.marketValue.toLocaleString());
    console.log('Salvage Value:', result.estimatedSalvageValue.toLocaleString());
    console.log('Repair Cost:', result.estimatedRepairCost.toLocaleString());
    console.log('Analysis Method:', result.analysisMethod);
    console.log();
    console.log('Damage Scores:');
    console.log('  Structural:', result.damageScore.structural);
    console.log('  Mechanical:', result.damageScore.mechanical);
    console.log('  Cosmetic:', result.damageScore.cosmetic);
    console.log('  Electrical:', result.damageScore.electrical);
    console.log('  Interior:', result.damageScore.interior);
    console.log();
    
    // Check if Gemini was used
    if (result.analysisMethod === 'google-vision') {
      console.log('⚠️  WARNING: Still using Vision API!');
      console.log('   Expected: Gemini should be used when vehicle context is provided');
      console.log('   Check: GEMINI_API_KEY is configured and Gemini service is enabled');
    } else {
      console.log('✅ SUCCESS: Using enhanced AI method');
    }
    
  } catch (error: any) {
    console.error('❌ Assessment failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testGeminiFix().catch(console.error);
