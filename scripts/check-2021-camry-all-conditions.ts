/**
 * Check all 2021 Camry records in database
 */

import { config } from 'dotenv';
import { db } from '@/lib/db';
import { vehicleValuations } from '@/lib/db/schema/vehicle-valuations';
import { eq, and } from 'drizzle-orm';

config();

async function checkCamryRecords() {
  console.log('🔍 Checking all 2021 Toyota Camry records...\n');
  
  const results = await db
    .select()
    .from(vehicleValuations)
    .where(
      and(
        eq(vehicleValuations.make, 'Toyota'),
        eq(vehicleValuations.model, 'Camry'),
        eq(vehicleValuations.year, 2021)
      )
    );
  
  console.log(`Found ${results.length} records:\n`);
  
  results.forEach((record, index) => {
    console.log(`Record ${index + 1}:`);
    console.log(`  Condition: ${record.conditionCategory}`);
    console.log(`  Average Price: ₦${parseFloat(record.averagePrice).toLocaleString()}`);
    console.log(`  Low Price: ₦${parseFloat(record.lowPrice).toLocaleString()}`);
    console.log(`  High Price: ₦${parseFloat(record.highPrice).toLocaleString()}`);
    console.log(`  Mileage: ${record.mileageLow} - ${record.mileageHigh} km`);
    console.log('');
  });
  
  process.exit(0);
}

checkCamryRecords().catch(console.error);
