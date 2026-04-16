/**
 * SIMPLE Integration Test: Bid Placement Database Operations
 * 
 * This test directly tests database operations without going through
 * the full bid service to avoid transaction/lock issues.
 * 
 * Tests:
 * - Creating bids
 * - Freezing deposits
 * - Wallet balance updates
 * - Deposit event logging
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { users, vendors, escrowWallets, salvageCases, auctions, bids, depositEvents } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

describe('Simple Bid Placement Database Operations', () => {
  let testUserId: string;
  let testVendorId: string;
  let testWalletId: string;
  let testCaseId: string;
  let testAuctionId: string;

  beforeAll(async () => {
    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        email: `test-simple-${Date.now()}@example.com`,
        phone: `+234${Math.floor(Math.random() * 10000000000)}`,
        passwordHash: 'test-hash',
        fullName: 'Test User',
        dateOfBirth: new Date('1990-01-01'),
        role: 'vendor',
        status: 'verified_tier_1',
      })
      .returning();
    testUserId = user.id;

    // Create test vendor
    const [vendor] = await db
      .insert(vendors)
      .values({
        userId: testUserId,
        businessName: 'Test Vendor',
        tier: 'tier1_bvn',
        status: 'approved',
      })
      .returning();
    testVendorId = vendor.id;

    // Create test wallet
    const [wallet] = await db
      .insert(escrowWallets)
      .values({
        vendorId: testVendorId,
        balance: '1000000.00',
        availableBalance: '1000000.00',
        frozenAmount: '0.00',
        forfeitedAmount: '0.00',
      })
      .returning();
    testWalletId = wallet.id;

    // Create test salvage case
    const [salvageCase] = await db
      .insert(salvageCases)
      .values({
        claimReference: `TEST-SIMPLE-${Date.now()}`,
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
        marketValue: '1000000.00',
        estimatedSalvageValue: '500000.00',
        reservePrice: '350000.00',
        gpsLocation: sql`POINT(6.5244, 3.3792)`,
        locationName: 'Lagos, Nigeria',
        photos: ['test.jpg'],
        status: 'approved',
        createdBy: testUserId,
      })
      .returning();
    testCaseId = salvageCase.id;

    // Create test auction
    const now = new Date();
    const endTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const [auction] = await db
      .insert(auctions)
      .values({
        caseId: testCaseId,
        startTime: now,
        endTime: endTime,
        originalEndTime: endTime,
        status: 'active',
      })
      .returning();
    testAuctionId = auction.id;
  }, 30000);

  afterAll(async () => {
    // Cleanup in reverse order
    try {
      await db.delete(depositEvents).where(eq(depositEvents.auctionId, testAuctionId));
      await db.delete(bids).where(eq(bids.auctionId, testAuctionId));
      await db.delete(auctions).where(eq(auctions.id, testAuctionId));
      await db.delete(salvageCases).where(eq(salvageCases.id, testCaseId));
      await db.delete(escrowWallets).where(eq(escrowWallets.id, testWalletId));
      await db.delete(vendors).where(eq(vendors.id, testVendorId));
      await db.delete(users).where(eq(users.id, testUserId));
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }, 30000);

  it('should create a bid and freeze deposit', async () => {
    const bidAmount = 450000;
    const depositAmount = 100000;

    // 1. Create bid
    const [bid] = await db
      .insert(bids)
      .values({
        auctionId: testAuctionId,
        vendorId: testVendorId,
        amount: bidAmount.toString(),
        depositAmount: depositAmount.toString(),
        status: 'active',
        ipAddress: '127.0.0.1',
        deviceType: 'desktop',
      })
      .returning();

    expect(bid).toBeDefined();
    expect(bid.amount).toBe('450000.00'); // PostgreSQL numeric returns with decimals

    // 2. Freeze deposit
    await db
      .update(escrowWallets)
      .set({
        availableBalance: sql`available_balance - ${depositAmount}`,
        frozenAmount: sql`frozen_amount + ${depositAmount}`,
      })
      .where(eq(escrowWallets.id, testWalletId));

    // 3. Log deposit event
    await db
      .insert(depositEvents)
      .values({
        auctionId: testAuctionId,
        vendorId: testVendorId,
        eventType: 'freeze',
        amount: depositAmount.toString(),
        balanceAfter: '900000.00',
        frozenAfter: '100000.00',
        description: 'Deposit frozen for bid',
      });

    // 4. Verify wallet state
    const [wallet] = await db
      .select()
      .from(escrowWallets)
      .where(eq(escrowWallets.id, testWalletId));

    expect(wallet.availableBalance).toBe('900000.00');
    expect(wallet.frozenAmount).toBe('100000.00');

    // 5. Verify deposit event
    const events = await db
      .select()
      .from(depositEvents)
      .where(eq(depositEvents.auctionId, testAuctionId));

    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('freeze');
    expect(events[0].amount).toBe('100000.00'); // PostgreSQL numeric format
  }, 10000);

  it('should maintain wallet invariant', async () => {
    const [wallet] = await db
      .select()
      .from(escrowWallets)
      .where(eq(escrowWallets.id, testWalletId));

    const balance = parseFloat(wallet.balance);
    const available = parseFloat(wallet.availableBalance);
    const frozen = parseFloat(wallet.frozenAmount);
    const forfeited = parseFloat(wallet.forfeitedAmount);

    // Invariant: balance = available + frozen + forfeited
    expect(balance).toBe(available + frozen + forfeited);
  }, 5000);
});
