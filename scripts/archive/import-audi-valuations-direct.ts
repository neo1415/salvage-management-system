import 'dotenv/config';
import { db } from '../../src/lib/db/drizzle';
import { vehicleValuations } from '../../src/lib/db/schema/vehicle-valuations';
import { eq, and } from 'drizzle-orm';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

// Audi vehicle valuation data from comprehensive Audi Nigeria price guide (Feb 2026)
// Transform the data into separate records for each condition category
const audiRawData = [
  // A3 Series (2000-2024)
  { make: 'Audi', model: 'A3', year: 2000, nigUsedLow: 600000, nigUsedHigh: 1000000, avgUsed: 800000 },
  { make: 'Audi', model: 'A3', year: 2003, nigUsedLow: 800000, nigUsedHigh: 1400000, avgUsed: 1100000 },
  { make: 'Audi', model: 'A3', year: 2005, nigUsedLow: 1000000, nigUsedHigh: 1800000, avgUsed: 1400000 },
  { make: 'Audi', model: 'A3', year: 2007, nigUsedLow: 1100000, nigUsedHigh: 2000000, avgUsed: 1600000 },
  { make: 'Audi', model: 'A3', year: 2009, nigUsedLow: 1300000, nigUsedHigh: 2400000, avgUsed: 1900000 },
  { make: 'Audi', model: 'A3', year: 2012, nigUsedLow: 2000000, nigUsedHigh: 3500000, avgUsed: 2800000 },
  { make: 'Audi', model: 'A3', year: 2014, nigUsedLow: 2500000, nigUsedHigh: 4500000, avgUsed: 3500000 },
  { make: 'Audi', model: 'A3', year: 2016, nigUsedLow: 3500000, nigUsedHigh: 6000000, avgUsed: 4800000 },
  { make: 'Audi', model: 'A3', year: 2018, nigUsedLow: 4500000, nigUsedHigh: 8000000, avgUsed: 6300000 },
  { make: 'Audi', model: 'A3', year: 2020, tokunboLow: 11000000, tokunboHigh: 18000000, avgTokunbo: 14500000 },
  { make: 'Audi', model: 'A3', year: 2022, tokunboLow: 16000000, tokunboHigh: 24000000, avgTokunbo: 20000000 },
  { make: 'Audi', model: 'A3', year: 2024, tokunboLow: 22000000, tokunboHigh: 32000000, avgTokunbo: 27000000 },

  // A4 Series (2000-2024) - Most popular Audi in Nigeria
  { make: 'Audi', model: 'A4', year: 2000, nigUsedLow: 500000, nigUsedHigh: 900000, avgUsed: 700000 },
  { make: 'Audi', model: 'A4', year: 2002, nigUsedLow: 600000, nigUsedHigh: 1100000, avgUsed: 850000 },
  { make: 'Audi', model: 'A4', year: 2004, nigUsedLow: 700000, nigUsedHigh: 1300000, avgUsed: 1000000 },
  { make: 'Audi', model: 'A4', year: 2006, nigUsedLow: 900000, nigUsedHigh: 1700000, avgUsed: 1300000 },
  { make: 'Audi', model: 'A4', year: 2008, nigUsedLow: 1200000, nigUsedHigh: 2200000, avgUsed: 1700000 },
  { make: 'Audi', model: 'A4', year: 2010, nigUsedLow: 1500000, nigUsedHigh: 2800000, avgUsed: 2100000 },
  { make: 'Audi', model: 'A4', year: 2012, nigUsedLow: 2000000, nigUsedHigh: 3800000, avgUsed: 2900000 },
  { make: 'Audi', model: 'A4', year: 2014, nigUsedLow: 2800000, nigUsedHigh: 5000000, avgUsed: 3900000 },
  { make: 'Audi', model: 'A4', year: 2016, nigUsedLow: 4000000, nigUsedHigh: 7000000, avgUsed: 5500000 },
  { make: 'Audi', model: 'A4', year: 2018, nigUsedLow: 5500000, nigUsedHigh: 9500000, avgUsed: 7500000 },
  { make: 'Audi', model: 'A4', year: 2020, tokunboLow: 17000000, tokunboHigh: 26000000, avgTokunbo: 21500000 },
  { make: 'Audi', model: 'A4', year: 2022, tokunboLow: 25000000, tokunboHigh: 38000000, avgTokunbo: 31500000 },
  { make: 'Audi', model: 'A4', year: 2024, tokunboLow: 35000000, tokunboHigh: 50000000, avgTokunbo: 42500000 },

  // A6 Series (2000-2024) - Executive flagship
  { make: 'Audi', model: 'A6', year: 2000, nigUsedLow: 500000, nigUsedHigh: 900000, avgUsed: 700000 },
  { make: 'Audi', model: 'A6', year: 2002, nigUsedLow: 600000, nigUsedHigh: 1100000, avgUsed: 850000 },
  { make: 'Audi', model: 'A6', year: 2004, nigUsedLow: 700000, nigUsedHigh: 1300000, avgUsed: 1000000 },
  { make: 'Audi', model: 'A6', year: 2006, nigUsedLow: 900000, nigUsedHigh: 1800000, avgUsed: 1400000 },
  { make: 'Audi', model: 'A6', year: 2008, nigUsedLow: 1200000, nigUsedHigh: 2500000, avgUsed: 1900000 },
  { make: 'Audi', model: 'A6', year: 2010, nigUsedLow: 1600000, nigUsedHigh: 3200000, avgUsed: 2400000 },
  { make: 'Audi', model: 'A6', year: 2012, nigUsedLow: 2500000, nigUsedHigh: 5000000, avgUsed: 3800000 },
  { make: 'Audi', model: 'A6', year: 2014, nigUsedLow: 3500000, nigUsedHigh: 6500000, avgUsed: 5000000 },
  { make: 'Audi', model: 'A6', year: 2016, nigUsedLow: 5000000, nigUsedHigh: 9000000, avgUsed: 7000000 },
  { make: 'Audi', model: 'A6', year: 2018, nigUsedLow: 7000000, nigUsedHigh: 13000000, avgUsed: 10000000 },
  { make: 'Audi', model: 'A6', year: 2020, tokunboLow: 25000000, tokunboHigh: 38000000, avgTokunbo: 31500000 },
  { make: 'Audi', model: 'A6', year: 2022, tokunboLow: 35000000, tokunboHigh: 50000000, avgTokunbo: 42500000 },
  { make: 'Audi', model: 'A6', year: 2024, tokunboLow: 45000000, tokunboHigh: 65000000, avgTokunbo: 55000000 },

  // Q3 Series (2012-2024) - Compact luxury SUV
  { make: 'Audi', model: 'Q3', year: 2012, nigUsedLow: 2000000, nigUsedHigh: 4000000, avgUsed: 3000000 },
  { make: 'Audi', model: 'Q3', year: 2014, nigUsedLow: 2800000, nigUsedHigh: 5000000, avgUsed: 3900000 },
  { make: 'Audi', model: 'Q3', year: 2016, nigUsedLow: 3500000, nigUsedHigh: 6500000, avgUsed: 5000000 },
  { make: 'Audi', model: 'Q3', year: 2019, tokunboLow: 12000000, tokunboHigh: 20000000, avgTokunbo: 16000000 },
  { make: 'Audi', model: 'Q3', year: 2022, tokunboLow: 20000000, tokunboHigh: 30000000, avgTokunbo: 25000000 },
  { make: 'Audi', model: 'Q3', year: 2024, tokunboLow: 28000000, tokunboHigh: 40000000, avgTokunbo: 34000000 },

  // Q5 Series (2009-2025) - Mid-size luxury SUV
  { make: 'Audi', model: 'Q5', year: 2009, nigUsedLow: 1500000, nigUsedHigh: 2800000, avgUsed: 2100000 },
  { make: 'Audi', model: 'Q5', year: 2011, nigUsedLow: 2000000, nigUsedHigh: 3800000, avgUsed: 2900000 },
  { make: 'Audi', model: 'Q5', year: 2013, nigUsedLow: 2500000, nigUsedHigh: 4800000, avgUsed: 3600000 },
  { make: 'Audi', model: 'Q5', year: 2015, nigUsedLow: 3500000, nigUsedHigh: 6500000, avgUsed: 5000000 },
  { make: 'Audi', model: 'Q5', year: 2017, nigUsedLow: 5000000, nigUsedHigh: 8500000, avgUsed: 6800000 },
  { make: 'Audi', model: 'Q5', year: 2019, nigUsedLow: 7000000, nigUsedHigh: 12000000, avgUsed: 9500000 },
  { make: 'Audi', model: 'Q5', year: 2021, tokunboLow: 22000000, tokunboHigh: 33000000, avgTokunbo: 27500000 },
  { make: 'Audi', model: 'Q5', year: 2023, tokunboLow: 30000000, tokunboHigh: 45000000, avgTokunbo: 37500000 },
  { make: 'Audi', model: 'Q5', year: 2025, tokunboLow: 38000000, tokunboHigh: 55000000, avgTokunbo: 46500000 },

  // Q7 Series (2007-2024) - Full-size luxury SUV
  { make: 'Audi', model: 'Q7', year: 2007, nigUsedLow: 1500000, nigUsedHigh: 3000000, avgUsed: 2300000 },
  { make: 'Audi', model: 'Q7', year: 2009, nigUsedLow: 2000000, nigUsedHigh: 4000000, avgUsed: 3000000 },
  { make: 'Audi', model: 'Q7', year: 2011, nigUsedLow: 2500000, nigUsedHigh: 5000000, avgUsed: 3800000 },
  { make: 'Audi', model: 'Q7', year: 2013, nigUsedLow: 3500000, nigUsedHigh: 6500000, avgUsed: 5000000 },
  { make: 'Audi', model: 'Q7', year: 2014, nigUsedLow: 4000000, nigUsedHigh: 7500000, avgUsed: 5800000 },
  { make: 'Audi', model: 'Q7', year: 2016, nigUsedLow: 6000000, nigUsedHigh: 11000000, avgUsed: 8500000 },
  { make: 'Audi', model: 'Q7', year: 2018, nigUsedLow: 8000000, nigUsedHigh: 14000000, avgUsed: 11000000 },
  { make: 'Audi', model: 'Q7', year: 2020, tokunboLow: 25000000, tokunboHigh: 40000000, avgTokunbo: 32500000 },
  { make: 'Audi', model: 'Q7', year: 2022, tokunboLow: 38000000, tokunboHigh: 55000000, avgTokunbo: 46500000 },
  { make: 'Audi', model: 'Q7', year: 2024, tokunboLow: 50000000, tokunboHigh: 70000000, avgTokunbo: 60000000 },
];

// Transform raw data into database records with condition categories
function transformToDbRecords() {
  const records: any[] = [];
  
  for (const item of audiRawData) {
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
        dataSource: 'Audi Nigeria Comprehensive Price & Valuation Guide (Feb 2026)',
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
        dataSource: 'Audi Nigeria Comprehensive Price & Valuation Guide (Feb 2026)',
      });
    }
  }
  
  return records;
}

const audiValuations = transformToDbRecords();

async function importAudiValuations() {
  console.log('Starting Audi vehicle valuation import...');
  console.log(`Total records to import: ${audiValuations.length}`);

  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const valuation of audiValuations) {
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
  console.log(`Total records processed: ${audiValuations.length}`);
  console.log(`New records imported: ${imported}`);
  console.log(`Existing records updated: ${updated}`);
  console.log(`Records skipped (errors): ${skipped}`);
  console.log('======================\n');
}

importAudiValuations()
  .then(() => {
    console.log('Audi valuation import completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error during import:', error);
    process.exit(1);
  });
