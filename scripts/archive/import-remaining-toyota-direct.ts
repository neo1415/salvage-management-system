import 'dotenv/config';
import { db } from '../../src/lib/db/drizzle';
import { vehicleValuations } from '../../src/lib/db/schema/vehicle-valuations';
import { eq, and } from 'drizzle-orm';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

// Missing Toyota models: Highlander (need more), RAV4, Sienna, Land Cruiser, Prado, Venza, Avalon
// We already have: Camry (62), Corolla (26), Highlander (1)

const toyotaData = [
  // Highlander (add more records)
  { make: 'Toyota', model: 'Highlander', year: 2004, condition: 'fair', lowPrice: 2000000, highPrice: 3500000, avgPrice: 2750000, mileageLow: 120000, mileageHigh: 200000 },
  { make: 'Toyota', model: 'Highlander', year: 2007, condition: 'fair', lowPrice: 3000000, highPrice: 5500000, avgPrice: 4250000, mileageLow: 90000, mileageHigh: 165000 },
  { make: 'Toyota', model: 'Highlander', year: 2007, condition: 'good', lowPrice: 5500000, highPrice: 8000000, avgPrice: 6750000, mileageLow: 90000, mileageHigh: 165000 },
  { make: 'Toyota', model: 'Highlander', year: 2010, condition: 'fair', lowPrice: 5000000, highPrice: 9000000, avgPrice: 7000000, mileageLow: 75000, mileageHigh: 140000 },
  { make: 'Toyota', model: 'Highlander', year: 2010, condition: 'good', lowPrice: 9000000, highPrice: 13000000, avgPrice: 11000000, mileageLow: 75000, mileageHigh: 140000 },
  { make: 'Toyota', model: 'Highlander', year: 2012, condition: 'fair', lowPrice: 7000000, highPrice: 12000000, avgPrice: 9500000, mileageLow: 60000, mileageHigh: 115000 },
  { make: 'Toyota', model: 'Highlander', year: 2012, condition: 'good', lowPrice: 12000000, highPrice: 17000000, avgPrice: 14500000, mileageLow: 60000, mileageHigh: 115000 },
  { make: 'Toyota', model: 'Highlander', year: 2014, condition: 'fair', lowPrice: 10000000, highPrice: 16000000, avgPrice: 13000000, mileageLow: 45000, mileageHigh: 90000 },
  { make: 'Toyota', model: 'Highlander', year: 2014, condition: 'good', lowPrice: 16000000, highPrice: 22000000, avgPrice: 19000000, mileageLow: 45000, mileageHigh: 90000 },
  { make: 'Toyota', model: 'Highlander', year: 2016, condition: 'fair', lowPrice: 14000000, highPrice: 22000000, avgPrice: 18000000, mileageLow: 35000, mileageHigh: 70000 },
  { make: 'Toyota', model: 'Highlander', year: 2016, condition: 'good', lowPrice: 22000000, highPrice: 30000000, avgPrice: 26000000, mileageLow: 35000, mileageHigh: 70000 },
  { make: 'Toyota', model: 'Highlander', year: 2018, condition: 'fair', lowPrice: 18000000, highPrice: 28000000, avgPrice: 23000000, mileageLow: 25000, mileageHigh: 55000 },
  { make: 'Toyota', model: 'Highlander', year: 2018, condition: 'good', lowPrice: 28000000, highPrice: 38000000, avgPrice: 33000000, mileageLow: 25000, mileageHigh: 55000 },
  { make: 'Toyota', model: 'Highlander', year: 2020, condition: 'fair', lowPrice: 25000000, highPrice: 38000000, avgPrice: 31500000, mileageLow: 15000, mileageHigh: 40000 },
  { make: 'Toyota', model: 'Highlander', year: 2020, condition: 'good', lowPrice: 38000000, highPrice: 52000000, avgPrice: 45000000, mileageLow: 15000, mileageHigh: 40000 },
  { make: 'Toyota', model: 'Highlander', year: 2022, condition: 'fair', lowPrice: 35000000, highPrice: 50000000, avgPrice: 42500000, mileageLow: 5000, mileageHigh: 30000 },
  { make: 'Toyota', model: 'Highlander', year: 2022, condition: 'good', lowPrice: 50000000, highPrice: 68000000, avgPrice: 59000000, mileageLow: 5000, mileageHigh: 30000 },
  { make: 'Toyota', model: 'Highlander', year: 2024, condition: 'good', lowPrice: 60000000, highPrice: 75000000, avgPrice: 67500000, mileageLow: 0, mileageHigh: 20000 },
  { make: 'Toyota', model: 'Highlander', year: 2024, condition: 'excellent', lowPrice: 75000000, highPrice: 95000000, avgPrice: 85000000, mileageLow: 0, mileageHigh: 20000 },

  // RAV4
  { make: 'Toyota', model: 'RAV4', year: 2000, condition: 'fair', lowPrice: 800000, highPrice: 1500000, avgPrice: 1150000, mileageLow: 150000, mileageHigh: 240000 },
  { make: 'Toyota', model: 'RAV4', year: 2004, condition: 'fair', lowPrice: 1200000, highPrice: 2200000, avgPrice: 1700000, mileageLow: 120000, mileageHigh: 200000 },
  { make: 'Toyota', model: 'RAV4', year: 2008, condition: 'fair', lowPrice: 2000000, highPrice: 3800000, avgPrice: 2900000, mileageLow: 85000, mileageHigh: 160000 },
  { make: 'Toyota', model: 'RAV4', year: 2010, condition: 'fair', lowPrice: 3000000, highPrice: 5500000, avgPrice: 4250000, mileageLow: 75000, mileageHigh: 140000 },
  { make: 'Toyota', model: 'RAV4', year: 2013, condition: 'fair', lowPrice: 5000000, highPrice: 9000000, avgPrice: 7000000, mileageLow: 55000, mileageHigh: 100000 },
  { make: 'Toyota', model: 'RAV4', year: 2016, condition: 'fair', lowPrice: 9000000, highPrice: 15000000, avgPrice: 12000000, mileageLow: 35000, mileageHigh: 70000 },
  { make: 'Toyota', model: 'RAV4', year: 2019, condition: 'fair', lowPrice: 15000000, highPrice: 23000000, avgPrice: 19000000, mileageLow: 20000, mileageHigh: 45000 },
  { make: 'Toyota', model: 'RAV4', year: 2021, condition: 'fair', lowPrice: 20000000, highPrice: 30000000, avgPrice: 25000000, mileageLow: 10000, mileageHigh: 35000 },
  { make: 'Toyota', model: 'RAV4', year: 2023, condition: 'good', lowPrice: 38000000, highPrice: 48000000, avgPrice: 43000000, mileageLow: 0, mileageHigh: 25000 },
  { make: 'Toyota', model: 'RAV4', year: 2025, condition: 'excellent', lowPrice: 55000000, highPrice: 70000000, avgPrice: 62500000, mileageLow: 0, mileageHigh: 15000 },

  // Sienna
  { make: 'Toyota', model: 'Sienna', year: 2000, condition: 'fair', lowPrice: 900000, highPrice: 1700000, avgPrice: 1300000, mileageLow: 150000, mileageHigh: 240000 },
  { make: 'Toyota', model: 'Sienna', year: 2004, condition: 'fair', lowPrice: 1500000, highPrice: 2800000, avgPrice: 2150000, mileageLow: 120000, mileageHigh: 200000 },
  { make: 'Toyota', model: 'Sienna', year: 2007, condition: 'fair', lowPrice: 2500000, highPrice: 4500000, avgPrice: 3500000, mileageLow: 90000, mileageHigh: 165000 },
  { make: 'Toyota', model: 'Sienna', year: 2010, condition: 'fair', lowPrice: 4000000, highPrice: 7000000, avgPrice: 5500000, mileageLow: 75000, mileageHigh: 140000 },
  { make: 'Toyota', model: 'Sienna', year: 2012, condition: 'fair', lowPrice: 5500000, highPrice: 9500000, avgPrice: 7500000, mileageLow: 60000, mileageHigh: 115000 },
  { make: 'Toyota', model: 'Sienna', year: 2015, condition: 'fair', lowPrice: 9000000, highPrice: 15000000, avgPrice: 12000000, mileageLow: 40000, mileageHigh: 80000 },
  { make: 'Toyota', model: 'Sienna', year: 2018, condition: 'fair', lowPrice: 14000000, highPrice: 22000000, avgPrice: 18000000, mileageLow: 25000, mileageHigh: 55000 },
  { make: 'Toyota', model: 'Sienna', year: 2020, condition: 'fair', lowPrice: 18000000, highPrice: 28000000, avgPrice: 23000000, mileageLow: 15000, mileageHigh: 40000 },
  { make: 'Toyota', model: 'Sienna', year: 2022, condition: 'fair', lowPrice: 25000000, highPrice: 38000000, avgPrice: 31500000, mileageLow: 5000, mileageHigh: 30000 },
  { make: 'Toyota', model: 'Sienna', year: 2024, condition: 'good', lowPrice: 45000000, highPrice: 55000000, avgPrice: 50000000, mileageLow: 0, mileageHigh: 20000 },
  { make: 'Toyota', model: 'Sienna', year: 2025, condition: 'excellent', lowPrice: 60000000, highPrice: 75000000, avgPrice: 67500000, mileageLow: 0, mileageHigh: 15000 },

  // Land Cruiser
  { make: 'Toyota', model: 'Land Cruiser', year: 2000, condition: 'fair', lowPrice: 2000000, highPrice: 3500000, avgPrice: 2750000, mileageLow: 150000, mileageHigh: 240000 },
  { make: 'Toyota', model: 'Land Cruiser', year: 2005, condition: 'fair', lowPrice: 4000000, highPrice: 7000000, avgPrice: 5500000, mileageLow: 110000, mileageHigh: 190000 },
  { make: 'Toyota', model: 'Land Cruiser', year: 2008, condition: 'fair', lowPrice: 6000000, highPrice: 11000000, avgPrice: 8500000, mileageLow: 85000, mileageHigh: 160000 },
  { make: 'Toyota', model: 'Land Cruiser', year: 2012, condition: 'fair', lowPrice: 12000000, highPrice: 20000000, avgPrice: 16000000, mileageLow: 60000, mileageHigh: 115000 },
  { make: 'Toyota', model: 'Land Cruiser', year: 2015, condition: 'fair', lowPrice: 18000000, highPrice: 30000000, avgPrice: 24000000, mileageLow: 40000, mileageHigh: 80000 },
  { make: 'Toyota', model: 'Land Cruiser', year: 2018, condition: 'fair', lowPrice: 28000000, highPrice: 45000000, avgPrice: 36500000, mileageLow: 25000, mileageHigh: 55000 },
  { make: 'Toyota', model: 'Land Cruiser', year: 2020, condition: 'fair', lowPrice: 40000000, highPrice: 60000000, avgPrice: 50000000, mileageLow: 15000, mileageHigh: 40000 },
  { make: 'Toyota', model: 'Land Cruiser', year: 2022, condition: 'fair', lowPrice: 55000000, highPrice: 80000000, avgPrice: 67500000, mileageLow: 5000, mileageHigh: 30000 },
  { make: 'Toyota', model: 'Land Cruiser', year: 2025, condition: 'excellent', lowPrice: 120000000, highPrice: 160000000, avgPrice: 140000000, mileageLow: 0, mileageHigh: 15000 },

  // Prado
  { make: 'Toyota', model: 'Prado', year: 2003, condition: 'fair', lowPrice: 2000000, highPrice: 3500000, avgPrice: 2750000, mileageLow: 130000, mileageHigh: 210000 },
  { make: 'Toyota', model: 'Prado', year: 2007, condition: 'fair', lowPrice: 4000000, highPrice: 7000000, avgPrice: 5500000, mileageLow: 90000, mileageHigh: 165000 },
  { make: 'Toyota', model: 'Prado', year: 2010, condition: 'fair', lowPrice: 7000000, highPrice: 12000000, avgPrice: 9500000, mileageLow: 75000, mileageHigh: 140000 },
  { make: 'Toyota', model: 'Prado', year: 2014, condition: 'fair', lowPrice: 14000000, highPrice: 22000000, avgPrice: 18000000, mileageLow: 45000, mileageHigh: 90000 },
  { make: 'Toyota', model: 'Prado', year: 2017, condition: 'fair', lowPrice: 20000000, highPrice: 32000000, avgPrice: 26000000, mileageLow: 30000, mileageHigh: 65000 },
  { make: 'Toyota', model: 'Prado', year: 2020, condition: 'fair', lowPrice: 30000000, highPrice: 45000000, avgPrice: 37500000, mileageLow: 15000, mileageHigh: 40000 },
  { make: 'Toyota', model: 'Prado', year: 2023, condition: 'good', lowPrice: 55000000, highPrice: 70000000, avgPrice: 62500000, mileageLow: 0, mileageHigh: 25000 },
  { make: 'Toyota', model: 'Prado', year: 2025, condition: 'excellent', lowPrice: 85000000, highPrice: 110000000, avgPrice: 97500000, mileageLow: 0, mileageHigh: 15000 },

  // Venza
  { make: 'Toyota', model: 'Venza', year: 2009, condition: 'fair', lowPrice: 2500000, highPrice: 4500000, avgPrice: 3500000, mileageLow: 80000, mileageHigh: 150000 },
  { make: 'Toyota', model: 'Venza', year: 2012, condition: 'fair', lowPrice: 4500000, highPrice: 8000000, avgPrice: 6250000, mileageLow: 60000, mileageHigh: 115000 },
  { make: 'Toyota', model: 'Venza', year: 2015, condition: 'fair', lowPrice: 7000000, highPrice: 12000000, avgPrice: 9500000, mileageLow: 40000, mileageHigh: 80000 },
  { make: 'Toyota', model: 'Venza', year: 2020, condition: 'fair', lowPrice: 15000000, highPrice: 23000000, avgPrice: 19000000, mileageLow: 15000, mileageHigh: 40000 },
  { make: 'Toyota', model: 'Venza', year: 2023, condition: 'good', lowPrice: 30000000, highPrice: 40000000, avgPrice: 35000000, mileageLow: 0, mileageHigh: 25000 },
  { make: 'Toyota', model: 'Venza', year: 2025, condition: 'excellent', lowPrice: 50000000, highPrice: 65000000, avgPrice: 57500000, mileageLow: 0, mileageHigh: 15000 },

  // Avalon
  { make: 'Toyota', model: 'Avalon', year: 2000, condition: 'fair', lowPrice: 900000, highPrice: 1700000, avgPrice: 1300000, mileageLow: 150000, mileageHigh: 240000 },
  { make: 'Toyota', model: 'Avalon', year: 2005, condition: 'fair', lowPrice: 1800000, highPrice: 3200000, avgPrice: 2500000, mileageLow: 110000, mileageHigh: 190000 },
  { make: 'Toyota', model: 'Avalon', year: 2008, condition: 'fair', lowPrice: 2500000, highPrice: 4500000, avgPrice: 3500000, mileageLow: 85000, mileageHigh: 160000 },
  { make: 'Toyota', model: 'Avalon', year: 2013, condition: 'fair', lowPrice: 5000000, highPrice: 9000000, avgPrice: 7000000, mileageLow: 55000, mileageHigh: 100000 },
  { make: 'Toyota', model: 'Avalon', year: 2016, condition: 'fair', lowPrice: 8000000, highPrice: 14000000, avgPrice: 11000000, mileageLow: 35000, mileageHigh: 70000 },
  { make: 'Toyota', model: 'Avalon', year: 2019, condition: 'fair', lowPrice: 13000000, highPrice: 20000000, avgPrice: 16500000, mileageLow: 20000, mileageHigh: 45000 },
  { make: 'Toyota', model: 'Avalon', year: 2021, condition: 'fair', lowPrice: 18000000, highPrice: 28000000, avgPrice: 23000000, mileageLow: 10000, mileageHigh: 35000 },
  { make: 'Toyota', model: 'Avalon', year: 2022, condition: 'good', lowPrice: 32000000, highPrice: 42000000, avgPrice: 37000000, mileageLow: 5000, mileageHigh: 30000 },
];

