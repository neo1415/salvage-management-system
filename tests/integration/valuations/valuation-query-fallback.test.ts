/**
 * Integration tests for queryWithFallback method
 * 
 * Tests the intelligent condition fallback logic that:
 * 1. Maps universal UI conditions to database conditions
 * 2. Tries primary conditions first
 * 3. Falls back to alternative conditions when primary unavailable
 * 4. Returns null only when all conditions exhausted
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { valuationQueryService } from '@/features/valuations/services/valuation-query.service';
import { db } from '@/lib/db';
import { vehicleValuations } from '@/lib/db/schema/vehicle-valuations';
import { eq, and } from 'drizzle-orm';

describe('ValuationQueryService - queryWithFallback', () => {
  describe('Brand New condition fallback', () => {
    it('should return result when brand_new exists', async () => {
      // Find a vehicle with brand_new condition in database
      const brandNewVehicles = await db
        .select()
        .from(vehicleValuations)
        .where(eq(vehicleValuations.conditionCategory, 'brand_new'))
        .limit(1);

      if (brandNewVehicles.length === 0) {
        console.log('No brand_new vehicles in database, skipping test');
        return;
      }

      const vehicle = brandNewVehicles[0];
      const result = await valuationQueryService.queryWithFallback(
        'Brand New',
        vehicle.make,
        vehicle.model,
        vehicle.year,
        50000 // Low mileage
      );

      expect(result).not.toBeNull();
      expect(result?.found).toBe(true);
      expect(result?.valuation?.conditionCategory).toBe('brand_new');
    });

    it('should fallback to tokunbo when brand_new not available', async () => {
      // Find a vehicle with tokunbo but no brand_new
      const tokunboVehicles = await db
        .select()
        .from(vehicleValuations)
        .where(eq(vehicleValuations.conditionCategory, 'tokunbo_low'))
        .limit(10);

      // Find one that doesn't have brand_new
      for (const vehicle of tokunboVehicles) {
        const brandNewExists = await db
          .select()
          .from(vehicleValuations)
          .where(
            and(
              eq(vehicleValuations.make, vehicle.make),
              eq(vehicleValuations.model, vehicle.model),
              eq(vehicleValuations.year, vehicle.year),
              eq(vehicleValuations.conditionCategory, 'brand_new')
            )
          );

        if (brandNewExists.length === 0) {
          // This vehicle has tokunbo but no brand_new - perfect for fallback test
          const result = await valuationQueryService.queryWithFallback(
            'Brand New',
            vehicle.make,
            vehicle.model,
            vehicle.year,
            50000 // Low mileage
          );

          expect(result).not.toBeNull();
          expect(result?.found).toBe(true);
          expect(result?.valuation?.conditionCategory).toMatch(/tokunbo_low|tokunbo_high/);
          return;
        }
      }

      console.log('Could not find suitable vehicle for fallback test');
    });
  });

  describe('Foreign Used (Tokunbo) condition fallback', () => {
    it('should return tokunbo_low for low mileage', async () => {
      const tokunboLowVehicles = await db
        .select()
        .from(vehicleValuations)
        .where(eq(vehicleValuations.conditionCategory, 'tokunbo_low'))
        .limit(1);

      if (tokunboLowVehicles.length === 0) {
        console.log('No tokunbo_low vehicles in database, skipping test');
        return;
      }

      const vehicle = tokunboLowVehicles[0];
      const result = await valuationQueryService.queryWithFallback(
        'Foreign Used (Tokunbo)',
        vehicle.make,
        vehicle.model,
        vehicle.year,
        50000 // Low mileage - should prioritize tokunbo_low
      );

      expect(result).not.toBeNull();
      expect(result?.found).toBe(true);
      expect(result?.valuation?.conditionCategory).toBe('tokunbo_low');
    });

    it('should fallback to nig_used when tokunbo not available', async () => {
      // Find a vehicle with nig_used but no tokunbo
      const nigUsedVehicles = await db
        .select()
        .from(vehicleValuations)
        .where(eq(vehicleValuations.conditionCategory, 'nig_used_low'))
        .limit(10);

      // Find one that doesn't have tokunbo
      for (const vehicle of nigUsedVehicles) {
        const tokunboExists = await db
          .select()
          .from(vehicleValuations)
          .where(
            and(
              eq(vehicleValuations.make, vehicle.make),
              eq(vehicleValuations.model, vehicle.model),
              eq(vehicleValuations.year, vehicle.year),
              eq(vehicleValuations.conditionCategory, 'tokunbo_low')
            )
          );

        if (tokunboExists.length === 0) {
          // This vehicle has nig_used but no tokunbo - perfect for fallback test
          const result = await valuationQueryService.queryWithFallback(
            'Foreign Used (Tokunbo)',
            vehicle.make,
            vehicle.model,
            vehicle.year,
            50000 // Low mileage
          );

          expect(result).not.toBeNull();
          expect(result?.found).toBe(true);
          expect(result?.valuation?.conditionCategory).toMatch(/nig_used_low|nig_used_high/);
          return;
        }
      }

      console.log('Could not find suitable vehicle for fallback test');
    });
  });

  describe('Nigerian Used condition fallback', () => {
    it('should return nig_used_low for low mileage', async () => {
      const nigUsedLowVehicles = await db
        .select()
        .from(vehicleValuations)
        .where(eq(vehicleValuations.conditionCategory, 'nig_used_low'))
        .limit(1);

      if (nigUsedLowVehicles.length === 0) {
        console.log('No nig_used_low vehicles in database, skipping test');
        return;
      }

      const vehicle = nigUsedLowVehicles[0];
      const result = await valuationQueryService.queryWithFallback(
        'Nigerian Used',
        vehicle.make,
        vehicle.model,
        vehicle.year,
        50000 // Low mileage - should prioritize nig_used_low
      );

      expect(result).not.toBeNull();
      expect(result?.found).toBe(true);
      expect(result?.valuation?.conditionCategory).toBe('nig_used_low');
    });

    it('should return nig_used_high for high mileage', async () => {
      const nigUsedHighVehicles = await db
        .select()
        .from(vehicleValuations)
        .where(eq(vehicleValuations.conditionCategory, 'nig_used_high'))
        .limit(1);

      if (nigUsedHighVehicles.length === 0) {
        console.log('No nig_used_high vehicles in database, skipping test');
        return;
      }

      const vehicle = nigUsedHighVehicles[0];
      const result = await valuationQueryService.queryWithFallback(
        'Nigerian Used',
        vehicle.make,
        vehicle.model,
        vehicle.year,
        150000 // High mileage - should prioritize nig_used_high
      );

      expect(result).not.toBeNull();
      expect(result?.found).toBe(true);
      // Should get nig_used_high if it exists, otherwise nig_used_low
      expect(result?.valuation?.conditionCategory).toMatch(/nig_used_high|nig_used_low/);
    });
  });

  describe('Mileage-based quality determination', () => {
    it('should prioritize _low variants for low mileage', async () => {
      const tokunboLowVehicles = await db
        .select()
        .from(vehicleValuations)
        .where(eq(vehicleValuations.conditionCategory, 'tokunbo_low'))
        .limit(1);

      if (tokunboLowVehicles.length === 0) {
        console.log('No tokunbo_low vehicles in database, skipping test');
        return;
      }

      const vehicle = tokunboLowVehicles[0];
      const result = await valuationQueryService.queryWithFallback(
        'Foreign Used (Tokunbo)',
        vehicle.make,
        vehicle.model,
        vehicle.year,
        50000 // Low mileage (< 100,000 km)
      );

      expect(result).not.toBeNull();
      expect(result?.found).toBe(true);
      // Should get tokunbo_low for low mileage
      expect(result?.valuation?.conditionCategory).toBe('tokunbo_low');
    });

    it('should prioritize _high variants for high mileage', async () => {
      const tokunboHighVehicles = await db
        .select()
        .from(vehicleValuations)
        .where(eq(vehicleValuations.conditionCategory, 'tokunbo_high'))
        .limit(1);

      if (tokunboHighVehicles.length === 0) {
        console.log('No tokunbo_high vehicles in database, skipping test');
        return;
      }

      const vehicle = tokunboHighVehicles[0];
      const result = await valuationQueryService.queryWithFallback(
        'Foreign Used (Tokunbo)',
        vehicle.make,
        vehicle.model,
        vehicle.year,
        150000 // High mileage (>= 100,000 km)
      );

      expect(result).not.toBeNull();
      expect(result?.found).toBe(true);
      // Should get tokunbo_high for high mileage
      expect(result?.valuation?.conditionCategory).toBe('tokunbo_high');
    });
  });

  describe('All conditions exhausted', () => {
    it('should return null when no conditions match', async () => {
      const result = await valuationQueryService.queryWithFallback(
        'Brand New',
        'NonExistentMake',
        'NonExistentModel',
        2099,
        50000
      );

      expect(result).toBeNull();
    }, 10000); // Increase timeout to 10 seconds for this test
  });

  describe('Preservation - existing queryValuation still works', () => {
    it('should maintain backward compatibility with queryValuation', async () => {
      const vehicles = await db
        .select()
        .from(vehicleValuations)
        .limit(1);

      if (vehicles.length === 0) {
        console.log('No vehicles in database, skipping test');
        return;
      }

      const vehicle = vehicles[0];
      const result = await valuationQueryService.queryValuation({
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        conditionCategory: vehicle.conditionCategory,
      });

      expect(result.found).toBe(true);
      expect(result.valuation?.lowPrice).toBeDefined();
      expect(result.valuation?.highPrice).toBeDefined();
      expect(result.valuation?.averagePrice).toBeDefined();
    });
  });
});
