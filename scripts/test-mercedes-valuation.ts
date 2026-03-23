import { db } from '../src/lib/db/drizzle.ts';
import { vehicleValuations } from '../src/lib/db/schema/vehicle-valuations.ts';
import { eq, and } from 'drizzle-orm';

async function testMercedesValuation() {
  console.log('🚗 TESTING 2016 MERCEDES GLE350 VALUATION');
  console.log('='.repeat(50));
  
  const records = await db.select()
    .from(vehicleValuations)
    .where(and(
      eq(vehicleValuations.make, 'Mercedes-Benz'),
      eq(vehicleValuations.model, 'GLE350 W166'),
      eq(vehicleValuations.year, 2016)
    ));
  
  console.log(`Found ${records.length} records for 2016 Mercedes GLE350 W166:`);
  
  records.forEach(record => {
    console.log(`${record.conditionCategory}: ₦${record.averagePrice} (Range: ₦${record.lowPrice} - ₦${record.highPrice})`);
  });
  
  // Test what the AI assessment would get
  const excellentCondition = records.find(r => r.conditionCategory === 'excellent');
  if (excellentCondition) {
    console.log(`\n✅ For "excellent" condition: ₦${excellentCondition.averagePrice}`);
    console.log(`   This is ₦${(parseInt(excellentCondition.averagePrice) / 1000000).toFixed(1)}M - much more realistic!`);
  }
}

testMercedesValuation().catch(console.error);