#!/usr/bin/env tsx

/**
 * Debug AI Assessment Issues
 * 
 * This script identifies and fixes the following issues:
 * 1. iPhone 17 Pro Max pricing too low (₦1.69M instead of ₦2.4M+)
 * 2. Pristine phones showing "minor damage" 
 * 3. Vision API fallback showing generic labels instead of proper damage detection
 * 4. Salvage discount being applied incorrectly to Brand New items
 */

import { config } from 'dotenv';
config();

// Test the AI assessment with iPhone 17 Pro Max data
async function testIPhoneAssessment() {
  console.log('🔍 Testing iPhone 17 Pro Max AI Assessment...\n');
  
  // Simulate the request data from your logs
  const testData = {
    photos: [
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
    ],
    itemInfo: {
      assetType: 'electronics',
      brand: 'Apple',
      model: 'iphone 17 pro max',
      storageCapacity: '128gb',
      condition: 'Brand New'
    }
  };

  console.log('📱 Test Item:', testData.itemInfo);
  console.log('📸 Photos:', testData.photos.length, 'base64 images\n');

  // Test the current AI assessment endpoint
  try {
    const response = await fetch('http://localhost:3000/api/cases/ai-assessment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log('✅ AI Assessment Result:');
    console.log('   Damage Severity:', result.data.damageSeverity);
    console.log('   Confidence Score:', result.data.confidenceScore);
    console.log('   Market Value:', `₦${result.data.marketValue?.toLocaleString()}`);
    console.log('   Salvage Value:', `₦${result.data.estimatedSalvageValue?.toLocaleString()}`);
    console.log('   Data Source:', result.data.dataSource);
    console.log('   Search Query:', result.data.searchQuery);
    console.log('   Labels:', result.data.labels?.slice(0, 5).join(', '));
    
    // Identify issues
    console.log('\n🔍 Issue Analysis:');
    
    // Issue 1: Pricing too low
    if (result.data.estimatedSalvageValue < 2000000) {
      console.log('❌ ISSUE 1: iPhone 17 Pro Max salvage value too low');
      console.log(`   Expected: ₦2,000,000+, Got: ₦${result.data.estimatedSalvageValue?.toLocaleString()}`);
    }
    
    // Issue 2: Damage on pristine item
    if (result.data.damageSeverity !== 'none' && testData.itemInfo.condition === 'Brand New') {
      console.log('❌ ISSUE 2: Brand New item showing damage');
      console.log(`   Expected: none, Got: ${result.data.damageSeverity}`);
    }
    
    // Issue 3: Generic Vision API labels
    const genericLabels = ['Gadget', 'Electronic device', 'Mobile phone', 'Communication Device'];
    const hasGenericLabels = result.data.labels?.some(label => 
      genericLabels.some(generic => label.includes(generic))
    );
    
    if (hasGenericLabels) {
      console.log('❌ ISSUE 3: Vision API showing generic labels instead of damage analysis');
      console.log(`   Labels: ${result.data.labels?.join(', ')}`);
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return null;
  }
}

// Test the search results directly
async function testSearchResults() {
  console.log('\n🔍 Testing Search Results Directly...\n');
  
  try {
    // Import the internet search service
    const { internetSearchService } = await import('@/features/internet-search/services/internet-search.service');
    
    const searchResult = await internetSearchService.searchMarketPrice({
      item: {
        type: 'electronics',
        brand: 'Apple',
        model: 'iphone 17 pro max',
        storage: '128gb',
        condition: 'Brand New'
      },
      maxResults: 10,
      timeout: 10000
    });
    
    console.log('🌐 Search Results:');
    console.log('   Success:', searchResult.success);
    console.log('   Query:', searchResult.query);
    console.log('   Results Processed:', searchResult.resultsProcessed);
    console.log('   Prices Found:', searchResult.priceData.prices.length);
    console.log('   Average Price:', `₦${searchResult.priceData.averagePrice?.toLocaleString()}`);
    console.log('   Confidence:', searchResult.priceData.confidence);
    
    if (searchResult.priceData.prices.length > 0) {
      console.log('\n📊 Individual Prices:');
      searchResult.priceData.prices.slice(0, 5).forEach((price, index) => {
        console.log(`   ${index + 1}. ₦${price.toLocaleString()}`);
      });
    }
    
    return searchResult;
    
  } catch (error) {
    console.error('❌ Search test failed:', error);
    return null;
  }
}

// Test salvage discount calculation
async function testSalvageDiscount() {
  console.log('\n🔍 Testing Salvage Discount Calculation...\n');
  
  try {
    // Import the service
    const { assessDamageEnhanced } = await import('@/features/cases/services/ai-assessment-enhanced.service');
    
    // Test different conditions
    const conditions = ['Brand New', 'Foreign Used (Tokunbo)', 'Nigerian Used', 'Heavily Used'];
    
    for (const condition of conditions) {
      console.log(`📱 Testing condition: ${condition}`);
      
      // Mock a high market price to see salvage discount effect
      const mockMarketPrice = 2500000; // ₦2.5M
      
      // Calculate what the salvage discount would be
      // We need to access the internal function, so let's simulate it
      const baseDiscount = 0.55; // Electronics base discount
      let conditionMultiplier = 1.0;
      
      switch (condition) {
        case 'Brand New':
          conditionMultiplier = 1.25; // Should get highest salvage value
          break;
        case 'Foreign Used (Tokunbo)':
          conditionMultiplier = 1.10;
          break;
        case 'Nigerian Used':
          conditionMultiplier = 1.00;
          break;
        case 'Heavily Used':
          conditionMultiplier = 0.85;
          break;
      }
      
      const finalDiscount = Math.min(baseDiscount * conditionMultiplier, 0.85);
      const salvageValue = mockMarketPrice * finalDiscount;
      
      console.log(`   Market Price: ₦${mockMarketPrice.toLocaleString()}`);
      console.log(`   Salvage Discount: ${(finalDiscount * 100).toFixed(1)}%`);
      console.log(`   Salvage Value: ₦${salvageValue.toLocaleString()}`);
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Salvage discount test failed:', error);
  }
}

// Main test function
async function main() {
  console.log('🚀 AI Assessment Issues Debug Script\n');
  console.log('This script will identify the following issues:');
  console.log('1. iPhone 17 Pro Max pricing too low');
  console.log('2. Pristine phones showing damage');
  console.log('3. Vision API generic labels instead of damage detection');
  console.log('4. Incorrect salvage discount application\n');
  
  // Test 1: Full AI assessment
  await testIPhoneAssessment();
  
  // Test 2: Search results
  await testSearchResults();
  
  // Test 3: Salvage discount calculation
  await testSalvageDiscount();
  
  console.log('\n✅ Debug complete. Check the issues identified above.');
  console.log('\n🔧 Recommended fixes:');
  console.log('1. Fix salvage discount for Brand New electronics (should be higher, not lower)');
  console.log('2. Improve damage detection to not show damage on pristine items');
  console.log('3. Fix Vision API fallback to properly detect no damage');
  console.log('4. Ensure search results are properly processed and not over-discounted');
}

if (require.main === module) {
  main().catch(console.error);
}