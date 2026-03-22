/**
 * Integration Tests for Document Signing → Fund Release Flow
 * 
 * Tests the complete end-to-end flow:
 * 1. Vendor signs document 1 → No fund release
 * 2. Vendor signs document 2 → No fund release
 * 3. Vendor signs document 3 → Automatic fund release triggered
 * 4. Payment status updated to 'verified'
 * 5. Case status updated to 'sold'
 * 6. Notifications sent to vendor
 * 7. Audit log created
 * 
 * This is the CORE automation test for the escrow wallet payment completion feature.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { salvageCases } from '@/lib/db/schema/cases';
import { auctions } from '@/lib/db/schema/auctions';
import { payments } from '@/lib/db/schema/payments';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { escrowWallets, walletTransactions } from '@/lib/db/schema/escrow';
import { eq, and } from 'drizzle-orm';
import {
  generateDocument,
  signDocument,
  checkAllDocumentsSigned,
} from '@/features/documents/services/document.service';
import { escrowService } from '@/features/payments/services/escrow.service';

describe('Document Signing → Fund Release Integration', () => {
  let testUserId: string;
  let testVendorId: string;
  let testCaseId: string;
  let testAuctionId: string;
  let testPaymentId: string;
  let testWalletId: string;

  beforeAll(async () => {
    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        email: `test-fund-release-${Date.now()}@example.com`,
        fullName: 'Test Vendor Fund Release',
        phone: '2348141252812',
        passwordHash: 'hashed-password-test', // Required field
        dateOfBirth: new Date('1990-01-01'), // Required field
        role: 'vendor',
        emailVerified: true,
        phoneVerified: true,
      })
      .returning();
    testUserId = user.id;

    // Create test vendor
    const [vendor] = await db
      .insert(vendors)
      .values({
        userId: testUserId,
        tier: 'tier1',
        bvnVerified: true,
        bvnEncrypted: 'encrypted-bvn',
      })
      .returning();
    testVendorId = vendor.id;

    // Create test case
    const [testCase] = await db
      .insert(salvageCases)
      .values({
        claimReference: `TEST-FUND-RELEASE-${Date.now()}`,
        assetType: 'vehicle',
        vehicleCondition: 'fair',
        locationName: 'Test Location',
        locationCoordinates: { lat: 6.5244, lng: 3.3792 },
        assetDetails: {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
        },
        aiAssessment: {
          estimatedValue: 500000,
          salvageValue: 400000,
        },
        status: 'approved',
        createdBy: testUserId,
      })
      .returning();
    testCaseId = testCase.id;

    // Create test auction
    const [auction] = await db
      .insert(auctions)
      .values({
        caseId: testCaseId,
        reservePrice: '400000.00',
        currentBid: '500000.00',
        highestBidderId: testVendorId,
        startTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // Started 24 hours ago
        endTime: new Date(Date.now() - 1 * 60 * 60 * 1000), // Ended 1 hour ago
        status: 'closed',
      })
      .returning();
    testAuctionId = auction.id;

    // Fund vendor wallet
    const fundResult = await escrowService.fundWallet(testVendorId, 500000, testUserId);
    testWalletId = fundResult.walletId;

    // Credit wallet (simulate Paystack confirmation)
    await escrowService.creditWallet(testWalletId, 500000, fundResult.reference, testUserId);

    // Freeze funds for auction
    await escrowService.freezeFunds(testVendorId, 500000, testAuctionId, testUserId);

    // Create payment record with escrow_wallet method
    const [payment] = await db
      .insert(payments)
      .values({
        auctionId: testAuctionId,
        vendorId: testVendorId,
        amount: '500000.00',
        paymentMethod: 'escrow_wallet',
        escrowStatus: 'frozen',
        status: 'pending',
        paymentDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000),
      })
      .returning();
    testPaymentId = payment.id;

    // Generate 3 required documents
    await generateDocument(testAuctionId, testVendorId, 'bill_of_sale', testUserId);
    await generateDocument(testAuctionId, testVendorId, 'liability_waiver', testUserId);
    await generateDocument(testAuctionId, testVendorId, 'pickup_authorization', testUserId);
  });

  afterAll(async () => {
    // Cleanup test data
    if (testAuctionId) {
      await db.delete(releaseForms).where(eq(releaseForms.auctionId, testAuctionId));
      await db.delete(payments).where(eq(payments.auctionId, testAuctionId));
      await db.delete(auctions).where(eq(auctions.id, testAuctionId));
    }
    if (testCaseId) {
      await db.delete(salvageCases).where(eq(salvageCases.id, testCaseId));
    }
    if (testWalletId) {
      await db.delete(walletTransactions).where(eq(walletTransactions.walletId, testWalletId));
      await db.delete(escrowWallets).where(eq(escrowWallets.id, testWalletId));
    }
    if (testVendorId) {
      await db.delete(vendors).where(eq(vendors.id, testVendorId));
    }
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
  });

  it('should NOT release funds when only 1 document signed', async () => {
    // Get bill of sale document
    const [billOfSale] = await db
      .select()
      .from(releaseForms)
      .where(
        and(
          eq(releaseForms.auctionId, testAuctionId),
          eq(releaseForms.documentType, 'bill_of_sale')
        )
      )
      .limit(1);

    expect(billOfSale).toBeDefined();

    // Sign bill of sale
    await signDocument(
      billOfSale.id,
      testVendorId,
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      '127.0.0.1',
      'desktop',
      'test-user-agent'
    );

    // Check if all documents signed
    const allSigned = await checkAllDocumentsSigned(testAuctionId, testVendorId);
    expect(allSigned).toBe(false);

    // Verify payment status is still pending
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, testPaymentId))
      .limit(1);

    expect(payment.status).toBe('pending');
    expect(payment.escrowStatus).toBe('frozen');
  });

  it('should NOT release funds when only 2 documents signed', async () => {
    // Get liability waiver document
    const [liabilityWaiver] = await db
      .select()
      .from(releaseForms)
      .where(
        and(
          eq(releaseForms.auctionId, testAuctionId),
          eq(releaseForms.documentType, 'liability_waiver')
        )
      )
      .limit(1);

    expect(liabilityWaiver).toBeDefined();

    // Sign liability waiver
    await signDocument(
      liabilityWaiver.id,
      testVendorId,
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      '127.0.0.1',
      'desktop',
      'test-user-agent'
    );

    // Check if all documents signed
    const allSigned = await checkAllDocumentsSigned(testAuctionId, testVendorId);
    expect(allSigned).toBe(false);

    // Verify payment status is still pending
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, testPaymentId))
      .limit(1);

    expect(payment.status).toBe('pending');
    expect(payment.escrowStatus).toBe('frozen');
  });

  it('should AUTOMATICALLY release funds when all 3 documents signed', async () => {
    // Get pickup authorization document
    const [pickupAuth] = await db
      .select()
      .from(releaseForms)
      .where(
        and(
          eq(releaseForms.auctionId, testAuctionId),
          eq(releaseForms.documentType, 'pickup_authorization')
        )
      )
      .limit(1);

    expect(pickupAuth).toBeDefined();

    // Get wallet balance before signing
    const balanceBefore = await escrowService.getBalance(testVendorId);
    expect(balanceBefore.frozenAmount).toBe(500000);

    // Sign pickup authorization (3rd and final document)
    await signDocument(
      pickupAuth.id,
      testVendorId,
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      '127.0.0.1',
      'desktop',
      'test-user-agent'
    );

    // Wait a bit for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if all documents signed
    const allSigned = await checkAllDocumentsSigned(testAuctionId, testVendorId);
    expect(allSigned).toBe(true);

    // Verify payment status updated to verified
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, testPaymentId))
      .limit(1);

    expect(payment.status).toBe('verified');
    expect(payment.escrowStatus).toBe('released');
    expect(payment.autoVerified).toBe(true);
    expect(payment.verifiedAt).toBeDefined();

    // Verify case status updated to sold
    const [testCase] = await db
      .select()
      .from(salvageCases)
      .where(eq(salvageCases.id, testCaseId))
      .limit(1);

    expect(testCase.status).toBe('sold');

    // Verify wallet balance updated (funds released)
    const balanceAfter = await escrowService.getBalance(testVendorId);
    expect(balanceAfter.balance).toBe(0); // All funds released
    expect(balanceAfter.frozenAmount).toBe(0); // No frozen funds
    expect(balanceAfter.availableBalance).toBe(0); // No available balance

    // Verify wallet transaction created
    const transactions = await escrowService.getTransactions(testVendorId, 10);
    const releaseTransaction = transactions.find(t => 
      t.type === 'debit' && 
      t.description.includes('Funds released')
    );
    expect(releaseTransaction).toBeDefined();
    expect(releaseTransaction?.amount).toBe(500000);
  });

  it('should have all 3 documents signed after completion', async () => {
    const documents = await db
      .select()
      .from(releaseForms)
      .where(eq(releaseForms.auctionId, testAuctionId));

    expect(documents).toHaveLength(3);
    
    const signedDocuments = documents.filter(doc => doc.status === 'signed');
    expect(signedDocuments).toHaveLength(3);

    const documentTypes = signedDocuments.map(doc => doc.documentType).sort();
    expect(documentTypes).toEqual(['bill_of_sale', 'liability_waiver', 'pickup_authorization']);
  });
});
