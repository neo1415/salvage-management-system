#!/usr/bin/env tsx

/**
 * Test Internet Search Integration
 * 
 * This script tests the integration between the market data service
 * and the new internet search system.
 */

import { getMarketPrice } from '../src/features/market-data/services/market-data.service';
import { assessDamageEnhanced } from '../src/features/cases/services/ai-assessment-enhanced.service';
import type { PropertyIdentifier } from '../src/features/market-data/types';

async function testMarketDataIntegration() {
  console.log('🧪 Testing Market Data Service Integration...\n');

  // Test 1: Vehicle search (should use database first, then internet search)
  console.log('📋 Test 1: Vehicle Market Price Search');
  const vehicleProperty: PropertyIdentifier = {
    type: 'vehicle',
    make: 'Toyota',
    model: 'Camry',
    year: 2020
  };

  try {
    const vehicleResult = await getMarketPrice(vehicleProperty);
    console.log('✅ Vehicle search result:', {
      median: vehicleResult.median,
      count: vehicleResult.count,
      confidence: vehicleResult.confidence,
      dataSource: vehicleResult.dataSource,
      isFresh: vehicleResult.isFresh
    });
  } catch (error) {
    console.error('❌ Vehicle search failed:', error);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 2: Electronics search (should use internet search directly)
  console.log('📋 Test 2: Electronics Market Price Search');
  const electronicsProperty: PropertyIdentifier = {
    type: 'electronics',
    brand: 'Samsung',
    productModel: 'Galaxy S21'
  };

  try {
    const electronicsResult = await getMarketPrice(electronicsProperty);
    console.log('✅ Electronics search result:', {
      median: electronicsResult.median,
      count: electronicsResult.count,
      confidence: electronicsResult.confidence,
      dataSource: electronicsResult.dataSource,
      isFresh: electronicsResult.isFresh
    });
  } catch (error) {
    console.error('❌ Electronics search failed:', error);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 3: Property search (should use internet search directly)
  console.log('📋 Test 3: Property Market Price Search');
  const propertyProperty: PropertyIdentifier = {
    type: 'building',
    location: 'Lagos',
    propertyType: 'apartment',
    bedrooms: 3
  };

  try {
    const propertyResult = await getMarketPrice(propertyProperty);
    console.log('✅ Property search result:', {
      median: propertyResult.median,
      count: propertyResult.count,
      confidence: propertyResult.confidence,
      dataSource: propertyResult.dataSource,
      isFresh: propertyResult.isFresh
    });
  } catch (error) {
    console.error('❌ Property search failed:', error);
  }
}

async function testAIAssessmentIntegration() {
  console.log('\n' + '='.repeat(60) + '\n');
  console.log('🤖 Testing AI Assessment Service Integration...\n');

  // Test enhanced AI assessment with internet search integration
  console.log('📋 Test: Enhanced AI Assessment with Internet Search');
  
  const mockPhotos = [
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
  ];

  const vehicleInfo = {
    make: 'Toyota',
    model: 'Camry',
    year: 2020,
    mileage: 50000,
    condition: 'good' as const
  };

  try {
    const assessment = await assessDamageEnhanced({
      photos: mockPhotos,
      vehicleInfo
    });

    console.log('✅ AI Assessment result:', {
      marketValue: assessment.marketValue,
      estimatedSalvageValue: assessment.estimatedSalvageValue,
      confidence: assessment.confidenceScore,
      priceSource: assessment.priceSource,
      qualityTier: assessment.qualityTier,
      damageBreakdown: assessment.damageBreakdown?.length || 0
    });
  } catch (error) {
    console.error('❌ AI Assessment failed:', error);
  }
}

async function main() {
  console.log('🚀 Starting Internet Search Integration Tests\n');
  
  try {
    await testMarketDataIntegration();
    await testAIAssessmentIntegration();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ All integration tests completed!');
    console.log('📊 Check the results above to verify internet search integration');
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}