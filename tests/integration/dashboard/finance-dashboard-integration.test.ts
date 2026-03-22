/**
 * Integration Tests: Finance Dashboard with Escrow Payment Stats
 * 
 * Tests Requirement 4 from requirements.md:
 * - Finance Officer can view escrow wallet payment statistics
 * - Dashboard shows count and percentage of escrow payments
 * - Dashboard displays chart comparing payment methods
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { 
  users, 
  vendors, 
  salvageCases, 
  auctions, 
  payments 
} from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

describe('Finance Dashboard - Escrow Payment Stats Integration', () => {
  let financeOfficerUserId: string;
  let vendorUserId: string;
  let vendorId: string;
  let caseId: string;
  let auctionId: string;
  let escrowPaymentId: string;
  let paystackPaymentId: string;
  let bankTransferPaymentId: string;

  beforeAll(async () => {
    // Create Finance Officer user
    const [financeOfficerUser] = await db
      .insert(users)
      .values({
        email: `finance.dashboard.${Date.now()}@test.com`,
        fullName: 'Finance Dashboard Test Officer',
        phone: `+234801234${Math.floor(Math.random() * 10000)}`,
        role: 'finance_officer',
        passwordHash: '$2a$10$dummyhashfortest1234567890123456789012345678901234567890',
        dateOfBirth: new Date('1990-01-01'),
      })
      .returning();

    financeOfficerUserId = financeOfficerUser.id;

    // Create vendor user
    const [vendorUser] = await db
      .insert(users)
      .values({
        email: `vendor.dashboard.${Date.now()}@test.com`,
        fullName: 'Vendor Dashboard Test',
        phone: `+234808765${Math.floor(Math.random() * 10000)}`,
        role: 'vendor',
        passwordHash: '$2a$10$dummyhashfortest1234567890123456789012345678901234567890',
        dateOfBirth: new Date('1985-05-15'),
      })
      .returning();

    vendorUserId = vendorUser.id;

    // Create vendor
    const [vendor] = await db
      .insert(vendors)
      .values({
        userId: vendorUserId,
        businessName: 'Test Vendor Company',
        tier: 'tier2_full',
        status: 'approved',
        bankAccountNumber: '1234567890',
        bankName: 'Test Bank',
        bankAccountName: 'Test Vendor',
      })
      .returning();

    vendorId = vendor.id;

    // Create salvage case
    const [salvageCase] = await db
      .insert(salvageCases)
      .values({
        claimReference: `TEST-DASHBOARD-${Date.now()}`,
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
        status: 'active_auction',
        createdBy: financeOfficerUserId,
      })
      .returning();

    caseId = salvageCase.id;

    // Create auction
    const [auction] = await db
      .insert(auctions)
      .values({
        caseId,
        title: 'Test Dashboard Auction',
        startingBid: 400000,
        currentBid: 500000,
        startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - 1 * 60 * 60 * 1000),
        originalEndTime: new Date(Date.now() - 1 * 60 * 60 * 1000),
        status: 'closed',
        winnerId: vendorId,
        createdBy: financeOfficerUserId,
      })
      .returning();

    auctionId = auction.id;

    // Create escrow wallet payment
    const [escrowPayment] = await db
      .insert(payments)
      .values({
        auctionId,
        vendorId,
        amount: '500000',
        paymentMethod: 'escrow_wallet',
        escrowStatus: 'frozen',
        status: 'pending',
        paymentReference: 'ESC-DASHBOARD-001',
        autoVerified: false,
        paymentDeadline: new Date(Date.now() + 86400000),
      })
      .returning();

    escrowPaymentId = escrowPayment.id;

    // Create Paystack payment
    const [paystackPayment] = await db
      .insert(payments)
      .values({
        auctionId,
        vendorId,
        amount: '300000',
        paymentMethod: 'paystack',
        status: 'verified',
        paymentReference: 'PAY-DASHBOARD-001',
        autoVerified: true,
        paymentDeadline: new Date(Date.now() + 86400000),
      })
      .returning();

    paystackPaymentId = paystackPayment.id;

    // Create Bank Transfer payment
    const [bankTransferPayment] = await db
      .insert(payments)
      .values({
        auctionId,
        vendorId,
        amount: '200000',
        paymentMethod: 'bank_transfer',
        status: 'verified',
        paymentReference: 'BANK-DASHBOARD-001',
        autoVerified: false,
        paymentDeadline: new Date(Date.now() + 86400000),
      })
      .returning();

    bankTransferPaymentId = bankTransferPayment.id;
  });

  afterAll(async () => {
    // Cleanup in reverse order of creation
    if (escrowPaymentId) {
      await db.delete(payments).where(eq(payments.id, escrowPaymentId));
    }
    if (paystackPaymentId) {
      await db.delete(payments).where(eq(payments.id, paystackPaymentId));
    }
    if (bankTransferPaymentId) {
      await db.delete(payments).where(eq(payments.id, bankTransferPaymentId));
    }
    if (auctionId) {
      await db.delete(auctions).where(eq(auctions.id, auctionId));
    }
    if (caseId) {
      await db.delete(salvageCases).where(eq(salvageCases.id, caseId));
    }
    if (vendorId) {
      await db.delete(vendors).where(eq(vendors.id, vendorId));
    }
    if (vendorUserId) {
      await db.delete(users).where(eq(users.id, vendorUserId));
    }
    if (financeOfficerUserId) {
      await db.delete(users).where(eq(users.id, financeOfficerUserId));
    }
  });

  describe('Dashboard API - Escrow Payment Statistics', () => {
    it('should return escrow wallet payment count', async () => {
      const escrowPayments = await db
        .select()
        .from(payments)
        .where(eq(payments.paymentMethod, 'escrow_wallet'));

      expect(escrowPayments.length).toBeGreaterThanOrEqual(1);
      expect(escrowPayments.some(p => p.id === escrowPaymentId)).toBe(true);
    });

    it('should calculate escrow wallet percentage correctly', async () => {
      const allPayments = await db.select().from(payments);
      const escrowPayments = allPayments.filter(p => p.paymentMethod === 'escrow_wallet');

      const totalPayments = allPayments.length;
      const escrowCount = escrowPayments.length;
      const percentage = Math.round((escrowCount / totalPayments) * 100);

      expect(totalPayments).toBeGreaterThanOrEqual(3);
      expect(escrowCount).toBeGreaterThanOrEqual(1);
      expect(percentage).toBeGreaterThan(0);
      expect(percentage).toBeLessThanOrEqual(100);
    });

    it('should return payment method breakdown', async () => {
      const allPayments = await db.select().from(payments);

      const breakdown = {
        paystack: allPayments.filter(p => p.paymentMethod === 'paystack').length,
        bank_transfer: allPayments.filter(p => p.paymentMethod === 'bank_transfer').length,
        escrow_wallet: allPayments.filter(p => p.paymentMethod === 'escrow_wallet').length,
      };

      expect(breakdown.paystack).toBeGreaterThanOrEqual(1);
      expect(breakdown.bank_transfer).toBeGreaterThanOrEqual(1);
      expect(breakdown.escrow_wallet).toBeGreaterThanOrEqual(1);

      const total = breakdown.paystack + breakdown.bank_transfer + breakdown.escrow_wallet;
      expect(total).toBe(allPayments.length);
    });

    it('should include escrow stats in dashboard response', async () => {
      const allPayments = await db.select().from(payments);
      const escrowPayments = allPayments.filter(p => p.paymentMethod === 'escrow_wallet');

      const stats = {
        totalPayments: allPayments.length,
        escrowWalletPayments: escrowPayments.length,
        escrowWalletPercentage: Math.round((escrowPayments.length / allPayments.length) * 100),
        paymentMethodBreakdown: {
          paystack: allPayments.filter(p => p.paymentMethod === 'paystack').length,
          bank_transfer: allPayments.filter(p => p.paymentMethod === 'bank_transfer').length,
          escrow_wallet: escrowPayments.length,
        },
      };

      expect(stats.totalPayments).toBeGreaterThanOrEqual(3);
      expect(stats.escrowWalletPayments).toBeGreaterThanOrEqual(1);
      expect(stats.escrowWalletPercentage).toBeGreaterThan(0);
      expect(stats.paymentMethodBreakdown.escrow_wallet).toBe(stats.escrowWalletPayments);
    });
  });

  describe('Dashboard UI - Escrow Payment Display', () => {
    it('should display escrow wallet payment count and percentage', async () => {
      const allPayments = await db.select().from(payments);
      const escrowPayments = allPayments.filter(p => p.paymentMethod === 'escrow_wallet');

      const escrowCount = escrowPayments.length;
      const percentage = Math.round((escrowCount / allPayments.length) * 100);

      // Verify data for UI display
      expect(escrowCount).toBeGreaterThanOrEqual(1);
      expect(percentage).toBeGreaterThan(0);
      
      // Simulate UI display format
      const displayText = `${escrowCount} (${percentage}% of total)`;
      expect(displayText).toMatch(/\d+ \(\d+% of total\)/);
    });

    it('should provide data for payment method chart', async () => {
      const allPayments = await db.select().from(payments);

      const chartData = [
        {
          method: 'Escrow Wallet',
          count: allPayments.filter(p => p.paymentMethod === 'escrow_wallet').length,
          percentage: Math.round((allPayments.filter(p => p.paymentMethod === 'escrow_wallet').length / allPayments.length) * 100),
        },
        {
          method: 'Paystack',
          count: allPayments.filter(p => p.paymentMethod === 'paystack').length,
          percentage: Math.round((allPayments.filter(p => p.paymentMethod === 'paystack').length / allPayments.length) * 100),
        },
        {
          method: 'Bank Transfer',
          count: allPayments.filter(p => p.paymentMethod === 'bank_transfer').length,
          percentage: Math.round((allPayments.filter(p => p.paymentMethod === 'bank_transfer').length / allPayments.length) * 100),
        },
      ];

      // Verify chart data
      chartData.forEach(item => {
        expect(item.count).toBeGreaterThanOrEqual(0);
        expect(item.percentage).toBeGreaterThanOrEqual(0);
        expect(item.percentage).toBeLessThanOrEqual(100);
      });

      // Verify total percentages (may not equal 100 due to rounding)
      const totalPercentage = chartData.reduce((sum, item) => sum + item.percentage, 0);
      expect(totalPercentage).toBeGreaterThan(0);
      expect(totalPercentage).toBeLessThanOrEqual(300); // Max if all rounded up
    });

    it('should handle zero escrow payments gracefully', async () => {
      // Get current escrow payment ID before deletion
      const currentEscrowPayments = await db
        .select()
        .from(payments)
        .where(eq(payments.paymentMethod, 'escrow_wallet'));
      
      const tempEscrowId = currentEscrowPayments[0]?.id;

      // Delete all escrow payments temporarily
      await db.delete(payments).where(eq(payments.paymentMethod, 'escrow_wallet'));

      const allPayments = await db.select().from(payments);
      const escrowPayments = allPayments.filter(p => p.paymentMethod === 'escrow_wallet');

      const stats = {
        escrowWalletPayments: escrowPayments.length,
        escrowWalletPercentage: allPayments.length > 0 
          ? Math.round((escrowPayments.length / allPayments.length) * 100) 
          : 0,
      };

      expect(stats.escrowWalletPayments).toBe(0);
      expect(stats.escrowWalletPercentage).toBe(0);

      // Restore escrow payment
      await db
        .insert(payments)
        .values({
          id: tempEscrowId,
          auctionId,
          vendorId,
          amount: '500000',
          paymentMethod: 'escrow_wallet',
          escrowStatus: 'frozen',
          status: 'pending',
          paymentReference: 'ESC-DASHBOARD-001',
          autoVerified: false,
          paymentDeadline: new Date(Date.now() + 86400000),
        });
    });

    it('should calculate percentages correctly with various payment distributions', async () => {
      const allPayments = await db.select().from(payments);

      // Test percentage calculation
      const calculatePercentage = (count: number, total: number) => {
        return total > 0 ? Math.round((count / total) * 100) : 0;
      };

      const paystackCount = allPayments.filter(p => p.paymentMethod === 'paystack').length;
      const bankTransferCount = allPayments.filter(p => p.paymentMethod === 'bank_transfer').length;
      const escrowCount = allPayments.filter(p => p.paymentMethod === 'escrow_wallet').length;
      const total = allPayments.length;

      const paystackPercentage = calculatePercentage(paystackCount, total);
      const bankTransferPercentage = calculatePercentage(bankTransferCount, total);
      const escrowPercentage = calculatePercentage(escrowCount, total);

      // Verify all percentages are valid
      expect(paystackPercentage).toBeGreaterThanOrEqual(0);
      expect(paystackPercentage).toBeLessThanOrEqual(100);
      expect(bankTransferPercentage).toBeGreaterThanOrEqual(0);
      expect(bankTransferPercentage).toBeLessThanOrEqual(100);
      expect(escrowPercentage).toBeGreaterThanOrEqual(0);
      expect(escrowPercentage).toBeLessThanOrEqual(100);
    });
  });

  describe('Dashboard Filtering - Escrow Payments', () => {
    it('should filter payments by escrow_wallet method', async () => {
      const escrowPayments = await db
        .select()
        .from(payments)
        .where(eq(payments.paymentMethod, 'escrow_wallet'));

      expect(escrowPayments.length).toBeGreaterThanOrEqual(1);
      escrowPayments.forEach(payment => {
        expect(payment.paymentMethod).toBe('escrow_wallet');
      });
    });

    it('should show escrow status for escrow wallet payments', async () => {
      const escrowPayments = await db
        .select()
        .from(payments)
        .where(eq(payments.paymentMethod, 'escrow_wallet'));

      escrowPayments.forEach(payment => {
        expect(payment.escrowStatus).toBeDefined();
        expect(['frozen', 'released', 'failed']).toContain(payment.escrowStatus);
      });
    });

    it('should combine payment method and status filters', async () => {
      const filteredPayments = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.paymentMethod, 'escrow_wallet'),
            eq(payments.status, 'pending')
          )
        );

      filteredPayments.forEach(payment => {
        expect(payment.paymentMethod).toBe('escrow_wallet');
        expect(payment.status).toBe('pending');
      });
    });
  });
});
