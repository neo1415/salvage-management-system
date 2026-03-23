import { config } from 'dotenv';
config();

async function debugSalvageCalculation() {
  console.log('🔍 Debugging Salvage Calculation for iPhone 12 Pro Max...');
  
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
      
      console.log('\n📊 Calculation Breakdown:');
      console.log(`Internet Search Result: ₦${data.searchQuery ? 'Found' : 'Not found'}`);
      console.log(`Market Value (after salvage discount): ₦${data.marketValue?.toLocaleString()}`);
      console.log(`Final Salvage Value: ₦${data.estimatedSalvageValue?.toLocaleString()}`);
      console.log(`Search Query: ${data.searchQuery}`);
      console.log(`Data Source: ${data.dataSource}`);
      
      if (data.marketValue && data.estimatedSalvageValue) {
        const adjustmentMultiplier = data.estimatedSalvageValue / data.marketValue;
        console.log(`\n🔧 Adjustment Analysis:`);
        console.log(`Total Adjustment Multiplier: ${adjustmentMultiplier.toFixed(3)}x`);
        
        // Expected breakdown:
        // - Condition (Brand New): 1.05x
        // - Electronics Storage (128GB): 1.02x  
        // - Brand Prestige (Apple): 1.10x
        // Total: 1.05 × 1.02 × 1.10 = 1.178x
        
        console.log(`Expected multiplier: ~1.178x (1.05 × 1.02 × 1.10)`);
        console.log(`Actual multiplier: ${adjustmentMultiplier.toFixed(3)}x`);
        
        // Target salvage value should be around ₦800K-₦850K
        const targetSalvageValue = 825000; // Middle of range
        const requiredMarketValue = targetSalvageValue / adjustmentMultiplier;
        
        console.log(`\n🎯 Target Analysis:`);
        console.log(`Target Salvage Value: ₦${targetSalvageValue.toLocaleString()}`);
        console.log(`Required Market Value: ₦${Math.round(requiredMarketValue).toLocaleString()}`);
        console.log(`Current Market Value: ₦${data.marketValue.toLocaleString()}`);
        
        if (data.marketValue > requiredMarketValue) {
          const requiredSalvageDiscount = requiredMarketValue / (data.marketValue / 0.75); // Assuming current discount is 0.75
          console.log(`Suggested salvage discount: ${requiredSalvageDiscount.toFixed(3)} (currently ~0.79)`);
        }
      }
      
    } else {
      console.log('❌ Assessment failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugSalvageCalculation();