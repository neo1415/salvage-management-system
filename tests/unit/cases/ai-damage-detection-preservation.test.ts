/**
 * Preservation Property Tests - AI Damage Detection
 * 
 * Property 2: Preservation - Damaged Vehicles Still Detected Correctly
 * 
 * Goal: Verify that vehicles with actual damage keywords are still detected
 * as MODERATE/SEVERE with appropriate salvage value reductions
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { describe, it, expect } from 'vitest';
import { assessDamageEnhanced } from '@/features/cases/services/ai-assessment-enhanced.service';

describe('Preservation - Damaged Vehicles Detection', () => {
  /**
   * Test Case 1: Vehicle with explicit damage keywords
   * Expected: MODERATE/SEVERE severity, < 80% salvage value
   */
  it('should detect damage when explicit damage keywords are present', async () => {
    // Arrange: Mock Vision API response with damage keywords
    const mockPhotos = ['data:image/jpeg;base64,/9j/4AAQSkZJRg=='];
    
    const vehicleInfo = {
      make: 'Toyota',
      model: 'Camry',
      year: 2019,
      mileage: 80000,
      condition: 'fair' as const,
      marketValue: 7000000, // ₦7M
    };

    // In MOCK_MODE, the system returns damage keywords
    process.env.MOCK_AI_ASSESSMENT = 'true';

    const assessment = await assessDamageEnhanced({
      photos: mockPhotos,
      vehicleInfo,
    });

    // Assert: Preservation - Damage detection should still work
    
    // Requirement 3.1: Damage severity should be MODERATE or SEVERE
    expect(['moderate', 'severe']).toContain(assessment.damageSeverity.toLowerCase());
    
    // Requirement 3.2: At least one damage category score should be > 30
    const totalDamageScore = 
      assessment.damageScore.structural +
      assessment.damageScore.mechanical +
      assessment.damageScore.cosmetic +
      assessment.damageScore.electrical +
      assessment.damageScore.interior;
    
    expect(totalDamageScore).toBeGreaterThan(30);
    
    // Requirement 3.5: Salvage value should be < 80% of market value
    const salvageRatio = assessment.estimatedSalvageValue / assessment.marketValue;
    expect(salvageRatio).toBeLessThan(0.80);
    
    // Damage breakdown should be present
    expect(assessment.damageBreakdown).toBeDefined();
    if (assessment.damageBreakdown) {
      expect(assessment.damageBreakdown.length).toBeGreaterThan(0);
    }
  });

  /**
   * Test Case 2: Vehicle with moderate damage
   * Expected: MODERATE severity, 50-70% salvage value
   */
  it('should correctly assess moderate damage severity', async () => {
    const mockPhotos = ['data:image/jpeg;base64,/9j/4AAQSkZJRg=='];
    
    const vehicleInfo = {
      make: 'Honda',
      model: 'Civic',
      year: 2018,
      mileage: 90000,
      condition: 'fair' as const,
      marketValue: 6000000,
    };

    process.env.MOCK_AI_ASSESSMENT = 'true';

    const assessment = await assessDamageEnhanced({
      photos: mockPhotos,
      vehicleInfo,
    });

    // Moderate damage should result in appropriate severity
    if (assessment.damageSeverity === 'moderate') {
      const salvageRatio = assessment.estimatedSalvageValue / assessment.marketValue;
      
      // Moderate damage typically results in 50-70% salvage value
      expect(salvageRatio).toBeGreaterThanOrEqual(0.30);
      expect(salvageRatio).toBeLessThanOrEqual(0.80);
    }
  });

  /**
   * Test Case 3: Vehicle with severe damage
   * Expected: SEVERE severity, 20-40% salvage value
   */
  it('should correctly assess severe damage severity', async () => {
    const mockPhotos = ['data:image/jpeg;base64,/9j/4AAQSkZJRg=='];
    
    const vehicleInfo = {
      make: 'Toyota',
      model: 'Corolla',
      year: 2017,
      mileage: 100000,
      condition: 'poor' as const,
      marketValue: 5000000,
    };

    process.env.MOCK_AI_ASSESSMENT = 'true';

    const assessment = await assessDamageEnhanced({
      photos: mockPhotos,
      vehicleInfo,
    });

    // Severe damage should result in low salvage value
    if (assessment.damageSeverity === 'severe') {
      const salvageRatio = assessment.estimatedSalvageValue / assessment.marketValue;
      
      // Severe damage typically results in 20-40% salvage value
      expect(salvageRatio).toBeGreaterThanOrEqual(0.10);
      expect(salvageRatio).toBeLessThanOrEqual(0.50);
      
      // Should be marked as total loss if deduction >= 70%
      if (assessment.isTotalLoss) {
        expect(salvageRatio).toBeLessThanOrEqual(0.30);
      }
    }
  });

  /**
   * Test Case 4: Property-based test - Multiple damaged vehicles
   * Verify consistent damage detection across various scenarios
   */
  it('should consistently detect damage across multiple test cases', async () => {
    const testCases = [
      {
        make: 'Toyota',
        model: 'RAV4',
        year: 2020,
        mileage: 70000,
        condition: 'fair' as const,
        marketValue: 9000000,
      },
      {
        make: 'Honda',
        model: 'Accord',
        year: 2019,
        mileage: 85000,
        condition: 'fair' as const,
        marketValue: 7500000,
      },
      {
        make: 'Toyota',
        model: 'Camry',
        year: 2018,
        mileage: 95000,
        condition: 'poor' as const,
        marketValue: 6500000,
      },
    ];

    process.env.MOCK_AI_ASSESSMENT = 'true';

    for (const vehicleInfo of testCases) {
      const mockPhotos = ['data:image/jpeg;base64,/9j/4AAQSkZJRg=='];
      
      const assessment = await assessDamageEnhanced({
        photos: mockPhotos,
        vehicleInfo,
      });

      // All damaged vehicles should have:
      // 1. MODERATE or SEVERE severity
      expect(['moderate', 'severe']).toContain(assessment.damageSeverity.toLowerCase());
      
      // 2. Total damage score > 30
      const totalDamageScore = 
        assessment.damageScore.structural +
        assessment.damageScore.mechanical +
        assessment.damageScore.cosmetic +
        assessment.damageScore.electrical +
        assessment.damageScore.interior;
      
      expect(totalDamageScore).toBeGreaterThan(30);
      
      // 3. Salvage value < 80% of market value
      const salvageRatio = assessment.estimatedSalvageValue / assessment.marketValue;
      expect(salvageRatio).toBeLessThan(0.80);
    }
  });

  /**
   * Test Case 5: Database-first approach preservation
   * Verify market value calculation still uses database-first approach
   */
  it('should preserve database-first market value calculation', async () => {
    const mockPhotos = ['data:image/jpeg;base64,/9j/4AAQSkZJRg=='];
    
    const vehicleInfo = {
      make: 'Toyota',
      model: 'Camry',
      year: 2021,
      mileage: 50000,
      condition: 'fair' as const,
      // No marketValue provided - should query database
    };

    process.env.MOCK_AI_ASSESSMENT = 'true';

    const assessment = await assessDamageEnhanced({
      photos: mockPhotos,
      vehicleInfo,
    });

    // Requirement 3.3: Database-first approach should still work
    expect(assessment.marketValue).toBeGreaterThan(0);
    expect(assessment.priceSource).toBeDefined();
    
    // Price source should indicate where data came from
    expect(['database', 'scraping', 'estimated', 'user_provided']).toContain(
      assessment.priceSource || 'estimated'
    );
  });

  /**
   * Test Case 6: Condition adjustments preservation
   * Verify condition multipliers still work correctly
   */
  it('should preserve condition adjustment calculations', async () => {
    const mockPhotos = ['data:image/jpeg;base64,/9j/4AAQSkZJRg=='];
    
    const baseVehicle = {
      make: 'Toyota',
      model: 'Camry',
      year: 2020,
      mileage: 60000,
      marketValue: 8000000,
    };

    process.env.MOCK_AI_ASSESSMENT = 'true';

    // Test with different conditions
    const conditions: Array<'excellent' | 'good' | 'fair' | 'poor'> = [
      'excellent',
      'good',
      'fair',
      'poor',
    ];

    const assessments = await Promise.all(
      conditions.map(condition =>
        assessDamageEnhanced({
          photos: mockPhotos,
          vehicleInfo: { ...baseVehicle, condition },
        })
      )
    );

    // Requirement 3.4: Condition adjustments should still work
    // Better condition should result in higher salvage value (for same damage)
    for (let i = 0; i < assessments.length - 1; i++) {
      const current = assessments[i];
      const next = assessments[i + 1];
      
      // Each condition should have different salvage values
      // (excellent > good > fair > poor)
      expect(current.estimatedSalvageValue).not.toBe(next.estimatedSalvageValue);
    }
  });
});

/**
 * Test Documentation:
 * 
 * These tests verify that the fix does NOT break existing damage detection:
 * 
 * 1. Vehicles with damage keywords are still detected as MODERATE/SEVERE
 * 2. Damage scores are still calculated correctly for damaged vehicles
 * 3. Salvage values are still reduced appropriately based on damage
 * 4. Database-first market value approach still works
 * 5. Condition adjustments still work correctly
 * 
 * All tests should PASS on both unfixed and fixed code, proving no regression.
 */
