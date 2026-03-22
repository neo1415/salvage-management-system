/**
 * UAT Test Data Setup Script
 * 
 * This script creates test data for User Acceptance Testing (UAT) of the
 * escrow wallet payment completion feature.
 * 
 * Usage:
 *   npm run test:uat:setup
 * 
 * This will create:
 * - 5 vendor test accounts with funded wallets
 * - 3 finance officer test accounts
 * - 2 admin test accounts
 * - 10 test auctions with various states
 * - Test payment records with escrow_wallet method
 * - Test documents for signing
 */

import { db } from '@/lib/db';
import { users, vendors, salvageCases, auctions, payments, releaseForms, wallets, walletTransactions } from '@/lib/db/schema';
import { hash } from 'bcrypt';
import { eq } from 'drizzle-orm';

const SALT_ROUNDS = 10;

interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'vendor' | 'finance_officer' | 'admin' | 'manager';
  phoneNumber: string;
}

interface TestVendor {
  userEmail: string;
  companyName: string;
  walletBalance: number;
  frozenAmount: number;
}

interface TestAuction {
  vendorEmail: string;
  caseTitle: string;
  bidAmount: number;
  status: 'active' | 'closed' | 'completed';
  paymentMethod: 'escrow_wallet' | 'paystack' | 'bank_transfer';
  documentsGenerated: boolean;
  documentsSigned: number; // 0, 1, 2, or 3
}

// Test users to create
const testUsers: TestUser[] = [
  // Vendors
  {
    email: 'vendor-uat-1@test.com',
    password: 'Test123!@#',
    firstName: 'Vendor',
    lastName: 'One',
    role: 'vendor',
    phoneNumber: '+2348011111111',
  },
  {
    email: 'vendor-uat-2@test.com',
    password: 'Test123!@#',
    firstName: 'Vendor',
    lastName: 'Two',
    role: 'vendor',
    phoneNumber: '+2348022222222',
  },
  {
    email: 'vendor-uat-3@test.com',
    password: 'Test123!@#',
    firstName: 'Vendor',
    lastName: 'Three',
    role: 'vendor',
    phoneNumber: '+2348033333333',
  },
  {
    email: 'vendor-uat-4@test.com',
    password: 'Test123!@#',
    firstName: 'Vendor',
    lastName: 'Four',
    role: 'vendor',
    phoneNumber: '+2348044444444',
  },
  {
    email: 'vendor-uat-5@test.com',
    password: 'Test123!@#',
    firstName: 'Vendor',
    lastName: 'Five',
    role: 'vendor',
    phoneNumber: '+2348055555555',
  },
  // Finance Officers
  {
    email: 'finance-uat-1@test.com',
    password: 'Test123!@#',
    firstName: 'Finance',
    lastName: 'Officer One',
    role: 'finance_officer',
    phoneNumber: '+2348066666666',
  },
  {
    email: 'finance-uat-2@test.com',
    password: 'Test123!@#',
    firstName: 'Finance',
    lastName: 'Officer Two',
    role: 'finance_officer',
    phoneNumber: '+2348077777777',
  },
  {
    email: 'finance-uat-3@test.com',
    password: 'Test123!@#',
    firstName: 'Finance',
    lastName: 'Manager',
    role: 'finance_officer',
    phoneNumber: '+2348088888888',
  },
  // Admins
  {
    email: 'admin-uat-1@test.com',
    password: 'Test123!@#',
    firstName: 'Admin',
    lastName: 'One',
    role: 'admin',
    phoneNumber: '+2348099999999',
  },
  {
    email: 'admin-uat-2@test.com',
    password: 'Test123!@#',
    firstName: 'Manager',
    lastName: 'One',
    role: 'manager',
    phoneNumber: '+2348010101010',
  },
];

