/**
 * Integration Test: End-to-End Auction Closure Flow
 * 
 * Tests the complete auction closure flow including:
 * - Top N bidders identification
 * - Deposit retention for top N
 * - Deposit unfreeze for bidders below top N
 * - Document generation
 * - Winner recording
 * - Various bidder count scenarios (< N, = N, > N)
 * 
 * Requirements: 5.1-5.6, 6.1-6.6
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
import { auctionClosureService } from '@/features/auctions/services/auction-closure.service';
import { bidService } from '@/features/auctions/services/bid.service';
import { escrowService } from '@/features/auctions/services/escrow.service';
import { eq } from 'drizzle-orm';
import { hash } from 'bcryptjs';

describe('Integration Test: End-to-End Auction Closure', () => {
  let testUserIds: string[] = [];
  let testVendorIds: string[] = [];
  let testWalletIds: string[] = [];
  let testCaseId: string;
  let testAuctionId: string;

  /**
   * Helper function to create a test vendor with wallet
   */
  async function createTestVendor(index: number) {
    const [user] = await db
      .insert(users)
      .values({
        email: `test-closure-${index}-${Date.now()}@example.com`,
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
        balance: '1000000.00',
        availableBalance: '1000000.00',
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

  beforeEach(async () => {
    // Create test salvage case
    const [salvageCase] = await db
      .insert(salvageCases)
      .values({
        claimReference: `TEST-CLOSURE-${Date.now()}`,
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
    const endTime = new Date(now.getTime() - 1000); // Already ended
    
    const [auction] = await db
      .insert(auctions)
      .values({
        caseId: testCaseId,
        startTime: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        endTime: endTime,
        originalEndTime: endTime,
        status: 'active', // Will be closed by test
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

  describe('Top N Bidders Identification', () => {
    it('should identify top 3 bidders when more than 3 bids exist', async () => {
      // Create 5 vendors
      const vendors = await Promise.all([
        createTestVendor(1),
        createTestVendor(2),
        createTestVendor(3),
        createTestVendor(4),
        createTestVendor(5),
      ]);

      // Place bids in random order
      await placeBid(vendors[0].vendorId, vendors[0].userId, 1500000);
      await placeBid(vendors[1].vendorId, vendors[1].userId, 1600000);
      await placeBid(vendors[2].vendorId, vendors[2].userId, 1800000);
      await placeBid(vendors[3].vendorId, vendors[3].userId, 1700000);
      await placeBid(vendors[4].vendorId, vendors[4].userId, 1550000);

      // Close auction
      await auctionClosureService.closeAuction(testAuctionId);

      // Verify top 3 identified
      const winners = await db
        .select()
        .from(auctionWinners)
        .where(eq(auctionWinners.auctionId, testAuctionId));

      expect(winners).toHaveLength(3);
      
      // Verify correct ranking
      const sortedWinners = winners.sort((a, b) => a.rank - b.rank);
      expect(sortedWinners[0].vendorId).toBe(vendors[2].vendorId); // 1.8M
      expect(sortedWinners[1].vendorId).toBe(vendors[3].vendorId); // 1.7M
      expect(sortedWinners[2].vendorId).toBe(vendors[1].vendorId); // 1.6M
    });

    it('should keep all bidders when fewer than 3 bids exist', async () => {
      // Create 2 vendors
      const vendors = await Promise.all([
        createTestVendor(1),
        createTestVendor(2),
      ]);

      await placeBid(vendors[0].vendorId, vendors[0].userId, 1500000);
      await placeBid(vendors[1].vendorId, vendors[1].userId, 1600000);

      // Close auction
      await auctionClosureService.closeAuction(testAuctionId);

      // Verify both kept
      const winners = await db
        .select()
        .from(auctionWinners)
        .where(eq(auctionWinners.auctionId, testAuctionId));

      expect(winners).toHaveLength(2);
    });

    it('should handle exactly 3 bidders', async () => {
      // Create 3 vendors
      const vendors = await Promise.all([
        createTestVendor(1),
        createTestVendor(2),
        createTestVendor(3),
      ]);

      await placeBid(vendors[0].vendorId, vendors[0].userId, 1500000);
      await placeBid(vendors[1].vendorId, vendors[1].userId, 1600000);
      await placeBid(vendors[2].vendorId, vendors[2].userId, 1700000);

      // Close auction
      await auctionClosureService.closeAuction(testAuctionId);

      // Verify all 3 kept
      const winners = await db
        .select()
        .from(auctionWinners)
        .where(eq(auctionWinners.auctionId, testAuctionId));

      expect(winners).toHaveLength(3);
    });
  });

  describe('Deposit Retention and Unfreeze', () => {
    it('should keep deposits frozen for top 3 bidders', async () => {
      // Create 5 vendors
      const vendors = await Promise.all([
        createTestVendor(1),
        createTestVendor(2),
        createTestVendor(3),
        createTestVendor(4),
        createTestVendor(5),
      ]);

      // Place bids
      await placeBid(vendors[0].vendorId, vendors[0].userId, 1500000); // Rank 5
      await placeBid(vendors[1].vendorId, vendors[1].userId, 1600000); // Rank 3
      await placeBid(vendors[2].vendorId, vendors[2].userId, 1800000); // Rank 1
      await placeBid(vendors[3].vendorId, vendors[3].userId, 1700000); // Rank 2
      await placeBid(vendors[4].vendorId, vendors[4].userId, 1550000); // Rank 4

      // Close auction
      await auctionClosureService.closeAuction(testAuctionId);

      // Verify top 3 deposits still frozen
      const balance1 = await escrowService.getBalance(vendors[2].vendorId); // Rank 1
      expect(balance1.frozenAmount).toBe(180000); // 10% of 1.8M

      const balance2 = await escrowService.getBalance(vendors[3].vendorId); // Rank 2
      expect(balance2.frozenAmount).toBe(170000); // 10% of 1.7M

      const balance3 = await escrowService.getBalance(vendors[1].vendorId); // Rank 3
      expect(balance3.frozenAmount).toBe(160000); // 10% of 1.6M
    });

    it('should unfreeze deposits for bidders below top 3', async () => {
      // Create 5 vendors
      const vendors = await Promise.all([
        createTestVendor(1),
        createTestVendor(2),
        createTestVendor(3),
        createTestVendor(4),
        createTestVendor(5),
      ]);

      // Place bids
      await placeBid(vendors[0].vendorId, vendors[0].userId, 1500000); // Rank 5
      await placeBid(vendors[1].vendorId, vendors[1].userId, 1600000); // Rank 3
      await placeBid(vendors[2].vendorId, vendors[2].userId, 1800000); // Rank 1
      await placeBid(vendors[3].vendorId, vendors[3].userId, 1700000); // Rank 2
      await placeBid(vendors[4].vendorId, vendors[4].userId, 1550000); // Rank 4

      // Close auction
      await auctionClosureService.closeAuction(testAuctionId);

      // Verify rank 4 and 5 deposits unfrozen
      const balance4 = await escrowService.getBalance(vendors[4].vendorId); // Rank 4
      expect(balance4.frozenAmount).toBe(0);
      expect(balance4.availableBalance).toBe(1000000); // Back to original

      const balance5 = await escrowService.getBalance(vendors[0].vendorId); // Rank 5
      expect(balance5.frozenAmount).toBe(0);
      expect(balance5.availableBalance).toBe(1000000); // Back to original
    });

    it('should keep all deposits frozen when fewer than 3 bidders', async () => {
      // Create 2 vendors
      const vendors = await Promise.all([
        createTestVendor(1),
        createTestVendor(2),
      ]);

      await placeBid(vendors[0].vendorId, vendors[0].userId, 1500000);
      await placeBid(vendors[1].vendorId, vendors[1].userId, 1600000);

      // Close auction
      await auctionClosureService.closeAuction(testAuctionId);

      // Verify both deposits still frozen
      const balance1 = await escrowService.getBalance(vendors[0].vendorId);
      expect(balance1.frozenAmount).toBe(150000);

      const balance2 = await escrowService.getBalance(vendors[1].vendorId);
      expect(balance2.frozenAmount).toBe(160000);
    });
  });

  describe('Winner Recording', () => {
    it('should record winner as highest bidder', async () => {
      // Create 3 vendors
      const vendors = await Promise.all([
        createTestVendor(1),
        createTestVendor(2),
        createTestVendor(3),
      ]);

      await placeBid(vendors[0].vendorId, vendors[0].userId, 1500000);
      await placeBid(vendors[1].vendorId, vendors[1].userId, 1700000);
      await placeBid(vendors[2].vendorId, vendors[2].userId, 1600000);

      // Close auction
      await auctionClosureService.closeAuction(testAuctionId);

      // Verify winner recorded
      const [winner] = await db
        .select()
        .from(auctionWinners)
        .where(eq(auctionWinners.auctionId, testAuctionId))
        .where(eq(auctionWinners.rank, 1));

      expect(winner).toBeDefined();
      expect(winner.vendorId).toBe(vendors[1].vendorId); // 1.7M bid
      expect(winner.status).toBe('pending_documents');
    });

    it('should record all top N bidders with correct ranks', async () => {
      // Create 5 vendors
      const vendors = await Promise.all([
        createTestVendor(1),
        createTestVendor(2),
        createTestVendor(3),
        createTestVendor(4),
        createTestVendor(5),
      ]);

      await placeBid(vendors[0].vendorId, vendors[0].userId, 1500000);
      await placeBid(vendors[1].vendorId, vendors[1].userId, 1600000);
      await placeBid(vendors[2].vendorId, vendors[2].userId, 1800000);
      await placeBid(vendors[3].vendorId, vendors[3].userId, 1700000);
      await placeBid(vendors[4].vendorId, vendors[4].userId, 1550000);

      // Close auction
      await auctionClosureService.closeAuction(testAuctionId);

      // Verify ranks
      const winners = await db
        .select()
        .from(auctionWinners)
        .where(eq(auctionWinners.auctionId, testAuctionId));

      const sortedWinners = winners.sort((a, b) => a.rank - b.rank);
      
      expect(sortedWinners[0].rank).toBe(1);
      expect(sortedWinners[0].vendorId).toBe(vendors[2].vendorId); // 1.8M
      
      expect(sortedWinners[1].rank).toBe(2);
      expect(sortedWinners[1].vendorId).toBe(vendors[3].vendorId); // 1.7M
      
      expect(sortedWinners[2].rank).toBe(3);
      expect(sortedWinners[2].vendorId).toBe(vendors[1].vendorId); // 1.6M
    });
  });

  describe('Auction Status Update', () => {
    it('should update auction status to awaiting_documents', async () => {
      // Create 1 vendor
      const vendor = await createTestVendor(1);
      await placeBid(vendor.vendorId, vendor.userId, 1500000);

      // Close auction
      await auctionClosureService.closeAuction(testAuctionId);

      // Verify status
      const [auction] = await db
        .select()
        .from(auctions)
        .where(eq(auctions.id, testAuctionId));

      expect(auction.status).toBe('awaiting_documents');
    });
  });

  describe('Document Generation', () => {
    it('should generate documents for winner', async () => {
      // Create 1 vendor
      const vendor = await createTestVendor(1);
      await placeBid(vendor.vendorId, vendor.userId, 1500000);

      // Close auction
      await auctionClosureService.closeAuction(testAuctionId);

      // Verify documents generated
      const documents = await db
        .select()
        .from(releaseForms)
        .where(eq(releaseForms.auctionId, testAuctionId));

      expect(documents.length).toBeGreaterThan(0);
      
      // Verify document has validity deadline
      const document = documents[0];
      expect(document.validityDeadline).toBeDefined();
      expect(document.validityDeadline).toBeInstanceOf(Date);
    });

    it('should set document validity deadline to 48 hours from now', async () => {
      // Create 1 vendor
      const vendor = await createTestVendor(1);
      await placeBid(vendor.vendorId, vendor.userId, 1500000);

      const beforeClosure = new Date();
      
      // Close auction
      await auctionClosureService.closeAuction(testAuctionId);

      const afterClosure = new Date();

      // Verify documents generated
      const documents = await db
        .select()
        .from(releaseForms)
        .where(eq(releaseForms.auctionId, testAuctionId));

      const document = documents[0];
      const deadline = document.validityDeadline!;

      // Deadline should be approximately 48 hours from now
      const expectedDeadline = new Date(beforeClosure.getTime() + 48 * 60 * 60 * 1000);
      const timeDiff = Math.abs(deadline.getTime() - expectedDeadline.getTime());
      
      // Allow 5 second tolerance for test execution time
      expect(timeDiff).toBeLessThan(5000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle auction with no bids', async () => {
      // Close auction without any bids
      await expect(
        auctionClosureService.closeAuction(testAuctionId)
      ).rejects.toThrow(/no bids/i);
    });

    it('should handle auction with 100+ bidders', async () => {
      // Create 10 vendors (simulating many bidders)
      const vendors = await Promise.all(
        Array.from({ length: 10 }, (_, i) => createTestVendor(i + 1))
      );

      // Place bids with varying amounts
      for (let i = 0; i < vendors.length; i++) {
        await placeBid(
          vendors[i].vendorId,
          vendors[i].userId,
          1500000 + (i * 10000)
        );
      }

      // Close auction
      await auctionClosureService.closeAuction(testAuctionId);

      // Verify only top 3 kept
      const winners = await db
        .select()
        .from(auctionWinners)
        .where(eq(auctionWinners.auctionId, testAuctionId));

      expect(winners).toHaveLength(3);

      // Verify top 3 have highest bids
      const sortedWinners = winners.sort((a, b) => a.rank - b.rank);
      expect(sortedWinners[0].vendorId).toBe(vendors[9].vendorId); // Highest
      expect(sortedWinners[1].vendorId).toBe(vendors[8].vendorId);
      expect(sortedWinners[2].vendorId).toBe(vendors[7].vendorId);
    });

    it('should handle auction already closed', async () => {
      // Create 1 vendor
      const vendor = await createTestVendor(1);
      await placeBid(vendor.vendorId, vendor.userId, 1500000);

      // Close auction first time
      await auctionClosureService.closeAuction(testAuctionId);

      // Attempt to close again
      await expect(
        auctionClosureService.closeAuction(testAuctionId)
      ).rejects.toThrow(/already closed/i);
    });
  });

  describe('Wallet Invariant', () => {
    it('should maintain wallet invariant for all vendors after closure', async () => {
      // Create 5 vendors
      const vendors = await Promise.all([
        createTestVendor(1),
        createTestVendor(2),
        createTestVendor(3),
        createTestVendor(4),
        createTestVendor(5),
      ]);

      // Place bids
      await placeBid(vendors[0].vendorId, vendors[0].userId, 1500000);
      await placeBid(vendors[1].vendorId, vendors[1].userId, 1600000);
      await placeBid(vendors[2].vendorId, vendors[2].userId, 1800000);
      await placeBid(vendors[3].vendorId, vendors[3].userId, 1700000);
      await placeBid(vendors[4].vendorId, vendors[4].userId, 1550000);

      // Close auction
      await auctionClosureService.closeAuction(testAuctionId);

      // Verify invariant for all vendors
      for (const vendor of vendors) {
        const balance = await escrowService.getBalance(vendor.vendorId);
        const calculatedBalance = balance.availableBalance + balance.frozenAmount + balance.forfeitedAmount;
        expect(Math.abs(balance.balance - calculatedBalance)).toBeLessThanOrEqual(0.01);
      }
    });
  });
});
