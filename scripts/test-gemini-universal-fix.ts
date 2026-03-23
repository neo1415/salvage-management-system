#!/usr/bin/env tsx

/**
 * Test script to verify Gemini works with universal items (electronics)
 */

import { assessDamageEnhanced } from '../src/features/cases/services/ai-assessment-enhanced.service';

async function testGeminiUniversalFix() {
  console.log('🧪 Testing Gemini Universal Item Support...\n');

  // Test with electronics (iPhone)
  const testPhotos = [
    'https://res.cloudinary.com/test/image/upload/v1/test1.jpg',
    'https://res.cloudinary.com/test/image/upload/v1/test2.jpg',
    'https://res.cloudinary.com/test/image/upload/v1/test3.jpg'
  ];

  const universalItemInfo = {
    type: 'electronics' as const,
    condition: 'Brand New' as const,
    description: undefined,
    brand: 'Apple',
    model: 'iPhone 17 Pro Max',
    storageCapacity: '512GB',
    batteryHealth: undefined,
    age: undefined,
    brandPrestige: 'luxury' as const
  };

  try {
    console.log('📱 Testing with iPhone 17 Pro Max...');
    console.log('Universal item info:', JSON.stringify(universalItemInfo, null, 2));
    
    const result = await assessDamageEnhanced({
      photos: testPhotos,
      universalItemInfo: universalItemInfo
    });

    console.log('\n✅ Assessment completed successfully!');
    console.log('Result:', JSON.stringify(result, null, 2));
    
    // Check if Gemini was used (should be based on the logs)
    console.log('\n🔍 Check the logs above to see if Gemini was used instead of Vision API');
    
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testGeminiUniversalFix().catch(console.error);