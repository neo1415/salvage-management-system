import 'dotenv/config';
import { db } from '../../src/lib/db/drizzle';
import { vehicleValuations } from '../../src/lib/db/schema/vehicle-valuations';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

// RAV4 Data (19 entries)
const rav4Data = [
  // RAV4 2000
  { make: 'Toyota', model: 'RAV4', year: 2000, conditionCategory: 'nig_used_low', lowPrice: 600000, highPrice: 1000000, averagePrice: 800000, mileageLow: 150000, mileageHigh: 250000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'RAV4', year: 2000, conditionCategory: 'tokunbo_low', lowPrice: 900000, highPrice: 1500000, averagePrice: 1100000, mileageLow: 150000, mileageHigh: 250000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // RAV4 2003
  { make: 'Toyota', model: 'RAV4', year: 2003, conditionCategory: 'nig_used_low', lowPrice: 800000, highPrice: 1300000, averagePrice: 1100000, mileageLow: 130000, mileageHigh: 220000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'RAV4', year: 2003, conditionCategory: 'tokunbo_low', lowPrice: 1100000, highPrice: 1800000, averagePrice: 1600000, mileageLow: 130000, mileageHigh: 220000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // RAV4 2006
  { make: 'Toyota', model: 'RAV4', year: 2006, conditionCategory: 'nig_used_low', lowPrice: 1000000, highPrice: 1500000, averagePrice: 1500000, mileageLow: 110000, mileageHigh: 195000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'RAV4', year: 2006, conditionCategory: 'tokunbo_low', lowPrice: 1600000, highPrice: 2300000, averagePrice: 2300000, mileageLow: 110000, mileageHigh: 195000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // RAV4 2009
  { make: 'Toyota', model: 'RAV4', year: 2009, conditionCategory: 'nig_used_low', lowPrice: 1400000, highPrice: 2100000, averagePrice: 2100000, mileageLow: 90000, mileageHigh: 165000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'RAV4', year: 2009, conditionCategory: 'tokunbo_low', lowPrice: 2200000, highPrice: 3100000, averagePrice: 3100000, mileageLow: 90000, mileageHigh: 165000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // RAV4 2010
  { make: 'Toyota', model: 'RAV4', year: 2010, conditionCategory: 'nig_used_low', lowPrice: 1600000, highPrice: 2400000, averagePrice: 2400000, mileageLow: 80000, mileageHigh: 150000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'RAV4', year: 2010, conditionCategory: 'tokunbo_low', lowPrice: 2500000, highPrice: 3800000, averagePrice: 3800000, mileageLow: 80000, mileageHigh: 150000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // RAV4 2012
  { make: 'Toyota', model: 'RAV4', year: 2012, conditionCategory: 'nig_used_low', lowPrice: 2200000, highPrice: 3100000, averagePrice: 3100000, mileageLow: 65000, mileageHigh: 130000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'RAV4', year: 2012, conditionCategory: 'tokunbo_low', lowPrice: 3500000, highPrice: 5000000, averagePrice: 5000000, mileageLow: 65000, mileageHigh: 130000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // RAV4 2014
  { make: 'Toyota', model: 'RAV4', year: 2014, conditionCategory: 'nig_used_low', lowPrice: 3000000, highPrice: 4300000, averagePrice: 4300000, mileageLow: 50000, mileageHigh: 100000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'RAV4', year: 2014, conditionCategory: 'tokunbo_low', lowPrice: 5000000, highPrice: 7000000, averagePrice: 7000000, mileageLow: 50000, mileageHigh: 100000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // RAV4 2016
  { make: 'Toyota', model: 'RAV4', year: 2016, conditionCategory: 'nig_used_low', lowPrice: 4000000, highPrice: 5800000, averagePrice: 5800000, mileageLow: 38000, mileageHigh: 80000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'RAV4', year: 2016, conditionCategory: 'tokunbo_low', lowPrice: 7000000, highPrice: 10000000, averagePrice: 10000000, mileageLow: 38000, mileageHigh: 80000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // RAV4 2019
  { make: 'Toyota', model: 'RAV4', year: 2019, conditionCategory: 'excellent', lowPrice: 15000000, highPrice: 20000000, averagePrice: 20000000, mileageLow: 20000, mileageHigh: 50000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // RAV4 2021
  { make: 'Toyota', model: 'RAV4', year: 2021, conditionCategory: 'excellent', lowPrice: 22000000, highPrice: 29000000, averagePrice: 29000000, mileageLow: 10000, mileageHigh: 30000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // RAV4 2023
  { make: 'Toyota', model: 'RAV4', year: 2023, conditionCategory: 'excellent', lowPrice: 32000000, highPrice: 40000000, averagePrice: 40000000, mileageLow: 5000, mileageHigh: 20000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // RAV4 2025
  { make: 'Toyota', model: 'RAV4', year: 2025, conditionCategory: 'excellent', lowPrice: 40000000, highPrice: 49000000, averagePrice: 49000000, mileageLow: 0, mileageHigh: 8000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
];

// Sienna Data (21 entries)
const siennaData = [
  // Sienna 2000
  { make: 'Toyota', model: 'Sienna', year: 2000, conditionCategory: 'nig_used_low', lowPrice: 700000, highPrice: 1100000, averagePrice: 1100000, mileageLow: 160000, mileageHigh: 260000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Sienna', year: 2000, conditionCategory: 'tokunbo_low', lowPrice: 1000000, highPrice: 1500000, averagePrice: 1500000, mileageLow: 160000, mileageHigh: 260000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // Sienna 2001
  { make: 'Toyota', model: 'Sienna', year: 2001, conditionCategory: 'nig_used_low', lowPrice: 600000, highPrice: 900000, averagePrice: 900000, mileageLow: 155000, mileageHigh: 250000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Sienna', year: 2001, conditionCategory: 'tokunbo_low', lowPrice: 800000, highPrice: 1200000, averagePrice: 1200000, mileageLow: 155000, mileageHigh: 250000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // Sienna 2004
  { make: 'Toyota', model: 'Sienna', year: 2004, conditionCategory: 'nig_used_low', lowPrice: 800000, highPrice: 1100000, averagePrice: 1100000, mileageLow: 140000, mileageHigh: 230000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Sienna', year: 2004, conditionCategory: 'tokunbo_low', lowPrice: 1200000, highPrice: 1700000, averagePrice: 1700000, mileageLow: 140000, mileageHigh: 230000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // Sienna 2006
  { make: 'Toyota', model: 'Sienna', year: 2006, conditionCategory: 'nig_used_low', lowPrice: 900000, highPrice: 1300000, averagePrice: 1300000, mileageLow: 120000, mileageHigh: 210000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Sienna', year: 2006, conditionCategory: 'tokunbo_low', lowPrice: 1400000, highPrice: 1900000, averagePrice: 1900000, mileageLow: 120000, mileageHigh: 210000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // Sienna 2008
  { make: 'Toyota', model: 'Sienna', year: 2008, conditionCategory: 'nig_used_low', lowPrice: 1200000, highPrice: 1900000, averagePrice: 1900000, mileageLow: 100000, mileageHigh: 185000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Sienna', year: 2008, conditionCategory: 'tokunbo_low', lowPrice: 2000000, highPrice: 2900000, averagePrice: 2900000, mileageLow: 100000, mileageHigh: 185000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // Sienna 2010
  { make: 'Toyota', model: 'Sienna', year: 2010, conditionCategory: 'nig_used_low', lowPrice: 1500000, highPrice: 2500000, averagePrice: 2500000, mileageLow: 85000, mileageHigh: 165000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Sienna', year: 2010, conditionCategory: 'tokunbo_low', lowPrice: 2800000, highPrice: 4200000, averagePrice: 4200000, mileageLow: 85000, mileageHigh: 165000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // Sienna 2011
  { make: 'Toyota', model: 'Sienna', year: 2011, conditionCategory: 'nig_used_low', lowPrice: 1800000, highPrice: 2900000, averagePrice: 2900000, mileageLow: 75000, mileageHigh: 150000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Sienna', year: 2011, conditionCategory: 'tokunbo_low', lowPrice: 3500000, highPrice: 5000000, averagePrice: 5000000, mileageLow: 75000, mileageHigh: 150000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // Sienna 2012
  { make: 'Toyota', model: 'Sienna', year: 2012, conditionCategory: 'nig_used_low', lowPrice: 2500000, highPrice: 3800000, averagePrice: 3800000, mileageLow: 65000, mileageHigh: 130000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Sienna', year: 2012, conditionCategory: 'tokunbo_low', lowPrice: 5000000, highPrice: 7000000, averagePrice: 7000000, mileageLow: 65000, mileageHigh: 130000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // Sienna 2014
  { make: 'Toyota', model: 'Sienna', year: 2014, conditionCategory: 'nig_used_low', lowPrice: 3500000, highPrice: 5300000, averagePrice: 5300000, mileageLow: 55000, mileageHigh: 110000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Sienna', year: 2014, conditionCategory: 'tokunbo_low', lowPrice: 7000000, highPrice: 10000000, averagePrice: 10000000, mileageLow: 55000, mileageHigh: 110000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // Sienna 2016
  { make: 'Toyota', model: 'Sienna', year: 2016, conditionCategory: 'nig_used_low', lowPrice: 5000000, highPrice: 7000000, averagePrice: 7000000, mileageLow: 40000, mileageHigh: 85000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Sienna', year: 2016, conditionCategory: 'tokunbo_low', lowPrice: 10000000, highPrice: 14000000, averagePrice: 14000000, mileageLow: 40000, mileageHigh: 85000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // Sienna 2018
  { make: 'Toyota', model: 'Sienna', year: 2018, conditionCategory: 'nig_used_low', lowPrice: 7000000, highPrice: 10000000, averagePrice: 10000000, mileageLow: 25000, mileageHigh: 60000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Sienna', year: 2018, conditionCategory: 'tokunbo_low', lowPrice: 14000000, highPrice: 19000000, averagePrice: 19000000, mileageLow: 25000, mileageHigh: 60000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // Sienna 2021 (Hybrid)
  { make: 'Toyota', model: 'Sienna', year: 2021, conditionCategory: 'excellent', lowPrice: 38000000, highPrice: 46500000, averagePrice: 46500000, mileageLow: 10000, mileageHigh: 30000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // Sienna 2023 (Hybrid)
  { make: 'Toyota', model: 'Sienna', year: 2023, conditionCategory: 'excellent', lowPrice: 48000000, highPrice: 56500000, averagePrice: 56500000, mileageLow: 5000, mileageHigh: 20000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // Sienna 2025 (Hybrid)
  { make: 'Toyota', model: 'Sienna', year: 2025, conditionCategory: 'excellent', lowPrice: 58000000, highPrice: 68000000, averagePrice: 68000000, mileageLow: 0, mileageHigh: 8000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
];

async function importData() {
  console.log('🚗 Importing Remaining Toyota Models');
  console.log('====================================');
  console.log(`✅ Using system user ID: ${SYSTEM_USER_ID}\n`);

  let successCount = 0;
  let errorCount = 0;

  // Import RAV4
  console.log(`📊 Importing ${rav4Data.length} RAV4 valuations...`);
  for (const data of rav4Data) {
    try {
      await db.insert(vehicleValuations).values({
        ...data,
        createdBy: SYSTEM_USER_ID,
      });
      successCount++;
      if (successCount % 10 === 0) {
        console.log(`✅ Imported ${successCount} valuations...`);
      }
    } catch (error) {
      console.error(`❌ Error importing Toyota ${data.model} ${data.year}:`, error);
      errorCount++;
    }
  }

  console.log('🎉 RAV4 Import Complete!\n');

  // Import Sienna
  console.log(`📊 Importing ${siennaData.length} Sienna valuations...`);
  for (const data of siennaData) {
    try {
      await db.insert(vehicleValuations).values({
        ...data,
        createdBy: SYSTEM_USER_ID,
      });
      successCount++;
      if (successCount % 10 === 0) {
        console.log(`✅ Imported ${successCount} valuations...`);
      }
    } catch (error) {
      console.error(`❌ Error importing Toyota ${data.model} ${data.year}:`, error);
      errorCount++;
    }
  }

  console.log('🎉 Sienna Import Complete!\n');

  console.log('🎉 Import Complete!');
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log('\n💡 Next: Continue with Land Cruiser, Prado, Venza, and Avalon');

  process.exit(0);
}

importData().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
