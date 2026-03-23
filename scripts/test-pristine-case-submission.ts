/**
 * Test case submission with pristine item (should have severity: 'none')
 * 
 * This tests the fix for the database enum mismatch issue.
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { users } from '@/lib/db/schema/users';
import { sql } from 'drizzle-orm';

async function testPristineCase() {
  console.log('🧪 Testing pristine case submission with severity: "none"');
  console.log('================================================\n');

  try {
    // Create a test user first
    console.log('0️⃣ Creating test user...');
    const [testUser] = await db
      .insert(users)
      .values({
        email: `test-${Date.now()}@example.com`,
        name: 'Test User',
        role: 'adjuster' as const,
        phoneNumber: '+2341234567890',
        isPhoneVerified: true
      })
      .returning();
    console.log('✅ Test user created:', testUser.id);

    // Create a test case with severity: 'none'
    console.log('\n1️⃣ Creating test case with severity: "none"...');
    
    const testCase = {
      claimReference: `TEST-PRISTINE-${Date.now()}`,
      assetType: 'electronics' as const,
      assetDetails: {
        brand: 'Apple',
        model: 'iPhone 17 Pro Max',
        serialNumber: 'TEST123456'
      },
      marketValue: '1500000',
      estimatedSalvageValue: '1500000',
      reservePrice: '1050000',
      damageSeverity: 'none' as const, // This should now work!
      aiAssessment: {
        labels: ['pristine', 'brand new'],
        confidenceScore: 95,
        damagePercentage: 0,
        processedAt: new Date(),
        damageScore: {
          structural: 0,
          mechanical: 0,
          cosmetic: 0,
          electrical: 0,
          interior: 0
        },
        confidence: {
          overall: 95,
          vehicleDetection: 100,
          damageDetection: 100,
          valuationAccuracy: 90,
          photoQuality: 95,
          reasons: ['High quality photos', 'Clear item identification']
        },
        estimatedRepairCost: 0,
        isRepairable: true,
        recommendation: 'Item is in pristine condition',
        warnings: [],
        analysisMethod: 'mock' as const,
        photoCount: 3
      },
      gpsLocation: [6.5244, 3.3792] as [number, number],
      locationName: 'Lagos, Nigeria',
      photos: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg', 'https://example.com/photo3.jpg'],
      voiceNotes: [],
      status: 'draft' as const,
      createdBy: testUser.id // Use the test user ID
    };

    const [createdCase] = await db
      .insert(salvageCases)
      .values(testCase)
      .returning();

    console.log('✅ Case created successfully!');
    console.log('   Case ID:', createdCase.id);
    console.log('   Claim Reference:', createdCase.claimReference);
    console.log('   Damage Severity:', createdCase.damageSeverity);
    console.log('   Market Value:', createdCase.marketValue);
    console.log('   Salvage Value:', createdCase.estimatedSalvageValue);

    // Verify the case was saved correctly
    console.log('\n2️⃣ Verifying case was saved correctly...');
    const [savedCase] = await db
      .select()
      .from(salvageCases)
      .where(sql`${salvageCases.id} = ${createdCase.id}`)
      .limit(1);

    if (savedCase && savedCase.damageSeverity === 'none') {
      console.log('✅ Case verified: severity is "none"');
    } else {
      console.log('❌ Case verification failed');
      console.log('   Expected severity: "none"');
      console.log('   Actual severity:', savedCase?.damageSeverity);
    }

    // Clean up test case
    console.log('\n3️⃣ Cleaning up test case...');
    await db
      .delete(salvageCases)
      .where(sql`${salvageCases.id} = ${createdCase.id}`);
    console.log('✅ Test case deleted');

    // Clean up test user
    console.log('\n4️⃣ Cleaning up test user...');
    await db
      .delete(users)
      .where(sql`${users.id} = ${testUser.id}`);
    console.log('✅ Test user deleted');

    console.log('\n✅ Test completed successfully!');
    console.log('   The database now accepts "none" as a damage severity value.');
    console.log('   Pristine items can be submitted without errors.');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message?.includes('invalid input value for enum damage_severity: "none"')) {
      console.log('\n❌ The migration did not work correctly.');
      console.log('   The database still rejects "none" as a damage severity value.');
      console.log('   Please check the migration and try again.');
    }
    
    throw error;
  }
}

// Run the test
testPristineCase()
  .then(() => {
    console.log('\n✅ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
