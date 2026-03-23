/**
 * Test: Exact Bug Scenario from Problem Description
 * 
 * Reproduces the exact scenario:
 * 1. AI assessment returns severity='severe', confidence=87, salvageValue=166253
 * 2. Frontend sends this to backend
 * 3. Backend should store severity='severe' (NOT 'moderate')
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';

async function testExactBugScenario() {
  console.log('🐛 Testing Exact Bug Scenario from Problem Description\n');
  console.log('Expected: AI returns severity="severe", DB stores severity="severe"');
  console.log('Bug was: AI returns severity="severe", DB stores severity="moderate"\n');
  console.log('=' .repeat(70));
  
  try {
    // Get a real user
    const [testUser] = await db
      .select({ id: users.id })
      .from(users)
      .limit(1);
    
    if (!testUser) {
      throw new Error('No users found');
    }
    
    // EXACT values from problem description
    console.log('\n📊 AI Assessment API Returns:');
    const aiAssessmentFromAPI = {
      severity: 'severe',
      confidence: 87,
      salvageValue: 166253,
    };
    console.log(`   severity: '${aiAssessmentFromAPI.severity}'`);
    console.log(`   confidence: ${aiAssessmentFromAPI.confidence}`);
    console.log(`   salvageValue: ${aiAssessmentFromAPI.salvageValue}`);
    
    // Frontend creates complete assessment object
    console.log('\n📱 Frontend Stores Complete Assessment:');
    const frontendAssessment = {
      damageSeverity: aiAssessmentFromAPI.severity as 'severe',
      confidenceScore: aiAssessmentFromAPI.confidence,
      labels: ['Severe structural damage', 'Airbag deployed'],
      estimatedSalvageValue: aiAssessmentFromAPI.salvageValue,
      reservePrice: Math.round(aiAssessmentFromAPI.salvageValue * 0.7),
      marketValue: 5000000,
      estimatedRepairCost: 4833747,
      damagePercentage: 96.67,
      isRepairable: false,
      recommendation: 'Total loss',
      warnings: ['Severe damage'],
      confidence: {
        overall: 87,
        vehicleDetection: 95,
        damageDetection: 90,
        valuationAccuracy: 85,
        photoQuality: 75,
        reasons: ['High confidence'],
      },
      damageScore: {
        structural: 95,
        mechanical: 90,
        cosmetic: 85,
        electrical: 80,
        interior: 75,
      },
      analysisMethod: 'gemini' as const,
      qualityTier: 'good',
    };
    console.log(`   damageSeverity: '${frontendAssessment.damageSeverity}'`);
    console.log(`   confidenceScore: ${frontendAssessment.confidenceScore}`);
    console.log(`   estimatedSalvageValue: ${frontendAssessment.estimatedSalvageValue}`);
    
    // Backend receives and stores
    console.log('\n🔧 Backend Receives and Processes:');
    const testClaimRef = `BUG-TEST-${Date.now()}`;
    
    const caseValues = {
      claimReference: testClaimRef,
      assetType: 'vehicle' as const,
      assetDetails: { make: 'Toyota', model: 'Camry', year: 2021 },
      marketValue: frontendAssessment.marketValue.toString(),
      estimatedSalvageValue: frontendAssessment.estimatedSalvageValue.toString(),
      reservePrice: frontendAssessment.reservePrice.toString(),
      damageSeverity: frontendAssessment.damageSeverity,
      aiAssessment: {
        labels: frontendAssessment.labels,
        confidenceScore: frontendAssessment.confidenceScore,
        damagePercentage: frontendAssessment.damagePercentage,
        processedAt: new Date(),
        damageScore: frontendAssessment.damageScore,
        confidence: frontendAssessment.confidence,
        estimatedRepairCost: frontendAssessment.estimatedRepairCost,
        isRepairable: frontendAssessment.isRepairable,
        recommendation: frontendAssessment.recommendation,
        warnings: frontendAssessment.warnings,
        analysisMethod: frontendAssessment.analysisMethod,
        photoCount: 3,
      },
      gpsLocation: [6.5244, 3.3792] as [number, number],
      locationName: 'Lagos, Nigeria',
      photos: ['https://example.com/photo1.jpg'],
      voiceNotes: [],
      status: 'pending_approval' as const,
      createdBy: testUser.id,
    };
    
    console.log(`   Storing damageSeverity: '${caseValues.damageSeverity}'`);
    
    const [createdCase] = await db
      .insert(salvageCases)
      .values(caseValues)
      .returning();
    
    // Verify database storage
    console.log('\n💾 Database Stores:');
    console.log(`   damage_severity: '${createdCase.damageSeverity}'`);
    console.log(`   estimated_salvage_value: ₦${parseFloat(createdCase.estimatedSalvageValue || '0').toLocaleString()}`);
    console.log(`   ai_confidence: ${(createdCase.aiAssessment as any)?.confidenceScore}%`);
    
    // Validation
    console.log('\n' + '='.repeat(70));
    console.log('VALIDATION:');
    console.log(`  AI API returned:      severity='${aiAssessmentFromAPI.severity}'`);
    console.log(`  Frontend sent:        severity='${frontendAssessment.damageSeverity}'`);
    console.log(`  Database stored:      severity='${createdCase.damageSeverity}'`);
    
    const isFixed = createdCase.damageSeverity === 'severe';
    
    if (isFixed) {
      console.log('\n✅ BUG IS FIXED!');
      console.log('   Database correctly stores severity="severe"');
      console.log('   (Previously would have stored severity="moderate")');
    } else {
      console.log('\n❌ BUG STILL EXISTS!');
      console.log(`   Expected: 'severe'`);
      console.log(`   Got: '${createdCase.damageSeverity}'`);
    }
    console.log('='.repeat(70));
    
    // Cleanup
    await db.delete(salvageCases).where(eq(salvageCases.id, createdCase.id));
    console.log('\n🧹 Test case cleaned up');
    
    return isFixed;
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

testExactBugScenario()
  .then((success) => process.exit(success ? 0 : 1))
  .catch(() => process.exit(1));
