/**
 * Test Script: Verify Severity Mismatch Fix
 * 
 * This script tests the complete data flow from AI assessment → frontend → backend → database
 * to ensure the severity value is correctly preserved throughout.
 * 
 * Expected behavior:
 * 1. AI assessment API returns severity='severe'
 * 2. Frontend stores complete assessment result
 * 3. Frontend sends complete assessment to backend
 * 4. Backend uses frontend assessment (not fallback)
 * 5. Database stores correct severity='severe'
 */

import { assessDamageEnhanced } from '@/features/cases/services/ai-assessment-enhanced.service';
import { createCase } from '@/features/cases/services/case.service';
import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function testSeverityMismatchFix() {
  console.log('🧪 Testing Severity Mismatch Fix\n');
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Load test photos
    console.log('\n📸 Step 1: Loading test photos...');
    const testPhotosDir = path.join(process.cwd(), 'tests', 'fixtures', 'photos');
    const photoFiles = ['damaged-car-1.jpg', 'damaged-car-2.jpg', 'damaged-car-3.jpg'];
    
    const photoBuffers: Buffer[] = [];
    const photoBase64: string[] = [];
    
    for (const filename of photoFiles) {
      const filepath = path.join(testPhotosDir, filename);
      if (fs.existsSync(filepath)) {
        const buffer = fs.readFileSync(filepath);
        photoBuffers.push(buffer);
        photoBase64.push(`data:image/jpeg;base64,${buffer.toString('base64')}`);
        console.log(`  ✓ Loaded ${filename}`);
      } else {
        console.log(`  ⚠️  ${filename} not found, using placeholder`);
        // Create a small placeholder image
        const placeholder = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
        photoBuffers.push(placeholder);
        photoBase64.push(`data:image/png;base64,${placeholder.toString('base64')}`);
      }
    }
    
    // Step 2: Run AI assessment (simulating frontend)
    console.log('\n🤖 Step 2: Running AI assessment (simulating frontend)...');
    const vehicleInfo = {
      type: 'vehicle' as const,
      make: 'Toyota',
      model: 'Camry',
      year: 2021,
      mileage: 45000,
      condition: 'good' as const,
      age: new Date().getFullYear() - 2021,
      brandPrestige: 'standard' as const,
    };
    
    const aiResult = await assessDamageEnhanced({
      photos: photoBase64,
      vehicleInfo,
    });
    
    console.log('  AI Assessment Result:');
    console.log(`    Severity: ${aiResult.damageSeverity}`);
    console.log(`    Confidence: ${aiResult.confidenceScore}%`);
    console.log(`    Salvage Value: ₦${aiResult.estimatedSalvageValue.toLocaleString()}`);
    console.log(`    Reserve Price: ₦${aiResult.reservePrice.toLocaleString()}`);
    console.log(`    Analysis Method: ${aiResult.analysisMethod}`);
    
    // Step 3: Simulate frontend sending complete assessment to backend
    console.log('\n📤 Step 3: Simulating frontend sending data to backend...');
    const frontendAssessment = {
      damageSeverity: aiResult.damageSeverity,
      confidenceScore: aiResult.confidenceScore,
      labels: aiResult.labels,
      estimatedSalvageValue: aiResult.estimatedSalvageValue,
      reservePrice: aiResult.reservePrice,
      marketValue: aiResult.marketValue,
      estimatedRepairCost: aiResult.estimatedRepairCost,
      damagePercentage: aiResult.damagePercentage,
      isRepairable: aiResult.isRepairable,
      recommendation: aiResult.recommendation,
      warnings: aiResult.warnings,
      confidence: aiResult.confidence,
      damageScore: aiResult.damageScore,
      analysisMethod: aiResult.analysisMethod,
      qualityTier: aiResult.qualityTier,
    };
    
    console.log('  Frontend sending assessment with severity:', frontendAssessment.damageSeverity);
    
    // Step 4: Create case via backend service
    console.log('\n💾 Step 4: Creating case via backend service...');
    const testClaimRef = `TEST-SEVERITY-${Date.now()}`;
    
    // Get a real user ID from database
    const { users } = await import('@/lib/db/schema/users');
    const [testUser] = await db
      .select({ id: users.id })
      .from(users)
      .limit(1);
    
    if (!testUser) {
      throw new Error('No users found in database. Please create a user first.');
    }
    
    console.log(`  Using test user ID: ${testUser.id}`);
    
    const caseInput = {
      claimReference: testClaimRef,
      assetType: 'vehicle' as const,
      assetDetails: {
        make: vehicleInfo.make,
        model: vehicleInfo.model,
        year: vehicleInfo.year,
        mileage: vehicleInfo.mileage,
        condition: vehicleInfo.condition,
      },
      marketValue: aiResult.marketValue || 5000000,
      photos: photoBuffers,
      gpsLocation: {
        latitude: 6.5244,
        longitude: 3.3792,
      },
      locationName: 'Lagos, Nigeria',
      createdBy: testUser.id,
      status: 'pending_approval' as const,
      aiAssessmentResult: frontendAssessment,
    };
    
    const createdCase = await createCase(
      caseInput,
      '127.0.0.1',
      'desktop',
      'test-script'
    );
    
    console.log('  Case created with ID:', createdCase.id);
    
    // Step 5: Verify database storage
    console.log('\n🔍 Step 5: Verifying database storage...');
    const [dbCase] = await db
      .select()
      .from(salvageCases)
      .where(eq(salvageCases.id, createdCase.id))
      .limit(1);
    
    if (!dbCase) {
      throw new Error('Case not found in database!');
    }
    
    console.log('  Database record:');
    console.log(`    Claim Reference: ${dbCase.claimReference}`);
    console.log(`    Damage Severity: ${dbCase.damageSeverity}`);
    console.log(`    Estimated Salvage Value: ₦${dbCase.estimatedSalvageValue}`);
    console.log(`    Reserve Price: ₦${dbCase.reservePrice}`);
    console.log(`    AI Confidence: ${(dbCase.aiAssessment as any)?.confidenceScore}%`);
    
    // Step 6: Validate the fix
    console.log('\n✅ Step 6: Validating the fix...');
    const validationResults = {
      aiSeverity: aiResult.damageSeverity,
      frontendSeverity: frontendAssessment.damageSeverity,
      backendSeverity: createdCase.damageSeverity,
      databaseSeverity: dbCase.damageSeverity,
    };
    
    console.log('  Severity values at each stage:');
    console.log(`    1. AI Assessment API:    ${validationResults.aiSeverity}`);
    console.log(`    2. Frontend Storage:     ${validationResults.frontendSeverity}`);
    console.log(`    3. Backend Service:      ${validationResults.backendSeverity}`);
    console.log(`    4. Database Record:      ${validationResults.databaseSeverity}`);
    
    // Check if all values match
    const allMatch = 
      validationResults.aiSeverity === validationResults.frontendSeverity &&
      validationResults.frontendSeverity === validationResults.backendSeverity &&
      validationResults.backendSeverity === validationResults.databaseSeverity;
    
    console.log('\n' + '='.repeat(60));
    if (allMatch) {
      console.log('✅ SUCCESS: Severity values match at all stages!');
      console.log(`   All stages show: ${validationResults.databaseSeverity}`);
    } else {
      console.log('❌ FAILURE: Severity mismatch detected!');
      console.log('   Values differ across stages - see details above');
    }
    console.log('='.repeat(60));
    
    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await db
      .delete(salvageCases)
      .where(eq(salvageCases.id, createdCase.id));
    console.log('  Test case deleted');
    
    return allMatch;
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    throw error;
  }
}

// Run the test
testSeverityMismatchFix()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
