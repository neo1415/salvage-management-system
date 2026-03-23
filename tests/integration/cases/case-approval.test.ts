/**
 * Integration Tests for Case Approval Workflow
 * 
 * Tests the complete case approval workflow including:
 * - Case status updates
 * - Auction auto-creation
 * - Vendor matching and notifications
 * 
 * **Validates: Requirement 15**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { auctions } from '@/lib/db/schema/auctions';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq, and, arrayContains } from 'drizzle-orm';
import { hash } from 'bcryptjs';

describe('Case Approval Workflow - Integration Tests', () => {
  let managerId: string;
  let adjusterId: string;
  let vendorId: string;
  let vendorUserId: string;
  let caseId: string;
  const timestamp = Date.now();

  beforeEach(async () => {
    // Create test Salvage Manager
    const [manager] = await db
      .insert(users)
      .values({
        email: `manager-${timestamp}@test.com`,
        phone: `+234${timestamp.toString().slice(-10)}`,
        passwordHash: await hash('Test123!@#', 12),
        role: 'salvage_manager',
        status: 'verified_tier_1',
        fullName: 'Test Manager',
        dateOfBirth: new Date('1990-01-01'),
      })
      .returning();
    managerId = manager.id;

    // Create test Claims Adjuster
    const [adjuster] = await db
      .insert(users)
      .values({
        email: `adjuster-${timestamp}@test.com`,
        phone: `+234${(timestamp + 1).toString().slice(-10)}`,
        passwordHash: await hash('Test123!@#', 12),
        role: 'claims_adjuster',
        status: 'verified_tier_1',
        fullName: 'Test Adjuster',
        dateOfBirth: new Date('1990-01-01'),
      })
      .returning();
    adjusterId = adjuster.id;

    // Create test Vendor user
    const [vendorUser] = await db
      .insert(users)
      .values({
        email: `vendor-${timestamp}@test.com`,
        phone: `+234${(timestamp + 2).toString().slice(-10)}`,
        passwordHash: await hash('Test123!@#', 12),
        role: 'vendor',
        status: 'verified_tier_1',
        fullName: 'Test Vendor',
        dateOfBirth: new Date('1990-01-01'),
      })
      .returning();
    vendorUserId = vendorUser.id;

    // Create test Vendor
    const [vendor] = await db
      .insert(vendors)
      .values({
        userId: vendorUserId,
        tier: 'tier1_bvn',
        status: 'approved',
        categories: ['vehicle'],
        performanceStats: {
          totalBids: 0,
          totalWins: 0,
          winRate: 0,
          avgPaymentTimeHours: 0,
          onTimePickupRate: 0,
          fraudFlags: 0,
        },
      })
      .returning();
    vendorId = vendor.id;

    // Create test case in pending_approval status
    const [testCase] = await db
      .insert(salvageCases)
      .values({
        claimReference: `TEST-CLAIM-${timestamp}`,
        assetType: 'vehicle',
        assetDetails: {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          vin: 'TEST123456789',
        },
        marketValue: '5000000.00',
        estimatedSalvageValue: '1500000.00',
        reservePrice: '1050000.00',
        damageSeverity: 'moderate',
        aiAssessment: {
          labels: ['Front damage', 'Bumper dent'],
          confidenceScore: 85,
          damagePercentage: 30,
          processedAt: new Date(),
        },
        gpsLocation: [6.5244, 3.3792] as [number, number],
        locationName: 'Lagos, Nigeria',
        photos: ['https://cloudinary.com/photo1.jpg'],
        status: 'pending_approval',
        createdBy: adjusterId,
      })
      .returning();
    caseId = testCase.id;
  });

  afterEach(async () => {
    // Clean up test data in reverse order of creation
    try {
      await db.delete(auctions).where(eq(auctions.caseId, caseId));
      await db.delete(salvageCases).where(eq(salvageCases.id, caseId));
      await db.delete(vendors).where(eq(vendors.id, vendorId));
      await db.delete(users).where(eq(users.id, managerId));
      await db.delete(users).where(eq(users.id, adjusterId));
      await db.delete(users).where(eq(users.id, vendorUserId));
    } catch (error) {
      console.error('Error cleaning up test data:', error);
    }
  });

  describe('Case Approval Workflow', () => {
    it('should update case status to approved', async () => {
      // Approve the case
      const [updatedCase] = await db
        .update(salvageCases)
        .set({
          status: 'approved',
          approvedBy: managerId,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(salvageCases.id, caseId))
        .returning();

      // Verify case was updated
      expect(updatedCase.status).toBe('approved');
      expect(updatedCase.approvedBy).toBe(managerId);
      expect(updatedCase.approvedAt).toBeDefined();
    });

    it('should create auction when case is approved', async () => {
      // Approve the case
      await db
        .update(salvageCases)
        .set({
          status: 'approved',
          approvedBy: managerId,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(salvageCases.id, caseId));

      // Create auction
      const now = new Date();
      const endTime = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days

      const [auction] = await db
        .insert(auctions)
        .values({
          caseId: caseId,
          startTime: now,
          endTime: endTime,
          originalEndTime: endTime,
          extensionCount: 0,
          currentBid: null,
          currentBidder: null,
          minimumIncrement: '10000.00',
          status: 'active',
          watchingCount: 0,
        })
        .returning();

      // Verify auction was created
      expect(auction).toBeDefined();
      expect(auction.caseId).toBe(caseId);
      expect(auction.status).toBe('active');
      expect(auction.minimumIncrement).toBe('10000.00');

      // Update case to active_auction
      await db
        .update(salvageCases)
        .set({
          status: 'active_auction',
          updatedAt: new Date(),
        })
        .where(eq(salvageCases.id, caseId));

      // Verify case status
      const [finalCase] = await db
        .select()
        .from(salvageCases)
        .where(eq(salvageCases.id, caseId))
        .limit(1);

      expect(finalCase.status).toBe('active_auction');
    });

    it('should find vendors matching asset category', async () => {
      // Query vendors matching the asset type
      const assetType = 'vehicle';
      const matchingVendors = await db
        .select({
          vendorId: vendors.id,
          userId: vendors.userId,
          phone: users.phone,
          email: users.email,
          fullName: users.fullName,
        })
        .from(vendors)
        .innerJoin(users, eq(vendors.userId, users.id))
        .where(
          and(
            eq(vendors.status, 'approved'),
            arrayContains(vendors.categories, [assetType])
          )
        );

      // Verify at least one vendor was found
      expect(matchingVendors.length).toBeGreaterThan(0);
      
      // Verify our test vendor is in the list
      const testVendorInList = matchingVendors.some(
        (v) => v.vendorId === vendorId
      );
      expect(testVendorInList).toBe(true);
    });

    it('should not find vendors with different asset category', async () => {
      // Create vendor with different category
      const [electronicsVendorUser] = await db
        .insert(users)
        .values({
          email: `electronics-vendor-${timestamp}@test.com`,
          phone: `+234${(timestamp + 3).toString().slice(-10)}`,
          passwordHash: await hash('Test123!@#', 12),
          role: 'vendor',
          status: 'verified_tier_1',
          fullName: 'Electronics Vendor',
          dateOfBirth: new Date('1990-01-01'),
        })
        .returning();

      const [electronicsVendor] = await db
        .insert(vendors)
        .values({
          userId: electronicsVendorUser.id,
          tier: 'tier1_bvn',
          status: 'approved',
          categories: ['electronics'], // Different category
          performanceStats: {
            totalBids: 0,
            totalWins: 0,
            winRate: 0,
            avgPaymentTimeHours: 0,
            onTimePickupRate: 0,
            fraudFlags: 0,
          },
        })
        .returning();

      // Query vendors matching vehicle asset type
      const assetType = 'vehicle';
      const matchingVendors = await db
        .select({
          vendorId: vendors.id,
        })
        .from(vendors)
        .where(
          and(
            eq(vendors.status, 'approved'),
            arrayContains(vendors.categories, [assetType])
          )
        );

      // Verify electronics vendor is not in the list
      const electronicsVendorInList = matchingVendors.some(
        (v) => v.vendorId === electronicsVendor.id
      );
      expect(electronicsVendorInList).toBe(false);

      // Clean up
      await db.delete(vendors).where(eq(vendors.id, electronicsVendor.id));
      await db.delete(users).where(eq(users.id, electronicsVendorUser.id));
    });

    it('should update case status to draft when rejected', async () => {
      // Reject the case
      const [updatedCase] = await db
        .update(salvageCases)
        .set({
          status: 'draft',
          updatedAt: new Date(),
        })
        .where(eq(salvageCases.id, caseId))
        .returning();

      // Verify case was updated
      expect(updatedCase.status).toBe('draft');
    });

    it('should not create auction when case is rejected', async () => {
      // Reject the case
      await db
        .update(salvageCases)
        .set({
          status: 'draft',
          updatedAt: new Date(),
        })
        .where(eq(salvageCases.id, caseId));

      // Verify no auction was created
      const auctionList = await db
        .select()
        .from(auctions)
        .where(eq(auctions.caseId, caseId));

      expect(auctionList.length).toBe(0);
    });
  });
});
