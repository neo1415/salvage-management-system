#!/usr/bin/env tsx

/**
 * Test script to verify storage capacity is properly passed through
 */

import { config } from 'dotenv';
config();

async function testStorageCapacity() {
  console.log('💾 Testing Storage Capacity Mapping...\n');

  const testCase = {
    itemInfo: {
      assetType: 'electronics',
      brand: 'Apple',
      model: 'iPhone 12 Pro Max',
      storage: '512GB', // This should map to storageCapacity
      condition: 'Brand New'
    }
  };

  try {
    const response = await fetch('http://localhost:3000/api/cases/ai-assessment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        photos: [
          'data:image/jpeg;base64,/9j/test1',
          'data:image/jpeg;base64,/9j/test2', 
          'data:image/jpeg;base64,/9j/test3'
        ],
        itemInfo: testCase.itemInfo
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.log(`❌ Error: ${error.error}`);
      return;
    }

    const result = await response.json();
    
    console.log('📱 iPhone 12 Pro Max (512GB):');
    console.log(`   Salvage Value: ₦${result.data?.estimatedSalvageValue?.toLocaleString()}`);
    console.log(`   Market Value: ₦${result.data?.marketValue?.toLocaleString()}`);
    console.log(`   Search Query: ${result.data?.searchQuery}`);
    console.log(`   Data Source: ${result.data?.dataSource}`);
    
    // Check if storage capacity affects the search query or valuation
    if (result.data?.searchQuery?.includes('512')) {
      console.log('✅ Storage capacity is included in search query');
    } else {
      console.log('⚠️ Storage capacity not visible in search query (may still be used internally)');
    }
    
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
  }
}

testStorageCapacity().catch(console.error);