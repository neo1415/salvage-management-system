/**
 * Integration Tests for Finance Officer Payments Page
 * 
 * Tests the Finance Officer payments page with escrow wallet payment support.
 * 
 * Requirements: Escrow Wallet Payment Completion - Requirement 4
 * 
 * Test Coverage:
 * - Payment list display with payment source column
 * - Escrow status badge display (Frozen/Released/Failed)
 * - Filter by payment method including "Escrow Wallet"
 * - Payment details with wallet balance and document progress
 * - Filtering and sorting
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { escrowWallets } from '@/lib/db/schema/escrow';
import { eq, and, sql } from 'drizzle-orm';

describe('Finance Officer Payments Page Integration Tests', () => {
  let financeOfficerId: string;
  let vendorId: string;
  let vendorUserId: string;
  let auctionId: string;
  let caseId: string;
  let paystackPaymentId: string;
  let escrowPaymentId: string;
  let walletId: string;

  beforeEach(async () => {
    // Create finance officer user
    const [financeOfficer] = await db
      .insert(users)
      .values({
        email: `finance-${Date.now()}@test.com`,
        fullName: 'Finance Officer',
        phone: `+234801234${Math.floor(Math.random() * 10000)}`,
        passwordHash: '$2a$10$dummyhashfortest1234567890123456789012345678901234567890',
        dateOfBirth: new Date('1990-01-01'),
        role: 'finance_officer',
        status: 'active',
        emailVerified: true,
        phoneVerified: true,
      })
      .returning();
    financeOfficerId = financeOfficer.id;

    // Create vendor user
    const [vendorUser] = await db
      .insert(users)
      .values({
        email: `vendor-${Date.now()}@test.com`,
        fullName: 'Test Vendor',
        phone: `+234808765${Math.floor(Math.random() * 10000)}`,
        passwordHash: '$2a$10$dummyhashfortest1234567890123456789012345678901234567890',
        dateOfBirth: new Date('1990-01-01'),
        role: 'vendor',
        status: 'active',
        emailVerified: true,
        phoneVerified: true,
      })
      .returning();
    vendorUserId = vendorUser.id;

    // Create vendor
    const [vendor] = await db
      .insert(vendors)
      .values({
        userId: vendorUserId,
        businessName: 'Test Vendor Business',
        tier: 'tier2_full',
        status: 'approved',
        bankAccountNumber: '1234567890',
        bankName: 'Test Bank',
        bankAccountName: 'Test Vendor',
      })
      .returning();
    vendorId = vendor.id;

    // Create wallet
    const [wallet] = await db
      .insert(escrowWallets)
      .values({
        vendorId,
        balance: 1000000,
        frozenAmount: 500000,
      })
      .returning();
    walletId = wallet.id;

    // Create case
    const [salvageCase] = await db
      .insert(salvageCases)
      .values({
        claimReference: `TEST-CLAIM-${Date.now()}`,
        assetType: 'vehicle',
        vehicleCondition: 'fair',
        locationName: 'Test Location',
        locationCoordinates: { lat: 6.5244, lng: 3.3792 },
        gpsLocation: sql`point(6.5244, 3.3792)`,
        assetDetails: { make: 'Toyota', model: 'Camry' },
        marketValue: 5000000,
        estimatedSalvageValue: 1500000,
        reservePrice: 1000000,
        photos: ['https://example.com/photo1.jpg'],
        status: 'auction_live',
        createdBy: financeOfficerId,
      })
      .returning();
    caseId = salvageCase.id;

    // Create auction
    const [auction] = await db
      .insert(auctions)
      .values({
        caseId,
        title: 'Test Auction',
        startingBid: 400000,
        currentBid: 500000,
        startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - 1 * 60 * 60 * 1000),
        originalEndTime: new Date(Date.now() - 1 * 60 * 60 * 1000),
        status: 'closed',
        winnerId: vendorId,
        createdBy: financeOfficerId,
      })
      .returning();
    auctionId = auction.id;

    // Create Paystack payment
    const [paystackPayment] = await db
      .insert(payments)
      .values({
        auctionId,
        vendorId,
        amount: '500000',
        paymentMethod: 'paystack',
        paymentReference: 'PAY-TEST-001',
        status: 'pending',
        autoVerified: false,
        paymentDeadline: new Date(Date.now() + 86400000),
      })
      .returning();
    paystackPaymentId = paystackPayment.id;

    // Create Escrow Wallet payment
    const [escrowPayment] = await db
      .insert(payments)
      .values({
        auctionId,
        vendorId,
        amount: '500000',
        paymentMethod: 'escrow_wallet',
        escrowStatus: 'frozen',
        status: 'pending',
        autoVerified: false,
        paymentDeadline: new Date(Date.now() + 86400000),
      })
      .returning();
    escrowPaymentId = escrowPayment.id;

    // Create release forms for escrow payment
    await db.insert(releaseForms).values([
      {
        auctionId,
        vendorId,
        documentType: 'bill_of_sale',
        title: 'Bill of Sale',
        status: 'signed',
        signedAt: new Date(),
        pdfUrl: 'https://example.com/bill_of_sale.pdf',
        pdfPublicId: 'test_bill_of_sale',
        documentData: {},
        generatedBy: financeOfficerId,
      },
      {
        auctionId,
        vendorId,
        documentType: 'liability_waiver',
        title: 'Release & Waiver of Liability',
        status: 'signed',
        signedAt: new Date(),
        pdfUrl: 'https://example.com/liability_waiver.pdf',
        pdfPublicId: 'test_liability_waiver',
        documentData: {},
        generatedBy: financeOfficerId,
      },
      {
        auctionId,
        vendorId,
        documentType: 'pickup_authorization',
        title: 'Pickup Authorization',
        status: 'pending',
        pdfUrl: 'https://example.com/pickup_authorization.pdf',
        pdfPublicId: 'test_pickup_authorization',
        documentData: {},
        generatedBy: financeOfficerId,
      },
    ]);
  });

  afterEach(async () => {
    // Clean up in reverse order of dependencies
    await db.delete(releaseForms).where(eq(releaseForms.auctionId, auctionId));
    await db.delete(payments).where(eq(payments.auctionId, auctionId));
    await db.delete(auctions).where(eq(auctions.id, auctionId));
    await db.delete(salvageCases).where(eq(salvageCases.id, caseId));
    await db.delete(escrowWallets).where(eq(escrowWallets.id, walletId));
    await db.delete(vendors).where(eq(vendors.id, vendorId));
    await db.delete(users).where(eq(users.id, vendorUserId));
    await db.delete(users).where(eq(users.id, financeOfficerId));
  });

  describe('Payment List Display', () => {
    it('should fetch payments with payment method information', async () => {
      const allPayments = await db
        .select()
        .from(payments)
        .where(eq(payments.auctionId, auctionId));

      expect(allPayments).toHaveLength(2);
      
      const paystackPayment = allPayments.find(p => p.id === paystackPaymentId);
      expect(paystackPayment?.paymentMethod).toBe('paystack');
      expect(paystackPayment?.escrowStatus).toBeNull();
      
      const escrowPayment = allPayments.find(p => p.id === escrowPaymentId);
      expect(escrowPayment?.paymentMethod).toBe('escrow_wallet');
      expect(escrowPayment?.escrowStatus).toBe('frozen');
    });

    it('should display escrow status for escrow_wallet payments', async () => {
      const [escrowPayment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, escrowPaymentId));

      expect(escrowPayment.paymentMethod).toBe('escrow_wallet');
      expect(escrowPayment.escrowStatus).toBe('frozen');
    });
  });

  describe('Payment Method Filtering', () => {
    it('should filter payments by Escrow Wallet method', async () => {
      const escrowPayments = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.auctionId, auctionId),
            eq(payments.paymentMethod, 'escrow_wallet')
          )
        );

      expect(escrowPayments).toHaveLength(1);
      expect(escrowPayments[0].paymentMethod).toBe('escrow_wallet');
      expect(escrowPayments[0].escrowStatus).toBe('frozen');
    });

    it('should filter payments by Paystack method', async () => {
      const paystackPayments = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.auctionId, auctionId),
            eq(payments.paymentMethod, 'paystack')
          )
        );

      expect(paystackPayments).toHaveLength(1);
      expect(paystackPayments[0].paymentMethod).toBe('paystack');
    });
  });

  describe('Escrow Payment Details', () => {
    it('should fetch wallet balance for escrow payments', async () => {
      const { escrowService } = await import('@/features/payments/services/escrow.service');
      const walletBalance = await escrowService.getBalance(vendorId);

      expect(walletBalance.availableBalance).toBe(1000000);
      expect(walletBalance.frozenAmount).toBe(500000);
    });

    it('should fetch document progress for escrow payments', async () => {
      const { getDocumentProgress } = await import('@/features/documents/services/document.service');
      const progress = await getDocumentProgress(auctionId, vendorId);

      expect(progress.signedDocuments).toBe(2);
      expect(progress.totalDocuments).toBe(3);
      expect(progress.progress).toBeCloseTo(66.67, 1);
      expect(progress.allSigned).toBe(false);
    });
  });

  describe('Escrow Status Badges', () => {
    it('should display frozen status for pending escrow payments', async () => {
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, escrowPaymentId));

      expect(payment.escrowStatus).toBe('frozen');
      expect(payment.status).toBe('pending');
    });

    it('should display released status after fund release', async () => {
      // Update payment to released status
      await db
        .update(payments)
        .set({ escrowStatus: 'released', status: 'verified' })
        .where(eq(payments.id, escrowPaymentId));

      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, escrowPaymentId));

      expect(payment.escrowStatus).toBe('released');
      expect(payment.status).toBe('verified');
    });

    it('should display failed status for failed fund releases', async () => {
      // Update payment to failed status
      await db
        .update(payments)
        .set({ escrowStatus: 'failed' })
        .where(eq(payments.id, escrowPaymentId));

      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, escrowPaymentId));

      expect(payment.escrowStatus).toBe('failed');
    });
  });

  describe('Filtering and Sorting', () => {
    it('should filter by status and payment method combined', async () => {
      const filteredPayments = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.auctionId, auctionId),
            eq(payments.status, 'pending'),
            eq(payments.paymentMethod, 'escrow_wallet')
          )
        );

      expect(filteredPayments).toHaveLength(1);
      expect(filteredPayments[0].status).toBe('pending');
      expect(filteredPayments[0].paymentMethod).toBe('escrow_wallet');
    });

    it('should return payments sorted by creation date descending', async () => {
      const sortedPayments = await db
        .select()
        .from(payments)
        .where(eq(payments.auctionId, auctionId))
        .orderBy(sql`${payments.createdAt} DESC`);

      expect(sortedPayments).toHaveLength(2);
      
      // Verify descending order
      for (let i = 0; i < sortedPayments.length - 1; i++) {
        const current = new Date(sortedPayments[i].createdAt).getTime();
        const next = new Date(sortedPayments[i + 1].createdAt).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });
  });
});


describe('Finance Officer Payments Page Integration Tests', () => {
  let financeOfficerId: string;
  let vendorId: string;
  let vendorUserId: string;
  let auctionId: string;
  let caseId: string;
  let paystackPaymentId: string;
  let escrowPaymentId: string;
  let walletId: string;

  beforeEach(async () => {
    // Create finance officer user
    const [financeOfficer] = await db
      .insert(users)
      .values({
        email: 'finance@test.com',
        fullName: 'Finance Officer',
        phone: '+2348012345678',
        role: 'finance_officer',
        status: 'active',
      })
      .returning();
    financeOfficerId = financeOfficer.id;

    // Create vendor user
    const [vendorUser] = await db
      .insert(users)
      .values({
        email: 'vendor@test.com',
        fullName: 'Test Vendor',
        phone: '+2348087654321',
        role: 'vendor',
        status: 'active',
      })
      .returning();
    vendorUserId = vendorUser.id;

    // Create vendor
    const [vendor] = await db
      .insert(vendors)
      .values({
        userId: vendorUserId,
        businessName: 'Test Vendor Business',
        tier: 'tier2_full',
        status: 'approved',
        bankAccountNumber: '1234567890',
        bankName: 'Test Bank',
        bankAccountName: 'Test Vendor',
      })
      .returning();
    vendorId = vendor.id;

    // Create wallet
    const [wallet] = await db
      .insert(escrowWallets)
      .values({
        vendorId,
        balance: 1000000,
        frozenAmount: 500000,
      })
      .returning();
    walletId = wallet.id;

    // Create case
    const [salvageCase] = await db
      .insert(salvageCases)
      .values({
        claimReference: 'TEST-CLAIM-001',
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry' },
        status: 'auction_live',
      })
      .returning();
    caseId = salvageCase.id;

    // Create auction
    const [auction] = await db
      .insert(auctions)
      .values({
        caseId,
        startingBid: 400000,
        currentBid: 500000,
        startTime: new Date(),
        endTime: new Date(Date.now() + 86400000),
        status: 'closed',
        winnerId: vendorId,
      })
      .returning();
    auctionId = auction.id;

    // Create Paystack payment
    const [paystackPayment] = await db
      .insert(payments)
      .values({
        auctionId,
        vendorId,
        amount: '500000',
        paymentMethod: 'paystack',
        paymentReference: 'PAY-TEST-001',
        status: 'pending',
        autoVerified: false,
        paymentDeadline: new Date(Date.now() + 86400000),
      })
      .returning();
    paystackPaymentId = paystackPayment.id;

    // Create Escrow Wallet payment
    const [escrowPayment] = await db
      .insert(payments)
      .values({
        auctionId,
        vendorId,
        amount: '500000',
        paymentMethod: 'escrow_wallet',
        escrowStatus: 'frozen',
        status: 'pending',
        autoVerified: false,
        paymentDeadline: new Date(Date.now() + 86400000),
      })
      .returning();
    escrowPaymentId = escrowPayment.id;

    // Create release forms for escrow payment
    await db.insert(releaseForms).values([
      {
        auctionId,
        vendorId,
        documentType: 'bill_of_sale',
        status: 'signed',
        signedAt: new Date(),
      },
      {
        auctionId,
        vendorId,
        documentType: 'liability_waiver',
        status: 'signed',
        signedAt: new Date(),
      },
      {
        auctionId,
        vendorId,
        documentType: 'pickup_authorization',
        status: 'pending',
      },
    ]);
  });

  afterEach(async () => {
    // Clean up in reverse order of dependencies
    await db.delete(releaseForms).where(eq(releaseForms.auctionId, auctionId));
    await db.delete(payments).where(eq(payments.auctionId, auctionId));
    await db.delete(auctions).where(eq(auctions.id, auctionId));
    await db.delete(salvageCases).where(eq(salvageCases.id, caseId));
    await db.delete(escrowWallets).where(eq(escrowWallets.id, walletId));
    await db.delete(vendors).where(eq(vendors.id, vendorId));
    await db.delete(users).where(eq(users.id, vendorUserId));
    await db.delete(users).where(eq(users.id, financeOfficerId));
  });

  describe('Payment List Display', () => {
    it('should fetch payments with payment method information', async () => {
      const allPayments = await db
        .select()
        .from(payments)
        .where(eq(payments.auctionId, auctionId));

      expect(allPayments).toHaveLength(2);
      
      const paystackPayment = allPayments.find(p => p.id === paystackPaymentId);
      expect(paystackPayment?.paymentMethod).toBe('paystack');
      expect(paystackPayment?.escrowStatus).toBeNull();
      
      const escrowPayment = allPayments.find(p => p.id === escrowPaymentId);
      expect(escrowPayment?.paymentMethod).toBe('escrow_wallet');
      expect(escrowPayment?.escrowStatus).toBe('frozen');
    });

    it('should display escrow status for escrow_wallet payments', async () => {
      const [escrowPayment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, escrowPaymentId));

      expect(escrowPayment.paymentMethod).toBe('escrow_wallet');
      expect(escrowPayment.escrowStatus).toBe('frozen');
    });
  });

  describe('Payment Method Filtering', () => {
    it('should filter payments by Escrow Wallet method', async () => {
      const escrowPayments = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.auctionId, auctionId),
            eq(payments.paymentMethod, 'escrow_wallet')
          )
        );

      expect(escrowPayments).toHaveLength(1);
      expect(escrowPayments[0].paymentMethod).toBe('escrow_wallet');
      expect(escrowPayments[0].escrowStatus).toBe('frozen');
    });

    it('should filter payments by Paystack method', async () => {
      const paystackPayments = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.auctionId, auctionId),
            eq(payments.paymentMethod, 'paystack')
          )
        );

      expect(paystackPayments).toHaveLength(1);
      expect(paystackPayments[0].paymentMethod).toBe('paystack');
    });
  });

  describe('Escrow Payment Details', () => {
    it('should fetch wallet balance for escrow payments', async () => {
      const { escrowService } = await import('@/features/payments/services/escrow.service');
      const walletBalance = await escrowService.getBalance(vendorId);

      expect(walletBalance.availableBalance).toBe(1000000);
      expect(walletBalance.frozenAmount).toBe(500000);
    });

    it('should fetch document progress for escrow payments', async () => {
      const { getDocumentProgress } = await import('@/features/documents/services/document.service');
      const progress = await getDocumentProgress(auctionId, vendorId);

      expect(progress.signedDocuments).toBe(2);
      expect(progress.totalDocuments).toBe(3);
      expect(progress.progress).toBeCloseTo(66.67, 1);
      expect(progress.allSigned).toBe(false);
    });
  });

  describe('Escrow Status Badges', () => {
    it('should display frozen status for pending escrow payments', async () => {
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, escrowPaymentId));

      expect(payment.escrowStatus).toBe('frozen');
      expect(payment.status).toBe('pending');
    });

    it('should display released status after fund release', async () => {
      // Update payment to released status
      await db
        .update(payments)
        .set({ escrowStatus: 'released', status: 'verified' })
        .where(eq(payments.id, escrowPaymentId));

      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, escrowPaymentId));

      expect(payment.escrowStatus).toBe('released');
      expect(payment.status).toBe('verified');
    });

    it('should display failed status for failed fund releases', async () => {
      // Update payment to failed status
      await db
        .update(payments)
        .set({ escrowStatus: 'failed' })
        .where(eq(payments.id, escrowPaymentId));

      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, escrowPaymentId));

      expect(payment.escrowStatus).toBe('failed');
    });
  });

  describe('Filtering and Sorting', () => {
    it('should filter by status and payment method combined', async () => {
      const filteredPayments = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.auctionId, auctionId),
            eq(payments.status, 'pending'),
            eq(payments.paymentMethod, 'escrow_wallet')
          )
        );

      expect(filteredPayments).toHaveLength(1);
      expect(filteredPayments[0].status).toBe('pending');
      expect(filteredPayments[0].paymentMethod).toBe('escrow_wallet');
    });

    it('should return payments sorted by creation date descending', async () => {
      const sortedPayments = await db
        .select()
        .from(payments)
        .where(eq(payments.auctionId, auctionId))
        .orderBy(sql`${payments.createdAt} DESC`);

      expect(sortedPayments).toHaveLength(2);
      
      // Verify descending order
      for (let i = 0; i < sortedPayments.length - 1; i++) {
        const current = new Date(sortedPayments[i].createdAt).getTime();
        const next = new Date(sortedPayments[i + 1].createdAt).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });
  });
});
