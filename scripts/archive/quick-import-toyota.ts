/**
 * Quick Toyota data import with proper user ID
 */

import { config } from 'dotenv';
import { db } from '../../src/lib/db/drizzle';
import { vehicleValuations } from '../../src/lib/db/schema/vehicle-valuations';

config();

// System user ID (from the error log)
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

async function quickImport() {
  console.log('🚗 Quick Toyota Import\n');
  
  try {
    // Sample data - just a few records to test
    const sampleData = [
      {
        make: 'Toyota',
        model: 'Camry',
        year: 2020,
        conditionCategory: 'excellent',
        lowPrice: '8500000',
        highPrice: '10500000',
        averagePrice: '9500000',
        mileageLow: 20000,
        mileageHigh: 50000,
        dataSource: 'Jiji.ng, Carlots.ng',
        createdBy: SYSTEM_USER_ID,
      },
      {
        make: 'Toyota',
        model: 'Camry',
        year: 2021,
        conditionCategory: 'excellent',
        lowPrice: '10000000',
        highPrice: '12000000',
        averagePrice: '11000000',
        mileageLow: 10000,
        mileageHigh: 30000,
        dataSource: 'Jiji.ng, Carlots.ng',
        createdBy: SYSTEM_USER_ID,
      },
      {
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        conditionCategory: 'excellent',
        lowPrice: '6500000',
        highPrice: '8000000',
        averagePrice: '7250000',
        mileageLow: 20000,
        mileageHigh: 50000,
        dataSource: 'Jiji.ng, Carlots.ng',
        createdBy: SYSTEM_USER_ID,
      },
      {
        make: 'Toyota',
        model: 'Highlander',
        year: 2020,
        conditionCategory: 'excellent',
        lowPrice: '15000000',
        highPrice: '18000000',
        averagePrice: '16500000',
        mileageLow: 20000,
        mileageHigh: 50000,
        dataSource: 'Jiji.ng, Carlots.ng',
        createdBy: SYSTEM_USER_ID,
      },
      {
        make: 'Lexus',
        model: 'ES350',
        year: 2020,
        conditionCategory: 'excellent',
        lowPrice: '18000000',
        highPrice: '22000000',
        averagePrice: '20000000',
        mileageLow: 20000,
        mileageHigh: 50000,
        dataSource: 'Jiji.ng, Carlots.ng',
        createdBy: SYSTEM_USER_ID,
      },
      {
        make: 'Honda',
        model: 'Accord',
        year: 2020,
        conditionCategory: 'excellent',
        lowPrice: '7500000',
        highPrice: '9500000',
        averagePrice: '8500000',
        mileageLow: 20000,
        mileageHigh: 50000,
        dataSource: 'Jiji.ng, Carlots.ng',
        createdBy: SYSTEM_USER_ID,
      },
    ];

    console.log(`📤 Inserting ${sampleData.length} records...`);
    
    await db.insert(vehicleValuations).values(sampleData);
    
    console.log('✅ Import successful!');
    
    // Verify
    const count = await db.select().from(vehicleValuations);
    console.log(`\n📊 Total records in database: ${count.length}`);
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

quickImport()
  .then(() => {
    console.log('\n✅ Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