// Test vendors with wallet balances
const testVendors: TestVendor[] = [
  {
    userEmail: 'vendor-uat-1@test.com',
    companyName: 'UAT Vendor Company 1',
    walletBalance: 1000000,
    frozenAmount: 400000,
  },
  {
    userEmail: 'vendor-uat-2@test.com',
    companyName: 'UAT Vendor Company 2',
    walletBalance: 800000,
    frozenAmount: 300000,
  },
  {
    userEmail: 'vendor-uat-3@test.com',
    companyName: 'UAT Vendor Company 3',
    walletBalance: 1500000,
    frozenAmount: 500000,
  },
  {
    userEmail: 'vendor-uat-4@test.com',
    companyName: 'UAT Vendor Company 4',
    walletBalance: 600000,
    frozenAmount: 200000,
  },
  {
    userEmail: 'vendor-uat-5@test.com',
    companyName: 'UAT Vendor Company 5',
    walletBalance: 2000000,
    frozenAmount: 700000,
  },
];

// Test auctions with various states
const testAuctions: TestAuction[] = [
  // Scenario 1: Ready for wallet payment confirmation (no documents signed)
  {
    vendorEmail: 'vendor-uat-1@test.com',
    caseTitle: 'UAT Case 1 - Ready for Payment',
    bidAmount: 400000,
    status: 'closed',
    paymentMethod: 'escrow_wallet',
    documentsGenerated: true,
    documentsSigned: 0,
  },
  // Scenario 2: 1 document signed
  {
    vendorEmail: 'vendor-uat-2@test.com',
    caseTitle: 'UAT Case 2 - 1 Document Signed',
    bidAmount: 300000,
    status: 'closed',
    paymentMethod: 'escrow_wallet',
    documentsGenerated: true,
    documentsSigned: 1,
  },
  // Scenario 3: 2 documents signed
  {
    vendorEmail: 'vendor-uat-3@test.com',
    caseTitle: 'UAT Case 3 - 2 Documents Signed',
    bidAmount: 500000,
    status: 'closed',
    paymentMethod: 'escrow_wallet',
    documentsGenerated: true,
    documentsSigned: 2,
  },
  // Scenario 4: All documents signed, ready for fund release
  {
    vendorEmail: 'vendor-uat-4@test.com',
    caseTitle: 'UAT Case 4 - Ready for Fund Release',
    bidAmount: 200000,
    status: 'closed',
    paymentMethod: 'escrow_wallet',
    documentsGenerated: true,
    documentsSigned: 3,
  },
  // Scenario 5: Payment verified, ready for pickup confirmation
  {
    vendorEmail: 'vendor-uat-5@test.com',
    caseTitle: 'UAT Case 5 - Ready for Pickup',
    bidAmount: 700000,
    status: 'closed',
    paymentMethod: 'escrow_wallet',
    documentsGenerated: true,
    documentsSigned: 3,
  },
  // Scenario 6: Active auction (not yet closed)
  {
    vendorEmail: 'vendor-uat-1@test.com',
    caseTitle: 'UAT Case 6 - Active Auction',
    bidAmount: 350000,
    status: 'active',
    paymentMethod: 'escrow_wallet',
    documentsGenerated: false,
    documentsSigned: 0,
  },
  // Scenario 7: Paystack payment (for comparison)
  {
    vendorEmail: 'vendor-uat-2@test.com',
    caseTitle: 'UAT Case 7 - Paystack Payment',
    bidAmount: 250000,
    status: 'closed',
    paymentMethod: 'paystack',
    documentsGenerated: true,
    documentsSigned: 3,
  },
  // Scenario 8: Bank transfer payment (for comparison)
  {
    vendorEmail: 'vendor-uat-3@test.com',
    caseTitle: 'UAT Case 8 - Bank Transfer',
    bidAmount: 450000,
    status: 'closed',
    paymentMethod: 'bank_transfer',
    documentsGenerated: true,
    documentsSigned: 3,
  },
  // Scenario 9: Failed fund release (for testing manual release)
  {
    vendorEmail: 'vendor-uat-4@test.com',
    caseTitle: 'UAT Case 9 - Failed Fund Release',
    bidAmount: 180000,
    status: 'closed',
    paymentMethod: 'escrow_wallet',
    documentsGenerated: true,
    documentsSigned: 3,
  },
  // Scenario 10: Completed transaction
  {
    vendorEmail: 'vendor-uat-5@test.com',
    caseTitle: 'UAT Case 10 - Completed',
    bidAmount: 600000,
    status: 'completed',
    paymentMethod: 'escrow_wallet',
    documentsGenerated: true,
    documentsSigned: 3,
  },
];

