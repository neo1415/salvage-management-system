import 'dotenv/config';
import { db } from '../../src/lib/db/drizzle';
import { vehicleValuations } from '../../src/lib/db/schema/vehicle-valuations';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

// Land Cruiser Data (17 entries)
const landCruiserData = [
  // LC100 2000
  { make: 'Toyota', model: 'Land Cruiser', year: 2000, conditionCategory: 'nig_used_low', lowPrice: 1500000, highPrice: 2300000, averagePrice: 2300000, mileageLow: 150000, mileageHigh: 250000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Land Cruiser', year: 2000, conditionCategory: 'tokunbo_low', lowPrice: 2500000, highPrice: 3800000, averagePrice: 3800000, mileageLow: 150000, mileageHigh: 250000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // LC100 2003
  { make: 'Toyota', model: 'Land Cruiser', year: 2003, conditionCategory: 'nig_used_low', lowPrice: 2000000, highPrice: 3000000, averagePrice: 3000000, mileageLow: 130000, mileageHigh: 220000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Land Cruiser', year: 2003, conditionCategory: 'tokunbo_low', lowPrice: 3500000, highPrice: 5300000, averagePrice: 5300000, mileageLow: 130000, mileageHigh: 220000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // LC100 2005
  { make: 'Toyota', model: 'Land Cruiser', year: 2005, conditionCategory: 'nig_used_low', lowPrice: 2500000, highPrice: 3800000, averagePrice: 3800000, mileageLow: 110000, mileageHigh: 200000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Land Cruiser', year: 2005, conditionCategory: 'tokunbo_low', lowPrice: 4500000, highPrice: 6300000, averagePrice: 6300000, mileageLow: 110000, mileageHigh: 200000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // LC200 2008
  { make: 'Toyota', model: 'Land Cruiser', year: 2008, conditionCategory: 'nig_used_low', lowPrice: 4000000, highPrice: 6000000, averagePrice: 6000000, mileageLow: 90000, mileageHigh: 175000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Land Cruiser', year: 2008, conditionCategory: 'tokunbo_low', lowPrice: 7000000, highPrice: 11000000, averagePrice: 11000000, mileageLow: 90000, mileageHigh: 175000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // LC200 2010
  { make: 'Toyota', model: 'Land Cruiser', year: 2010, conditionCategory: 'nig_used_low', lowPrice: 5000000, highPrice: 7500000, averagePrice: 7500000, mileageLow: 80000, mileageHigh: 155000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Land Cruiser', year: 2010, conditionCategory: 'tokunbo_low', lowPrice: 10000000, highPrice: 15000000, averagePrice: 15000000, mileageLow: 80000, mileageHigh: 155000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // LC200 2013
  { make: 'Toyota', model: 'Land Cruiser', year: 2013, conditionCategory: 'nig_used_low', lowPrice: 7000000, highPrice: 10500000, averagePrice: 10500000, mileageLow: 65000, mileageHigh: 130000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Land Cruiser', year: 2013, conditionCategory: 'tokunbo_low', lowPrice: 15000000, highPrice: 21500000, averagePrice: 21500000, mileageLow: 65000, mileageHigh: 130000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // LC200 2015
  { make: 'Toyota', model: 'Land Cruiser', year: 2015, conditionCategory: 'nig_used_low', lowPrice: 10000000, highPrice: 14000000, averagePrice: 14000000, mileageLow: 50000, mileageHigh: 100000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Land Cruiser', year: 2015, conditionCategory: 'tokunbo_low', lowPrice: 22000000, highPrice: 31000000, averagePrice: 31000000, mileageLow: 50000, mileageHigh: 100000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // LC200 2017
  { make: 'Toyota', model: 'Land Cruiser', year: 2017, conditionCategory: 'nig_used_low', lowPrice: 14000000, highPrice: 19500000, averagePrice: 19500000, mileageLow: 35000, mileageHigh: 75000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Land Cruiser', year: 2017, conditionCategory: 'tokunbo_low', lowPrice: 35000000, highPrice: 48500000, averagePrice: 48500000, mileageLow: 35000, mileageHigh: 75000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // LC200 2020
  { make: 'Toyota', model: 'Land Cruiser', year: 2020, conditionCategory: 'nig_used_low', lowPrice: 20000000, highPrice: 29000000, averagePrice: 29000000, mileageLow: 15000, mileageHigh: 45000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Land Cruiser', year: 2020, conditionCategory: 'tokunbo_low', lowPrice: 55000000, highPrice: 72500000, averagePrice: 72500000, mileageLow: 15000, mileageHigh: 45000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // LC300 2022
  { make: 'Toyota', model: 'Land Cruiser', year: 2022, conditionCategory: 'excellent', lowPrice: 130000000, highPrice: 165000000, averagePrice: 165000000, mileageLow: 5000, mileageHigh: 20000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // LC300 2025
  { make: 'Toyota', model: 'Land Cruiser', year: 2025, conditionCategory: 'excellent', lowPrice: 180000000, highPrice: 247500000, averagePrice: 247500000, mileageLow: 0, mileageHigh: 10000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
];

// Prado Data (15 entries)
const pradoData = [
  // J120 2003
  { make: 'Toyota', model: 'Prado', year: 2003, conditionCategory: 'nig_used_low', lowPrice: 1200000, highPrice: 1900000, averagePrice: 1900000, mileageLow: 140000, mileageHigh: 230000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Prado', year: 2003, conditionCategory: 'tokunbo_low', lowPrice: 2000000, highPrice: 3000000, averagePrice: 3000000, mileageLow: 140000, mileageHigh: 230000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // J120 2005
  { make: 'Toyota', model: 'Prado', year: 2005, conditionCategory: 'nig_used_low', lowPrice: 1500000, highPrice: 2400000, averagePrice: 2400000, mileageLow: 120000, mileageHigh: 210000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Prado', year: 2005, conditionCategory: 'tokunbo_low', lowPrice: 2800000, highPrice: 4200000, averagePrice: 4200000, mileageLow: 120000, mileageHigh: 210000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // J120 2007
  { make: 'Toyota', model: 'Prado', year: 2007, conditionCategory: 'nig_used_low', lowPrice: 2000000, highPrice: 3000000, averagePrice: 3000000, mileageLow: 100000, mileageHigh: 180000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Prado', year: 2007, conditionCategory: 'tokunbo_low', lowPrice: 3500000, highPrice: 5000000, averagePrice: 5000000, mileageLow: 100000, mileageHigh: 180000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // J150 2010
  { make: 'Toyota', model: 'Prado', year: 2010, conditionCategory: 'nig_used_low', lowPrice: 3500000, highPrice: 5300000, averagePrice: 5300000, mileageLow: 80000, mileageHigh: 155000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Prado', year: 2010, conditionCategory: 'tokunbo_low', lowPrice: 6000000, highPrice: 9000000, averagePrice: 9000000, mileageLow: 80000, mileageHigh: 155000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // J150 2013
  { make: 'Toyota', model: 'Prado', year: 2013, conditionCategory: 'nig_used_low', lowPrice: 5000000, highPrice: 7000000, averagePrice: 7000000, mileageLow: 65000, mileageHigh: 125000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Prado', year: 2013, conditionCategory: 'tokunbo_low', lowPrice: 9000000, highPrice: 13500000, averagePrice: 13500000, mileageLow: 65000, mileageHigh: 125000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // J150 2016
  { make: 'Toyota', model: 'Prado', year: 2016, conditionCategory: 'nig_used_low', lowPrice: 8000000, highPrice: 11000000, averagePrice: 11000000, mileageLow: 40000, mileageHigh: 85000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Prado', year: 2016, conditionCategory: 'tokunbo_low', lowPrice: 14000000, highPrice: 19500000, averagePrice: 19500000, mileageLow: 40000, mileageHigh: 85000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // J150 2018
  { make: 'Toyota', model: 'Prado', year: 2018, conditionCategory: 'nig_used_low', lowPrice: 12000000, highPrice: 17000000, averagePrice: 17000000, mileageLow: 25000, mileageHigh: 60000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Prado', year: 2018, conditionCategory: 'tokunbo_low', lowPrice: 22000000, highPrice: 31000000, averagePrice: 31000000, mileageLow: 25000, mileageHigh: 60000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // J250 2024
  { make: 'Toyota', model: 'Prado', year: 2024, conditionCategory: 'excellent', lowPrice: 100000000, highPrice: 125000000, averagePrice: 125000000, mileageLow: 0, mileageHigh: 10000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // J250 2025
  { make: 'Toyota', model: 'Prado', year: 2025, conditionCategory: 'excellent', lowPrice: 122000000, highPrice: 143500000, averagePrice: 143500000, mileageLow: 0, mileageHigh: 5000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
];

// Venza Data (11 entries)
const venzaData = [
  // Venza 2009
  { make: 'Toyota', model: 'Venza', year: 2009, conditionCategory: 'nig_used_low', lowPrice: 1000000, highPrice: 1500000, averagePrice: 1500000, mileageLow: 120000, mileageHigh: 200000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Venza', year: 2009, conditionCategory: 'tokunbo_low', lowPrice: 1500000, highPrice: 2300000, averagePrice: 2300000, mileageLow: 120000, mileageHigh: 200000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // Venza 2012
  { make: 'Toyota', model: 'Venza', year: 2012, conditionCategory: 'nig_used_low', lowPrice: 1500000, highPrice: 2300000, averagePrice: 2300000, mileageLow: 100000, mileageHigh: 175000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Venza', year: 2012, conditionCategory: 'tokunbo_low', lowPrice: 2500000, highPrice: 3800000, averagePrice: 3800000, mileageLow: 100000, mileageHigh: 175000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // Venza 2014
  { make: 'Toyota', model: 'Venza', year: 2014, conditionCategory: 'nig_used_low', lowPrice: 2000000, highPrice: 3000000, averagePrice: 3000000, mileageLow: 80000, mileageHigh: 150000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Venza', year: 2014, conditionCategory: 'tokunbo_low', lowPrice: 3500000, highPrice: 5300000, averagePrice: 5300000, mileageLow: 80000, mileageHigh: 150000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // Venza 2021 (2nd Gen Hybrid)
  { make: 'Toyota', model: 'Venza', year: 2021, conditionCategory: 'excellent', lowPrice: 25000000, highPrice: 32500000, averagePrice: 32500000, mileageLow: 10000, mileageHigh: 35000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // Venza 2023 (Hybrid)
  { make: 'Toyota', model: 'Venza', year: 2023, conditionCategory: 'excellent', lowPrice: 35000000, highPrice: 43500000, averagePrice: 43500000, mileageLow: 5000, mileageHigh: 20000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // Venza 2025 (Hybrid)
  { make: 'Toyota', model: 'Venza', year: 2025, conditionCategory: 'excellent', lowPrice: 42000000, highPrice: 51000000, averagePrice: 51000000, mileageLow: 0, mileageHigh: 8000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
];

// Avalon Data (16 entries)
const avalonData = [
  // Avalon 2000
  { make: 'Toyota', model: 'Avalon', year: 2000, conditionCategory: 'nig_used_low', lowPrice: 500000, highPrice: 750000, averagePrice: 750000, mileageLow: 160000, mileageHigh: 260000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Avalon', year: 2000, conditionCategory: 'tokunbo_low', lowPrice: 800000, highPrice: 1100000, averagePrice: 1100000, mileageLow: 160000, mileageHigh: 260000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // Avalon 2005
  { make: 'Toyota', model: 'Avalon', year: 2005, conditionCategory: 'nig_used_low', lowPrice: 700000, highPrice: 1100000, averagePrice: 1100000, mileageLow: 130000, mileageHigh: 220000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Avalon', year: 2005, conditionCategory: 'tokunbo_low', lowPrice: 1000000, highPrice: 1600000, averagePrice: 1600000, mileageLow: 130000, mileageHigh: 220000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // Avalon 2007
  { make: 'Toyota', model: 'Avalon', year: 2007, conditionCategory: 'nig_used_low', lowPrice: 900000, highPrice: 1300000, averagePrice: 1300000, mileageLow: 110000, mileageHigh: 200000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Avalon', year: 2007, conditionCategory: 'tokunbo_low', lowPrice: 1300000, highPrice: 2000000, averagePrice: 2000000, mileageLow: 110000, mileageHigh: 200000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // Avalon 2010
  { make: 'Toyota', model: 'Avalon', year: 2010, conditionCategory: 'nig_used_low', lowPrice: 1200000, highPrice: 1900000, averagePrice: 1900000, mileageLow: 90000, mileageHigh: 170000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Avalon', year: 2010, conditionCategory: 'tokunbo_low', lowPrice: 2000000, highPrice: 3000000, averagePrice: 3000000, mileageLow: 90000, mileageHigh: 170000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // Avalon 2013
  { make: 'Toyota', model: 'Avalon', year: 2013, conditionCategory: 'nig_used_low', lowPrice: 2000000, highPrice: 3000000, averagePrice: 3000000, mileageLow: 70000, mileageHigh: 135000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Avalon', year: 2013, conditionCategory: 'tokunbo_low', lowPrice: 3500000, highPrice: 5000000, averagePrice: 5000000, mileageLow: 70000, mileageHigh: 135000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // Avalon 2016
  { make: 'Toyota', model: 'Avalon', year: 2016, conditionCategory: 'nig_used_low', lowPrice: 3000000, highPrice: 4500000, averagePrice: 4500000, mileageLow: 45000, mileageHigh: 90000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  { make: 'Toyota', model: 'Avalon', year: 2016, conditionCategory: 'tokunbo_low', lowPrice: 6000000, highPrice: 8500000, averagePrice: 8500000, mileageLow: 45000, mileageHigh: 90000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // Avalon 2019
  { make: 'Toyota', model: 'Avalon', year: 2019, conditionCategory: 'excellent', lowPrice: 14000000, highPrice: 19000000, averagePrice: 19000000, mileageLow: 20000, mileageHigh: 50000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
  // Avalon 2022
  { make: 'Toyota', model: 'Avalon', year: 2022, conditionCategory: 'excellent', lowPrice: 22000000, highPrice: 28500000, averagePrice: 28500000, mileageLow: 5000, mileageHigh: 25000, dataSource: 'Toyota Nigeria Comprehensive Guide 2026' },
];

async function importData() {
  console.log('🚗 Importing Final Toyota Models');
  console.log('====================================');
  console.log(`✅ Using system user ID: ${SYSTEM_USER_ID}\n`);

  let successCount = 0;
  let errorCount = 0;

  // Import Land Cruiser
  console.log(`📊 Importing ${landCruiserData.length} Land Cruiser valuations...`);
  for (const data of landCruiserData) {
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

  console.log('🎉 Land Cruiser Import Complete!\n');

  // Import Prado
  console.log(`📊 Importing ${pradoData.length} Prado valuations...`);
  for (const data of pradoData) {
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

  console.log('🎉 Prado Import Complete!\n');

  // Import Venza
  console.log(`📊 Importing ${venzaData.length} Venza valuations...`);
  for (const data of venzaData) {
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

  console.log('🎉 Venza Import Complete!\n');

  // Import Avalon
  console.log(`📊 Importing ${avalonData.length} Avalon valuations...`);
  for (const data of avalonData) {
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

  console.log('🎉 Avalon Import Complete!\n');

  console.log('🎉 ALL TOYOTA MODELS IMPORT COMPLETE!');
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log('\n💡 Database now contains comprehensive Toyota pricing data for all 9 models');

  process.exit(0);
}

importData().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
