import { config } from 'dotenv';
config();

async function testRealisticiPhonePricing() {
  console.log('🧪 Testing Realistic iPhone 12 Pro Max Pricing...');
  
  const testData = {
    photos: [
      'data:image/jpeg;base64,/9j/test1',
      'data:image/jpeg;base64,/9j/test2', 
      'data:image/jpeg;base64,/9j/test3'
    ],
    itemInfo: {
      assetType: 'electronics',
      brand: 'Apple',
      model: 'iPhone 12 Pro Max',
      condition: 'Brand New',
      storage: '128GB'
    }
  };

  try {
    const response = await fetch('http://localhost:3000/api/cases/ai-assessment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    const result = await response.json();
    
    if (result.success) {
      const data = result.data;
      console.log('📱 iPhone 12 Pro Max (Brand New, 128GB):');
      console.log(`Market Value: ₦${data.marketValue?.toLocaleString()}`);
      console.log(`Salvage Value: ₦${data.estimatedSalvageValue?.toLocaleString()}`);
      console.log(`Data Source: ${data.dataSource}`);
      console.log(`Search Query: ${data.searchQuery}`);
      
      // Calculate the adjustment multiplier
      if (data.marketValue && data.estimatedSalvageValue) {
        const multiplier = data.estimatedSalvageValue / data.marketValue;
        console.log(`Adjustment Multiplier: ${multiplier.toFixed(3)}x`);
        
        // Expected range: ₦800K - ₦900K for iPhone 12 Pro Max 128GB
        const expectedMin = 800000;
        const expectedMax = 900000;
        
        if (data.estimatedSalvageValue >= expectedMin && data.estimatedSalvageValue <= expectedMax) {
          console.log('✅ PASS: Salvage value is within expected range');
        } else {
          console.log(`❌ FAIL: Expected ₦${expectedMin.toLocaleString()} - ₦${expectedMax.toLocaleString()}`);
        }
      }
      
    } else {
      console.log('❌ Assessment failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testRealisticiPhonePricing();