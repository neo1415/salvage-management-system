import { config } from 'dotenv';
config();

async function testSalvagePricing() {
  console.log('🧪 Testing Comprehensive Salvage Pricing...');
  
  const testCases = [
    {
      name: 'iPhone 12 Pro Max (Brand New)',
      data: {
        photos: ['data:image/jpeg;base64,/9j/test1', 'data:image/jpeg;base64,/9j/test2', 'data:image/jpeg;base64,/9j/test3'],
        itemInfo: {
          assetType: 'electronics',
          brand: 'Apple',
          model: 'iPhone 12 Pro Max',
          condition: 'Brand New',
          storage: '128GB'
        }
      },
      expectedRange: [800000, 900000]
    },
    {
      name: 'iPhone 12 Pro Max (Foreign Used)',
      data: {
        photos: ['data:image/jpeg;base64,/9j/test1', 'data:image/jpeg;base64,/9j/test2', 'data:image/jpeg;base64,/9j/test3'],
        itemInfo: {
          assetType: 'electronics',
          brand: 'Apple',
          model: 'iPhone 12 Pro Max',
          condition: 'Foreign Used',
          storage: '128GB'
        }
      },
      expectedRange: [700000, 800000]
    },
    {
      name: 'Samsung Galaxy S21 (Foreign Used)',
      data: {
        photos: ['data:image/jpeg;base64,/9j/test1', 'data:image/jpeg;base64,/9j/test2', 'data:image/jpeg;base64,/9j/test3'],
        itemInfo: {
          assetType: 'electronics',
          brand: 'Samsung',
          model: 'Galaxy S21',
          condition: 'Foreign Used',
          storage: '128GB'
        }
      },
      expectedRange: [300000, 450000]
    }
  ];

  for (const testCase of testCases) {
    try {
      console.log(`\n📱 Testing ${testCase.name}...`);
      
      const response = await fetch('http://localhost:3000/api/cases/ai-assessment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testCase.data),
      });

      const result = await response.json();
      
      if (result.success) {
        const data = result.data;
        const salvageValue = data.estimatedSalvageValue;
        const marketValue = data.marketValue;
        
        console.log(`Market Value: ₦${marketValue?.toLocaleString()}`);
        console.log(`Salvage Value: ₦${salvageValue?.toLocaleString()}`);
        console.log(`Search Query: ${data.searchQuery}`);
        
        if (marketValue && salvageValue) {
          const multiplier = salvageValue / marketValue;
          console.log(`Adjustment Multiplier: ${multiplier.toFixed(3)}x`);
        }
        
        const [expectedMin, expectedMax] = testCase.expectedRange;
        if (salvageValue >= expectedMin && salvageValue <= expectedMax) {
          console.log(`✅ PASS: Within expected range ₦${expectedMin.toLocaleString()} - ₦${expectedMax.toLocaleString()}`);
        } else {
          console.log(`❌ FAIL: Expected ₦${expectedMin.toLocaleString()} - ₦${expectedMax.toLocaleString()}, got ₦${salvageValue?.toLocaleString()}`);
        }
        
      } else {
        console.log('❌ Assessment failed:', result.error);
      }
      
    } catch (error) {
      console.error(`❌ Error testing ${testCase.name}:`, error);
    }
  }
}

testSalvagePricing();