async function createUsers() {
  console.log('Creating test users...');
  
  for (const testUser of testUsers) {
    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, testUser.email))
      .limit(1);

    if (existingUser.length > 0) {
      console.log(`  ✓ User ${testUser.email} already exists`);
      continue;
    }

    // Hash password
    const hashedPassword = await hash(testUser.password, SALT_ROUNDS);

    // Create user
    await db.insert(users).values({
      email: testUser.email,
      password: hashedPassword,
      firstName: testUser.firstName,
      lastName: testUser.lastName,
      role: testUser.role,
      phoneNumber: testUser.phoneNumber,
      emailVerified: true,
      isActive: true,
    });

    console.log(`  ✓ Created user: ${testUser.email} (${testUser.role})`);
  }
}

async function createVendors() {
  console.log('\nCreating test vendors with wallets...');
  
  for (const testVendor of testVendors) {
    // Get user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, testVendor.userEmail))
      .limit(1);

    if (!user) {
      console.log(`  ✗ User not found: ${testVendor.userEmail}`);
      continue;
    }

    // Check if vendor already exists
    const existingVendor = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, user.id))
      .limit(1);

    if (existingVendor.length > 0) {
      console.log(`  ✓ Vendor for ${testVendor.userEmail} already exists`);
      continue;
    }

    // Create vendor
    const [vendor] = await db.insert(vendors).values({
      userId: user.id,
      companyName: testVendor.companyName,
      businessRegistrationNumber: `BRN-${Date.now()}`,
      businessAddress: '123 Test Street, Lagos, Nigeria',
      isVerified: true,
    }).returning();

    // Create wallet
    await db.insert(wallets).values({
      vendorId: vendor.id,
      balance: testVendor.walletBalance.toString(),
      frozenAmount: testVendor.frozenAmount.toString(),
    });

    // Create wallet funding transaction
    await db.insert(walletTransactions).values({
      vendorId: vendor.id,
      type: 'credit',
      amount: testVendor.walletBalance.toString(),
      description: 'Initial UAT wallet funding',
      status: 'completed',
    });

    console.log(`  ✓ Created vendor: ${testVendor.companyName} (Balance: ₦${testVendor.walletBalance.toLocaleString()})`);
  }
}

