/**
 * Debug 2021 Toyota Camry Valuation Bug
 * 
 * Investigates why salvage/reserve prices are less than 1% of expected market value
 */

import { assessDamageEnhanced } from '@/features/cases/services/ai-assessment-enhanced.service';

async function debugCamryValuation() {
  console.log('🔍 Debugging 2021 Toyota Camry Valuation Bug\n');
  console.log('=' .repeat(80));
  
  // Simulate the exact inputs from the user's form
  const vehicleInfo = {
    make: 'Toyota',
    model: 'Camry',
    year: 2021,
    mileage: 49999,
    condition: 'excellent' as const,
  };
  
  console.log('\n📋 Input Data:');
  console.log(JSON.stringify(vehicleInfo, null, 2));
  
  // Mock photos (6 photos as shown in the form)
  const mockPhotos = Array(6).fill('data:image/jpeg;base64,mock');
  
  try {
    console.log('\n🤖 Running AI Assessment...\n');
    
    const assessment = await assessDamageEnhanced({
      photos: mockPhotos,
      vehicleInfo,
    });
    
    console.log('\n💰 FINANCIAL RESULTS:');
    console.log('=' .repeat(80));
    console.log(`Market Value:        ₦${assessment.marketValue.toLocaleString()}`);
    console.log(`Repair Cost:         ₦${assessment.estimatedRepairCost.toLocaleString()}`);
    console.log(`Salvage Value:       ₦${assessment.estimatedSalvageValue.toLocaleString()}`);
    console.log(`Reserve Price:       ₦${assessment.reservePrice.toLocaleString()}`);
    console.log(`Price Source:        ${assessment.priceSource || 'unknown'}`);
    
    console.log('\n📊 DAMAGE ANALYSIS:');
    console.log('=' .repeat(80));
    console.log(`Severity:            ${assessment.damageSeverity.toUpperCase()}`);
    console.log(`Damage Percentage:   ${assessment.damagePercentage}%`);
    console.log(`Is Total Loss:       ${assessment.isTotalLoss ? 'YES' : 'NO'}`);
    console.log(`Is Repairable:       ${assessment.isRepairable ? 'YES' : 'NO'}`);
    
    console.log('\n🔧 DAMAGE SCORES:');
    console.log('=' .repeat(80));
    console.log(`Structural:          ${assessment.damageScore.structural}`);
    console.log(`Mechanical:          ${assessment.damageScore.mechanical}`);
    console.log(`Cosmetic:            ${assessment.damageScore.cosmetic}`);
    console.log(`Electrical:          ${assessment.damageScore.electrical}`);
    console.log(`Interior:            ${assessment.damageScore.interior}`);
    
    if (assessment.damageBreakdown && assessment.damageBreakdown.length > 0) {
      console.log('\n💥 DAMAGE BREAKDOWN:');
      console.log('=' .repeat(80));
      assessment.damageBreakdown.forEach((damage, index) => {
        console.log(`\n${index + 1}. ${damage.component.toUpperCase()} (${damage.damageLevel})`);
        console.log(`   Repair Cost:      ₦${damage.repairCost.toLocaleString()}`);
        console.log(`   Deduction:        ${(damage.deductionPercent * 100).toFixed(2)}%`);
        console.log(`   Deduction Amount: ₦${damage.deductionAmount.toLocaleString()}`);
      });
    }
    
    console.log('\n🎯 CONFIDENCE SCORES:');
    console.log('=' .repeat(80));
    console.log(`Overall:             ${assessment.confidence.overall}%`);
    console.log(`Vehicle Detection:   ${assessment.confidence.vehicleDetection}%`);
    console.log(`Damage Detection:    ${assessment.confidence.damageDetection}%`);
    console.log(`Valuation Accuracy:  ${assessment.confidence.valuationAccuracy}%`);
    console.log(`Photo Quality:       ${assessment.confidence.photoQuality}%`);
    
    if (assessment.confidence.reasons.length > 0) {
      console.log('\n📝 Confidence Reasons:');
      assessment.confidence.reasons.forEach((reason, index) => {
        console.log(`   ${index + 1}. ${reason}`);
      });
    }
    
    if (assessment.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      console.log('=' .repeat(80));
      assessment.warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning}`);
      });
    }
    
    console.log('\n🔍 DETECTED LABELS:');
    console.log('=' .repeat(80));
    console.log(assessment.labels.join(', '));
    
    // Calculate percentages for analysis
    const salvagePercentOfMarket = (assessment.estimatedSalvageValue / assessment.marketValue) * 100;
    const reservePercentOfMarket = (assessment.reservePrice / assessment.marketValue) * 100;
    const repairPercentOfMarket = (assessment.estimatedRepairCost / assessment.marketValue) * 100;
    
    console.log('\n📈 PERCENTAGE ANALYSIS:');
    console.log('=' .repeat(80));
    console.log(`Salvage as % of Market:  ${salvagePercentOfMarket.toFixed(2)}%`);
    console.log(`Reserve as % of Market:  ${reservePercentOfMarket.toFixed(2)}%`);
    console.log(`Repair as % of Market:   ${repairPercentOfMarket.toFixed(2)}%`);
    
    // Check if this matches the bug
    if (salvagePercentOfMarket < 1 || reservePercentOfMarket < 1) {
      console.log('\n🚨 BUG CONFIRMED!');
      console.log('=' .repeat(80));
      console.log('Salvage/Reserve prices are less than 1% of market value!');
      console.log('This is the bug we need to fix.');
    } else {
      console.log('\n✅ Values look reasonable');
    }
    
    console.log('\n' + '='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ Error during assessment:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
  }
}

// Run the debug
debugCamryValuation()
  .then(() => {
    console.log('\n✅ Debug complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Debug failed:', error);
    process.exit(1);
  });
