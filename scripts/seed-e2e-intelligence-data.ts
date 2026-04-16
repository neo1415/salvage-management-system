/**
 * Seed E2E Test Data for Intelligence Tests
 * Creates test users and sample data needed for E2E tests
 */

import { db } from '@/lib/db';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { predictions, recommendations } from '@/lib/db/schema/intelligence';
import { hash } from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';

async function seedE2EData() {
  console.log('🌱 Seeding E2E test data for intelligence tests...');

  try {
    // 1. Create test vendor user
    console.log('Creating test vendor user...');
    const hashedPassword = await hash('Test123!@#', 10);
    
    let existingVendor = await db
      .select()
      .from(users)
      .where(eq(users.email, 'vendor-e2e@test.com'))
      .limit(1);

    // Also check by phone if email doesn't exist
    if (existingVendor.length === 0) {
      existingVendor = await db
        .select()
        .from(users)
        .where(eq(users.phone, '+2348012345678'))
        .limit(1);
    }

    let vendorUserId: string;
    let vendorId: string;

    if (existingVendor.length > 0) {
      console.log('Test vendor user already exists');
      vendorUserId = existingVendor[0].id;
      
      const existingVendorProfile = await db
        .select()
        .from(vendors)
        .where(eq(vendors.userId, vendorUserId))
        .limit(1);
      
      if (existingVendorProfile.length > 0) {
        vendorId = existingVendorProfile[0].id;
      } else {
        // Create vendor profile if it doesn't exist
        const [vendorProfile] = await db
          .insert(vendors)
          .values({
            userId: vendorUserId,
            businessName: 'E2E Test Vendor',
            tier: 'tier1_bvn',
            status: 'approved',
          })
          .returning();
        vendorId = vendorProfile.id;
      }
    } else {
      const [vendorUser] = await db
        .insert(users)
        .values({
          email: 'vendor-e2e@test.com',
          phone: '+2348012345678',
          passwordHash: hashedPassword,
          role: 'vendor',
          fullName: 'Test Vendor',
          dateOfBirth: new Date('1990-01-01'),
          status: 'verified_tier_1',
        })
        .returning();

      vendorUserId = vendorUser.id;

      const [vendorProfile] = await db
        .insert(vendors)
        .values({
          userId: vendorUserId,
          businessName: 'E2E Test Vendor',
          tier: 'tier1_bvn',
          status: 'approved',
        })
        .returning();

      vendorId = vendorProfile.id;
      console.log('✅ Test vendor user created');
    }

    // 2. Create test admin user
    console.log('Creating test admin user...');
    let existingAdmin = await db
      .select()
      .from(users)
      .where(eq(users.email, 'admin-e2e@test.com'))
      .limit(1);

    // Also check by phone if email doesn't exist
    if (existingAdmin.length === 0) {
      existingAdmin = await db
        .select()
        .from(users)
        .where(eq(users.phone, '+2348087654321'))
        .limit(1);
    }

    if (existingAdmin.length === 0) {
      await db.insert(users).values({
        email: 'admin-e2e@test.com',
        phone: '+2348087654321',
        passwordHash: hashedPassword,
        role: 'system_admin',
        fullName: 'Test Admin',
        dateOfBirth: new Date('1985-01-01'),
        status: 'verified_tier_1',
      });
      console.log('✅ Test admin user created');
    } else {
      console.log('Test admin user already exists');
    }

    // 3. Create sample case for auction (or reuse existing)
    console.log('Creating sample case...');
    
    let existingCase = await db
      .select()
      .from(salvageCases)
      .where(eq(salvageCases.claimReference, 'E2E-AUCTION-001'))
      .limit(1);

    let testCase;
    if (existingCase.length > 0) {
      console.log('Test case already exists, reusing...');
      testCase = existingCase[0];
    } else {
      [testCase] = await db
        .insert(salvageCases)
        .values({
          claimReference: 'E2E-AUCTION-001',
          assetType: 'vehicle',
          assetDetails: {
            make: 'Toyota',
            model: 'Camry',
            year: 2020,
          },
          marketValue: '5000000',
          estimatedSalvageValue: '2500000',
          reservePrice: '2500000',
          damageSeverity: 'moderate',
          gpsLocation: sql`point(6.5244, 3.3792)`, // Lagos coordinates
          locationName: 'Lagos, Nigeria',
          photos: ['https://example.com/photo1.jpg'],
          status: 'approved',
          createdBy: vendorUserId,
          approvedBy: vendorUserId,
          approvedAt: new Date(),
        })
        .returning();
      console.log('✅ Test case created');
    }

    // 4. Create sample auction (or reuse existing)
    console.log('Creating sample auction...');
    const auctionStartDate = new Date();
    const auctionEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    let existingAuction = await db
      .select()
      .from(auctions)
      .where(eq(auctions.caseId, testCase.id))
      .limit(1);

    let testAuction;
    if (existingAuction.length > 0) {
      console.log('Test auction already exists, reusing...');
      testAuction = existingAuction[0];
    } else {
      [testAuction] = await db
        .insert(auctions)
        .values({
          caseId: testCase.id,
          startTime: auctionStartDate,
          endTime: auctionEndDate,
          originalEndTime: auctionEndDate,
          currentBid: '2200000',
          currentBidder: vendorId,
          minimumIncrement: '10000',
          status: 'active',
        })
        .returning();
      console.log('✅ Test auction created');
    }

    // 5. Create sample prediction (or update existing)
    console.log('Creating sample prediction...');
    const existingPrediction = await db
      .select()
      .from(predictions)
      .where(eq(predictions.auctionId, testAuction.id))
      .limit(1);

    if (existingPrediction.length > 0) {
      console.log('Test prediction already exists');
    } else {
      await db.insert(predictions).values({
        auctionId: testAuction.id,
        predictedPrice: '2800000',
        lowerBound: '2500000',
        upperBound: '3100000',
        confidenceScore: '0.85',
        confidenceLevel: 'High',
        method: 'historical',
        sampleSize: 12,
        metadata: {
          similarAuctions: 12,
          competitionLevel: 'medium',
          notes: ['Based on similar Toyota Camry 2020 auctions'],
        },
      });
      console.log('✅ Test prediction created');
    }

    // 6. Create sample recommendations (or update existing)
    console.log('Creating sample recommendations...');
    const existingRecommendation = await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.auctionId, testAuction.id))
      .limit(1);

    if (existingRecommendation.length > 0) {
      console.log('Test recommendation already exists');
    } else {
      await db.insert(recommendations).values({
        auctionId: testAuction.id,
        vendorId: vendorId,
        matchScore: '0.92',
        reasonCodes: ['similar_past_bids', 'preferred_category', 'price_range_match'],
        expiresAt: testAuction.endTime,
      });
      console.log('✅ Test recommendation created');
    }

    console.log('✅ E2E test data seeded successfully!');
    console.log('\nTest Credentials:');
    console.log('Vendor: vendor-e2e@test.com / Test123!@#');
    console.log('Admin: admin-e2e@test.com / Test123!@#');
    console.log(`\nTest Auction ID: ${testAuction.id}`);
    
  } catch (error) {
    console.error('❌ Error seeding E2E test data:', error);
    throw error;
  }
}

// Run the seed function
seedE2EData()
  .then(() => {
    console.log('\n✅ Seeding complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  });
