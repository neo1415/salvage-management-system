/**
 * Test AI Assessment with Real Market Data
 * 
 * This script tests the AI assessment service with real market data scraping
 */

import { assessDamageEnhanced } from '@/features/cases/services/ai-assessment-enhanced.service';

async function testAIWithRealMarketData() {
  console.log('🤖 Testing AI Assessment with Real Market Data\n');
  
  try {
    // Test with a Toyota Camry 2020 (moderate damage)
    const vehicleInfo = {
      make: 'Toyota',
      model: 'Camry',
      year: 2020,
      mileage: 45000,
      condition: 'good' as const,
    };
    
    // Mock photos (in real scenario, these would be base64 images)
    const photos = [
      'data:image/jpeg;base64,/9j/4AAQSkZJRg==', // Mock base64
      'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    ];
    
    console.log('🚗 Vehicle:', vehicleInfo);
    console.log('📸 Photos:', photos.length);
    console.log('\nThis will:');
    console.log('  1. Scrape real market data from Jiji.ng');
    console.log('  2. Calculate damage assessment');
    console.log('  3. Estimate salvage value\n');
    
    const startTime = Date.now();
    const assessment = await assessDamageEnhanced({
      photos,
      vehicleInfo,
    });
    const duration = Date.now() - startTime;
    
    console.log('✅ AI Assessment Complete!\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 ASSESSMENT RESULTS');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log('🔍 Damage Analysis:');
    console.log(`  Severity: ${assessment.damageSeverity.toUpperCase()}`);
    console.log(`  Damage %: ${assessment.damagePercentage}%`);
    console.log(`  Confidence: ${assessment.confidenceScore}%\n`);
    
    console.log('💰 Financial Estimates:');
    console.log(`  Market Value: ₦${assessment.marketValue.toLocaleString()}`);
    console.log(`  Repair Cost: ₦${assessment.estimatedRepairCost.toLocaleString()}`);
    console.log(`  Salvage Value: ₦${assessment.estimatedSalvageValue.toLocaleString()}`);
    console.log(`  Reserve Price: ₦${assessment.reservePrice.toLocaleString()}\n`);
    
    console.log('📈 Confidence Breakdown:');
    console.log(`  Overall: ${assessment.confidence.overall}%`);
    console.log(`  Vehicle Detection: ${assessment.confidence.vehicleDetection}%`);
    console.log(`  Damage Detection: ${assessment.confidence.damageDetection}%`);
    console.log(`  Valuation Accuracy: ${assessment.confidence.valuationAccuracy}%`);
    console.log(`  Photo Quality: ${assessment.confidence.photoQuality}%\n`);
    
    console.log('🔧 Damage Scores:');
    console.log(`  Structural: ${assessment.damageScore.structural}/100`);
    console.log(`  Mechanical: ${assessment.damageScore.mechanical}/100`);
    console.log(`  Cosmetic: ${assessment.damageScore.cosmetic}/100`);
    console.log(`  Electrical: ${assessment.damageScore.electrical}/100`);
    console.log(`  Interior: ${assessment.damageScore.interior}/100\n`);
    
    console.log('💡 Recommendation:');
    console.log(`  ${assessment.recommendation}\n`);
    
    if (assessment.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      assessment.warnings.forEach(warning => {
        console.log(`  ${warning}`);
      });
      console.log('');
    }
    
    if (assessment.confidence.reasons.length > 0) {
      console.log('📝 Confidence Notes:');
      assessment.confidence.reasons.forEach(reason => {
        console.log(`  • ${reason}`);
      });
      console.log('');
    }
    
    console.log('═══════════════════════════════════════════════════════');
    console.log(`⏱️  Total Duration: ${duration}ms`);
    console.log('═══════════════════════════════════════════════════════\n');
    
    // Validation
    console.log('🔍 Validation:');
    
    if (assessment.estimatedSalvageValue < 100000) {
      console.log('  ⚠️  WARNING: Salvage value seems very low');
    } else if (assessment.estimatedSalvageValue > assessment.marketValue) {
      console.log('  ⚠️  WARNING: Salvage value exceeds market value');
    } else {
      console.log('  ✅ Salvage value is reasonable');
    }
    
    if (assessment.marketValue < 5000000) {
      console.log('  ⚠️  WARNING: Market value seems low for a 2020 Toyota Camry');
    } else if (assessment.marketValue > 30000000) {
      console.log('  ⚠️  WARNING: Market value seems high for a 2020 Toyota Camry');
    } else {
      console.log('  ✅ Market value is within expected range');
    }
    
    if (assessment.confidence.valuationAccuracy >= 70) {
      console.log('  ✅ High valuation confidence (using real market data)');
    } else {
      console.log('  ⚠️  Low valuation confidence');
    }
    
    console.log('\n✅ Test complete!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

testAIWithRealMarketData()
  .then(() => {
    console.log('\n✅ All tests passed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });
