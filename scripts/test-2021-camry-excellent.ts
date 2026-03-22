/**
 * Test 2021 Toyota Camry Excellent Condition Valuation
 * This should now return ₦40M from the database, not ₦5.6M from estimation
 */

import { config } from 'dotenv';
import { valuationQueryService } from '@/features/valuations/services/valuation-query.service';

config();

async function test() {
  console.log('🔍 Testing 2021 Toyota Camry Excellent Condition Query\n');
  console.log('Expected: ₦40M average (₦32M-₦48M range)');
  console.log('Previous Bug: ₦5.6M (from fallback estimation)\n');
  
  const result = await valuationQueryService.queryValuation({
    make: 'Toyota',
    model: 'Camry',
    year: 2021,
    conditionCategory: 'excellent',
  });
  
  if (result.found && result.valuation) {
    console.log('✅ FOUND IN DATABASE!');
    console.log(`   Average Price: ₦${result.valuation.averagePrice.toLocaleString()}`);
    console.log(`   Low Price: ₦${result.valuation.lowPrice.toLocaleString()}`);
    console.log(`   High Price: ₦${result.valuation.highPrice.toLocaleString()}`);
    console.log(`   Condition: ${result.valuation.conditionCategory}`);
    console.log(`   Mileage Range: ${result.valuation.mileageLow?.toLocaleString()} - ${result.valuation.mileageHigh?.toLocaleString()} km`);
    console.log(`   Source: ${result.source}`);
    
    if (result.valuation.averagePrice === 40000000) {
      console.log('\n🎉 SUCCESS! The correct price is now being returned from the database!');
    } else {
      console.log(`\n⚠️  WARNING: Expected ₦40M but got ₦${result.valuation.averagePrice.toLocaleString()}`);
    }
  } else {
    console.log('❌ NOT FOUND - This means the database query failed');
    console.log('   The system will fall back to web scraping or estimation');
  }
}

test();
