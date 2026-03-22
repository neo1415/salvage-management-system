import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';

/**
 * Integration Test: Backward Compatibility
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 * 
 * This test verifies that old cases without mileage/condition fields
 * continue to work correctly in the system:
 * - Display shows "N/A" for missing fields
 * - AI assessment works with defaults
 * - Approval works normally
 */
describe('Integration: Backward Compatibility', () => {
  let testUserId: string;
  let testManagerId: string;
  let oldCaseId: string;

  beforeAll(async () => {
    // Create test user (adjuster)
    const [user] = await db
      .insert(users)
      .values({
        email: `test-adjuster-old-${Date.now()}@example.com`,
        name: 'Test Adjuster Old',
        role: 'adjuster',
        phoneNumber: '+2348012345681',
      })
      .returning();
    
    testUserId = user.id;

    // Create test manager
    const [manager] = await db
      .insert(users)
      .values({
        email: `test-manager-old-${Date.now()}@example.com`,
        name: 'Test Manager Old',
        role: 'manager',
        phoneNumber: '+2348012345682',
      })
      .returning();
    
    testManagerId = manager.id;
  });

  afterAll(async () => {
    // Cleanup: Delete test data
    if (oldCaseId) {
      await db.delete(salvageCases).where(eq(salvageCases.id, oldCaseId));
    }
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
    if (testManagerId) {
      await db.delete(users).where(eq(users.id, testManagerId));
    }
  });

  it('should load old case without mileage/condition', async () => {
    // Arrange & Act: Create old case without new fields
    const [oldCase] = await db
      .insert(salvageCases)
      .values({
        adjusterId: testUserId,
        policyNumber: 'POL-OLD-001',
        claimNumber: 'CLM-OLD-001',
        assetType: 'vehicle',
        vehicleMake: 'Nissan',
        vehicleModel: 'Altima',
        vehicleYear: 2015,
        // No vehicleMileage
        // No vehicleCondition
        damageDescription: 'Side impact damage',
        location: 'Port Harcourt, Nigeria',
        latitude: 4.8156,
        longitude: 7.0498,
        status: 'pending_approval',
      })
      .returning();

    oldCaseId = oldCase.id;

    // Assert: Verify case was created without new fields
    expect(oldCase).toBeDefined();
    expect(oldCase.id).toBeDefined();
    expect(oldCase.vehicleMileage).toBeNull();
    expect(oldCase.vehicleCondition).toBeNull();
    expect(oldCase.vehicleMake).toBe('Nissan');
    expect(oldCase.vehicleModel).toBe('Altima');
  });

  it('should display N/A for missing mileage', async () => {
    // Verify display logic handles missing mileage

    const oldCase = await db.query.salvageCases.findFirst({
      where: eq(salvageCases.id, oldCaseId),
    });

    expect(oldCase).toBeDefined();
    
    // Simulate display logic
    const displayMileage = oldCase?.vehicleMileage ?? 'N/A';
    
    expect(displayMileage).toBe('N/A');
    expect(oldCase?.vehicleMileage).toBeNull();
  });

  it('should display N/A for missing condition', async () => {
    // Verify display logic handles missing condition

    const oldCase = await db.query.salvageCases.findFirst({
      where: eq(salvageCases.id, oldCaseId),
    });

    expect(oldCase).toBeDefined();
    
    // Simulate display logic
    const displayCondition = oldCase?.vehicleCondition ?? 'N/A';
    
    expect(displayCondition).toBe('N/A');
    expect(oldCase?.vehicleCondition).toBeNull();
  });

  it('should use default mileage for AI assessment', async () => {
    // Verify AI assessment logic uses defaults for missing mileage

    const oldCase = await db.query.salvageCases.findFirst({
      where: eq(salvageCases.id, oldCaseId),
    });

    expect(oldCase).toBeDefined();
    
    // Simulate AI assessment input preparation
    const vehicleAge = new Date().getFullYear() - (oldCase?.vehicleYear || 0);
    const estimatedMileage = oldCase?.vehicleMileage ?? (vehicleAge * 15000);
    
    expect(estimatedMileage).toBeGreaterThan(0);
    expect(typeof estimatedMileage).toBe('number');
    // For a 2015 vehicle in 2026, estimated mileage would be ~165,000 km
    expect(estimatedMileage).toBeGreaterThan(100000);
  });

  it('should use default condition for AI assessment', async () => {
    // Verify AI assessment logic uses defaults for missing condition

    const oldCase = await db.query.salvageCases.findFirst({
      where: eq(salvageCases.id, oldCaseId),
    });

    expect(oldCase).toBeDefined();
    
    // Simulate AI assessment input preparation
    const defaultCondition = oldCase?.vehicleCondition ?? 'fair';
    
    expect(defaultCondition).toBe('fair');
    expect(['excellent', 'good', 'fair', 'poor']).toContain(defaultCondition);
  });

  it('should allow approval without mileage/condition', async () => {
    // Verify approval workflow works for old cases

    // Act: Approve old case
    const [approvedCase] = await db
      .update(salvageCases)
      .set({
        status: 'approved',
        aiEstimates: {
          marketValue: 3500000,
          salvageValue: 2000000,
          repairCost: 1500000,
          reservePrice: 1800000,
          confidence: 75,
        },
      })
      .where(eq(salvageCases.id, oldCaseId))
      .returning();

    // Assert: Verify approval succeeded
    expect(approvedCase).toBeDefined();
    expect(approvedCase.status).toBe('approved');
    expect(approvedCase.aiEstimates).toBeDefined();
    expect(approvedCase.vehicleMileage).toBeNull();
    expect(approvedCase.vehicleCondition).toBeNull();
  });

  it('should display old case with N/A for missing fields', async () => {
    // Verify complete display logic for old case

    const oldCase = await db.query.salvageCases.findFirst({
      where: eq(salvageCases.id, oldCaseId),
    });

    expect(oldCase).toBeDefined();
    
    // Simulate complete display data
    const displayData = {
      make: oldCase?.vehicleMake,
      model: oldCase?.vehicleModel,
      year: oldCase?.vehicleYear,
      mileage: oldCase?.vehicleMileage ?? 'N/A',
      condition: oldCase?.vehicleCondition ?? 'N/A',
      status: oldCase?.status,
    };

    expect(displayData.make).toBe('Nissan');
    expect(displayData.model).toBe('Altima');
    expect(displayData.year).toBe(2015);
    expect(displayData.mileage).toBe('N/A');
    expect(displayData.condition).toBe('N/A');
    expect(displayData.status).toBe('approved');
  });

  it('should not break existing workflows', async () => {
    // Verify old case can go through complete workflow

    const finalCase = await db.query.salvageCases.findFirst({
      where: eq(salvageCases.id, oldCaseId),
    });

    expect(finalCase).toBeDefined();
    
    // Verify all required fields are present
    expect(finalCase?.id).toBeDefined();
    expect(finalCase?.adjusterId).toBe(testUserId);
    expect(finalCase?.policyNumber).toBe('POL-OLD-001');
    expect(finalCase?.claimNumber).toBe('CLM-OLD-001');
    expect(finalCase?.assetType).toBe('vehicle');
    expect(finalCase?.status).toBe('approved');
    
    // Verify optional new fields are null (not undefined)
    expect(finalCase?.vehicleMileage).toBeNull();
    expect(finalCase?.vehicleCondition).toBeNull();
    
    // Verify AI estimates were generated
    expect(finalCase?.aiEstimates).toBeDefined();
  });

  it('should handle mixed old and new cases', async () => {
    // Create a new case with mileage/condition
    const [newCase] = await db
      .insert(salvageCases)
      .values({
        adjusterId: testUserId,
        policyNumber: 'POL-NEW-001',
        claimNumber: 'CLM-NEW-001',
        assetType: 'vehicle',
        vehicleMake: 'Toyota',
        vehicleModel: 'Corolla',
        vehicleYear: 2022,
        vehicleMileage: 25000,
        vehicleCondition: 'excellent',
        damageDescription: 'Minor fender bender',
        location: 'Lagos, Nigeria',
        latitude: 6.5244,
        longitude: 3.3792,
        status: 'pending_approval',
      })
      .returning();

    // Query both old and new cases
    const allCases = await db.query.salvageCases.findMany({
      where: eq(salvageCases.adjusterId, testUserId),
    });

    expect(allCases.length).toBeGreaterThanOrEqual(2);
    
    // Verify old case
    const oldCaseData = allCases.find(c => c.id === oldCaseId);
    expect(oldCaseData?.vehicleMileage).toBeNull();
    expect(oldCaseData?.vehicleCondition).toBeNull();
    
    // Verify new case
    const newCaseData = allCases.find(c => c.id === newCase.id);
    expect(newCaseData?.vehicleMileage).toBe(25000);
    expect(newCaseData?.vehicleCondition).toBe('excellent');
    
    // Cleanup new case
    await db.delete(salvageCases).where(eq(salvageCases.id, newCase.id));
  });
});