async function createAuctions() {
  console.log('\nCreating test auctions and payments...');
  
  for (let i = 0; i < testAuctions.length; i++) {
    const testAuction = testAuctions[i];
    
    // Get user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, testAuction.vendorEmail))
      .limit(1);

    if (!user) {
      console.log(`  ✗ User not found: ${testAuction.vendorEmail}`);
      continue;
    }

    // Get vendor
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, user.id))
      .limit(1);

    if (!vendor) {
      console.log(`  ✗ Vendor not found for user: ${testAuction.vendorEmail}`);
      continue;
    }

    // Create salvage case
    const [salvageCase] = await db.insert(salvageCases).values({
      caseNumber: `UAT-CASE-${i + 1}-${Date.now()}`,
      vehicleMake: 'Toyota',
      vehicleModel: 'Camry',
      vehicleYear: 2020,
      vehicleVin: `VIN${i + 1}${Date.now()}`,
      damageDescription: 'Test damage for UAT',
      estimatedValue: (testAuction.bidAmount * 1.5).toString(),
      status: testAuction.status === 'completed' ? 'sold' : 'approved',
      location: 'Lagos',
    }).returning();

    // Create auction
    const auctionEndDate = new Date();
    auctionEndDate.setDate(auctionEndDate.getDate() - 1); // Ended yesterday

    const [auction] = await db.insert(auctions).values({
      caseId: salvageCase.id,
      startingBid: (testAuction.bidAmount * 0.8).toString(),
      currentBid: testAuction.bidAmount.toString(),
      highestBidderId: vendor.id,
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      endDate: auctionEndDate,
      status: testAuction.status,
      pickupConfirmedVendor: testAuction.status === 'completed',
      pickupConfirmedAdmin: testAuction.status === 'completed',
    }).returning();

    // Create payment record
    const paymentStatus = 
      testAuction.documentsSigned === 3 && testAuction.status !== 'completed' ? 'verified' :
      testAuction.documentsSigned > 0 ? 'wallet_confirmed' :
      'pending';

    const escrowStatus =
      testAuction.documentsSigned === 3 && testAuction.status !== 'completed' ? 'released' :
      testAuction.paymentMethod === 'escrow_wallet' ? 'frozen' :
      null;

    const [payment] = await db.insert(payments).values({
      auctionId: auction.id,
      vendorId: vendor.id,
      amount: testAuction.bidAmount.toString(),
      paymentMethod: testAuction.paymentMethod,
      status: paymentStatus,
      escrowStatus: escrowStatus,
      verifiedAt: paymentStatus === 'verified' ? new Date() : null,
      autoVerified: paymentStatus === 'verified',
    }).returning();

    // Create documents if needed
    if (testAuction.documentsGenerated) {
      const documentTypes = ['bill_of_sale', 'liability_waiver', 'pickup_authorization'];
      
      for (let j = 0; j < documentTypes.length; j++) {
        const documentType = documentTypes[j];
        const isSigned = j < testAuction.documentsSigned;

        await db.insert(releaseForms).values({
          auctionId: auction.id,
          vendorId: vendor.id,
          documentType: documentType,
          status: isSigned ? 'signed' : 'pending',
          signedAt: isSigned ? new Date() : null,
          digitalSignature: isSigned ? `signature-${j + 1}` : null,
          ipAddress: isSigned ? '127.0.0.1' : null,
          deviceType: isSigned ? 'desktop' : null,
          userAgent: isSigned ? 'Mozilla/5.0 UAT Test' : null,
        });
      }
    }

    console.log(`  ✓ Created auction: ${testAuction.caseTitle} (${testAuction.documentsSigned}/3 docs signed)`);
  }
}

async function main() {
  console.log('========================================');
  console.log('UAT Test Data Setup');
  console.log('========================================\n');

  try {
    await createUsers();
    await createVendors();
    await createAuctions();

    console.log('\n========================================');
    console.log('✓ UAT Test Data Setup Complete!');
    console.log('========================================\n');

    console.log('Test Accounts Created:');
    console.log('\nVendors:');
    testUsers
      .filter(u => u.role === 'vendor')
      .forEach(u => console.log(`  - ${u.email} / ${u.password}`));

    console.log('\nFinance Officers:');
    testUsers
      .filter(u => u.role === 'finance_officer')
      .forEach(u => console.log(`  - ${u.email} / ${u.password}`));

    console.log('\nAdmins:');
    testUsers
      .filter(u => u.role === 'admin' || u.role === 'manager')
      .forEach(u => console.log(`  - ${u.email} / ${u.password}`));

    console.log('\nTest Scenarios:');
    testAuctions.forEach((a, i) => {
      console.log(`  ${i + 1}. ${a.caseTitle} (${a.documentsSigned}/3 docs signed)`);
    });

    console.log('\nYou can now proceed with UAT testing!');
    console.log('Refer to tests/uat/escrow-wallet-payment-uat-plan.md for test scenarios.\n');

  } catch (error) {
    console.error('\n✗ Error setting up UAT test data:', error);
    process.exit(1);
  }
}

main();
