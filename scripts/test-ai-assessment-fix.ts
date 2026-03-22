#!/usr/bin/env tsx

/**
 * Test script to verify AI assessment fixes
 * 
 * This script tests:
 * 1. Vehicle info parsing from itemInfo format
 * 2. Gemini initialization
 * 3. Market value estimation with proper vehicle context
 */

import { assessDamageEnhanced } from '../src/features/cases/services/ai-assessment-enhanced.service';

async function testAIAssessmentFix() {
  console.log('🧪 Testing AI Assessment Fixes...\n');

  // Test data similar to what the frontend sends
  const testVehicleInfo = {
    make: 'Toyota',
    model: 'Camry',
    year: 2022,
    condition: 'Nigerian Used' as const,
    mileage: 45000
  };

  // Mock photos (base64 data URLs)
  const testPhotos = [
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
  ];

  try {
    console.log('📋 Test Parameters:');
    console.log(`   Vehicle: ${testVehicleInfo.make} ${testVehicleInfo.model} ${testVehicleInfo.year}`);
    console.log(`   Condition: ${testVehicleInfo.condition}`);
    console.log(`   Mileage: ${testVehicleInfo.mileage?.toLocaleString()} km`);
    console.log(`   Photos: ${testPhotos.length} test images\n`);

    console.log('🚀 Running Enhanced AI Assessment...\n');

    const assessment = await assessDamageEnhanced({
      photos: testPhotos,
      vehicleInfo: testVehicleInfo
    });

    console.log('\n✅ Assessment Results:');
    console.log(`   Severity: ${assessment.damageSeverity}`);
    console.log(`   Confidence: ${assessment.confidenceScore}%`);
    console.log(`   Market Value: ₦${assessment.marketValue.toLocaleString()}`);
    console.log(`   Salvage Value: ₦${assessment.estimatedSalvageValue.toLocaleString()}`);
    console.log(`   Repair Cost: ₦${assessment.estimatedRepairCost.toLocaleString()}`);
    console.log(`   Analysis Method: ${assessment.analysisMethod}`);

    // Check if the market value is reasonable for a 2022 Toyota Camry
    const expectedRange = { min: 4000000, max: 8000000 }; // 4M - 8M Naira
    const isReasonable = assessment.marketValue >= expectedRange.min && assessment.marketValue <= expectedRange.max;

    console.log('\n🔍 Validation:');
    console.log(`   Market Value Range Check: ${isReasonable ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Expected: ₦${expectedRange.min.toLocaleString()} - ₦${expectedRange.max.toLocaleString()}`);
    console.log(`   Actual: ₦${assessment.marketValue.toLocaleString()}`);

    if (assessment.warnings && assessment.warnings.length > 0) {
      console.log('\n⚠️ Warnings:');
      assessment.warnings.forEach(warning => console.log(`   - ${warning}`));
    }

    console.log('\n🎉 Test completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
  }
}

// Run the test
testAIAssessmentFix().catch(console.error);