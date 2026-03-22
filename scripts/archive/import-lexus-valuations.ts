import 'dotenv/config';
import { db } from '../../src/lib/db/drizzle';
import { vehicleValuations } from '../../src/lib/db/schema/vehicle-valuations';
import { eq, and } from 'drizzle-orm';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

// Lexus vehicle valuation data from official Lexus Nigeria Comprehensive Price & Valuation Guide (Feb 2026)
// Transform the data into separate records for each condition category
const lexusRawData = [
  // ES Series
  { make: 'Lexus', model: 'ES300', year: 2000, nigUsedLow: 500000, nigUsedHigh: 900000, tokunboLow: 700000, tokunboHigh: 1300000, avgUsed: 700000, avgTokunbo: 1000000 },
  { make: 'Lexus', model: 'ES300', year: 2002, nigUsedLow: 600000, nigUsedHigh: 1100000, tokunboLow: 900000, tokunboHigh: 1700000, avgUsed: 850000, avgTokunbo: 1300000 },
  { make: 'Lexus', model: 'ES330', year: 2004, nigUsedLow: 800000, nigUsedHigh: 1500000, tokunboLow: 1200000, tokunboHigh: 2300000, avgUsed: 1100000, avgTokunbo: 1800000 },
  { make: 'Lexus', model: 'ES350', year: 2006, nigUsedLow: 1200000, nigUsedHigh: 2500000, tokunboLow: 2000000, tokunboHigh: 4000000, avgUsed: 1900000, avgTokunbo: 3000000 },
  { make: 'Lexus', model: 'ES350', year: 2008, nigUsedLow: 1500000, nigUsedHigh: 3000000, tokunboLow: 2500000, tokunboHigh: 5000000, avgUsed: 2300000, avgTokunbo: 3800000 },
  { make: 'Lexus', model: 'ES350', year: 2010, nigUsedLow: 2000000, nigUsedHigh: 4000000, tokunboLow: 3500000, tokunboHigh: 7000000, avgUsed: 3000000, avgTokunbo: 5300000 },
  { make: 'Lexus', model: 'ES350', year: 2012, nigUsedLow: 3000000, nigUsedHigh: 6000000, tokunboLow: 5500000, tokunboHigh: 10000000, avgUsed: 4500000, avgTokunbo: 7800000 },
  { make: 'Lexus', model: 'ES350', year: 2014, nigUsedLow: 4000000, nigUsedHigh: 7500000, tokunboLow: 8000000, tokunboHigh: 13000000, avgUsed: 5800000, avgTokunbo: 10500000 },
  { make: 'Lexus', model: 'ES350', year: 2016, nigUsedLow: 5000000, nigUsedHigh: 9000000, tokunboLow: 10000000, tokunboHigh: 18000000, avgUsed: 7000000, avgTokunbo: 14000000 },
  { make: 'Lexus', model: 'ES350', year: 2018, nigUsedLow: 7000000, nigUsedHigh: 13000000, tokunboLow: 15000000, tokunboHigh: 25000000, avgUsed: 10000000, avgTokunbo: 20000000 },
  { make: 'Lexus', model: 'ES350', year: 2020, tokunboLow: 22000000, tokunboHigh: 35000000, avgTokunbo: 28500000 },
  { make: 'Lexus', model: 'ES350', year: 2022, tokunboLow: 35000000, tokunboHigh: 50000000, avgTokunbo: 42500000 },
  { make: 'Lexus', model: 'ES350', year: 2024, tokunboLow: 45000000, tokunboHigh: 65000000, avgTokunbo: 55000000 },

  // IS Series
  { make: 'Lexus', model: 'IS250', year: 2006, nigUsedLow: 1000000, nigUsedHigh: 1900000, tokunboLow: 1500000, tokunboHigh: 2800000, avgUsed: 1400000, avgTokunbo: 2100000 },
  { make: 'Lexus', model: 'IS250', year: 2008, nigUsedLow: 1500000, nigUsedHigh: 3000000, tokunboLow: 2500000, tokunboHigh: 5000000, avgUsed: 2300000, avgTokunbo: 3800000 },
  { make: 'Lexus', model: 'IS250', year: 2010, nigUsedLow: 2000000, nigUsedHigh: 3800000, tokunboLow: 3500000, tokunboHigh: 6500000, avgUsed: 2900000, avgTokunbo: 5000000 },
  { make: 'Lexus', model: 'IS250', year: 2011, nigUsedLow: 2500000, nigUsedHigh: 5000000, tokunboLow: 5000000, tokunboHigh: 9000000, avgUsed: 3800000, avgTokunbo: 7000000 },
  { make: 'Lexus', model: 'IS250', year: 2013, nigUsedLow: 3500000, nigUsedHigh: 6500000, tokunboLow: 7000000, tokunboHigh: 12000000, avgUsed: 5000000, avgTokunbo: 9500000 },
  { make: 'Lexus', model: 'IS250', year: 2014, nigUsedLow: 4000000, nigUsedHigh: 7500000, tokunboLow: 8000000, tokunboHigh: 14000000, avgUsed: 5800000, avgTokunbo: 11000000 },
  { make: 'Lexus', model: 'IS300', year: 2016, nigUsedLow: 5000000, nigUsedHigh: 9000000, tokunboLow: 10000000, tokunboHigh: 17000000, avgUsed: 7000000, avgTokunbo: 13500000 },
  { make: 'Lexus', model: 'IS300', year: 2018, nigUsedLow: 7000000, nigUsedHigh: 12000000, tokunboLow: 14000000, tokunboHigh: 22000000, avgUsed: 9500000, avgTokunbo: 18000000 },
  { make: 'Lexus', model: 'IS350', year: 2021, tokunboLow: 22000000, tokunboHigh: 35000000, avgTokunbo: 28500000 },
  { make: 'Lexus', model: 'IS350', year: 2023, tokunboLow: 32000000, tokunboHigh: 48000000, avgTokunbo: 40000000 },

  // RX Series
  { make: 'Lexus', model: 'RX300', year: 2000, nigUsedLow: 600000, nigUsedHigh: 1200000, tokunboLow: 900000, tokunboHigh: 1800000, avgUsed: 900000, avgTokunbo: 1400000 },
  { make: 'Lexus', model: 'RX300', year: 2002, nigUsedLow: 700000, nigUsedHigh: 1300000, tokunboLow: 1000000, tokunboHigh: 2000000, avgUsed: 1000000, avgTokunbo: 1500000 },
  { make: 'Lexus', model: 'RX330', year: 2004, nigUsedLow: 900000, nigUsedHigh: 1700000, tokunboLow: 1400000, tokunboHigh: 2600000, avgUsed: 1300000, avgTokunbo: 2000000 },
  { make: 'Lexus', model: 'RX350', year: 2006, nigUsedLow: 1200000, nigUsedHigh: 2500000, tokunboLow: 2200000, tokunboHigh: 4500000, avgUsed: 1900000, avgTokunbo: 3400000 },
  { make: 'Lexus', model: 'RX350', year: 2007, nigUsedLow: 1500000, nigUsedHigh: 3000000, tokunboLow: 2500000, tokunboHigh: 5500000, avgUsed: 2300000, avgTokunbo: 4000000 },
  { make: 'Lexus', model: 'RX350', year: 2008, nigUsedLow: 2000000, nigUsedHigh: 4000000, tokunboLow: 3500000, tokunboHigh: 7000000, avgUsed: 3000000, avgTokunbo: 5300000 },
  { make: 'Lexus', model: 'RX350', year: 2010, nigUsedLow: 2500000, nigUsedHigh: 5500000, tokunboLow: 5000000, tokunboHigh: 9500000, avgUsed: 4000000, avgTokunbo: 7300000 },
  { make: 'Lexus', model: 'RX350', year: 2011, nigUsedLow: 3500000, nigUsedHigh: 7000000, tokunboLow: 7000000, tokunboHigh: 13000000, avgUsed: 5300000, avgTokunbo: 10000000 },
  { make: 'Lexus', model: 'RX350', year: 2013, nigUsedLow: 5000000, nigUsedHigh: 10000000, tokunboLow: 10000000, tokunboHigh: 18000000, avgUsed: 7500000, avgTokunbo: 14000000 },
  { make: 'Lexus', model: 'RX350', year: 2014, nigUsedLow: 6000000, nigUsedHigh: 12000000, tokunboLow: 13000000, tokunboHigh: 22000000, avgUsed: 9000000, avgTokunbo: 17500000 },
  { make: 'Lexus', model: 'RX350', year: 2016, nigUsedLow: 8000000, nigUsedHigh: 15000000, tokunboLow: 18000000, tokunboHigh: 30000000, avgUsed: 11500000, avgTokunbo: 24000000 },
  { make: 'Lexus', model: 'RX350', year: 2018, nigUsedLow: 12000000, nigUsedHigh: 22000000, tokunboLow: 25000000, tokunboHigh: 40000000, avgUsed: 17000000, avgTokunbo: 32500000 },
  { make: 'Lexus', model: 'RX350', year: 2019, tokunboLow: 32000000, tokunboHigh: 48000000, avgTokunbo: 40000000 },
  { make: 'Lexus', model: 'RX350', year: 2020, tokunboLow: 42000000, tokunboHigh: 60000000, avgTokunbo: 51000000 },
  { make: 'Lexus', model: 'RX350', year: 2022, tokunboLow: 65000000, tokunboHigh: 95000000, avgTokunbo: 80000000 },
  { make: 'Lexus', model: 'RX350', year: 2024, tokunboLow: 80000000, tokunboHigh: 115000000, avgTokunbo: 97500000 },

  // GX Series
  { make: 'Lexus', model: 'GX470', year: 2003, nigUsedLow: 1200000, nigUsedHigh: 2500000, tokunboLow: 2000000, tokunboHigh: 4000000, avgUsed: 1900000, avgTokunbo: 3000000 },
  { make: 'Lexus', model: 'GX470', year: 2005, nigUsedLow: 1800000, nigUsedHigh: 3500000, tokunboLow: 3000000, tokunboHigh: 6000000, avgUsed: 2600000, avgTokunbo: 4500000 },
  { make: 'Lexus', model: 'GX470', year: 2007, nigUsedLow: 2500000, nigUsedHigh: 5000000, tokunboLow: 4500000, tokunboHigh: 8000000, avgUsed: 3800000, avgTokunbo: 6300000 },
  { make: 'Lexus', model: 'GX470', year: 2009, nigUsedLow: 3000000, nigUsedHigh: 6000000, tokunboLow: 6000000, tokunboHigh: 10000000, avgUsed: 4500000, avgTokunbo: 8000000 },
  { make: 'Lexus', model: 'GX460', year: 2010, nigUsedLow: 4000000, nigUsedHigh: 8000000, tokunboLow: 7000000, tokunboHigh: 14000000, avgUsed: 6000000, avgTokunbo: 10500000 },
  { make: 'Lexus', model: 'GX460', year: 2013, nigUsedLow: 6000000, nigUsedHigh: 11000000, tokunboLow: 11000000, tokunboHigh: 20000000, avgUsed: 8500000, avgTokunbo: 15500000 },
  { make: 'Lexus', model: 'GX460', year: 2016, nigUsedLow: 9000000, nigUsedHigh: 16000000, tokunboLow: 18000000, tokunboHigh: 30000000, avgUsed: 12500000, avgTokunbo: 24000000 },
  { make: 'Lexus', model: 'GX460', year: 2019, nigUsedLow: 13000000, nigUsedHigh: 24000000, tokunboLow: 25000000, tokunboHigh: 42000000, avgUsed: 18500000, avgTokunbo: 33500000 },
  { make: 'Lexus', model: 'GX550', year: 2024, tokunboLow: 100000000, tokunboHigh: 150000000, avgTokunbo: 125000000 },
  { make: 'Lexus', model: 'GX550', year: 2025, tokunboLow: 120000000, tokunboHigh: 165000000, avgTokunbo: 142500000 },

  // LX Series
  { make: 'Lexus', model: 'LX470', year: 2000, nigUsedLow: 1500000, nigUsedHigh: 3500000, tokunboLow: 2500000, tokunboHigh: 5000000, avgUsed: 2500000, avgTokunbo: 3800000 },
  { make: 'Lexus', model: 'LX470', year: 2003, nigUsedLow: 2000000, nigUsedHigh: 4500000, tokunboLow: 3500000, tokunboHigh: 7000000, avgUsed: 3300000, avgTokunbo: 5300000 },
  { make: 'Lexus', model: 'LX470', year: 2007, nigUsedLow: 3000000, nigUsedHigh: 6000000, tokunboLow: 5000000, tokunboHigh: 10000000, avgUsed: 4500000, avgTokunbo: 7500000 },
  { make: 'Lexus', model: 'LX570', year: 2008, nigUsedLow: 4000000, nigUsedHigh: 8000000, tokunboLow: 7000000, tokunboHigh: 15000000, avgUsed: 6000000, avgTokunbo: 11000000 },
  { make: 'Lexus', model: 'LX570', year: 2010, nigUsedLow: 5000000, nigUsedHigh: 10000000, tokunboLow: 12000000, tokunboHigh: 22000000, avgUsed: 7500000, avgTokunbo: 17000000 },
  { make: 'Lexus', model: 'LX570', year: 2013, nigUsedLow: 7000000, nigUsedHigh: 14000000, tokunboLow: 18000000, tokunboHigh: 30000000, avgUsed: 10500000, avgTokunbo: 24000000 },
  { make: 'Lexus', model: 'LX570', year: 2015, nigUsedLow: 10000000, nigUsedHigh: 20000000, tokunboLow: 25000000, tokunboHigh: 45000000, avgUsed: 15000000, avgTokunbo: 35000000 },
  { make: 'Lexus', model: 'LX570', year: 2016, nigUsedLow: 14000000, nigUsedHigh: 26000000, tokunboLow: 32000000, tokunboHigh: 55000000, avgUsed: 20000000, avgTokunbo: 43500000 },
  { make: 'Lexus', model: 'LX570', year: 2017, nigUsedLow: 18000000, nigUsedHigh: 34000000, tokunboLow: 45000000, tokunboHigh: 72000000, avgUsed: 26000000, avgTokunbo: 58500000 },
  { make: 'Lexus', model: 'LX570', year: 2018, nigUsedLow: 22000000, nigUsedHigh: 40000000, tokunboLow: 55000000, tokunboHigh: 85000000, avgUsed: 31000000, avgTokunbo: 70000000 },
  { make: 'Lexus', model: 'LX570', year: 2019, tokunboLow: 65000000, tokunboHigh: 95000000, avgTokunbo: 80000000 },
  { make: 'Lexus', model: 'LX570', year: 2020, tokunboLow: 75000000, tokunboHigh: 110000000, avgTokunbo: 92500000 },
  { make: 'Lexus', model: 'LX600', year: 2022, tokunboLow: 120000000, tokunboHigh: 180000000, avgTokunbo: 150000000 },
  { make: 'Lexus', model: 'LX600', year: 2024, tokunboLow: 150000000, tokunboHigh: 220000000, avgTokunbo: 185000000 },

  // NX Series
  { make: 'Lexus', model: 'NX200t', year: 2015, nigUsedLow: 6000000, nigUsedHigh: 11000000, tokunboLow: 12000000, tokunboHigh: 20000000, avgUsed: 8500000, avgTokunbo: 16000000 },
  { make: 'Lexus', model: 'NX300', year: 2018, nigUsedLow: 10000000, nigUsedHigh: 18000000, tokunboLow: 20000000, tokunboHigh: 32000000, avgUsed: 14000000, avgTokunbo: 26000000 },
  { make: 'Lexus', model: 'NX350', year: 2022, tokunboLow: 45000000, tokunboHigh: 65000000, avgTokunbo: 55000000 },
  { make: 'Lexus', model: 'NX350', year: 2024, tokunboLow: 55000000, tokunboHigh: 80000000, avgTokunbo: 67500000 },

  // LS Series
  { make: 'Lexus', model: 'LS400', year: 2000, nigUsedLow: 800000, nigUsedHigh: 1500000, tokunboLow: 1200000, tokunboHigh: 2300000, avgUsed: 1100000, avgTokunbo: 1800000 },
  { make: 'Lexus', model: 'LS430', year: 2004, nigUsedLow: 1500000, nigUsedHigh: 3000000, tokunboLow: 2500000, tokunboHigh: 5000000, avgUsed: 2300000, avgTokunbo: 3800000 },
  { make: 'Lexus', model: 'LS460', year: 2007, nigUsedLow: 2500000, nigUsedHigh: 5000000, tokunboLow: 4500000, tokunboHigh: 8500000, avgUsed: 3800000, avgTokunbo: 6500000 },
  { make: 'Lexus', model: 'LS460', year: 2010, nigUsedLow: 4000000, nigUsedHigh: 8000000, tokunboLow: 8000000, tokunboHigh: 15000000, avgUsed: 6000000, avgTokunbo: 11500000 },
  { make: 'Lexus', model: 'LS460', year: 2013, nigUsedLow: 6000000, nigUsedHigh: 12000000, tokunboLow: 13000000, tokunboHigh: 23000000, avgUsed: 9000000, avgTokunbo: 18000000 },
  { make: 'Lexus', model: 'LS500', year: 2018, nigUsedLow: 15000000, nigUsedHigh: 28000000, tokunboLow: 35000000, tokunboHigh: 55000000, avgUsed: 21500000, avgTokunbo: 45000000 },
  { make: 'Lexus', model: 'LS500', year: 2021, tokunboLow: 60000000, tokunboHigh: 90000000, avgTokunbo: 75000000 },
  { make: 'Lexus', model: 'LS500', year: 2023, tokunboLow: 80000000, tokunboHigh: 120000000, avgTokunbo: 100000000 },
];

