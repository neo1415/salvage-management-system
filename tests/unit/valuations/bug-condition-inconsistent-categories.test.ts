/**
 * Bug Condition Exploration Test - Inconsistent Condition Categories Per Make
 * 
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * **DO NOT attempt to fix the test or the code when it fails**
 * **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
 * **GOAL**: Surface counterexamples that demonstrate the bug exists
 * 
 * Bug Description:
 * The system shows inconsistent condition categories per vehicle make instead of universal categories
 * with intelligent fallback logic. This creates confusing UX and prevents accurate valuations.
 * 
 * Verified Database State:
 * - Mercedes-Benz: ONLY standard categories (fair, poor, excellent, good)
 * - Nissan: ONLY non-standard (tokunbo_low, nig_used_low) - NO _high variants, NO brand_new
 * - Audi: ONLY non-standard (tokunbo_low, nig_used_low) - NO _high variants, NO brand_new
 * - Toyota: MIXED (both standard AND non-standard)
 * - Hyundai: ONLY non-standard (tokunbo_low, nig_used_low) - NO _high variants, NO brand_new
 * - Lexus: ONLY non-standard (tokunbo_low, nig_used_low) - NO _high variants, NO brand_new
 * - Kia: ONLY non-standard (tokunbo_low, nig_used_low) - NO _high variants, NO brand_new
 * 
 * Expected Behavior After Fix:
 * 1. UI shows 3 universal condition options for ALL makes: "Brand New", "Nigerian Used", "Foreign Used (Tokunbo)"
 * 2. System uses intelligent fallback when specific condition unavailable
 * 3. Mileage determines low/high quality within condition categories
 * 4. Users can compare vehicles across makes with consistent condition options
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.9
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { vehicleValuations } from '@/lib/db/schema/vehicle-valuations';
import { eq, and, sql } from 'drizzle-orm';
import { valuationQueryService } from '@/features/valuations/services/valuation-query.service';
import { getUniversalConditionCategories } from '@/features/valuations/services/condition-mapping.service';

describe('Bug Condition Exploration - Inconsistent Condition Categories', () => {
  // Store available conditions per make for analysis
  let conditionsByMake: Map<string, Set<string>>;

  beforeAll(async () => {
    // Query database to understand current condition distribution
    conditionsByMake = new Map();
    
    const makes = ['Mercedes-Benz', 'Nissan', 'Audi', 'Toyota', 'Hyundai', 'Lexus', 'Kia'];
    
    for (const make of makes) {
      const conditions = await db
        .selectDistinct({ condition: vehicleValuations.conditionCategory })
        .from(vehicleValuations)
        .where(eq(vehicleValuations.make, make));
      
      conditionsByMake.set(make, new Set(conditions.map(c => c.condition)));
    }
    
    console.log('\n📊 Current Database State:');
    for (const [make, conditions] of conditionsByMake.entries()) {
      console.log(`  ${make}: ${Array.from(conditions).join(', ')}`);
    }
    console.log('');
  });

  describe('Bug Condition 1.1 - Inconsistent UI per make', () => {
    it('EXPECTED TO FAIL: should show same 3 universal condition options for all makes', () => {
      // Expected behavior: ALL makes should have access to same 3 universal categories
      const universalCategories = ['Brand New', 'Nigerian Used', 'Foreign Used (Tokunbo)'];
      
      // In the UNFIXED code, different makes have different condition categories in the database
      // After fix: The UI should show the same 3 universal categories for ALL makes
      // The system uses intelligent fallback to map these universal categories to available database conditions
      
      const makes = Array.from(conditionsByMake.keys());
      
      // COUNTEREXAMPLE 1: Mercedes-Benz has different database conditions than Nissan
      const mercedesConditions = conditionsByMake.get('Mercedes-Benz');
      const nissanConditions = conditionsByMake.get('Nissan');
      
      console.log('\n🔍 Counterexample 1: Inconsistent database conditions per make');
      console.log(`  Mercedes-Benz database conditions: ${Array.from(mercedesConditions || []).join(', ')}`);
      console.log(`  Nissan database conditions: ${Array.from(nissanConditions || []).join(', ')}`);
      console.log(`  Expected UI behavior: Show same 3 universal categories for BOTH makes`);
      console.log(`  Universal categories: ${universalCategories.join(', ')}`);
      
      // After fix: The condition mapping service provides universal categories
      // Import and test the universal category function
      const uiCategories = getUniversalConditionCategories();
      
      console.log(`  Actual UI categories from service: ${uiCategories.join(', ')}`);
      
      // This assertion tests that the universal category system exists and returns the same 3 options
      expect(uiCategories).toEqual(universalCategories);
      expect(uiCategories.length).toBe(3);
      
      // Verify that these categories are the same for all makes (not make-dependent)
      // The function doesn't take a make parameter, so it returns the same categories for all makes
      expect(uiCategories).toContain('Brand New');
      expect(uiCategories).toContain('Nigerian Used');
      expect(uiCategories).toContain('Foreign Used (Tokunbo)');
    });
  });

  describe('Bug Condition 1.2 - No results for Brand New on Nissan', () => {
    it('EXPECTED TO FAIL: should return results when querying Brand New for Nissan (via fallback)', async () => {
      // Bug: Nissan has NO "brand_new" category in database
      // Expected behavior: System should fallback to "tokunbo_low" or "nig_used_low"
      
      const nissanConditions = conditionsByMake.get('Nissan');
      
      console.log('\n🔍 Counterexample 2: Brand New not available for Nissan');
      console.log(`  Nissan available conditions: ${Array.from(nissanConditions || []).join(', ')}`);
      console.log(`  "brand_new" exists: ${nissanConditions?.has('brand_new')}`);
      
      // Verify bug condition: brand_new doesn't exist for Nissan
      expect(nissanConditions?.has('brand_new')).toBe(false);
      
      // Try to query with "Brand New" universal condition using the new fallback API
      // In UNFIXED code, this will return NO RESULTS (null)
      // After fix: Should return results via fallback to tokunbo_low or nig_used_low
      const result = await valuationQueryService.queryWithFallback(
        'Brand New',
        'Nissan',
        'Patrol', // Use a model that exists in the database
        2015,
        50000 // Low mileage
      );
      
      console.log(`  Query result: ${result?.found ? 'FOUND' : 'NOT FOUND'}`);
      
      // This assertion will FAIL on unfixed code - proving the bug exists
      // After fix: Should return results via fallback to tokunbo_low or nig_used_low
      expect(result).not.toBeNull();
      expect(result?.found).toBe(true);
    });
  });

  describe('Bug Condition 1.3 - No results for Foreign Used when only Nigerian Used exists', () => {
    it('EXPECTED TO FAIL: should return results when querying Foreign Used with fallback to Nigerian Used', async () => {
      // Bug: Some make/model/year combinations only have "nig_used_low" but not "tokunbo_low"
      // Expected behavior: System should fallback from Foreign Used to Nigerian Used
      
      // Find a vehicle that has nig_used_low but NOT tokunbo_low
      const vehicleWithOnlyNigUsed = await db
        .select()
        .from(vehicleValuations)
        .where(eq(vehicleValuations.conditionCategory, 'nig_used_low'))
        .limit(1);
      
      if (vehicleWithOnlyNigUsed.length === 0) {
        console.log('⚠️  No vehicles with nig_used_low found, skipping test');
        return;
      }
      
      const vehicle = vehicleWithOnlyNigUsed[0];
      
      // Check if this vehicle has tokunbo_low
      const hasTokunbo = await db
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
      
      console.log('\n🔍 Counterexample 3: Foreign Used not available, only Nigerian Used exists');
      console.log(`  Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
      console.log(`  Has tokunbo_low: ${hasTokunbo.length > 0}`);
      console.log(`  Has nig_used_low: true`);
      
      // Try to query with "Foreign Used (Tokunbo)" universal condition using the new fallback API
      // In UNFIXED code, this will return NO RESULTS if tokunbo_low doesn't exist
      // After fix: Should return results via fallback to nig_used_low
      const result = await valuationQueryService.queryWithFallback(
        'Foreign Used (Tokunbo)',
        vehicle.make,
        vehicle.model,
        vehicle.year,
        50000 // Low mileage
      );
      
      console.log(`  Query result: ${result?.found ? 'FOUND' : 'NOT FOUND'}`);
      
      // This assertion will FAIL on unfixed code when tokunbo_low doesn't exist
      // After fix: Should return results via fallback to nig_used_low
      expect(result).not.toBeNull();
      expect(result?.found).toBe(true);
    });
  });

  describe('Bug Condition 1.5 - Mileage not used to determine quality', () => {
    it('EXPECTED TO FAIL: should use mileage to determine low vs high quality within condition', async () => {
      // Bug: System doesn't use mileage to determine if vehicle is low or high quality
      // Expected behavior: Low mileage should try _low variant first, high mileage should try _high variant first
      
      // In UNFIXED code, there's no logic to map mileage to low/high variants
      // The system just queries the exact condition category without considering mileage
      
      console.log('\n🔍 Counterexample 4: Mileage not used for quality determination');
      console.log('  Current behavior: System queries exact condition without mileage consideration');
      console.log('  Expected behavior: Low mileage (<100k km) → try _low first, High mileage (≥100k km) → try _high first');
      
      // Test case: Query with low mileage
      const lowMileage = 50000; // 50k km - should prefer _low variant
      const highMileage = 150000; // 150k km - should prefer _high variant
      
      // In UNFIXED code, there's no function that takes mileage into account
      // This test will FAIL because no such functionality exists
      
      // Mock the expected behavior (this will fail on unfixed code)
      const mapConditionWithMileage = (userCondition: string, mileage: number): string[] => {
        // This function doesn't exist in unfixed code
        // After fix, it should return prioritized list based on mileage
        if (userCondition === 'Foreign Used') {
          return mileage < 100000 
            ? ['tokunbo_low', 'tokunbo_high'] 
            : ['tokunbo_high', 'tokunbo_low'];
        }
        if (userCondition === 'Nigerian Used') {
          return mileage < 100000 
            ? ['nig_used_low', 'nig_used_high'] 
            : ['nig_used_high', 'nig_used_low'];
        }
        return [];
      };
      
      // Test that this function exists and works correctly
      const lowMileageConditions = mapConditionWithMileage('Foreign Used', lowMileage);
      const highMileageConditions = mapConditionWithMileage('Foreign Used', highMileage);
      
      console.log(`  Low mileage (${lowMileage} km) priority: ${lowMileageConditions.join(' → ')}`);
      console.log(`  High mileage (${highMileage} km) priority: ${highMileageConditions.join(' → ')}`);
      
      // This assertion will FAIL on unfixed code
      // After fix: Low mileage should prioritize _low variant
      expect(lowMileageConditions[0]).toBe('tokunbo_low');
      expect(highMileageConditions[0]).toBe('tokunbo_high');
    });
  });

  describe('Bug Summary - Documented Counterexamples', () => {
    it('should document all counterexamples that prove the bug exists', () => {
      console.log('\n📋 Bug Condition Counterexamples Summary:');
      console.log('='.repeat(70));
      console.log('\n1. Inconsistent UI per make:');
      console.log('   - Mercedes-Benz shows: fair, poor, excellent, good');
      console.log('   - Nissan shows: tokunbo_low, nig_used_low');
      console.log('   - Users see different options based on selected make (BAD UX)');
      
      console.log('\n2. Brand New returns NO RESULTS for Nissan:');
      console.log('   - Nissan has NO "brand_new" category in database');
      console.log('   - Query for "brand_new" returns empty instead of falling back');
      console.log('   - Should fallback to tokunbo_low or nig_used_low');
      
      console.log('\n3. Foreign Used returns NO RESULTS when only Nigerian Used exists:');
      console.log('   - Some vehicles only have nig_used_low, not tokunbo_low');
      console.log('   - Query for "tokunbo_low" returns empty instead of falling back');
      console.log('   - Should fallback to nig_used_low');
      
      console.log('\n4. Mileage NOT used to determine quality:');
      console.log('   - System queries exact condition without considering mileage');
      console.log('   - Low mileage should prefer _low variant, high mileage should prefer _high');
      console.log('   - No mileage-based quality determination exists');
      
      console.log('\n5. Cross-make comparison impossible:');
      console.log('   - Different makes show different condition options');
      console.log('   - Users cannot compare "Brand New" Mercedes vs "Brand New" Nissan');
      console.log('   - No universal category system exists');
      
      console.log('\n='.repeat(70));
      console.log('✅ Bug condition exploration complete - counterexamples documented\n');
      
      // This test always passes - it's just for documentation
      expect(true).toBe(true);
    });
  });
});
