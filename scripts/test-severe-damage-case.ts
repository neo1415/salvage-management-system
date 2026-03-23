/**
 * Test Script: Verify Severe Damage Case
 * 
 * This script specifically tests that 'severe' damage severity
 * is correctly preserved from AI assessment through to database storage.
 * 
 * This addresses the original bug where AI returned 'severe' but
 * database stored 'moderate'.
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';

async function testSevereDamageCase() {
  console.log('🧪 Testing Severe Damage Case - End-to-End\n');
  console.log('=' .repeat(60));
  
  try {
    // Get a real user
    const [testUser] = await db
      .select({ id: users.id })
      .from(users)
      .limit(1);
    
    if (!testUser) {
      throw new Error('No users found in database');
    }
    
    console.log(`Using test user: ${testUser.id}`);
    
    // Step 1: Simulate AI assessment returning 'severe'
    console.log('\n🤖 Step 1: Simulating AI assessment with SEVERE damage...');
    const mockAIAssessment = {
      damageSeverity: 'severe' as const,
      confidenceScore: 87,
      labels: ['Front-end damage', 'Structural damage', 'Airbag deployed'],
      estimatedSalvageValue: 166253,
      reservePrice: 116377,
      marketValue: 5000000,
      estimatedRepairCost: 4833747,
      damagePercentage: 96.67,
      isRepairable: false,
      recommendation: 'Total loss - recommend salvage auction',
      warnings: ['Severe structural damage detected', 'Airbag deployment indicates high-impact collision'],
      confidence: {
        overall: 87,
        vehicleDetection: 95,
        damageDetection: 90,
        valuationAccuracy: 85,
        photoQuality: 75,
        reasons: ['High confidence in damage detection', 'Clear structural damage visible'],
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
    
    console.log(`  AI returned severity: ${mockAIAssessment.damageSeverity}`);
    console.log(`  AI confidence: ${mockAIAssessment.confidenceScore}%`);
    console.log(`  Salvage value: ₦${mockAIAssessment.estimatedSalvageValue.toLocaleString()}`);
    
    // Step 2: Simulate frontend sending to backend
    console.log('\n📤 Step 2: Simulating frontend POST to /api/cases...');
    
    // Create a small test image
    const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    
    const requestBody = {
      claimReference: `TEST-SEVERE-${Date.now()}`,
      assetType: 'vehicle',
      assetDetails: {
        make: 'Toyota',
        model: 'Camry',
        year: 2021,
        mileage: 45000,
        condition: 'good',
      },
      marketValue: 5000000,
      photos: [testImageBase64, testImageBase64, testImageBase64],
      gpsLocation: {
        latitude: 6.5244,
        longitude: 3.3792,
      },
      locationName: 'Lagos, Nigeria',
      status: 'pending_approval',
      // CRITICAL: Frontend sends complete AI assessment
      aiAssessmentResult: mockAIAssessment,
    };
    
    console.log(`  Sending severity: ${requestBody.aiAssessmentResult.damageSeverity}`);
    
    // Step 3: Call the API endpoint
    console.log('\n🔄 Step 3: Calling POST /api/cases endpoint...');
    
    const response = await fetch('http://localhost:3000/api/cases', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `next-auth.session-token=test-session`, // Mock auth
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('  ❌ API call failed:', error);
      
      // If auth failed, test directly with service
      console.log('\n  ⚠️  API auth failed, testing service directly...');
      const { createCase } = await import('@/features/cases/services/case.service');
      
      const photoBuffers = requestBody.photos.map(photo => {
        const base64Data = photo.split('base64,')[1];
        return Buffer.from(base64Data, 'base64');
      });
      
      const caseInput = {
        claimReference: requestBody.claimReference,
        assetType: requestBody.assetType as 'vehicle',
        assetDetails: requestBody.assetDetails,
        marketValue: requestBody.marketValue,
        photos: photoBuffers,
        gpsLocation: requestBody.gpsLocation,
        locationName: requestBody.locationName,
        createdBy: testUser.id,
        status: requestBody.status as 'pending_approval',
        aiAssessmentResult: requestBody.aiAssessmentResult,
      };
      
      const createdCase = await createCase(
        caseInput,
        '127.0.0.1',
        'desktop',
        'test-script'
      );
      
      console.log(`  ✓ Case created via service: ${createdCase.id}`);
      
      // Step 4: Verify database
      console.log('\n🔍 Step 4: Verifying database storage...');
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
      console.log(`    Estimated Salvage Value: ₦${parseFloat(dbCase.estimatedSalvageValue || '0').toLocaleString()}`);
      console.log(`    AI Confidence: ${(dbCase.aiAssessment as any)?.confidenceScore}%`);
      
      // Step 5: Validate
      console.log('\n✅ Step 5: Validation Results:');
      console.log(`  AI Assessment:     ${mockAIAssessment.damageSeverity}`);
      console.log(`  Frontend Sent:     ${requestBody.aiAssessmentResult.damageSeverity}`);
      console.log(`  Backend Stored:    ${createdCase.damageSeverity}`);
      console.log(`  Database Record:   ${dbCase.damageSeverity}`);
      
      const success = 
        mockAIAssessment.damageSeverity === requestBody.aiAssessmentResult.damageSeverity &&
        requestBody.aiAssessmentResult.damageSeverity === createdCase.damageSeverity &&
        createdCase.damageSeverity === dbCase.damageSeverity;
      
      console.log('\n' + '='.repeat(60));
      if (success) {
        console.log('✅ SUCCESS: Severity "severe" correctly preserved!');
        console.log('   All stages show: severe');
      } else {
        console.log('❌ FAILURE: Severity mismatch detected!');
      }
      console.log('='.repeat(60));
      
      // Cleanup
      console.log('\n🧹 Cleaning up...');
      await db
        .delete(salvageCases)
        .where(eq(salvageCases.id, createdCase.id));
      console.log('  Test case deleted');
      
      return success;
    }
    
    const result = await response.json();
    console.log('  ✓ API response:', result.success ? 'Success' : 'Failed');
    
    if (!result.success) {
      throw new Error(result.error || 'API call failed');
    }
    
    // Continue with verification...
    const createdCase = result.data;
    console.log(`  Case ID: ${createdCase.id}`);
    
    // Step 4: Verify database
    console.log('\n🔍 Step 4: Verifying database storage...');
    const [dbCase] = await db
      .select()
      .from(salvageCases)
      .where(eq(salvageCases.id, createdCase.id))
      .limit(1);
    
    if (!dbCase) {
      throw new Error('Case not found in database!');
    }
    
    console.log('  Database record:');
    console.log(`    Damage Severity: ${dbCase.damageSeverity}`);
    console.log(`    Estimated Salvage Value: ₦${parseFloat(dbCase.estimatedSalvageValue || '0').toLocaleString()}`);
    
    // Step 5: Validate
    console.log('\n✅ Step 5: Validation Results:');
    console.log(`  AI Assessment:     ${mockAIAssessment.damageSeverity}`);
    console.log(`  Frontend Sent:     ${requestBody.aiAssessmentResult.damageSeverity}`);
    console.log(`  Database Record:   ${dbCase.damageSeverity}`);
    
    const success = 
      mockAIAssessment.damageSeverity === requestBody.aiAssessmentResult.damageSeverity &&
      requestBody.aiAssessmentResult.damageSeverity === dbCase.damageSeverity;
    
    console.log('\n' + '='.repeat(60));
    if (success) {
      console.log('✅ SUCCESS: Severity correctly preserved!');
    } else {
      console.log('❌ FAILURE: Severity mismatch!');
    }
    console.log('='.repeat(60));
    
    // Cleanup
    await db
      .delete(salvageCases)
      .where(eq(salvageCases.id, createdCase.id));
    
    return success;
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

// Run test
testSevereDamageCase()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch(() => {
    process.exit(1);
  });
