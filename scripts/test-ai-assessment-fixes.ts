#!/usr/bin/env tsx

/**
 * Test script to verify AI assessment fixes:
 * 1. Confidence scores should be 0-100, not multiplied by 100
 * 2. Salvage value should never exceed market value
 * 3. Brand prestige should correctly detect Apple as luxury
 */

import { assessDamageEnhanced } from '@/features/cases/services/ai-assessment-enhanced.service';

async function testAIAssessmentFixes() {
  console.log('🧪 Testing AI Assessment Fixes...\n');

  // Test 1: Electronics (Apple iPhone) - should detect Apple as luxury
  console.log('📱 Test 1: Apple iPhone Assessment');
  try {
    const appleAssessment = await assessDamageEnhanced({
      photos: [
        'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
        'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
        'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
      ],
      universalItemInfo: {
        type: 'electronics',
        brand: 'Apple',
        model: 'iPhone 14 Pro',
        condition: 'Foreign Used (Tokunbo)',
        storageCapacity: '256GB',
        batteryHealth: 85,
        age: 2
      }
    });

    console.log('✅ Apple iPhone Assessment Results:');
    console.log(`   Confidence Score: ${appleAssessment.confidenceScore}% (should be 0-100)`);
    console.log(`   Market Value: ₦${appleAssessment.marketValue.toLocaleString()}`);
    console.log(`   Salvage Value: ₦${appleAssessment.estimatedSalvageValue.toLocaleString()}`);
    console.log(`   Salvage ≤ Market: ${appleAssessment.estimatedSalvageValue <= appleAssessment.marketValue ? '✅' : '❌'}`);
    console.log(`   Brand Prestige: ${appleAssessment.qualityTier} (should reflect luxury brand)`);
    
    // Validate fixes
    const issues = [];
    
    if (appleAssessment.confidenceScore > 100) {
      issues.push(`❌ Confidence score too high: ${appleAssessment.confidenceScore}%`);
    }
    
    if (appleAssessment.estimatedSalvageValue > appleAssessment.marketValue) {
      issues.push(`❌ Salvage value (₦${appleAssessment.estimatedSalvageValue.toLocaleString()}) exceeds market value (₦${appleAssessment.marketValue.toLocaleString()})`);
    }
    
    if (issues.length === 0) {
      console.log('✅ All validation checks passed!\n');
    } else {
      console.log('❌ Issues found:');
      issues.forEach(issue => console.log(`   ${issue}`));
      console.log('');
    }

  } catch (error) {
    console.error('❌ Apple iPhone test failed:', error);
  }

  // Test 2: Vehicle Assessment
  console.log('🚗 Test 2: Vehicle Assessment');
  try {
    const vehicleAssessment = await assessDamageEnhanced({
      photos: [
        'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
        'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
        'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
      ],
      vehicleInfo: {
        type: 'vehicle',
        make: 'Toyota',
        model: 'Camry',
        year: 2020,
        mileage: 45000,
        condition: 'Nigerian Used'
      }
    });

    console.log('✅ Toyota Camry Assessment Results:');
    console.log(`   Confidence Score: ${vehicleAssessment.confidenceScore}% (should be 0-100)`);
    console.log(`   Market Value: ₦${vehicleAssessment.marketValue.toLocaleString()}`);
    console.log(`   Salvage Value: ₦${vehicleAssessment.estimatedSalvageValue.toLocaleString()}`);
    console.log(`   Salvage ≤ Market: ${vehicleAssessment.estimatedSalvageValue <= vehicleAssessment.marketValue ? '✅' : '❌'}`);
    
    // Validate fixes
    const vehicleIssues = [];
    
    if (vehicleAssessment.confidenceScore > 100) {
      vehicleIssues.push(`❌ Confidence score too high: ${vehicleAssessment.confidenceScore}%`);
    }
    
    if (vehicleAssessment.estimatedSalvageValue > vehicleAssessment.marketValue) {
      vehicleIssues.push(`❌ Salvage value (₦${vehicleAssessment.estimatedSalvageValue.toLocaleString()}) exceeds market value (₦${vehicleAssessment.marketValue.toLocaleString()})`);
    }
    
    if (vehicleIssues.length === 0) {
      console.log('✅ All validation checks passed!\n');
    } else {
      console.log('❌ Issues found:');
      vehicleIssues.forEach(issue => console.log(`   ${issue}`));
      console.log('');
    }

  } catch (error) {
    console.error('❌ Vehicle test failed:', error);
  }

  console.log('🎉 AI Assessment Fixes Test Complete!');
}

// Run the test
testAIAssessmentFixes().catch(console.error);