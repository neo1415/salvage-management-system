#!/usr/bin/env tsx

/**
 * Test script to verify the electronics AI assessment fix
 * Tests that storage capacity is properly passed and internet search works
 */

import { config } from 'dotenv';
config();

async function testElectronicsAssessment() {
  console.log('🧪 Testing Electronics AI Assessment Fix...\n');

  const testCases = [
    {
      name: 'iPhone 12 Pro Max with Storage',
      itemInfo: {
        assetType: 'electronics',
        brand: 'Apple',
        model: 'iPhone 12 Pro Max',
        storage: '256GB', // Using 'storage' field name from form
        condition: 'Brand New'
      }
    },
    {
      name: 'Samsung Galaxy S21 with Storage',
      itemInfo: {
        assetType: 'electronics',
        brand: 'Samsung',
        model: 'Galaxy S21',
        storage: '128GB',
        condition: 'Foreign Used'
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`📱 Testing ${testCase.name}...`);
    
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
        console.log(`❌ ${testCase.name}: ${error.error || 'Assessment failed'}`);
        continue;
      }

      const result = await response.json();
      
      console.log(`✅ ${testCase.name} Assessment:`);
      console.log(`   Salvage Value: ₦${result.data?.estimatedSalvageValue?.toLocaleString()}`);
      console.log(`   Market Value: ₦${result.data?.marketValue?.toLocaleString()}`);
      console.log(`   Confidence: ${result.data?.confidenceScore}%`);
      console.log(`   Damage: ${result.data?.damageSeverity}`);
      console.log(`   Data Source: ${result.data?.dataSource}`);
      console.log(`   Search Query: ${result.data?.searchQuery}`);
      console.log('');
      
    } catch (error) {
      console.log(`❌ ${testCase.name}: ${error.message}`);
    }
  }
}

testElectronicsAssessment().catch(console.error);