// Transform raw data into database records with condition categories
function transformToDbRecords() {
  const records: any[] = [];
  
  for (const item of lexusRawData) {
    // Add nig_used_low record if data exists
    if (item.nigUsedLow && item.nigUsedHigh && item.avgUsed) {
      records.push({
        make: item.make,
        model: item.model,
        year: item.year,
        conditionCategory: 'nig_used_low',
        lowPrice: item.nigUsedLow,
        highPrice: item.nigUsedHigh,
        averagePrice: item.avgUsed,
        dataSource: 'Lexus Nigeria Comprehensive Price & Valuation Guide (Feb 2026)',
      });
    }
    
    // Add tokunbo_low record if data exists
    if (item.tokunboLow && item.tokunboHigh && item.avgTokunbo) {
      records.push({
        make: item.make,
        model: item.model,
        year: item.year,
        conditionCategory: 'tokunbo_low',
        lowPrice: item.tokunboLow,
        highPrice: item.tokunboHigh,
        averagePrice: item.avgTokunbo,
        dataSource: 'Lexus Nigeria Comprehensive Price & Valuation Guide (Feb 2026)',
      });
    }
  }
  
  return records;
}

const lexusValuations = transformToDbRecords();

async function importLexusValuations() {
  console.log('Starting Lexus vehicle valuation import...');
  console.log(`Total records to import: ${lexusValuations.length}`);

  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const valuation of lexusValuations) {
    try {
      // Check if record already exists
      const existing = await db
        .select()
        .from(vehicleValuations)
        .where(
          and(
            eq(vehicleValuations.make, valuation.make),
            eq(vehicleValuations.model, valuation.model),
            eq(vehicleValuations.year, valuation.year),
            eq(vehicleValuations.conditionCategory, valuation.conditionCategory)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Update existing record
        await db
          .update(vehicleValuations)
          .set({
            lowPrice: valuation.lowPrice.toString(),
            highPrice: valuation.highPrice.toString(),
            averagePrice: valuation.averagePrice.toString(),
            dataSource: valuation.dataSource,
            updatedBy: SYSTEM_USER_ID,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(vehicleValuations.make, valuation.make),
              eq(vehicleValuations.model, valuation.model),
              eq(vehicleValuations.year, valuation.year),
              eq(vehicleValuations.conditionCategory, valuation.conditionCategory)
            )
          );
        updated++;
        console.log(`✓ Updated: ${valuation.year} ${valuation.make} ${valuation.model} (${valuation.conditionCategory})`);
      } else {
        // Insert new record
        await db.insert(vehicleValuations).values({
          make: valuation.make,
          model: valuation.model,
          year: valuation.year,
          conditionCategory: valuation.conditionCategory,
          lowPrice: valuation.lowPrice.toString(),
          highPrice: valuation.highPrice.toString(),
          averagePrice: valuation.averagePrice.toString(),
          dataSource: valuation.dataSource,
          createdBy: SYSTEM_USER_ID,
          updatedBy: SYSTEM_USER_ID,
        });
        imported++;
        console.log(`✓ Imported: ${valuation.year} ${valuation.make} ${valuation.model} (${valuation.conditionCategory})`);
      }
    } catch (error) {
      console.error(`✗ Error processing ${valuation.year} ${valuation.make} ${valuation.model} (${valuation.conditionCategory}):`, error);
      skipped++;
    }
  }

  console.log('\n=== Import Summary ===');
  console.log(`Total records processed: ${lexusValuations.length}`);
  console.log(`New records imported: ${imported}`);
  console.log(`Existing records updated: ${updated}`);
  console.log(`Records skipped (errors): ${skipped}`);
  console.log('======================\n');
}

importLexusValuations()
  .then(() => {
    console.log('Lexus valuation import completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error during import:', error);
    process.exit(1);
  });
