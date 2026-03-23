import { config } from 'dotenv';
config();

import { internetSearchService } from '../src/features/internet-search/services/internet-search.service';

async function testInternetSearchServiceSimple() {
  console.log('🔍 Testing Internet Search Service (Simple)...');
  
  // Clear cache first
  try {
    await internetSearchService.clearCache();
    console.log('✅ Cache cleared');
  } catch (error) {
    console.log('⚠️ Cache clear failed:', error);
  }
  
  const item = {
    type: 'vehicle' as const,
    make: 'Toyota',
    model: 'Camry',
    year: 2020,
    mileage: 50000,
    condition: 'good' as const
  };
  
  console.log('\n🚗 Testing with Toyota Camry (should work)...');
  
  try {
    const result = await internetSearchService.searchMarketPrice({
      item,
      maxResults: 10,
      timeout: 5000
    });
    
    console.log('Toyota Camry Result:');
    console.log(`- Success: ${result.success}`);
    console.log(`- Prices found: ${result.priceData.prices.length}`);
    console.log(`- Average: ₦${result.priceData.averagePrice?.toLocaleString()}`);
    console.log(`- Error: ${result.error}`);
    
  } catch (error) {
    console.log('❌ Toyota Camry failed:', error);
  }
  
  // Now test Lamborghini
  const lamborghiniItem = {
    type: 'vehicle' as const,
    make: 'Lamborghini',
    model: 'Revuelto',
    year: 2023,
    mileage: 50000,
    condition: 'excellent' as const
  };
  
  console.log('\n🏎️ Testing with Lamborghini Revuelto...');
  
  try {
    const result = await internetSearchService.searchMarketPrice({
      item: lamborghiniItem,
      maxResults: 10,
      timeout: 5000
    });
    
    console.log('Lamborghini Result:');
    console.log(`- Success: ${result.success}`);
    console.log(`- Prices found: ${result.priceData.prices.length}`);
    console.log(`- Average: ₦${result.priceData.averagePrice?.toLocaleString()}`);
    console.log(`- Error: ${result.error}`);
    
    if (result.success && result.priceData.prices.length > 0) {
      console.log('\n📋 Individual Prices:');
      result.priceData.prices.forEach((price, index) => {
        console.log(`${index + 1}. ₦${price.price.toLocaleString()}`);
        console.log(`   Original: ${price.originalText}`);
      });
    }
    
  } catch (error) {
    console.log('❌ Lamborghini failed:', error);
  }
}

testInternetSearchServiceSimple().catch(console.error);