async function importToyotaData() {
  console.log('🚗 Starting Toyota vehicle data import (remaining models)...\n');

  let importedCount = 0;
  let updatedCount = 0;
  let errorCount = 0;

  for (const record of toyotaData) {
    try {
      // Check if record already exists
      const existing = await db
        .select()
        .from(vehicleValuations)
        .where(
          and(
            eq(vehicleValuations.make, record.make),
            eq(vehicleValuations.model, record.model),
            eq(vehicleValuations.year, record.year),
            eq(vehicleValuations.conditionCategory, record.condition)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Update existing record
        await db
          .update(vehicleValuations)
          .set({
            lowPrice: record.lowPrice.toString(),
            highPrice: record.highPrice.toString(),
            averagePrice: record.avgPrice.toString(),
            mileageLow: record.mileageLow,
            mileageHigh: record.mileageHigh,
            dataSource: 'Toyota Nigeria Market Data 2026',
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(vehicleValuations.make, record.make),
              eq(vehicleValuations.model, record.model),
              eq(vehicleValuations.year, record.year),
              eq(vehicleValuations.conditionCategory, record.condition)
            )
          );
        updatedCount++;
      } else {
        // Insert new record
        await db.insert(vehicleValuations).values({
          make: record.make,
          model: record.model,
          year: record.year,
          conditionCategory: record.condition,
          lowPrice: record.lowPrice.toString(),
          highPrice: record.highPrice.toString(),
          averagePrice: record.avgPrice.toString(),
          mileageLow: record.mileageLow,
          mileageHigh: record.mileageHigh,
          dataSource: 'Toyota Nigeria Market Data 2026',
          createdBy: SYSTEM_USER_ID,
        });
        importedCount++;
      }

      // Progress indicator
      if ((importedCount + updatedCount) % 10 === 0) {
        console.log(`  Processed ${importedCount + updatedCount} records...`);
      }
    } catch (error) {
      console.error(`❌ Error importing ${record.year} ${record.model} (${record.condition}):`, error);
      errorCount++;
    }
  }

  console.log('\n✅ Toyota data import complete!');
  console.log(`   Imported: ${importedCount} new records`);
  console.log(`   Updated: ${updatedCount} existing records`);
  console.log(`   Errors: ${errorCount} records`);
  console.log(`\n📊 Total processed: ${importedCount + updatedCount} records`);
}

importToyotaData()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
