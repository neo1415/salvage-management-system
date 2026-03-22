import 'dotenv/config';
import { assessDamageEnhanced } from '@/features/cases/services/ai-assessment-enhanced.service';

async function testDamageDetection() {
  console.log('\n🔍 TESTING DAMAGE DETECTION FIX\n');
  console.log('=' .repeat(80));
  
  // Test with mock mode (simulates Vision API returning "Traffic collision")
  process.env.MOCK_AI_ASSESSMENT = 'true';
  
  console.log('\n📸 Testing with mock collision damage...\n');
  
  // Use base64 mock images
  const mockPhoto = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA==';
  
  const assessment = await assessDamageEnhanced({
    photos: [mockPhoto, mockPhoto],
    vehicleInfo: {
      make: 'Mercedes-Benz',
      model: 'GLE350 W166',
      year: 2016,
      condition: 'excellent',
      mileage: 50000,
    },
  });
  
  console.log('\n📊 ASSESSMENT RESULTS:\n');
  console.log(`Damage Severity:     ${assessment.damageSeverity}`);
  console.log(`Damage Percentage:   ${assessment.damagePercentage}%`);
  console.log(`Confidence Score:    ${assessment.confidenceScore}%`);
  console.log('');
  console.log('Damage Scores:');
  console.log(`  Structural:  ${assessment.damageScore.structural}`);
  console.log(`  Mechanical:  ${assessment.damageScore.mechanical}`);
  console.log(`  Cosmetic:    ${assessment.damageScore.cosmetic}`);
  console.log(`  Electrical:  ${assessment.damageScore.electrical}`);
  console.log(`  Interior:    ${assessment.damageScore.interior}`);
  console.log('');
  console.log(`Market Value:        ₦${assessment.marketValue.toLocaleString()}`);
  console.log(`Repair Cost:         ₦${assessment.estimatedRepairCost.toLocaleString()}`);
  console.log(`Salvage Value:       ₦${assessment.estimatedSalvageValue.toLocaleString()}`);
  console.log(`Reserve Price:       ₦${assessment.reservePrice.toLocaleString()}`);
  console.log('');
  
  // Verify the fix
  console.log('\n✅ VERIFICATION:\n');
  
  if (assessment.damageSeverity === 'minor' && assessment.damageScore.cosmetic === 0) {
    console.log('❌ FIX FAILED: Damage detected but severity is still "minor" with zero cosmetic score');
    console.log('   This means the uncategorized damage was not assigned to cosmetic category');
  } else if (assessment.damageSeverity !== 'minor') {
    console.log(`✅ FIX SUCCESSFUL: Damage severity is "${assessment.damageSeverity}" (not minor)`);
    console.log(`   Cosmetic damage score: ${assessment.damageScore.cosmetic}`);
  } else {
    console.log('⚠️  UNCLEAR: Damage is minor but cosmetic score is non-zero');
    console.log('   This might be correct if the damage is actually minor');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Test complete\n');
}

testDamageDetection()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
