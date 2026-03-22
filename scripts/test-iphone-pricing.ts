#!/usr/bin/env tsx

/**
 * Simple test to verify iPhone 17 Pro Max pricing fix
 */

import { config } from 'dotenv';
config();

async function testIPhonePricing() {
  console.log('🧪 Testing iPhone 17 Pro Max Pricing Fix...\n');
  
  const testData = {
    photos: ['data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='],
    itemInfo: {
      assetType: 'electronics',
      brand: 'Apple',
      model: 'iphone 17 pro max',
      storageCapacity: '128gb',
      condition: 'Brand New'
    }
  };

  try {
    const response = await fetch('http://localhost:3000/api/cases/ai-assessment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log('📱 RESULTS:');
    console.log(`   Market Value: ₦${result.data.marketValue?.toLocaleString()}`);
    console.log(`   Salvage Value: ₦${result.data.estimatedSalvageValue?.toLocaleString()}`);
    console.log(`   Damage Severity: ${result.data.damageSeverity}`);
    console.log(`   Confidence: ${result.data.confidenceScore}%`);
    console.log(`   Data Source: ${result.data.dataSource}`);
    
    console.log('\n🔍 VERIFICATION:');
    
    // Check if pricing is fixed (should be ₦2.5M+)
    if (result.data.marketValue >= 2500000) {
      console.log('✅ PRICING FIXED: Brand New iPhone gets premium pricing');
    } else {
      console.log('❌ PRICING ISSUE: Still too low');
    }
    
    // Check if damage severity is fixed (should be "none")
    if (result.data.damageSeverity === 'none') {
      console.log('✅ DAMAGE FIXED: Pristine item shows "none" severity');
    } else {
      console.log(`❌ DAMAGE ISSUE: Shows "${result.data.damageSeverity}" instead of "none"`);
    }
    
    // Check if salvage value equals market value (no discount for Brand New)
    if (result.data.marketValue === result.data.estimatedSalvageValue) {
      console.log('✅ DISCOUNT FIXED: No salvage discount for Brand New');
    } else {
      console.log('❌ DISCOUNT ISSUE: Salvage discount still applied');
    }
    
    console.log('\n🎯 SUMMARY:');
    console.log('Before fix: ₦1,690,746 with "minor" damage');
    console.log(`After fix:  ₦${result.data.marketValue?.toLocaleString()} with "${result.data.damageSeverity}" damage`);
    
    const improvement = ((result.data.marketValue - 1690746) / 1690746 * 100).toFixed(1);
    console.log(`Improvement: +${improvement}% price increase`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

if (require.main === module) {
  testIPhonePricing().catch(console.error);
}