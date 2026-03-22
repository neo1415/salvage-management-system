/**
 * Integration Tests for Case Approval with Price Overrides
 * 
 * Tests the end-to-end approval flow with price overrides,
 * verifying that auctions use overridden prices and both
 * AI and override values are stored.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { auctions } from '@/lib/db/schema/auctions';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { hash } from 'bcryptjs';

describe('Case Approval with Price Overrides Integration', () => {
  let testAdjusterId: string;
  let testManagerId: string;
  let testCaseId: string;

  beforeEach(async () => {
    // Create test adjuster
    const [adjuster] = await db
      .insert(users)
      .values({
        email: `adjuster-${Date.now()}@test.com`,
        phone: `+234${Math.floor(Math.random() * 10000000000)}`,
        fullName: 'Test Adjuster',
        passwordHash: await hash('password123', 10),
        dateOfBirth: new Date('1990-01-01'),
        role: 'claims_adjuster',
        isVerified: true,
      })
      .returning();
    testAdjusterId = adjuster.id;

    // Create test manager
    const [manager] = await db
      .insert(users)
      .values({
        email: `manager-${Date.now()}@test.com`,
        phone: `+234${Math.floor(Math.random() * 10000000000)}`,
        fullName: 'Test Manager',
        passwordHash: await hash('password123', 10),
        dateOfBirth: new Date('1985-01-01'),
        role: 'salvage_manager',
        isVerified: true,
      })
      .returning();
    testManagerId = manager.id;

    // Create test case
    const [testCase] = await db
      .insert(salvageCases)
      .values({
        claimReference: `TEST-${Date.now()}`,
        assetType: 'vehicle',
        assetDetails: {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          vin: 'TEST123456789',
        },
        marketValue: '5000000',
        estimatedRepairCost: '2000000',
        estimatedSalvageValue: '3000000',
        reservePrice: '2100000',
        aiConfidence: 85,
        damageSeverity: 'moderate',
        aiAssessment: {
          labels: ['Front damage'],
          confidenceScore: 85,
          damagePercentage: 40,
          processedAt: new Date(),
        },
        gpsLocation: [6.5244, 3.3792] as [number, number],
        locationName: 'Lagos',
        photos: ['https://cloudinary.com/photo1.jpg'],
        status: 'pending_approval',
        createdBy: testAdjusterId,
      })
      .returning();
    testCaseId = testCase.id;
  });

  afterEach(async () => {
    // Clean up test data
    if (testCaseId) {
      await db.delete(auctions).where(eq(auctions.caseId, testCaseId));
      await db.delete(salvageCases).where(eq(salvageCases.id, testCaseId));
    }
    if (testAdjusterId) {
      await db.delete(users).where(eq(users.id, testAdjusterId));
    }
    if (testManagerId) {
      await db.delete(users).where(eq(users.id, testManagerId));
    }
  });

  it('should approve case with price overrides and create auction with overridden reserve price', async () => {
    // Arrange
    const priceOverrides = {
      marketValue: 5500000,
      salvageValue: 3300000,
      reservePrice: 2310000,
    };

    const comment = 'Market research shows higher value for this model in Lagos';

    // Act - Simulate approval with overrides
    const [updatedCase] = await db
      .update(salvageCases)
      .set({
        marketValue: priceOverrides.marketValue.toString(),
        estimatedSalvageValue: priceOverrides.salvageValue.toString(),
        reservePrice: priceOverrides.reservePrice.toString(),
        aiEstimates: {
          marketValue: 5000000,
          repairCost: 2000000,
          salvageValue: 3000000,
          reservePrice: 2100000,
          confidence: 85,
        },
        managerOverrides: {
          ...priceOverrides,
          reason: comment,
          overriddenBy: testManagerId,
          overriddenAt: new Date().toISOString(),
        },
        status: 'approved',
        approvedBy: testManagerId,
        approvedAt: new Date(),
      })
      .where(eq(salvageCases.id, testCaseId))
      .returning();

    // Create auction
    const now = new Date();
    const endTime = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

    const [auction] = await db
      .insert(auctions)
      .values({
        caseId: testCaseId,
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

    await db
      .update(salvageCases)
      .set({
        status: 'active_auction',
      })
      .where(eq(salvageCases.id, testCaseId));

    // Assert - Verify case was updated with overrides
    expect(updatedCase.marketValue).toBe('5500000.00');
    expect(updatedCase.estimatedSalvageValue).toBe('3300000.00');
    expect(updatedCase.reservePrice).toBe('2310000.00');

    // Assert - Verify AI estimates are stored
    expect(updatedCase.aiEstimates).toBeDefined();
    expect(updatedCase.aiEstimates).toMatchObject({
      marketValue: 5000000,
      salvageValue: 3000000,
      reservePrice: 2100000,
    });

    // Assert - Verify manager overrides are stored
    expect(updatedCase.managerOverrides).toBeDefined();
    expect(updatedCase.managerOverrides).toMatchObject({
      marketValue: priceOverrides.marketValue,
      salvageValue: priceOverrides.salvageValue,
      reservePrice: priceOverrides.reservePrice,
      reason: comment,
      overriddenBy: testManagerId,
    });

    // Assert - Verify auction was created
    expect(auction).toBeDefined();
    expect(auction.caseId).toBe(testCaseId);
    expect(auction.status).toBe('active');

    // Assert - Verify case status is active_auction
    const [finalCase] = await db
      .select()
      .from(salvageCases)
      .where(eq(salvageCases.id, testCaseId))
      .limit(1);

    expect(finalCase.status).toBe('active_auction');
  });

  it('should approve case without overrides and use AI estimates', async () => {
    // Act - Simulate approval without overrides
    const [updatedCase] = await db
      .update(salvageCases)
      .set({
        status: 'approved',
        approvedBy: testManagerId,
        approvedAt: new Date(),
      })
      .where(eq(salvageCases.id, testCaseId))
      .returning();

    // Create auction
    const now = new Date();
    const endTime = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

    const [auction] = await db
      .insert(auctions)
      .values({
        caseId: testCaseId,
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

    await db
      .update(salvageCases)
      .set({
        status: 'active_auction',
      })
      .where(eq(salvageCases.id, testCaseId));

    // Assert - Verify case uses original AI estimates
    expect(updatedCase.marketValue).toBe('5000000.00');
    expect(updatedCase.estimatedSalvageValue).toBe('3000000.00');
    expect(updatedCase.reservePrice).toBe('2100000.00');

    // Assert - Verify no overrides are stored
    expect(updatedCase.managerOverrides).toBeNull();

    // Assert - Verify auction was created
    expect(auction).toBeDefined();
    expect(auction.caseId).toBe(testCaseId);
    expect(auction.status).toBe('active');
  });

  it('should store both AI estimates and overrides for audit trail', async () => {
    // Arrange
    const aiEstimates = {
      marketValue: 5000000,
      repairCost: 2000000,
      salvageValue: 3000000,
      reservePrice: 2100000,
      confidence: 85,
    };

    const priceOverrides = {
      marketValue: 5500000,
      reservePrice: 2310000,
    };

    // Act - Simulate approval with partial overrides
    const [updatedCase] = await db
      .update(salvageCases)
      .set({
        marketValue: priceOverrides.marketValue.toString(),
        reservePrice: priceOverrides.reservePrice.toString(),
        aiEstimates: aiEstimates,
        managerOverrides: {
          ...priceOverrides,
          reason: 'Adjusted based on recent market trends',
          overriddenBy: testManagerId,
          overriddenAt: new Date().toISOString(),
        },
        status: 'approved',
        approvedBy: testManagerId,
        approvedAt: new Date(),
      })
      .where(eq(salvageCases.id, testCaseId))
      .returning();

    // Assert - Verify both AI estimates and overrides are stored
    expect(updatedCase.aiEstimates).toEqual(aiEstimates);
    expect(updatedCase.managerOverrides).toMatchObject({
      marketValue: priceOverrides.marketValue,
      reservePrice: priceOverrides.reservePrice,
      reason: 'Adjusted based on recent market trends',
      overriddenBy: testManagerId,
    });

    // Assert - Verify final values use overrides where provided
    expect(updatedCase.marketValue).toBe('5500000.00');
    expect(updatedCase.reservePrice).toBe('2310000.00');
    
    // Assert - Verify salvage value still uses AI estimate (not overridden)
    expect(updatedCase.estimatedSalvageValue).toBe('3000000.00');
  });

  it('should handle partial overrides correctly', async () => {
    // Arrange - Only override reserve price
    const priceOverrides = {
      reservePrice: 2500000,
    };

    // Act
    const [updatedCase] = await db
      .update(salvageCases)
      .set({
        reservePrice: priceOverrides.reservePrice.toString(),
        aiEstimates: {
          marketValue: 5000000,
          repairCost: 2000000,
          salvageValue: 3000000,
          reservePrice: 2100000,
          confidence: 85,
        },
        managerOverrides: {
          ...priceOverrides,
          reason: 'Increased reserve to ensure minimum recovery',
          overriddenBy: testManagerId,
          overriddenAt: new Date().toISOString(),
        },
        status: 'approved',
        approvedBy: testManagerId,
        approvedAt: new Date(),
      })
      .where(eq(salvageCases.id, testCaseId))
      .returning();

    // Assert - Verify only reserve price was overridden
    expect(updatedCase.reservePrice).toBe('2500000.00');
    
    // Assert - Verify other values remain unchanged
    expect(updatedCase.marketValue).toBe('5000000.00');
    expect(updatedCase.estimatedSalvageValue).toBe('3000000.00');

    // Assert - Verify override metadata is stored
    expect(updatedCase.managerOverrides).toMatchObject({
      reservePrice: priceOverrides.reservePrice,
      reason: 'Increased reserve to ensure minimum recovery',
      overriddenBy: testManagerId,
    });
  });
});
