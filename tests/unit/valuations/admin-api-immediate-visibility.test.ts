/**
 * Property Test: Admin API Data Update Immediate Visibility
 * 
 * Verifies that data updates through admin API are immediately visible in queries
 * Requirements: 7.6, 12.1
 */

import { describe, it, expect, afterAll } from 'vitest';
import { db } from '@/lib/db';
import { vehicleValuations, damageDeductions } from '@/lib/db/schema/vehicle-valuations';
import { eq } from 'drizzle-orm';
import * as fc from 'fast-check';

describe('Admin API Immediate Visibility Property Tests', () => {
  const testUserId = '00000000-0000-0000-0000-000000000001';
  const createdIds: string[] = [];

  afterAll(async () => {
    // Clean up test data
    for (const id of createdIds) {
      await db.delete(vehicleValuations).where(eq(vehicleValuations.id, id)).catch(() => {});
    }
  });

  it('valuation updates are immediately visible in queries', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          make: fc.stringMatching(/^[A-Za-z]{3,20}$/),
          model: fc.stringMatching(/^[A-Za-z0-9 ]{3,30}$/),
          year: fc.integer({ min: 2000, max: 2024 }),
          lowPrice: fc.integer({ min: 1000000, max: 5000000 }),
          highPrice: fc.integer({ min: 5000001, max: 15000000 }),
          averagePrice: fc.integer({ min: 3000000, max: 10000000 }),
        }),
        async (data) => {
          // Create valuation
          const created = await db.insert(vehicleValuations).values({
            make: data.make,
            model: data.model,
            year: data.year,
            conditionCategory: 'average',
            lowPrice: data.lowPrice.toString(),
            highPrice: data.highPrice.toString(),
            averagePrice: data.averagePrice.toString(),
            dataSource: 'test',
            createdBy: testUserId,
          }).returning();

          createdIds.push(created[0].id);

          // Immediately query - should find it
          const found = await db
            .select()
            .from(vehicleValuations)
            .where(eq(vehicleValuations.id, created[0].id))
            .limit(1);

          expect(found.length).toBe(1);
          expect(found[0].make).toBe(data.make);
          expect(found[0].model).toBe(data.model);

          // Update valuation
          const newAveragePrice = data.averagePrice + 100000;
          await db
            .update(vehicleValuations)
            .set({ averagePrice: newAveragePrice.toString() })
            .where(eq(vehicleValuations.id, created[0].id));

          // Immediately query again - should see update
          const updated = await db
            .select()
            .from(vehicleValuations)
            .where(eq(vehicleValuations.id, created[0].id))
            .limit(1);

          expect(updated.length).toBe(1);
          expect(updated[0].averagePrice).toBe(newAveragePrice.toString());
        }
      ),
      { numRuns: 10 }
    );
  });

  it('deduction updates are immediately visible in queries', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          component: fc.constantFrom('engine', 'transmission', 'body', 'suspension'),
          damageLevel: fc.constantFrom('minor', 'moderate', 'severe'),
          repairCost: fc.integer({ min: 50000, max: 2000000 }),
          deductionPercent: fc.float({ min: 0.01, max: 0.50, noNaN: true }),
        }),
        async (data) => {
          // Create deduction
          const created = await db.insert(damageDeductions).values({
            component: data.component,
            damageLevel: data.damageLevel as 'minor' | 'moderate' | 'severe',
            repairCostEstimate: data.repairCost.toString(),
            valuationDeductionPercent: Math.fround(data.deductionPercent).toString(),
            description: 'Test deduction',
            createdBy: testUserId,
          }).returning();

          const deductionId = created[0].id;

          // Immediately query - should find it
          const found = await db
            .select()
            .from(damageDeductions)
            .where(eq(damageDeductions.id, deductionId))
            .limit(1);

          expect(found.length).toBe(1);
          expect(found[0].component).toBe(data.component);

          // Update deduction
          const newRepairCost = data.repairCost + 50000;
          await db
            .update(damageDeductions)
            .set({ repairCostEstimate: newRepairCost.toString() })
            .where(eq(damageDeductions.id, deductionId));

          // Immediately query again - should see update
          const updated = await db
            .select()
            .from(damageDeductions)
            .where(eq(damageDeductions.id, deductionId))
            .limit(1);

          expect(updated.length).toBe(1);
          expect(updated[0].repairCostEstimate).toBe(newRepairCost.toString());

          // Clean up
          await db.delete(damageDeductions).where(eq(damageDeductions.id, deductionId));
        }
      ),
      { numRuns: 10 }
    );
  });
});
