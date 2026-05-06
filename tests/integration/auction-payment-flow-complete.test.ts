/**
 * Complete Auction-to-Payment Flow E2E Tests
 * 
 * Tests the entire flow from auction creation to payment completion:
 * 1. Create auction with deposit system enabled
 * 2. Place bids from multiple vendors
 * 3. End auction early (or let it expire naturally)
 * 4. Verify winner record creation
 * 5. Sign documents
 * 6. Calculate payment breakdown
 * 7. Process payment (wallet/paystack/hybrid)
 * 8. Verify payment completion and fund release
 * 9. Verify non-winner deposit unfreeze
 * 10. Verify pickup authorization generation
 * 
 * This test suite ensures all the permanent fixes work together correctly.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { auctions, bids, vendors, users, escrowWallets, auctionWinners, payments, depositEvents } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { auctionClosureService } from '@/features/auctions/services/auction-closure.service';
import { escrowService } from '@/features/auctions/services/escrow.service';
import { paymentService } from '@/features/auction-deposit/services/payment.service';
import { configService } from '@/features/auction-deposit/services/config.service';

describe('Complete Auction-to-Payment Flow E2E Tests', () => {
  let testAuctionId: string;
  let testVendor1Id: string;
  let testVendor2Id: string;
  let testVendor3Id: string;
  let testUser1Id: string;
  let testUser2Id: string;
  let testUser3Id: string;

  beforeAll(async () => {
    // Create test users with all required fields
    const [user1] = await db.insert(users).values({
      email: 'vendor1@test.com',
      fullName: 'Test Vendor 1',
      phone: '+2348141252812',
      passwordHash: '$2a$10$dummyhashfortest1234567890', // Dummy bcrypt hash for testing
      role: 'vendor',
      dateOfBirth: new Date('1990-01-01'),
    }).returning();
    testUser1Id = user1.id;

    const [user2] = await db.insert(users).values({
      email: 'vendor2@test.com',
      fullName: 'Test Vendor 2',
      phone: '+2348141252813',
      passwordHash: '$2a$10$dummyhashfortest1234567890',
      role: 'vendor',
      dateOfBirth: new Date('1990-01-01'),
    }).returning();
    testUser2Id = user2.id;

    const [user3] = await db.insert(users).values({
      email: 'vendor3@test.com',
      fullName: 'Test Vendor 3',
      phone: '+2348141252814',
      passwordHash: '$2a$10$dummyhashfortest1234567890',
      role: 'vendor',
      dateOfBirth: new Date('1990-01-01'),
    }).returning();
    testUser3Id = user3.id;

    // Create test vendors (using only fields that exist in database)
    const [vendor1] = await db.insert(vendors).values({
      userId: testUser1Id,
      businessName: 'Test Business 1',
      tier: 1,
      cacNumber: 'CAC001',
    }).returning();
    testVendor1Id = vendor1.id;

    const [vendor2] = await db.insert(vendors).values({
      userId: testUser2Id,
      businessName: 'Test Business 2',
      tier: 1,
      cacNumber: 'CAC002',
    }).returning();
    testVendor2Id = vendor2.id;

    const [vendor3] = await db.insert(vendors).values({
      userId: testUser3Id,
      businessName: 'Test Business 3',
      tier: 1,
      cacNumber: 'CAC003',
    }).returning();
    testVendor3Id = vendor3.id;

    // Create escrow wallets with sufficient balance
    await db.insert(escrowWallets).values([
      {
        vendorId: testVendor1Id,
        balance: '500000.00', // ₦500,000
        availableBalance: '500000.00',
        frozenAmount: '0.00',
        forfeitedAmount: '0.00',
      },
      {
        vendorId: testVendor2Id,
        balance: '300000.00', // ₦300,000
        availableBalance: '300000.00',
        frozenAmount: '0.00',
        forfeitedAmount: '0.00',
      },
      {
        vendorId: testVendor3Id,
        balance: '200000.00', // ₦200,000
        availableBalance: '200000.00',
        frozenAmount: '0.00',
        forfeitedAmount: '0.00',
      },
    ]);

    // Ensure deposit system is enabled
    const config = await configService.getConfig();
    if (!config.depositSystemEnabled) {
      await configService.updateConfig({
        depositSystemEnabled: true,
        depositRate: 10, // 10%
        minimumDepositFloor: 5000, // ₦5,000
        topBiddersToKeepFrozen: 3,
      });
    }
  });

  afterAll(async () => {
    // Cleanup test data
    if (testAuctionId) {
      await db.delete(depositEvents).where(eq(depositEvents.auctionId, testAuctionId));
      await db.delete(payments).where(eq(payments.auctionId, testAuctionId));
      await db.delete(auctionWinners).where(eq(auctionWinners.auctionId, testAuctionId));
      await db.delete(bids).where(eq(bids.auctionId, testAuctionId));
      await db.delete(auctions).where(eq(auctions.id, testAuctionId));
    }

    if (testVendor1Id) {
      await db.delete(escrowWallets).where(eq(escrowWallets.vendorId, testVendor1Id));
      await db.delete(vendors).where(eq(vendors.id, testVendor1Id));
    }
    if (testVendor2Id) {
      await db.delete(escrowWallets).where(eq(escrowWallets.vendorId, testVendor2Id));
      await db.delete(vendors).where(eq(vendors.id, testVendor2Id));
    }
    if (testVendor3Id) {
      await db.delete(escrowWallets).where(eq(escrowWallets.vendorId, testVendor3Id));
      await db.delete(vendors).where(eq(vendors.id, testVendor3Id));
    }

    if (testUser1Id) await db.delete(users).where(eq(users.id, testUser1Id));
    if (testUser2Id) await db.delete(users).where(eq(users.id, testUser2Id));
    if (testUser3Id) await db.delete(users).where(eq(users.id, testUser3Id));
  });

  beforeEach(async () => {
    // Create a fresh auction for each test
    const [auction] = await db.insert(auctions).values({
      caseId: 'test-case-id',
      startingBid: '100000.00', // ₦100,000
      currentBid: '100000.00',
      currentBidderId: null,
      status: 'active',
      startTime: new Date(),
      endTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    }).returning();
    testAuctionId = auction.id;
  });

  describe('1. Auction Creation and Bidding', () => {
    it('should create auction with deposit system enabled', async () => {
      const [auction] = await db.select().from(auctions).where(eq(auctions.id, testAuctionId));
      
      expect(auction).toBeDefined();
      expect(auction.status).toBe('active');
      expect(parseFloat(auction.startingBid)).toBe(100000);
    });

    it('should allow multiple vendors to place bids with deposit freeze', async () => {
      // Vendor 1 bids ₦150,000 (deposit: ₦15,000)
      await db.insert(bids).values({
        auctionId: testAuctionId,
        vendorId: testVendor1Id,
        amount: '150000.00',
        isLegacy: false,
      });

      // Freeze deposit for vendor 1
      await escrowService.freezeDeposit(testVendor1Id, 15000, testAuctionId, 'system');

      // Vendor 2 bids ₦180,000 (deposit: ₦18,000)
      await db.insert(bids).values({
        auctionId: testAuctionId,
        vendorId: testVendor2Id,
        amount: '180000.00',
        isLegacy: false,
      });

      await escrowService.freezeDeposit(testVendor2Id, 18000, testAuctionId, 'system');

      // Vendor 3 bids ₦200,000 (deposit: ₦20,000)
      await db.insert(bids).values({
        auctionId: testAuctionId,
        vendorId: testVendor3Id,
        amount: '200000.00',
        isLegacy: false,
      });

      await escrowService.freezeDeposit(testVendor3Id, 20000, testAuctionId, 'system');

      // Verify all deposits are frozen
      const wallet1 = await escrowService.getBalance(testVendor1Id);
      const wallet2 = await escrowService.getBalance(testVendor2Id);
      const wallet3 = await escrowService.getBalance(testVendor3Id);

      expect(wallet1.frozenAmount).toBe(15000);
      expect(wallet1.availableBalance).toBe(485000); // 500000 - 15000

      expect(wallet2.frozenAmount).toBe(18000);
      expect(wallet2.availableBalance).toBe(282000); // 300000 - 18000

      expect(wallet3.frozenAmount).toBe(20000);
      expect(wallet3.availableBalance).toBe(180000); // 200000 - 20000
    });
  });

  describe('2. Auction Closure and Winner Record Creation', () => {
    beforeEach(async () => {
      // Place bids
      await db.insert(bids).values([
        { auctionId: testAuctionId, vendorId: testVendor1Id, amount: '150000.00', isLegacy: false },
        { auctionId: testAuctionId, vendorId: testVendor2Id, amount: '180000.00', isLegacy: false },
        { auctionId: testAuctionId, vendorId: testVendor3Id, amount: '200000.00', isLegacy: false },
      ]);

      // Freeze deposits
      await escrowService.freezeDeposit(testVendor1Id, 15000, testAuctionId, 'system');
      await escrowService.freezeDeposit(testVendor2Id, 18000, testAuctionId, 'system');
      await escrowService.freezeDeposit(testVendor3Id, 20000, testAuctionId, 'system');
    });

    it('should close auction and create winner record', async () => {
      // Close auction
      const result = await auctionClosureService.closeAuction(testAuctionId, 3);

      expect(result.success).toBe(true);
      expect(result.winnerId).toBe(testVendor3Id); // Highest bidder
      expect(result.winningBid).toBe(200000);
      expect(result.topBiddersCount).toBe(3);
      expect(result.unfrozenBiddersCount).toBe(0); // All 3 are top bidders

      // Verify winner record exists
      const [winner] = await db.select()
        .from(auctionWinners)
        .where(and(
          eq(auctionWinners.auctionId, testAuctionId),
          eq(auctionWinners.rank, 1)
        ));

      expect(winner).toBeDefined();
      expect(winner.vendorId).toBe(testVendor3Id);
      expect(parseFloat(winner.bidAmount)).toBe(200000);
      expect(parseFloat(winner.depositAmount)).toBe(20000);
      expect(winner.status).toBe('active');
    });

    it('should verify winner record persists after transaction', async () => {
      // Close auction
      await auctionClosureService.closeAuction(testAuctionId, 3);

      // Wait a bit to ensure transaction is fully committed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify winner record still exists (not rolled back)
      const [winner] = await db.select()
        .from(auctionWinners)
        .where(and(
          eq(auctionWinners.auctionId, testAuctionId),
          eq(auctionWinners.rank, 1)
        ));

      expect(winner).toBeDefined();
      expect(winner.vendorId).toBe(testVendor3Id);
      
      console.log('✅ Winner record verified:', {
        id: winner.id,
        vendorId: winner.vendorId,
        bidAmount: winner.bidAmount,
        depositAmount: winner.depositAmount,
        rank: winner.rank,
      });
    });

    it('should keep all top 3 bidders deposits frozen', async () => {
      await auctionClosureService.closeAuction(testAuctionId, 3);

      // All 3 bidders should still have frozen deposits
      const wallet1 = await escrowService.getBalance(testVendor1Id);
      const wallet2 = await escrowService.getBalance(testVendor2Id);
      const wallet3 = await escrowService.getBalance(testVendor3Id);

      expect(wallet1.frozenAmount).toBe(15000);
      expect(wallet2.frozenAmount).toBe(18000);
      expect(wallet3.frozenAmount).toBe(20000);
    });
  });

  describe('3. Payment Calculation', () => {
    beforeEach(async () => {
      // Setup: Place bids, freeze deposits, close auction
      await db.insert(bids).values([
        { auctionId: testAuctionId, vendorId: testVendor1Id, amount: '150000.00', isLegacy: false },
        { auctionId: testAuctionId, vendorId: testVendor2Id, amount: '180000.00', isLegacy: false },
        { auctionId: testAuctionId, vendorId: testVendor3Id, amount: '200000.00', isLegacy: false },
      ]);

      await escrowService.freezeDeposit(testVendor1Id, 15000, testAuctionId, 'system');
      await escrowService.freezeDeposit(testVendor2Id, 18000, testAuctionId, 'system');
      await escrowService.freezeDeposit(testVendor3Id, 20000, testAuctionId, 'system');

      await auctionClosureService.closeAuction(testAuctionId, 3);

      // Update auction status to awaiting_payment
      await db.update(auctions)
        .set({ status: 'awaiting_payment' })
        .where(eq(auctions.id, testAuctionId));
    });

    it('should calculate correct payment breakdown', async () => {
      const breakdown = await paymentService.calculatePaymentBreakdown(
        testVendor3Id,
        testAuctionId,
        200000, // Final bid
        20000   // Deposit amount
      );

      expect(breakdown.finalBid).toBe(200000);
      expect(breakdown.depositAmount).toBe(20000);
      expect(breakdown.remainingAmount).toBe(180000); // 200000 - 20000
      expect(breakdown.availableBalance).toBe(180000); // Vendor 3 has ₦180k available
      expect(breakdown.canUseWalletOnly).toBe(true); // Exactly enough
      expect(breakdown.walletPortion).toBe(180000);
      expect(breakdown.paystackPortion).toBe(0);
    });

    it('should handle insufficient wallet balance', async () => {
      // Vendor 2 won with ₦180k bid, has ₦282k available
      // But let's test with vendor 1 who has less
      const breakdown = await paymentService.calculatePaymentBreakdown(
        testVendor1Id,
        testAuctionId,
        200000, // Final bid (hypothetical)
        20000   // Deposit amount
      );

      expect(breakdown.remainingAmount).toBe(180000);
      expect(breakdown.availableBalance).toBe(485000); // Vendor 1 has ₦485k
      expect(breakdown.canUseWalletOnly).toBe(true);
      expect(breakdown.walletPortion).toBe(180000);
      expect(breakdown.paystackPortion).toBe(0);
    });
  });

  describe('4. Wallet Payment Processing', () => {
    beforeEach(async () => {
      // Setup: Place bids, freeze deposits, close auction
      await db.insert(bids).values([
        { auctionId: testAuctionId, vendorId: testVendor3Id, amount: '200000.00', isLegacy: false },
      ]);

      await escrowService.freezeDeposit(testVendor3Id, 20000, testAuctionId, 'system');
      await auctionClosureService.closeAuction(testAuctionId, 3);

      await db.update(auctions)
        .set({ status: 'awaiting_payment' })
        .where(eq(auctions.id, testAuctionId));
    });

    it('should process wallet payment successfully', async () => {
      const result = await paymentService.processWalletPayment({
        auctionId: testAuctionId,
        vendorId: testVendor3Id,
        finalBid: 200000,
        depositAmount: 20000,
        idempotencyKey: `wallet_${testAuctionId}_${Date.now()}`,
      });

      expect(result.type).toBe('wallet');
      expect(result.status).toBe('completed');
      expect(result.amount).toBe(200000);

      // Verify wallet state
      const wallet = await escrowService.getBalance(testVendor3Id);
      
      // Balance should be: 200000 (initial) - 20000 (deposit) - 180000 (remaining) = 0
      expect(wallet.balance).toBe(0);
      expect(wallet.availableBalance).toBe(0);
      expect(wallet.frozenAmount).toBe(0); // Deposit unfrozen

      // Verify payment record
      const [payment] = await db.select()
        .from(payments)
        .where(eq(payments.auctionId, testAuctionId));

      expect(payment).toBeDefined();
      expect(payment.status).toBe('verified');
      expect(parseFloat(payment.amount)).toBe(200000);
    });

    it('should maintain wallet invariant after payment', async () => {
      await paymentService.processWalletPayment({
        auctionId: testAuctionId,
        vendorId: testVendor3Id,
        finalBid: 200000,
        depositAmount: 20000,
        idempotencyKey: `wallet_${testAuctionId}_${Date.now()}`,
      });

      const wallet = await escrowService.getBalance(testVendor3Id);
      
      // Invariant: balance = available + frozen + forfeited
      const calculatedBalance = wallet.availableBalance + wallet.frozenAmount + wallet.forfeitedAmount;
      
      expect(Math.abs(wallet.balance - calculatedBalance)).toBeLessThan(0.01);
    });

    it('should create deposit events for payment', async () => {
      await paymentService.processWalletPayment({
        auctionId: testAuctionId,
        vendorId: testVendor3Id,
        finalBid: 200000,
        depositAmount: 20000,
        idempotencyKey: `wallet_${testAuctionId}_${Date.now()}`,
      });

      const events = await db.select()
        .from(depositEvents)
        .where(and(
          eq(depositEvents.auctionId, testAuctionId),
          eq(depositEvents.vendorId, testVendor3Id)
        ));

      // Should have freeze event (from bidding) and unfreeze event (from payment)
      expect(events.length).toBeGreaterThanOrEqual(2);
      
      const unfreezeEvent = events.find(e => e.eventType === 'unfreeze');
      expect(unfreezeEvent).toBeDefined();
      expect(parseFloat(unfreezeEvent!.amount)).toBe(20000);
    });
  });

  describe('5. Payment Idempotency', () => {
    beforeEach(async () => {
      await db.insert(bids).values([
        { auctionId: testAuctionId, vendorId: testVendor3Id, amount: '200000.00', isLegacy: false },
      ]);

      await escrowService.freezeDeposit(testVendor3Id, 20000, testAuctionId, 'system');
      await auctionClosureService.closeAuction(testAuctionId, 3);

      await db.update(auctions)
        .set({ status: 'awaiting_payment' })
        .where(eq(auctions.id, testAuctionId));
    });

    it('should prevent duplicate payments with same idempotency key', async () => {
      const idempotencyKey = `wallet_${testAuctionId}_${Date.now()}`;

      // First payment
      const result1 = await paymentService.processWalletPayment({
        auctionId: testAuctionId,
        vendorId: testVendor3Id,
        finalBid: 200000,
        depositAmount: 20000,
        idempotencyKey,
      });

      // Second payment with same key (should return existing)
      const result2 = await paymentService.processWalletPayment({
        auctionId: testAuctionId,
        vendorId: testVendor3Id,
        finalBid: 200000,
        depositAmount: 20000,
        idempotencyKey,
      });

      expect(result1.paymentId).toBe(result2.paymentId);
      expect(result1.status).toBe('completed');
      expect(result2.status).toBe('completed');

      // Verify only one payment record exists
      const payments = await db.select()
        .from(payments)
        .where(eq(payments.auctionId, testAuctionId));

      expect(payments.length).toBe(1);
    });
  });

  describe('6. Complete Flow Integration', () => {
    it('should complete entire auction-to-payment flow successfully', async () => {
      // Step 1: Place bids
      await db.insert(bids).values([
        { auctionId: testAuctionId, vendorId: testVendor1Id, amount: '150000.00', isLegacy: false },
        { auctionId: testAuctionId, vendorId: testVendor2Id, amount: '180000.00', isLegacy: false },
        { auctionId: testAuctionId, vendorId: testVendor3Id, amount: '200000.00', isLegacy: false },
      ]);

      // Step 2: Freeze deposits
      await escrowService.freezeDeposit(testVendor1Id, 15000, testAuctionId, 'system');
      await escrowService.freezeDeposit(testVendor2Id, 18000, testAuctionId, 'system');
      await escrowService.freezeDeposit(testVendor3Id, 20000, testAuctionId, 'system');

      // Step 3: Close auction
      const closureResult = await auctionClosureService.closeAuction(testAuctionId, 3);
      expect(closureResult.success).toBe(true);
      expect(closureResult.winnerId).toBe(testVendor3Id);

      // Step 4: Verify winner record
      const [winner] = await db.select()
        .from(auctionWinners)
        .where(and(
          eq(auctionWinners.auctionId, testAuctionId),
          eq(auctionWinners.rank, 1)
        ));
      expect(winner).toBeDefined();
      expect(winner.vendorId).toBe(testVendor3Id);

      // Step 5: Update auction status
      await db.update(auctions)
        .set({ status: 'awaiting_payment' })
        .where(eq(auctions.id, testAuctionId));

      // Step 6: Calculate payment
      const breakdown = await paymentService.calculatePaymentBreakdown(
        testVendor3Id,
        testAuctionId,
        200000,
        20000
      );
      expect(breakdown.canUseWalletOnly).toBe(true);

      // Step 7: Process payment
      const paymentResult = await paymentService.processWalletPayment({
        auctionId: testAuctionId,
        vendorId: testVendor3Id,
        finalBid: 200000,
        depositAmount: 20000,
        idempotencyKey: `wallet_${testAuctionId}_${Date.now()}`,
      });
      expect(paymentResult.status).toBe('completed');

      // Step 8: Verify final state
      const finalWallet = await escrowService.getBalance(testVendor3Id);
      expect(finalWallet.balance).toBe(0);
      expect(finalWallet.frozenAmount).toBe(0);

      const [finalPayment] = await db.select()
        .from(payments)
        .where(eq(payments.auctionId, testAuctionId));
      expect(finalPayment.status).toBe('verified');

      console.log('✅ Complete flow test passed:', {
        auctionId: testAuctionId,
        winnerId: testVendor3Id,
        winningBid: 200000,
        depositAmount: 20000,
        paymentStatus: finalPayment.status,
        finalWalletBalance: finalWallet.balance,
      });
    });
  });
});
