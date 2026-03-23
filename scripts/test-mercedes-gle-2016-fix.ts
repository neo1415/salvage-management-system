import 'dotenv/config';
import { db } from '@/lib/db/drizzle';
import { vehicleValuations } from '@/lib/db/schema/vehicle-valuations';
import { eq, and } from 'drizzle-orm';
import { valuationQueryService } from '@/features/valuations/services/valuation-query.service';

async function testMercedesGLE2016() {
  console.log('\n🔍 TESTING MERCEDES GLE 350 W166 2016 VALUATION FIX\n');
  console.log('=' .repeat(80));
  
  // Query the database for Mercedes GLE 350 2016
  const results = await db
    .select()
    .from(vehicleValuations)
    .where(
      and(
        eq(vehicleValuations.make, 'Mercedes-Benz'),
        eq(vehicleValuations.model, 'GLE350 W166'),
        eq(vehicleValuations.year, 2016)
      )
    );
  
  console.log(`\n📊 Found ${results.length} valuation records:\n`);
  
  for (const record of results) {
    console.log(`Condition: ${record.conditionCategory}`);
    console.log(`  Low:     ₦${parseFloat(record.lowPrice).toLocaleString()}`);
    console.log(`  Average: ₦${parseFloat(record.averagePrice).toLocaleString()}`);
    console.log(`  High:    ₦${parseFloat(record.highPrice).toLocaleString()}`);
    console.log('');
  }
  
  // Test the valuation query service with "excellent" condition
  console.log('\n🔍 Testing valuation query with "excellent" condition:\n');
  
  const queryResult = await valuationQueryService.queryValuation({
    make: 'Mercedes-Benz',
    model: 'GLE350 W166',
    year: 2016,
    conditionCategory: 'excellent',
  });
  
  if (queryResult.found && queryResult.valuation) {
    console.log('✅ SUCCESS! Found valuation for excellent condition:');
    console.log(`  Average Price: ₦${queryResult.valuation.averagePrice.toLocaleString()}`);
    console.log(`  Low Price:     ₦${queryResult.valuation.lowPrice.toLocaleString()}`);
    console.log(`  High Price:    ₦${queryResult.valuation.highPrice.toLocaleString()}`);
    console.log(`  Condition:     ${queryResult.valuation.conditionCategory}`);
    console.log('');
    
    // Verify the price is in the expected range (₦28-34M)
    const avgPrice = queryResult.valuation.averagePrice;
    if (avgPrice >= 28000000 && avgPrice <= 34000000) {
      console.log('✅ PRICE VALIDATION PASSED: Price is in expected range (₦28-34M)');
    } else {
      console.log(`❌ PRICE VALIDATION FAILED: Price ${avgPrice} is outside expected range (₦28-34M)`);
    }
  } else {
    console.log('❌ FAILED: No valuation found for excellent condition');
    console.log('This means the fix did not work correctly.');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Test complete\n');
}

testMercedesGLE2016()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
