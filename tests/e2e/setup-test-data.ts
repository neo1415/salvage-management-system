/**
 * E2E Test Data Setup Script
 * 
 * This script creates the necessary test data for E2E tests:
 * - Test users (vendor, finance officer, admin)
 * - Test auction with escrow wallet payment
 * - Test documents
 * 
 * Run with: tsx tests/e2e/setup-test-data.ts
 */

import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { salvageCases } from '@/lib/db/schema/cases';
import { auctions } from '@/lib/db/schema/auctions';
import { payments } from '@/lib/db/schema/payments';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { escrowWallets } from '@/lib/db/schema/escrow';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const TEST_PASSWORD = 'Test123!@#';

async function setupTestData() {
  console.log('🚀 Setting up E2E test data...');

  try {
    // 1. Create test vendor user
    console.log('Creating test vendor user...');
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    
    const [vendorUser] = await db
      .insert(users)
      .values({
        email: 'vendor-e2e@test.com',
        fullName: 'E2E Test Vendor',
        phone: '2348141252812',
        role: 'vendor',
        passwordHash,
        dateOfBirth: new Date('1990-01-01'),
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          fullName: 'E2E Test Vendor',
          phone: '2348141252812',
          passwordHash,
        },
      })
      .returning();

    console.log(`✅ Vendor user created: ${vendorUser.id}`);

    // 2. Create test vendor profile
    console.log('Creating test vendor profile...');
    const [vendor] = await db
      .insert(vendors)
      .values({
        userId: vendorUser.id,
        businessName: 'E2E Test Vendor Business',
        tier: 'tier1_bvn',
        status: 'approved',
      })
      .onConflictDoUpdate({
        target: vendors.userId,
        set: {
          businessName: 'E2E Test Vendor Business',
          tier: 'tier1_bvn',
          status: 'approved',
        },
      })
      .returning();

    console.log(`✅ Vendor profile created: ${vendor.id}`);

    // 3. Create wallet with funds
    console.log('Creating vendor wallet...');
    await db
      .insert(escrowWallets)
      .values({
        vendorId: vendor.id,
        balance: '500000', // ₦500,000
        frozenAmount: '150000', // ₦150,000 frozen
        availableBalance: '350000', // ₦350,000 available
      })
      .onConflictDoUpdate({
        target: escrowWallets.vendorId,
        set: {
          balance: '500000',
          frozenAmount: '150000',
          availableBalance: '350000',
        },
      });

    console.log('✅ Wallet created with ₦500,000 balance and ₦150,000 frozen');

    // 4. Create test finance officer user
    console.log('Creating test finance officer user...');
    const [financeUser] = await db
      .insert(users)
      .values({
        email: 'finance-e2e@test.com',
        fullName: 'E2E Finance Officer',
        phone: '2348141252813',
        role: 'finance_officer',
        passwordHash,
        dateOfBirth: new Date('1985-01-01'),
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          fullName: 'E2E Finance Officer',
          role: 'finance_officer',
          passwordHash,
        },
      })
      .returning();

    console.log(`✅ Finance officer user created: ${financeUser.id}`);

    // 5. Create test admin user
    console.log('Creating test admin user...');
    const [adminUser] = await db
      .insert(users)
      .values({
        email: 'admin-e2e@test.com',
        fullName: 'E2E Admin',
        phone: '2348141252814',
        role: 'system_admin',
        passwordHash,
        dateOfBirth: new Date('1980-01-01'),
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          fullName: 'E2E Admin',
          role: 'system_admin',
          passwordHash,
        },
      })
      .returning();

    console.log(`✅ Admin user created: ${adminUser.id}`);

    // 6. Create test salvage case
    console.log('Creating test salvage case...');
    const [testCase] = await db
      .insert(salvageCases)
      .values({
        claimReference: 'E2E-TEST-CASE-001',
        assetType: 'vehicle',
        vehicleCondition: 'salvage',
        locationName: 'Lagos Test Location',
        gpsLocation: sql`point(6.5244, 3.3792)`,
        photos: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
        createdBy: adminUser.id,
        status: 'approved',
        marketValue: '200000',
        assetDetails: {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          vin: 'E2ETEST123456789',
        },
      })
      .onConflictDoUpdate({
        target: salvageCases.claimReference,
        set: {
          status: 'approved',
          marketValue: '200000',
        },
      })
      .returning();

    console.log(`✅ Salvage case created: ${testCase.id}`);

    // 7. Create test auction
    console.log('Creating test auction...');
    const endTime = new Date(Date.now() - 1 * 60 * 60 * 1000); // Ended 1 hour ago
    const [auction] = await db
      .insert(auctions)
      .values({
        caseId: testCase.id,
        currentBid: '150000',
        currentBidder: vendor.id,
        startTime: new Date(Date.now() - 25 * 60 * 60 * 1000),
        endTime,
        originalEndTime: endTime,
        status: 'closed',
      })
      .returning();

    console.log(`✅ Auction created: ${auction.id}`);

    // 8. Create payment record
    console.log('Creating payment record...');
    const [payment] = await db
      .insert(payments)
      .values({
        auctionId: auction.id,
        vendorId: vendor.id,
        amount: '150000',
        paymentMethod: 'escrow_wallet',
        escrowStatus: 'frozen',
        status: 'pending',
        paymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      .returning();

    console.log(`✅ Payment record created: ${payment.id}`);

    // 9. Create release form documents
    console.log('Creating release form documents...');
    
    const documentTypes = [
      { type: 'bill_of_sale', title: 'Bill of Sale' },
      { type: 'liability_waiver', title: 'Liability Waiver' },
      { type: 'pickup_authorization', title: 'Pickup Authorization' },
    ];

    for (const docType of documentTypes) {
      await db
        .insert(releaseForms)
        .values({
          auctionId: auction.id,
          vendorId: vendor.id,
          documentType: docType.type as 'bill_of_sale' | 'liability_waiver' | 'pickup_authorization',
          title: docType.title,
          status: 'pending',
          pdfUrl: `https://example.com/${docType.type}.pdf`,
          pdfPublicId: `e2e-test-${docType.type}`,
          documentData: {
            buyerName: 'E2E Test Vendor',
            buyerEmail: 'vendor-e2e@test.com',
            buyerPhone: '2348141252812',
            sellerName: 'NEM Insurance',
            sellerAddress: 'Lagos, Nigeria',
            sellerContact: 'nemsupport@nem-insurance.com',
            assetType: 'vehicle',
            assetDescription: 'Toyota Camry 2020',
            assetCondition: 'salvage',
            salePrice: 150000,
            paymentMethod: 'escrow_wallet',
            transactionDate: new Date().toISOString(),
            pickupLocation: 'Lagos Test Location',
            pickupDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          },
          generatedBy: adminUser.id,
        });

      console.log(`✅ Document created: ${docType.title}`);
    }

    console.log('\n✨ E2E test data setup complete!');
    console.log('\nTest Credentials:');
    console.log('─────────────────────────────────────────');
    console.log('Vendor:');
    console.log('  Email: vendor-e2e@test.com');
    console.log('  Password: Test123!@#');
    console.log('\nFinance Officer:');
    console.log('  Email: finance-e2e@test.com');
    console.log('  Password: Test123!@#');
    console.log('\nAdmin:');
    console.log('  Email: admin-e2e@test.com');
    console.log('  Password: Test123!@#');
    console.log('─────────────────────────────────────────');
    console.log('\nTest Data IDs:');
    console.log(`  Vendor ID: ${vendor.id}`);
    console.log(`  Case ID: ${testCase.id}`);
    console.log(`  Auction ID: ${auction.id}`);
    console.log(`  Payment ID: ${payment.id}`);
    console.log('─────────────────────────────────────────\n');

  } catch (error) {
    console.error('❌ Error setting up test data:', error);
    throw error;
  }
}

// Run the setup
setupTestData()
  .then(() => {
    console.log('✅ Setup completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });
