#!/usr/bin/env tsx

/**
 * Test Universal Item System
 * 
 * Tests the new universal item adjustment system for vehicles, electronics, 
 * watches, appliances, artwork, and equipment.
 */

import { config } from 'dotenv';
config();

// Import the assessment service
import { assessDamageEnhanced } from '../src/features/cases/services/ai-assessment-enhanced.service';

async function testUniversalItemSystem() {
  console.log('🧪 Testing Universal Item System...\n');

  // Test 1: Vehicle (Toyota Camry 2022)
  console.log('=== Test 1: Vehicle (Toyota Camry 2022) ===');
  const vehicleResult = await assessDamageEnhanced({
    photos: ['data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='], // Minimal 1x1 pixel image
    vehicleInfo: {
      type: 'vehicle',
      make: 'Toyota',
      model: 'Camry',
      year: 2022,
      mileage: 50000, // 50K km
      condition: 'Foreign Used (Tokunbo)'
    }
  });
  
  console.log('Vehicle Assessment:', {
    salvageValue: vehicleResult.estimatedSalvageValue,
    repairCost: vehicleResult.estimatedRepairCost,
    damagePercentage: vehicleResult.damagePercentage,
    condition: vehicleResult.vehicleInfo?.condition
  });

  // Test 2: Electronics (iPhone 13)
  console.log('\n=== Test 2: Electronics (iPhone 13) ===');
  const electronicsResult = await assessDamageEnhanced({
    photos: ['data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='], // Minimal 1x1 pixel image
    vehicleInfo: {
      type: 'electronics',
      brand: 'Apple',
      model: 'iPhone 13',
      year: 2021,
      age: 3, // 3 years old
      storageCapacity: '256',
      batteryHealth: 85,
      condition: 'Nigerian Used',
      brandPrestige: 'premium'
    }
  });
  
  console.log('Electronics Assessment:', {
    salvageValue: electronicsResult.estimatedSalvageValue,
    repairCost: electronicsResult.estimatedRepairCost,
    damagePercentage: electronicsResult.damagePercentage
  });

  // Test 3: Watch (Rolex)
  console.log('\n=== Test 3: Watch (Luxury Automatic) ===');
  const watchResult = await assessDamageEnhanced({
    photos: ['data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='], // Minimal 1x1 pixel image
    vehicleInfo: {
      type: 'watch',
      brand: 'Rolex',
      model: 'Submariner',
      year: 2020,
      age: 4,
      movementType: 'automatic',
      condition: 'Brand New',
      brandPrestige: 'luxury'
    }
  });
  
  console.log('Watch Assessment:', {
    salvageValue: watchResult.estimatedSalvageValue,
    repairCost: watchResult.estimatedRepairCost,
    damagePercentage: watchResult.damagePercentage
  });

  // Test 4: Appliance (Refrigerator)
  console.log('\n=== Test 4: Appliance (Refrigerator) ===');
  const applianceResult = await assessDamageEnhanced({
    photos: ['data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='], // Minimal 1x1 pixel image
    vehicleInfo: {
      type: 'appliance',
      brand: 'Samsung',
      model: 'French Door',
      year: 2022,
      age: 2,
      condition: 'Foreign Used (Tokunbo)',
      brandPrestige: 'premium'
    }
  });
  
  console.log('Appliance Assessment:', {
    salvageValue: applianceResult.estimatedSalvageValue,
    repairCost: applianceResult.estimatedRepairCost,
    damagePercentage: applianceResult.damagePercentage
  });

  // Test 5: Artwork (Painting)
  console.log('\n=== Test 5: Artwork (Vintage Painting) ===');
  const artworkResult = await assessDamageEnhanced({
    photos: ['data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='], // Minimal 1x1 pixel image
    vehicleInfo: {
      type: 'artwork',
      description: 'Oil Painting',
      year: 2000,
      age: 24, // 24 years old (vintage)
      condition: 'Nigerian Used',
      brandPrestige: 'luxury'
    }
  });
  
  console.log('Artwork Assessment:', {
    salvageValue: artworkResult.estimatedSalvageValue,
    repairCost: artworkResult.estimatedRepairCost,
    damagePercentage: artworkResult.damagePercentage
  });

  // Test 6: Equipment (Generator)
  console.log('\n=== Test 6: Equipment (Generator) ===');
  const equipmentResult = await assessDamageEnhanced({
    photos: ['data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='], // Minimal 1x1 pixel image
    vehicleInfo: {
      type: 'equipment',
      brand: 'Honda',
      model: 'EU2200i',
      year: 2023,
      age: 1,
      condition: 'Brand New',
      brandPrestige: 'premium'
    }
  });
  
  console.log('Equipment Assessment:', {
    salvageValue: equipmentResult.estimatedSalvageValue,
    repairCost: equipmentResult.estimatedRepairCost,
    damagePercentage: equipmentResult.damagePercentage
  });

  // Test 7: Unknown Item Type (should only use condition adjustment)
  console.log('\n=== Test 7: Other/Unknown Item ===');
  const otherResult = await assessDamageEnhanced({
    photos: ['data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='], // Minimal 1x1 pixel image
    vehicleInfo: {
      type: 'other',
      description: 'Custom Item',
      condition: 'Heavily Used'
    }
  });
  
  console.log('Other Item Assessment:', {
    salvageValue: otherResult.estimatedSalvageValue,
    repairCost: otherResult.estimatedRepairCost,
    damagePercentage: otherResult.damagePercentage
  });

  console.log('\n✅ Universal Item System Test Complete!');
  console.log('\n📊 Summary:');
  console.log('- Vehicle: Uses mileage + condition adjustments');
  console.log('- Electronics: Uses age + battery + storage + condition adjustments');
  console.log('- Watch: Uses movement type + age + condition adjustments');
  console.log('- Appliance: Uses age + condition adjustments');
  console.log('- Artwork: Uses vintage bonus + condition adjustments');
  console.log('- Equipment: Uses age + condition adjustments');
  console.log('- Other: Uses only condition adjustments');
  console.log('\n🎯 All item types now supported universally!');
}

// Run the test
testUniversalItemSystem().catch(console.error);