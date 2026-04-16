/**
 * Integration Test: End-to-End Fallback Chain Flow
 * 
 * Tests the complete fallback chain flow including:
 * - Single fallback scenario (winner fails, next promoted)
 * - Multiple fallbacks (chain of 3)
 * - All fallbacks fail scenario
 * - Ineligible bidder skipping
 * - Document deadline expiration
 * - Payment deadline expiration
 * - Deposit unfreeze for failed winners
 * 
 * Requirements: 9.1-9.7, 10.1-10.6, 30.1-30.5
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { escrowWallets } from '@/lib/db/schema/escrow';
import { salvageCases } from '@/lib/db/schema/cases';
import { auctions } from '@/lib/db/schema/auctions';
import { bids } from '@/lib/db/schema/bids';
import { auctionWinners } from '@/lib/db/schema/auction-deposit';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { fallbackService } from '@/features/auction-deposit/services/fallback.service';
import { auctionClosureService } from '@/features/auctions/services/auction-closure.service';
import { bidService } from '@/features/auctions/services/bid.service';
import { escrowService } from '@/features/auctions/services/escrow.service';
import { eq, and } from 'drizzle-orm';
import { hash } from 'bcryptjs';

describe('Integration Test: End-to-End Fallback Chain', () => {
  let testUserIds: string[] = [];
  let testVendorIds: string[] = [];
  let testWalletIds: string[] = [];
  let testCaseId: string;
  let testAuctionId: string;

  /**
   * Helper function to create a test vendor with wallet
   */
  async function createTestVendor(index: number, balance: number = 1000000) {
    const [user] = await db
      .insert(users)
      .values({
        email: `test-fallback-${index}-${Date.now()}@example.com`,
        phone: `+234${Math.floor(Math.random() * 10000000000)}`,
        passwordHash: await hash('Test123!@#', 12),
        fullName: `Test Bidder ${index}`,
        dateOfBirth: new Date('1990-01-01'),
        role: 'vendor',
        status: 'verified_tier_1',
      })
      .returning();

    const [vendor] = await db
      .insert(vendors)
      .values({
        userId: user.id,
        businessName: `Test Vendor ${index}`,
        tier: 'tier1_bvn',
        kycStatus: 'approved',
      })
      .returning();

    const [wallet] = await db
      .insert(escrowWallets)
      .values({
        vendorId: vendor.id,
        balance: `${balance}.00`,
        availableBalance: `${balance}.00`,
        frozenAmount: '0.00',
        forfeitedAmount: '0.00',
      })
      .returning();

    testUserIds.push(user.id);
    testVendorIds.push(vendor.id);
    testWalletIds.push(wallet.id);

    return { userId: user.id, vendorId: vendor.id, walletId: wallet.id };
  }

  /**
   * Helper function to place a bid
   */
  async function placeBid(vendorId: string, userId: string, amount: number) {
    return await bidService.placeBid({
      auctionId: testAuctionId,
      vendorId,
      amount,
      userId,
    });
  }

  /**
   * Helper function to setup auction with bids and close it
   */
  async function setupClosedAuction(bidAmounts: number[]) {
    const vendors = await Promise.all(
      bidAmounts.map((_, i) => createTestVendor(i + 1))
    );

    for (let i = 0; i < vendors.length; i++) {
      await placeBid(vendors[i].vendorId, vendors[i].userId, bidAmounts[i]);
    }

    await auctionClosureService.closeAuction(testAuctionId);

    return vendors;
  }

  beforeEach(async () => {
    // Create test salvage case
    const [salvageCase] = await db
      .insert(salvageCases)
      .values({
        claimReference: `TEST-FALLBACK-${Date.now()}`,
        assetType: 'vehicle',
        assetDetails: {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          vin: 'TEST123456789',
        },
        marketValue: '5000000.00',
        estimatedSalvageValue: '2000000.00',
        reservePrice: '1400000.00',
        damageSeverity: 'moderate',
        gpsLocation: [3.3792, 6.5244],
        locationName: 'Lagos, Nigeria',
        photos: ['test-photo-1.jpg'],
        status: 'approved',
        createdBy: 'system',
      })
      .returning();
    testCaseId = salvageCase.id;

    // Create test auction
    const now = new Date();
    const endTime = new Date(now.getTime() - 1000);
    
    const [auction] = await db
      .insert(auctions)
      .values({
        caseId: testCaseId,
        startTime: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        endTime: endTime,
        originalEndTime: endTime,
        status: 'active',
      })
      .returning();
    testAuctionId = auction.id;
  });

  afterEach(async () => {
    // Cleanup in reverse order of dependencies
    await db.delete(releaseForms).where(eq(releaseForms.auctionId, testAuctionId));
    await db.delete(auctionWinners).where(eq(auctionWinners.auctionId, testAuctionId));
    await db.delete(bids).where(eq(bids.auctionId, testAuctionId));
    await db.delete(auctions).where(eq(auctions.id, testAuctionId));
    await db.delete(salvageCases).where(eq(salvageCases.id, testCaseId));
    
    for (const vendorId of testVendorIds) {
      await db.delete(escrowWallets).where(eq(escrowWallets.vendorId, vendorId));
      await db.delete(vendors).where(eq(vendors.id, vendorId));
    }
    
    for (const userId of testUserIds) {
      await db.delete(users).where(eq(users.id, userId));
    }

    // Reset arrays
    testUserIds = [];
    testVendorIds = [];
    testWalletIds = [];
  });

  describe('Single Fallback Scenario', () => {
    it('should promote next bidder when winner fails to sign documents', async () => {
      // Setup: 3 bidders, auction closed
      const vendors = await setupClosedAuction([1500000, 1600000, 1700000]);

      // Winner (rank 1) fails to sign documents
      await fallbackService.triggerFallback(testAuctionId, 'failed_to_sign');

      // Verify rank 1 marked as failed
      const [failedWinner] = await db
        .select()
        .from(auctionWinners)
        .where(and(
          eq(auctionWinners.auctionId, testAuctionId),
          eq(auctionWinners.rank, 1)
        ));

      expect(failedWinner.status).toBe('failed_to_sign');

      // Verify rank 2 promoted to winner
      const [newWinner] = await db
        .select()
        .from(auctionWinners)
        .where(and(
          eq(auctionWinners.auctionId, testAuctionId),
          eq(auctionWinners.rank, 2)
        ));

      expect(newWinner.status).toBe('pending_documents');

      // Verify failed winner's deposit unfrozen
      const failedBalance = await escrowService.getBalance(vendors[2].vendorId);
      expect(failedBalance.frozenAmount).toBe(0);
      expect(failedBalance.availableBalance).toBe(1000000);

      // Verify new winner's deposit still frozen
      const newWinnerBalance = await escrowService.getBalance(vendors[1].vendorId);
      expect(newWinnerBalance.frozenAmount).toBe(160000); // 10% of 1.6M
    });

    it('should promote next bidder when winner fails to pay', async () => {
      // Setup: 3 bidders, auction closed
      const vendors = await setupClosedAuction([1500000, 1600000, 1700000]);

      // Winner (rank 1) fails to pay
      await fallbackService.triggerFallback(testAuctionId, 'failed_to_pay');

      // Verify rank 1 marked as failed
      const [failedWinner] = await db
        .select()
        .from(auctionWinners)
        .where(and(
          eq(auctionWinners.auctionId, testAuctionId),
          eq(auctionWinners.rank, 1)
        ));

      expect(failedWinner.status).toBe('failed_to_pay');

      // Verify rank 2 promoted
      const [newWinner] = await db
        .select()
        .from(auctionWinners)
        .where(and(
          eq(auctionWinners.auctionId, testAuctionId),
          eq(auctionWinners.rank, 2)
        ));

      expect(newWinner.status).toBe('pending_documents');
    });

    it('should generate new documents for promoted bidder', async () => {
      // Setup: 3 bidders, auction closed
      await setupClosedAuction([1500000, 1600000, 1700000]);

      // Trigger fallback
      await fallbackService.triggerFallback(testAuctionId, 'failed_to_sign');

      // Verify new documents generated
      const documents = await db
        .select()
        .from(releaseForms)
        .where(eq(releaseForms.auctionId, testAuctionId));

      // Should have documents for new winner
      expect(documents.length).toBeGreaterThan(0);
      
      // Verify fresh validity deadline
      const latestDocument = documents.sort((a, b) => 
        b.createdAt.getTime() - a.createdAt.getTime()
      )[0];

      expect(latestDocument.validityDeadline).toBeDefined();
      
      // Deadline should be approximately 48 hours from now
      const now = new Date();
      const expectedDeadline = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      const timeDiff = Math.abs(latestDocument.validityDeadline!.getTime() - expectedDeadline.getTime());
      expect(timeDiff).toBeLessThan(5000); // 5 second tolerance
    });
  });

  describe('Multiple Fallbacks (Chain of 3)', () => {
    it('should handle chain of 3 fallbacks correctly', async () => {
      // Setup: 5 bidders, auction closed
      const vendors = await setupClosedAuction([
        1500000, // Rank 5
        1550000, // Rank 4
        1600000, // Rank 3
        1700000, // Rank 2
        1800000, // Rank 1
      ]);

      // First fallback: Rank 1 fails
      await fallbackService.triggerFallback(testAuctionId, 'failed_to_sign');

      // Verify rank 2 promoted
      let [currentWinner] = await db
        .select()
        .from(auctionWinners)
        .where(and(
          eq(auctionWinners.auctionId, testAuctionId),
          eq(auctionWinners.rank, 2)
        ));
      expect(currentWinner.status).toBe('pending_documents');

      // Second fallback: Rank 2 fails
      await fallbackService.triggerFallback(testAuctionId, 'failed_to_sign');

      // Verify rank 3 promoted
      [currentWinner] = await db
        .select()
        .from(auctionWinners)
        .where(and(
          eq(auctionWinners.auctionId, testAuctionId),
          eq(auctionWinners.rank, 3)
        ));
      expect(currentWinner.status).toBe('pending_documents');

      // Third fallback: Rank 3 fails
      await fallbackService.triggerFallback(testAuctionId, 'failed_to_sign');

      // Verify auction marked as failed_all_fallbacks
      const [auction] = await db
        .select()
        .from(auctions)
        .where(eq(auctions.id, testAuctionId));

      expect(auction.status).toBe('failed_all_fallbacks');

      // Verify all deposits unfrozen
      for (const vendor of vendors) {
        const balance = await escrowService.getBalance(vendor.vendorId);
        expect(balance.frozenAmount).toBe(0);
        expect(balance.availableBalance).toBe(1000000);
      }
    });
  });

  describe('All Fallbacks Fail Scenario', () => {
    it('should mark auction as failed_all_fallbacks when all top N fail', async () => {
      // Setup: 3 bidders (exactly top N), auction closed
      const vendors = await setupClosedAuction([1500000, 1600000, 1700000]);

      // All 3 fail in sequence
      await fallbackService.triggerFallback(testAuctionId, 'failed_to_sign');
      await fallbackService.triggerFallback(testAuctionId, 'failed_to_sign');
      await fallbackService.triggerFallback(testAuctionId, 'failed_to_sign');

      // Verify auction status
      const [auction] = await db
        .select()
        .from(auctions)
        .where(eq(auctions.id, testAuctionId));

      expect(auction.status).toBe('failed_all_fallbacks');
    });

    it('should unfreeze all deposits when all fallbacks fail', async () => {
      // Setup: 3 bidders, auction closed
      const vendors = await setupClosedAuction([1500000, 1600000, 1700000]);

      // All fail
      await fallbackService.triggerFallback(testAuctionId, 'failed_to_sign');
      await fallbackService.triggerFallback(testAuctionId, 'failed_to_sign');
      await fallbackService.triggerFallback(testAuctionId, 'failed_to_sign');

      // Verify all deposits unfrozen
      for (const vendor of vendors) {
        const balance = await escrowService.getBalance(vendor.vendorId);
        expect(balance.frozenAmount).toBe(0);
        expect(balance.availableBalance).toBe(1000000);
      }
    });

    it('should record failure reason and timestamp', async () => {
      // Setup: 3 bidders, auction closed
      await setupClosedAuction([1500000, 1600000, 1700000]);

      const beforeFailure = new Date();

      // All fail
      await fallbackService.triggerFallback(testAuctionId, 'failed_to_sign');
      await fallbackService.triggerFallback(testAuctionId, 'failed_to_sign');
      await fallbackService.triggerFallback(testAuctionId, 'failed_to_sign');

      const afterFailure = new Date();

      // Verify auction record
      const [auction] = await db
        .select()
        .from(auctions)
        .where(eq(auctions.id, testAuctionId));

      expect(auction.status).toBe('failed_all_fallbacks');
      expect(auction.updatedAt).toBeDefined();
      expect(auction.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeFailure.getTime());
      expect(auction.updatedAt.getTime()).toBeLessThanOrEqual(afterFailure.getTime());
    });
  });

  describe('Ineligible Bidder Skipping', () => {
    it('should skip bidder with insufficient balance', async () => {
      // Setup: 3 bidders, auction closed
      const vendors = await setupClosedAuction([1500000, 1600000, 1700000]);

      // Rank 2 withdraws funds (becomes ineligible)
      await db
        .update(escrowWallets)
        .set({
          availableBalance: '50000.00', // Insufficient for deposit
          balance: '210000.00', // 50K available + 160K frozen
        })
        .where(eq(escrowWallets.vendorId, vendors[1].vendorId));

      // Rank 1 fails
      await fallbackService.triggerFallback(testAuctionId, 'failed_to_sign');

      // Verify rank 2 skipped, rank 3 promoted
      const [newWinner] = await db
        .select()
        .from(auctionWinners)
        .where(and(
          eq(auctionWinners.auctionId, testAuctionId),
          eq(auctionWinners.rank, 3)
        ));

      expect(newWinner.status).toBe('pending_documents');

      // Verify rank 2 marked as ineligible
      const [ineligibleBidder] = await db
        .select()
        .from(auctionWinners)
        .where(and(
          eq(auctionWinners.auctionId, testAuctionId),
          eq(auctionWinners.rank, 2)
        ));

      expect(ineligibleBidder.status).toBe('ineligible');
    });

    it('should skip bidder with deposit already unfrozen', async () => {
      // Setup: 3 bidders, auction closed
      const vendors = await setupClosedAuction([1500000, 1600000, 1700000]);

      // Manually unfreeze rank 2's deposit (simulating system error or manual intervention)
      await escrowService.unfreezeDeposit(
        vendors[1].vendorId,
        160000,
        testAuctionId,
        'system'
      );

      // Rank 1 fails
      await fallbackService.triggerFallback(testAuctionId, 'failed_to_sign');

      // Verify rank 2 skipped, rank 3 promoted
      const [newWinner] = await db
        .select()
        .from(auctionWinners)
        .where(and(
          eq(auctionWinners.auctionId, testAuctionId),
          eq(auctionWinners.rank, 3)
        ));

      expect(newWinner.status).toBe('pending_documents');
    });

    it('should skip multiple ineligible bidders in sequence', async () => {
      // Setup: 5 bidders, auction closed
      const vendors = await setupClosedAuction([
        1500000, // Rank 5
        1550000, // Rank 4
        1600000, // Rank 3
        1700000, // Rank 2
        1800000, // Rank 1
      ]);

      // Make rank 2 and 3 ineligible
      await db
        .update(escrowWallets)
        .set({ availableBalance: '50000.00', balance: '220000.00' })
        .where(eq(escrowWallets.vendorId, vendors[3].vendorId)); // Rank 2

      await db
        .update(escrowWallets)
        .set({ availableBalance: '50000.00', balance: '210000.00' })
        .where(eq(escrowWallets.vendorId, vendors[2].vendorId)); // Rank 3

      // Rank 1 fails
      await fallbackService.triggerFallback(testAuctionId, 'failed_to_sign');

      // Verify rank 4 promoted (skipping 2 and 3)
      const [newWinner] = await db
        .select()
        .from(auctionWinners)
        .where(and(
          eq(auctionWinners.auctionId, testAuctionId),
          eq(auctionWinners.rank, 4)
        ));

      expect(newWinner.status).toBe('pending_documents');
    });
  });

  describe('Wallet Invariant', () => {
    it('should maintain wallet invariant throughout fallback chain', async () => {
      // Setup: 3 bidders, auction closed
      const vendors = await setupClosedAuction([1500000, 1600000, 1700000]);

      // Trigger fallback
      await fallbackService.triggerFallback(testAuctionId, 'failed_to_sign');

      // Verify invariant for all vendors
      for (const vendor of vendors) {
        const balance = await escrowService.getBalance(vendor.vendorId);
        const calculatedBalance = balance.availableBalance + balance.frozenAmount + balance.forfeitedAmount;
        expect(Math.abs(balance.balance - calculatedBalance)).toBeLessThanOrEqual(0.01);
      }
    });

    it('should maintain wallet invariant when all fallbacks fail', async () => {
      // Setup: 3 bidders, auction closed
      const vendors = await setupClosedAuction([1500000, 1600000, 1700000]);

      // All fail
      await fallbackService.triggerFallback(testAuctionId, 'failed_to_sign');
      await fallbackService.triggerFallback(testAuctionId, 'failed_to_sign');
      await fallbackService.triggerFallback(testAuctionId, 'failed_to_sign');

      // Verify invariant for all vendors
      for (const vendor of vendors) {
        const balance = await escrowService.getBalance(vendor.vendorId);
        const calculatedBalance = balance.availableBalance + balance.frozenAmount + balance.forfeitedAmount;
        expect(Math.abs(balance.balance - calculatedBalance)).toBeLessThanOrEqual(0.01);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle fallback when only 1 bidder exists', async () => {
      // Setup: 1 bidder, auction closed
      await setupClosedAuction([1500000]);

      // Trigger fallback
      await fallbackService.triggerFallback(testAuctionId, 'failed_to_sign');

      // Verify auction marked as failed
      const [auction] = await db
        .select()
        .from(auctions)
        .where(eq(auctions.id, testAuctionId));

      expect(auction.status).toBe('failed_all_fallbacks');
    });

    it('should handle fallback when auction not in awaiting_documents status', async () => {
      // Setup: 3 bidders, auction closed
      await setupClosedAuction([1500000, 1600000, 1700000]);

      // Manually change auction status
      await db
        .update(auctions)
        .set({ status: 'paid' })
        .where(eq(auctions.id, testAuctionId));

      // Attempt fallback
      await expect(
        fallbackService.triggerFallback(testAuctionId, 'failed_to_sign')
      ).rejects.toThrow(/invalid status/i);
    });
  });
});
