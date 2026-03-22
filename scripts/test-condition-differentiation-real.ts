#!/usr/bin/env tsx

/**
 * Real-world test for condition differentiation
 * Tests the actual market data service with different conditions
 */

import { getMarketPrice } from '../src/features/market-data/services/market-data.service';
import type { PropertyIdentifier } from '../src/features/market-data/types';

async function testConditionDifferentiation() {
  console.log('🧪 Testing Real Condition Differentiation\n');
  
  const baseVehicle = {
    type: 'vehicle' as const,
    make: 'Lamborghini',
    model: 'Revuelto',
    year: 2023,
    mileage: 50000
  };
  
  const conditions = [
    'Brand New',
    'Foreign Used (Tokunbo)', 
    'Nigerian Used',
    'Heavily Used'
  ];
  
  console.log('='.repeat(80));
  console.log('REAL MARKET DATA SERVICE TEST');
  console.log('='.repeat(80));
  console.log(`Vehicle: ${baseVehicle.make} ${baseVehicle.model} ${baseVehicle.year}`);
  console.log(`Mileage: ${baseVehicle.mileage.toLocaleString()} km\n`);
  
  const results = [];
  
  for (const condition of conditions) {
    console.log(`Testing condition: ${condition}`);
    console.log('-'.repeat(40));
    
    try {
      const property: PropertyIdentifier = {
        ...baseVehicle,
        condition
      };
      
      const marketPrice = await getMarketPrice(property);
      
      results.push({
        condition,
        median: marketPrice.median,
        confidence: marketPrice.confidence,
        dataSource: marketPrice.dataSource,
        count: marketPrice.count,
        success: true
      });
      
      console.log(`✅ Success:`);
      console.log(`   Median Price: ₦${marketPrice.median.toLocaleString()}`);
      console.log(`   Data Source: ${marketPrice.dataSource}`);
      console.log(`   Confidence: ${Math.round(marketPrice.confidence * 100)}%`);
      console.log(`   Sources: ${marketPrice.count}`);
      console.log('');
      
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
      results.push({
        condition,
        success: false,
        error: error.message
      });
      console.log('');
    }
  }
  
  // Analyze results
  console.log('='.repeat(80));
  console.log('CONDITION DIFFERENTIATION ANALYSIS');
  console.log('='.repeat(80));
  
  const successfulResults = results.filter(r => r.success);
  
  if (successfulResults.length < 2) {
    console.log('❌ Not enough successful results to analyze differentiation');
    return;
  }
  
  console.log('\n📊 Price Comparison:');
  console.log('-'.repeat(60));
  
  successfulResults.forEach((result, index) => {
    console.log(`${index + 1}. ${result.condition}:`);
    console.log(`   Price: ₦${result.median.toLocaleString()}`);
    console.log(`   Source: ${result.dataSource}`);
    console.log('');
  });
  
  // Check for price differentiation
  const prices = successfulResults.map(r => r.median);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = ((maxPrice - minPrice) / minPrice) * 100;
  
  console.log('📈 Differentiation Analysis:');
  console.log('-'.repeat(60));
  console.log(`Lowest Price: ₦${minPrice.toLocaleString()}`);
  console.log(`Highest Price: ₦${maxPrice.toLocaleString()}`);
  console.log(`Price Range: ${priceRange.toFixed(1)}%`);
  
  if (priceRange >= 10) {
    console.log('✅ PASS: Meaningful price differentiation detected');
  } else if (priceRange >= 5) {
    console.log('⚠️ PARTIAL: Some price differentiation detected');
  } else {
    console.log('❌ FAIL: No meaningful price differentiation');
  }
  
  // Check data sources
  const dataSources = [...new Set(successfulResults.map(r => r.dataSource))];
  console.log(`\n🔍 Data Sources Used: ${dataSources.join(', ')}`);
  
  if (dataSources.includes('internet_search')) {
    console.log('✅ Internet search is being used (should preserve condition differentiation)');
  } else {
    console.log('⚠️ Internet search not used - may explain lack of differentiation');
  }
  
  console.log('\n='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  
  console.log(`\n📊 Results: ${successfulResults.length}/${results.length} successful`);
  console.log(`🎯 Price Range: ${priceRange.toFixed(1)}%`);
  console.log(`🔍 Primary Source: ${dataSources[0] || 'unknown'}`);
  
  if (priceRange >= 10 && dataSources.includes('internet_search')) {
    console.log('\n🎉 CONDITION DIFFERENTIATION IS WORKING CORRECTLY!');
  } else if (priceRange < 10 && dataSources.includes('internet_search')) {
    console.log('\n⚠️ Internet search is working but may not be finding condition-specific results');
    console.log('   This could be due to limited availability of the specific vehicle model');
  } else {
    console.log('\n❌ CONDITION DIFFERENTIATION NEEDS INVESTIGATION');
    console.log('   Check internet search service and condition parameter passing');
  }
}

testConditionDifferentiation().catch(console.error);