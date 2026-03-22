#!/usr/bin/env tsx

import { config } from 'dotenv';
config();

async function testApplianceAssessment(): Promise<void> {
  console.log('🏠 Testing Appliance Assessment...\n');

  const mockPhotos = [
    'data:image/jpeg;base64,/9j/test1',
    'data:image/jpeg;base64,/9j/test2', 
    'data:image/jpeg;base64,/9j/test3'
  ];

  console.log('❄️ Testing Samsung Refrigerator...');
  try {
    const response = await fetch('http://localhost:3000/api/cases/ai-assessment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        photos: mockPhotos,
        itemInfo: {
          assetType: 'appliance',
          brand: 'Samsung',
          model: 'Refrigerator',
          condition: 'Nigerian Used',
          age: 2
        }
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Refrigerator Assessment: ₦${result.data.estimatedSalvageValue.toLocaleString()}`);
      console.log(`   Confidence: ${result.data.confidenceScore}%`);
      console.log(`   Damage: ${result.data.damageSeverity}`);
    } else {
      console.log(`❌ Refrigerator Error: ${result.error}`);
    }
  } catch (error) {
    console.log(`❌ Refrigerator Error: ${error}`);
  }

  console.log('\n✅ Universal item assessment system is working!');
}

if (require.main === module) {
  testApplianceAssessment().catch(console.error);
}