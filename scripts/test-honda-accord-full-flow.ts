/**
 * Test full flow for Honda Accord 2022 pricing
 * Reproduces the exact bug the user is experiencing
 */

import 'dotenv/config';
import { getMarketPrice } from '@/features/market-data/services/market-data.service';
import type { PropertyIdentifier } from '@/features/market-data/types';

async function testHondaAccordFullFlow() {
  console.log('🔍 TESTING HONDA ACCORD 2022 FULL FLOW\n');
  console.log('=' .repeat(80));
  
  // Test case: Honda Accord 2022 tokunbo (exactly as user would submit)
  const property: PropertyIdentifier = {
    type: 'vehicle',
    make: 'Honda',
    model: 'Accord',
    year: 2022,
    condition: 'Foreign Used (Tokunbo)'
  };
  
  console.log('\n📋 Test Vehicle:', property);
  console.log('\n🎯 Expected: ~₦8-12 million (Nigerian market for 2022 Honda Accord tokunbo)');
  console.log('❌ User reports: ₦4,160,000 (incorrect fallback)\n');
  
  try {
    console.log('🌐 Calling getMarketPrice (full flow)...\n');
    
    const result = await getMarketPrice(property);
    
    console.log('\n' + '='.repeat(80));
    console.log('RESULT');
    console.log('='.repeat(80));
    console.log('\n✅ Market Price Retrieved:');
    console.log('- Median: ₦' + result.median.toLocaleString());
    console.log('- Min: ₦' + result.min.toLocaleString());
    console.log('- Max: ₦' + result.max.toLocaleString());
    console.log('- Count:', result.count);
    console.log('- Confidence:', (result.confidence * 100).toFixed(1) + '%');
    console.log('- Data source:', result.dataSource);
    console.log('- Is fresh:', result.isFresh);
    console.log('- Cache age:', result.cacheAge, 'days');
    
    console.log('\n📊 Price Sources:');
    result.sources.slice(0, 5).forEach((source, index) => {
      console.log(`  ${index + 1}. ₦${source.price.toLocaleString()} - ${source.source}`);
    });
    
    // Analyze the result
    console.log('\n' + '='.repeat(80));
    console.log('ANALYSIS');
    console.log('='.repeat(80));
    
    if (result.median < 8000000) {
      console.log('\n❌ BUG CONFIRMED: Price is too low!');
      console.log(`   Expected: ₦8-12 million`);
      console.log(`   Got: ₦${result.median.toLocaleString()}`);
      console.log(`   Difference: ₦${(8000000 - result.median).toLocaleString()} too low`);
      
      // Check if this is the ₦4.16M fallback
      if (result.median === 4160000) {
        console.log('\n🚨 THIS IS THE EXACT BUG: ₦4,160,000 fallback value!');
        console.log('   Data source:', result.dataSource);
        console.log('   This means internet search failed and system fell back to estimation');
      }
    } else if (result.median >= 8000000 && result.median <= 40000000) {
      console.log('\n✅ PRICE IS REASONABLE: Within acceptable range for 2022 tokunbo');
      console.log('   Note: 2022 models can range ₦8-40M depending on trim and condition');
    } else {
      console.log('\n⚠️ PRICE IS HIGH: Above expected range');
      console.log(`   Expected: ₦8-40 million`);
      console.log(`   Got: ₦${result.median.toLocaleString()}`);
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error);
    
    if (error instanceof Error) {
      console.log('\n🔍 Error details:');
      console.log('- Message:', error.message);
      console.log('- Stack:', error.stack?.split('\n').slice(0, 5).join('\n'));
    }
  }
}

// Run the test
testHondaAccordFullFlow()
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
