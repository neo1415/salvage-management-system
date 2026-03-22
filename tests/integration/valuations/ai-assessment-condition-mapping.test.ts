/**
 * Integration Test: AI Assessment with Condition Mapping
 * 
 * Verifies that the AI assessment service correctly integrates with the condition mapping service
 * to query valuations using universal conditions with intelligent fallback logic.
 * 
 * Requirements: 2.5, 2.6, 2.7, 2.8, 3.4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { vehicleValuations } from '@/lib/db/schema/vehicle-valuations';
import { users } from '@/lib/db/schema/users';
import { eq, and } from 'drizzle-orm';
import { assessDamageEnhanced } from '@/features/cases/services/ai-assessment-enhanced.service';

describe.sequential('AI Assessment - Condition Mapping Integration', () => {
  let testUserId: string;

  beforeEach(async () => {
    // Create a test user for foreign key constraint
    testUserId = '00000000-0000-0000-0000-000000000099';
    await db.insert(users).values({
      id: testUserId,
      email: 'test-ai-assessment@example.com',
      fullName: 'Test AI Assessment User',
      phone: '+2341234567890',
      passwordHash: 'test-hash',
      role: 'claims_adjuster',
      status: 'verified_tier_1',
      dateOfBirth: new Date('1990-01-01'),
    }).onConflictDoNothing();
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(vehicleValuations).where(
      and(
        eq(vehicleValuations.make, 'TestMake'),
        eq(vehicleValuations.model, 'TestModel')
      )
    );
    await db.delete(users).where(eq(users.id, testUserId));
  });

  it('should use queryWithFallback when universal condition is provided', async () => {
    // Insert test valuation data with only nig_used_low condition
    await db.insert(vehicleValuations).values({
      make: 'TestMake',
      model: 'TestModel',
      year: 2020,
      conditionCategory: 'nig_used_low',
      averagePrice: 5000000,
      minPrice: 4500000,
      maxPrice: 5500000,
      sampleSize: 10,
      lastUpdated: new Date(),
      createdBy: testUserId,
    });

    // Mock photos (base64 data URLs)
    const mockPhotos = [
      'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    ];

    // Call AI assessment with universal condition "Foreign Used (Tokunbo)"
    // This should fallback to "Nigerian Used" → nig_used_low
    const assessment = await assessDamageEnhanced({
      photos: mockPhotos,
      vehicleInfo: {
        make: 'TestMake',
        model: 'TestModel',
        year: 2020,
        mileage: 80000, // Low mileage
        condition: 'Foreign Used (Tokunbo)', // Universal condition
      },
    });

    // Verify assessment was successful
    expect(assessment).toBeDefined();
    expect(assessment.marketValue).toBeGreaterThan(0);
    expect(assessment.priceSource).toBe('database');
    
    // The market value should be from the database (nig_used_low fallback)
    expect(assessment.marketValue).toBe(5000000);
  });

  it('should handle null response when all conditions exhausted', async () => {
    // No valuation data inserted - all conditions should be exhausted

    const mockPhotos = [
      'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    ];

    // Call AI assessment with universal condition
    const assessment = await assessDamageEnhanced({
      photos: mockPhotos,
      vehicleInfo: {
        make: 'NonExistentMake',
        model: 'NonExistentModel',
        year: 2020,
        mileage: 80000,
        condition: 'Brand New', // Universal condition
      },
    });

    // Should fallback to scraping or estimation
    expect(assessment).toBeDefined();
    expect(assessment.priceSource).not.toBe('database');
    expect(['scraping', 'estimated']).toContain(assessment.priceSource);
  });

  it('should use mileage to determine low vs high quality', async () => {
    // Insert both tokunbo_low and tokunbo_high
    await db.insert(vehicleValuations).values([
      {
        make: 'TestMake',
        model: 'TestModel',
        year: 2020,
        conditionCategory: 'tokunbo_low',
        averagePrice: 6000000,
        minPrice: 5500000,
        maxPrice: 6500000,
        sampleSize: 10,
        lastUpdated: new Date(),
        createdBy: testUserId,
      },
      {
        make: 'TestMake',
        model: 'TestModel',
        year: 2020,
        conditionCategory: 'tokunbo_high',
        averagePrice: 5500000,
        minPrice: 5000000,
        maxPrice: 6000000,
        sampleSize: 10,
        lastUpdated: new Date(),
        createdBy: testUserId,
      },
    ]);

    const mockPhotos = [
      'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    ];

    // Test with low mileage (< 100,000 km) - should prioritize tokunbo_low
    const lowMileageAssessment = await assessDamageEnhanced({
      photos: mockPhotos,
      vehicleInfo: {
        make: 'TestMake',
        model: 'TestModel',
        year: 2020,
        mileage: 50000, // Low mileage
        condition: 'Foreign Used (Tokunbo)',
      },
    });

    expect(lowMileageAssessment.marketValue).toBe(6000000); // tokunbo_low

    // Test with high mileage (>= 100,000 km) - should prioritize tokunbo_high
    const highMileageAssessment = await assessDamageEnhanced({
      photos: mockPhotos,
      vehicleInfo: {
        make: 'TestMake',
        model: 'TestModel',
        year: 2020,
        mileage: 150000, // High mileage
        condition: 'Foreign Used (Tokunbo)',
      },
    });

    expect(highMileageAssessment.marketValue).toBe(5500000); // tokunbo_high
  });

  it('should continue to work with legacy conditions', async () => {
    // Insert test valuation data with legacy condition
    await db.insert(vehicleValuations).values({
      make: 'TestMake',
      model: 'TestModel',
      year: 2020,
      conditionCategory: 'good',
      averagePrice: 5500000,
      minPrice: 5000000,
      maxPrice: 6000000,
      sampleSize: 10,
      lastUpdated: new Date(),
      createdBy: testUserId,
    });

    const mockPhotos = [
      'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    ];

    // Call AI assessment with legacy condition
    const assessment = await assessDamageEnhanced({
      photos: mockPhotos,
      vehicleInfo: {
        make: 'TestMake',
        model: 'TestModel',
        year: 2020,
        mileage: 80000,
        condition: 'good', // Legacy condition
      },
    });

    // Verify assessment was successful
    expect(assessment).toBeDefined();
    expect(assessment.marketValue).toBeGreaterThan(0);
    expect(assessment.priceSource).toBe('database');
    
    // Should use the legacy condition directly
    expect(assessment.marketValue).toBeGreaterThanOrEqual(5000000);
    expect(assessment.marketValue).toBeLessThanOrEqual(6000000);
  });

  it('should ensure damage deduction calculations continue to work', async () => {
    // Insert test valuation data
    await db.insert(vehicleValuations).values({
      make: 'TestMake',
      model: 'TestModel',
      year: 2020,
      conditionCategory: 'tokunbo_low',
      averagePrice: 6000000,
      minPrice: 5500000,
      maxPrice: 6500000,
      sampleSize: 10,
      lastUpdated: new Date(),
      createdBy: testUserId,
    });

    const mockPhotos = [
      'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    ];

    // Call AI assessment
    const assessment = await assessDamageEnhanced({
      photos: mockPhotos,
      vehicleInfo: {
        make: 'TestMake',
        model: 'TestModel',
        year: 2020,
        mileage: 80000,
        condition: 'Foreign Used (Tokunbo)',
      },
    });

    // Verify damage calculations are present
    expect(assessment.estimatedRepairCost).toBeDefined();
    expect(assessment.estimatedSalvageValue).toBeDefined();
    expect(assessment.reservePrice).toBeDefined();
    expect(assessment.damageSeverity).toBeDefined();
    
    // Salvage value should be less than market value (due to damage)
    expect(assessment.estimatedSalvageValue).toBeLessThanOrEqual(assessment.marketValue);
    
    // Reserve price should be ~70% of salvage value
    const expectedReserve = assessment.estimatedSalvageValue * 0.7;
    expect(assessment.reservePrice).toBeCloseTo(expectedReserve, -2); // Within 100
  });
});
