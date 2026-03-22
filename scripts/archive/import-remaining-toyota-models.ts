import 'dotenv/config';
import { db } from '../../src/lib/db/drizzle';
import { vehicleValuations } from '../../src/lib/db/schema/vehicle-valuations';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

// Highlander data (22 entries)
const highlanderData = [
  // 2001-2007
  { make: 'Toyota', model: 'Highlander', year: 2001, conditionCategory: 'nig_used_low', lowPrice: 800000, highPrice: 1500000, averagePrice: 1100000, mileageLow: 160000, mileageHigh: 260000 },
  { make: 'Toyota', model: 'Highlander', year: 2001, conditionCategory: 'tokunbo_low', lowPrice: 1200000, highPrice: 2200000, averagePrice: 1700000, mileageLow: 160000, mileageHigh: 260000 },
  { make: 'Toyota', model: 'Highlander', year: 2003, conditionCategory: 'nig_used_low', lowPrice: 1000000, highPrice: 1800000, averagePrice: 1400000, mileageLow: 140000, mileageHigh: 230000 },
  { make: 'Toyota', model: 'Highlander', year: 2003, conditionCategory: 'tokunbo_low', lowPrice: 1500000, highPrice: 2800000, averagePrice: 2100000, mileageLow: 140000, mileageHigh: 230000 },
  { make: 'Toyota', model: 'Highlander', year: 2005, conditionCategory: 'nig_used_low', lowPrice: 1100000, highPrice: 2200000, averagePrice: 1600000, mileageLow: 120000, mileageHigh: 210000 },
  { make: 'Toyota', model: 'Highlander', year: 2005, conditionCategory: 'tokunbo_low', lowPrice: 1800000, highPrice: 3500000, averagePrice: 2600000, mileageLow: 120000, mileageHigh: 210000 },
  { make: 'Toyota', model: 'Highlander', year: 2007, conditionCategory: 'nig_used_low', lowPrice: 1400000, highPrice: 2800000, averagePrice: 2100000, mileageLow: 100000, mileageHigh: 185000 },
  { make: 'Toyota', model: 'Highlander', year: 2007, conditionCategory: 'tokunbo_low', lowPrice: 2200000, highPrice: 4000000, averagePrice: 3100000, mileageLow: 100000, mileageHigh: 185000 },
  
  // 2008-2014
  { make: 'Toyota', model: 'Highlander', year: 2008, conditionCategory: 'nig_used_low', lowPrice: 1600000, highPrice: 3200000, averagePrice: 2400000, mileageLow: 90000, mileageHigh: 175000 },
  { make: 'Toyota', model: 'Highlander', year: 2008, conditionCategory: 'tokunbo_low', lowPrice: 2500000, highPrice: 5000000, averagePrice: 3800000, mileageLow: 90000, mileageHigh: 175000 },
  { make: 'Toyota', model: 'Highlander', year: 2010, conditionCategory: 'nig_used_low', lowPrice: 2000000, highPrice: 4000000, averagePrice: 3000000, mileageLow: 80000, mileageHigh: 155000 },
  { make: 'Toyota', model: 'Highlander', year: 2010, conditionCategory: 'tokunbo_low', lowPrice: 3500000, highPrice: 6500000, averagePrice: 5000000, mileageLow: 80000, mileageHigh: 155000 },
  { make: 'Toyota', model: 'Highlander', year: 2012, conditionCategory: 'nig_used_low', lowPrice: 3000000, highPrice: 5500000, averagePrice: 4300000, mileageLow: 65000, mileageHigh: 130000 },
  { make: 'Toyota', model: 'Highlander', year: 2012, conditionCategory: 'tokunbo_low', lowPrice: 5500000, highPrice: 10000000, averagePrice: 7800000, mileageLow: 65000, mileageHigh: 130000 },
  { make: 'Toyota', model: 'Highlander', year: 2013, conditionCategory: 'nig_used_low', lowPrice: 3500000, highPrice: 6500000, averagePrice: 5000000, mileageLow: 60000, mileageHigh: 115000 },
  { make: 'Toyota', model: 'Highlander', year: 2013, conditionCategory: 'tokunbo_low', lowPrice: 6500000, highPrice: 12000000, averagePrice: 9300000, mileageLow: 60000, mileageHigh: 115000 },
  { make: 'Toyota', model: 'Highlander', year: 2014, conditionCategory: 'nig_used_low', lowPrice: 4500000, highPrice: 8000000, averagePrice: 6300000, mileageLow: 50000, mileageHigh: 100000 },
  { make: 'Toyota', model: 'Highlander', year: 2014, conditionCategory: 'tokunbo_low', lowPrice: 8000000, highPrice: 15000000, averagePrice: 11500000, mileageLow: 50000, mileageHigh: 100000 },
  
  // 2015-2024
  { make: 'Toyota', model: 'Highlander', year: 2015, conditionCategory: 'nig_used_low', lowPrice: 5500000, highPrice: 10000000, averagePrice: 7800000, mileageLow: 40000, mileageHigh: 85000 },
  { make: 'Toyota', model: 'Highlander', year: 2015, conditionCategory: 'tokunbo_low', lowPrice: 12000000, highPrice: 22000000, averagePrice: 17000000, mileageLow: 40000, mileageHigh: 85000 },
  { make: 'Toyota', model: 'Highlander', year: 2016, conditionCategory: 'nig_used_low', lowPrice: 7000000, highPrice: 12000000, averagePrice: 9500000, mileageLow: 35000, mileageHigh: 75000 },
  { make: 'Toyota', model: 'Highlander', year: 2016, conditionCategory: 'tokunbo_low', lowPrice: 14000000, highPrice: 24000000, averagePrice: 19000000, mileageLow: 35000, mileageHigh: 75000 },
];

console.log('🚗 Importing Remaining Toyota Models');
console.log('====================================\n');
console.log(`✅ Using system user ID: ${SYSTEM_USER_ID}\n`);

async function importData() {
  let successCount = 0;
  let errorCount = 0;

  console.log(`📊 Importing ${highlanderData.length} Highlander valuations...\n`);

  for (const entry of highlanderData) {
    try {
      await db.insert(vehicleValuations).values({
        ...entry,
        dataSource: 'Toyota Nigeria Comprehensive Guide 2026',
        createdBy: SYSTEM_USER_ID,
      });
      
      successCount++;
      
      if (successCount % 10 === 0) {
        console.log(`✅ Imported ${successCount} valuations...`);
      }
    } catch (error) {
      console.error(`❌ Error importing ${entry.make} ${entry.model} ${entry.year}:`, error);
      errorCount++;
    }
  }

  console.log('\n🎉 Highlander Import Complete!');
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}\n`);
}

importData()
  .then(() => {
    console.log('💡 Next: Continue with RAV4, Sienna, Land Cruiser, Prado, Venza, and Avalon');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
