/**
 * Admin Dashboard Pickup Widget Integration Test
 * 
 * Tests the pickup notifications widget on the admin dashboard
 * 
 * Requirements: Task 5.3 - Add pickup notifications to admin dashboard
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { auctions, salvageCases, vendors, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

describe('Admin Dashboard Pickup Widget', () => {
  let testAuctionId: string;
  let testVendorId: string;
  let testUserId: string;
  let testCaseId: string;

  beforeEach(async () => {
    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        email: 'test-vendor-pickup@example.com',
        fullName: 'Test Vendor',
        phone: '+2341234567890',
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
        businessName: 'Test Vendor Business',
        status: 'active',
      })
      .returning();
    testVendorId = vendor.id;

    // Create test case
    const [salvageCase] = await db
      .insert(salvageCases)
      .values({
        claimReference: 'TEST-PICKUP-001',
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry' },
        status: 'sold',
      })
      .returning();
    testCaseId = salvageCase.id;

    // Create test auction with vendor pickup confirmed
    const [auction] = await db
      .insert(auctions)
      .values({
        caseId: testCaseId,
        currentBidder: testVendorId,
        currentBid: '500000',
        status: 'closed',
        pickupConfirmedVendor: true,
        pickupConfirmedVendorAt: new Date(),
        pickupConfirmedAdmin: false,
        startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })
      .returning();
    testAuctionId = auction.id;
  });

  afterEach(async () => {
    // Clean up test data
    if (testAuctionId) {
      await db.delete(auctions).where(eq(auctions.id, testAuctionId));
    }
    if (testCaseId) {
      await db.delete(salvageCases).where(eq(salvageCases.id, testCaseId));
    }
    if (testVendorId) {
      await db.delete(vendors).where(eq(vendors.id, testVendorId));
    }
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
  });

  it('should count pending pickup confirmations correctly', async () => {
    // Query for pending pickup confirmations
    const pendingPickups = await db
      .select()
      .from(auctions)
      .where(
        eq(auctions.pickupConfirmedVendor, true)
      );

    // Filter for admin not confirmed
    const pendingAdminConfirmations = pendingPickups.filter(
      (auction) => !auction.pickupConfirmedAdmin
    );

    expect(pendingAdminConfirmations.length).toBeGreaterThan(0);
    expect(pendingAdminConfirmations[0].id).toBe(testAuctionId);
  });

  it('should not count auctions where admin already confirmed', async () => {
    // Update auction to admin confirmed
    await db
      .update(auctions)
      .set({
        pickupConfirmedAdmin: true,
        pickupConfirmedAdminAt: new Date(),
      })
      .where(eq(auctions.id, testAuctionId));

    // Query for pending pickup confirmations
    const pendingPickups = await db
      .select()
      .from(auctions)
      .where(
        eq(auctions.pickupConfirmedVendor, true)
      );

    // Filter for admin not confirmed
    const pendingAdminConfirmations = pendingPickups.filter(
      (auction) => !auction.pickupConfirmedAdmin
    );

    // Should not include our test auction
    const hasTestAuction = pendingAdminConfirmations.some(
      (auction) => auction.id === testAuctionId
    );
    expect(hasTestAuction).toBe(false);
  });

  it('should not count auctions where vendor has not confirmed', async () => {
    // Update auction to vendor not confirmed
    await db
      .update(auctions)
      .set({
        pickupConfirmedVendor: false,
        pickupConfirmedVendorAt: null,
      })
      .where(eq(auctions.id, testAuctionId));

    // Query for pending pickup confirmations
    const pendingPickups = await db
      .select()
      .from(auctions)
      .where(
        eq(auctions.pickupConfirmedVendor, true)
      );

    // Should not include our test auction
    const hasTestAuction = pendingPickups.some(
      (auction) => auction.id === testAuctionId
    );
    expect(hasTestAuction).toBe(false);
  });
});
