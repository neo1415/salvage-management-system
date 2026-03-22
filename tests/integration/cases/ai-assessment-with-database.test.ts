/**
 * Integration Test: AI Assessment with Valuation Database
 * 
 * Tests that the AI assessment service correctly integrates with the valuation database
 * and damage calculation service.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db';
import { vehicleValuations, damageDeductions } from '@/lib/db/schema/vehicle-valuations';
import { assessDamageEnhanced } from '@/features/cases/services/ai-assessment-enhanced.service';
import { eq, and } from 'drizzle-orm';

describe('AI Assessment with Valuation Database Integration', () => {
  const testUserId = '00000000-0000-0000-0000-000000000001';
  const testValuationIds: string[] = [];
  const testDeductionIds: string[] = [];

  beforeAll(async () => {
    // Insert test valuation data
    const valuation = await db.insert(vehicleValuations).values({
      make: 'Toyota',
      model: 'Camry',
      year: 2020,
      conditionCategory: 'average',
      lowPrice: '8000000',
      highPrice: '9000000',
      averagePrice: '8500000',
      mileageLow: 50000,
      mileageHigh: 80000,
      marketNotes: 'Test valuation for integration test',
      dataSource: 'test',
      createdBy: testUserId,
    }).returning({ id: vehicleValuations.id });

    testValuationIds.push(valuation[0].id);

    // Insert test damage deduction data
    const deductions = await db.insert(damageDeductions).values([
      {
        component: 'engine',
        damageLevel: 'minor',
        repairCostEstimate: '200000',
        valuationDeductionPercent: '0.05',
        description: 'Minor engine damage',
        createdBy: testUserId,
      },
      {
        component: 'engine',
        damageLevel: 'moderate',
        repairCostEstimate: '500000',
        valuationDeductionPercent: '0.15',
        description: 'Moderate engine damage',
        createdBy: testUserId,
      },
      {
        component: 'body',
        damageLevel: 'minor',
        repairCostEstimate: '150000',
        valuationDeductionPercent: '0.03',
        description: 'Minor body damage',
        createdBy: testUserId,
      },
      {
        component: 'structure',
        damageLevel: 'severe',
        repairCostEstimate: '2000000',
        valuationDeductionPercent: '0.40',
        description: 'Severe structural damage',
        createdBy: testUserId,
      },
    ]).returning({ id: damageDeductions.id });

    testDeductionIds.push(...deductions.map(d => d.id));
  });

  afterAll(async () => {
    // Clean up test data
    for (const id of testDeductionIds) {
      await db.delete(damageDeductions).where(eq(damageDeductions.id, id));
    }
    for (const id of testValuationIds) {
      await db.delete(vehicleValuations).where(eq(vehicleValuations.id, id));
    }
  });

  it('should query database for base price before scraping (Requirement 6.1)', async () => {
    // Mock photos (will use MOCK_MODE)
    process.env.MOCK_AI_ASSESSMENT = 'true';
    
    const photos = ['data:image/jpeg;base64,/9j/4AAQSkZJRg=='];
    
    const assessment = await assessDamageEnhanced({
      photos,
      vehicleInfo: {
        make: 'Toyota',
        model: 'Camry',
        year: 2020,
      },
    });

    // Should use database price
    expect(assessment.marketValue).toBe(8500000);
    expect(assessment.priceSource).toBe('database');
  });

  it('should apply damage deductions correctly (Requirement 6.2)', async () => {
    process.env.MOCK_AI_ASSESSMENT = 'true';
    
    const photos = ['data:image/jpeg;base64,/9j/4AAQSkZJRg=='];
    
    const assessment = await assessDamageEnhanced({
      photos,
      vehicleInfo: {
        make: 'Toyota',
        model: 'Camry',
        year: 2020,
      },
    });

    // Should have damage breakdown
    expect(assessment.damageBreakdown).toBeDefined();
    expect(assessment.damageBreakdown!.length).toBeGreaterThan(0);
    
    // Salvage value should be less than market value
    expect(assessment.estimatedSalvageValue).toBeLessThan(assessment.marketValue);
  });

  it('should include breakdown in result (Requirement 6.3)', async () => {
    process.env.MOCK_AI_ASSESSMENT = 'true';
    
    const photos = ['data:image/jpeg;base64,/9j/4AAQSkZJRg=='];
    
    const assessment = await assessDamageEnhanced({
      photos,
      vehicleInfo: {
        make: 'Toyota',
        model: 'Camry',
        year: 2020,
      },
    });

    // Should have damage breakdown with required fields
    expect(assessment.damageBreakdown).toBeDefined();
    if (assessment.damageBreakdown && assessment.damageBreakdown.length > 0) {
      const breakdown = assessment.damageBreakdown[0];
      expect(breakdown).toHaveProperty('component');
      expect(breakdown).toHaveProperty('damageLevel');
      expect(breakdown).toHaveProperty('repairCost');
      expect(breakdown).toHaveProperty('deductionPercent');
      expect(breakdown).toHaveProperty('deductionAmount');
    }
    
    // Should have total loss indicator
    expect(assessment.isTotalLoss).toBeDefined();
    expect(typeof assessment.isTotalLoss).toBe('boolean');
    
    // Should have price source indicator
    expect(assessment.priceSource).toBeDefined();
    expect(['database', 'user_provided', 'scraping', 'estimated']).toContain(assessment.priceSource);
  });

  it('should fallback to existing logic when database unavailable (Requirement 6.4)', async () => {
    process.env.MOCK_AI_ASSESSMENT = 'true';
    
    const photos = ['data:image/jpeg;base64,/9j/4AAQSkZJRg=='];
    
    // Use a vehicle not in database
    const assessment = await assessDamageEnhanced({
      photos,
      vehicleInfo: {
        make: 'Honda',
        model: 'Accord',
        year: 2019,
      },
    });

    // Should still return valid assessment
    expect(assessment.marketValue).toBeGreaterThan(0);
    expect(assessment.estimatedSalvageValue).toBeGreaterThan(0);
    
    // Price source should not be 'database'
    expect(assessment.priceSource).not.toBe('database');
  });

  it('should maintain backward compatibility (Requirement 6.5)', async () => {
    process.env.MOCK_AI_ASSESSMENT = 'true';
    
    const photos = ['data:image/jpeg;base64,/9j/4AAQSkZJRg=='];
    
    // Call without vehicle info (old behavior)
    const assessment = await assessDamageEnhanced({
      photos,
    });

    // Should still return valid assessment with all required fields
    expect(assessment).toHaveProperty('labels');
    expect(assessment).toHaveProperty('confidenceScore');
    expect(assessment).toHaveProperty('damagePercentage');
    expect(assessment).toHaveProperty('damageSeverity');
    expect(assessment).toHaveProperty('marketValue');
    expect(assessment).toHaveProperty('estimatedSalvageValue');
    expect(assessment).toHaveProperty('reservePrice');
    expect(assessment).toHaveProperty('isRepairable');
    expect(assessment).toHaveProperty('recommendation');
    
    // Should have positive values
    expect(assessment.marketValue).toBeGreaterThan(0);
    expect(assessment.estimatedSalvageValue).toBeGreaterThan(0);
  });
});
