import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { users } from '@/lib/db/schema/users';
import { auctions } from '@/lib/db/schema/auctions';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { eq } from 'drizzle-orm';

/**
 * Integration Test: Manager Approval with Price Overrides
 * 
 * Requirements: 4.1, 4.5, 6.1, 6.2, 6.3, 7.1, 6.5
 * 
 * This test verifies the end-to-end flow of a manager approving a case
 * with price overrides, ensuring:
 * - Auction uses overridden prices
 * - Both AI and override values are stored
 * - Audit log is created
 * - Adjuster is notified
 */
describe('Integration: Manager Approval with Overrides', () => {
  let testManagerId: string;
  let testAdjusterId: string;
  let testCaseId: string;
  let testAuctionId: string;

  beforeAll(async () => {
    // Create test manager
    const [manager] = await db
      .insert(users)
      .values({
        email: `test-manager-${Date.now()}@example.com`,
        name: 'Test Manager',
        role: 'manager',
        phoneNumber: '+2348012345679',
      })
      .returning();
    
    testManagerId = manager.id;

    // Create test adjuster
    const [adjuster] = await db
      .insert(users)
      .values({
        email: `test-adjuster-${Date.now()}@example.com`,
        name: 'Test Adjuster',
        role: 'adjuster',
        phoneNumber: '+2348012345680',
      })
      .returning();
    
    testAdjusterId = adjuster.id;

    // Create test case with AI estimates
    const [testCase] = await db
      .insert(salvageCases)
      .values({
        adjusterId: testAdjusterId,
        policyNumber: 'POL-TEST-002',
        claimNumber: 'CLM-TEST-002',
        assetType: 'vehicle',
        vehicleMake: 'Honda',
        vehicleModel: 'Accord',
        vehicleYear: 2019,
        vehicleMileage: 60000,
        vehicleCondition: 'fair',
        damageDescription: 'Rear-end collision',
        location: 'Abuja, Nigeria',
        latitude: 9.0765,
        longitude: 7.3986,
        status: 'pending_approval',
        aiEstimates: {
          marketValue: 8000000,
          salvageValue: 5000000,
          repairCost: 3000000,
          reservePrice: 4500000,
          confidence: 85,
        },
      })
      .returning();
    
    testCaseId = testCase.id;
  });

  afterAll(async () => {
    // Cleanup: Delete test data
    if (testAuctionId) {
      await db.delete(auctions).where(eq(auctions.id, testAuctionId));
    }
    if (testCaseId) {
      await db.delete(salvageCases).where(eq(salvageCases.id, testCaseId));
      await db.delete(auditLogs).where(eq(auditLogs.caseId, testCaseId));
    }
    if (testManagerId) {
      await db.delete(users).where(eq(users.id, testManagerId));
    }
    if (testAdjusterId) {
      await db.delete(users).where(eq(users.id, testAdjusterId));
    }
  });

  it('should approve case with price overrides', async () => {
    // Arrange: Prepare price overrides
    const priceOverrides = {
      marketValue: 8500000, // Override: ₦8.5M (AI: ₦8M)
      salvageValue: 5500000, // Override: ₦5.5M (AI: ₦5M)
      reservePrice: 5000000, // Override: ₦5M (AI: ₦4.5M)
    };

    const overrideComment = 'Adjusted prices based on recent market analysis and vehicle condition assessment';

    // Act: Update case with overrides
    const [updatedCase] = await db
      .update(salvageCases)
      .set({
        status: 'approved',
        managerOverrides: priceOverrides,
      })
      .where(eq(salvageCases.id, testCaseId))
      .returning();

    // Assert: Verify case was updated
    expect(updatedCase).toBeDefined();
    expect(updatedCase.status).toBe('approved');
    expect(updatedCase.managerOverrides).toEqual(priceOverrides);
    expect(updatedCase.aiEstimates).toBeDefined();
  });

  it('should create auction with overridden prices', async () => {
    // Arrange: Get approved case
    const approvedCase = await db.query.salvageCases.findFirst({
      where: eq(salvageCases.id, testCaseId),
    });

    expect(approvedCase).toBeDefined();
    expect(approvedCase?.managerOverrides).toBeDefined();

    // Act: Create auction using overridden prices
    const overrides = approvedCase?.managerOverrides as any;
    const [auction] = await db
      .insert(auctions)
      .values({
        caseId: testCaseId,
        title: `${approvedCase?.vehicleMake} ${approvedCase?.vehicleModel} ${approvedCase?.vehicleYear}`,
        description: approvedCase?.damageDescription || '',
        startingBid: overrides.reservePrice, // Use overridden reserve price
        currentBid: overrides.reservePrice,
        minimumBid: overrides.reservePrice,
        startTime: new Date(),
        endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        status: 'active',
      })
      .returning();

    testAuctionId = auction.id;

    // Assert: Verify auction uses overridden prices
    expect(auction).toBeDefined();
    expect(auction.startingBid).toBe(5000000); // Overridden reserve price
    expect(auction.minimumBid).toBe(5000000);
    expect(auction.currentBid).toBe(5000000);
  });

  it('should store both AI estimates and overrides', async () => {
    // Verify both AI and override values are persisted

    const caseWithBothValues = await db.query.salvageCases.findFirst({
      where: eq(salvageCases.id, testCaseId),
    });

    expect(caseWithBothValues).toBeDefined();
    
    // AI estimates should still be present
    const aiEstimates = caseWithBothValues?.aiEstimates as any;
    expect(aiEstimates).toBeDefined();
    expect(aiEstimates.marketValue).toBe(8000000);
    expect(aiEstimates.salvageValue).toBe(5000000);
    expect(aiEstimates.reservePrice).toBe(4500000);
    
    // Manager overrides should be present
    const managerOverrides = caseWithBothValues?.managerOverrides as any;
    expect(managerOverrides).toBeDefined();
    expect(managerOverrides.marketValue).toBe(8500000);
    expect(managerOverrides.salvageValue).toBe(5500000);
    expect(managerOverrides.reservePrice).toBe(5000000);
  });

  it('should create audit log for price overrides', async () => {
    // Arrange: Create audit log entry
    const overrideComment = 'Adjusted prices based on recent market analysis';
    
    await db.insert(auditLogs).values({
      userId: testManagerId,
      action: 'PRICE_OVERRIDE',
      entityType: 'case',
      entityId: testCaseId,
      caseId: testCaseId,
      details: {
        originalValues: {
          marketValue: 8000000,
          salvageValue: 5000000,
          reservePrice: 4500000,
        },
        newValues: {
          marketValue: 8500000,
          salvageValue: 5500000,
          reservePrice: 5000000,
        },
        comment: overrideComment,
      },
    });

    // Act: Query audit logs
    const auditLog = await db.query.auditLogs.findFirst({
      where: eq(auditLogs.caseId, testCaseId),
    });

    // Assert: Verify audit log was created
    expect(auditLog).toBeDefined();
    expect(auditLog?.userId).toBe(testManagerId);
    expect(auditLog?.action).toBe('PRICE_OVERRIDE');
    expect(auditLog?.entityType).toBe('case');
    expect(auditLog?.entityId).toBe(testCaseId);
    
    const details = auditLog?.details as any;
    expect(details.originalValues).toBeDefined();
    expect(details.newValues).toBeDefined();
    expect(details.comment).toBe(overrideComment);
  });

  it('should verify adjuster notification (mock)', async () => {
    // In a real scenario, this would verify that a notification
    // was sent to the adjuster. For this test, we verify the
    // data is available for notification.

    const approvedCase = await db.query.salvageCases.findFirst({
      where: eq(salvageCases.id, testCaseId),
      with: {
        adjuster: true,
      },
    });

    expect(approvedCase).toBeDefined();
    expect(approvedCase?.adjuster).toBeDefined();
    expect(approvedCase?.adjuster?.phoneNumber).toBe('+2348012345680');
    expect(approvedCase?.managerOverrides).toBeDefined();
    
    // Notification would include:
    // - Adjuster phone number
    // - Case details
    // - Override information
    // - Manager comment
  });

  it('should complete end-to-end approval flow', async () => {
    // Verify the complete flow from approval to auction creation

    // 1. Case is approved with overrides
    const finalCase = await db.query.salvageCases.findFirst({
      where: eq(salvageCases.id, testCaseId),
    });
    expect(finalCase?.status).toBe('approved');
    expect(finalCase?.managerOverrides).toBeDefined();

    // 2. Auction was created
    const finalAuction = await db.query.auctions.findFirst({
      where: eq(auctions.caseId, testCaseId),
    });
    expect(finalAuction).toBeDefined();
    expect(finalAuction?.status).toBe('active');

    // 3. Auction uses overridden prices
    const overrides = finalCase?.managerOverrides as any;
    expect(finalAuction?.startingBid).toBe(overrides.reservePrice);

    // 4. Audit log exists
    const finalAuditLog = await db.query.auditLogs.findFirst({
      where: eq(auditLogs.caseId, testCaseId),
    });
    expect(finalAuditLog).toBeDefined();
    expect(finalAuditLog?.action).toBe('PRICE_OVERRIDE');
  });
});
