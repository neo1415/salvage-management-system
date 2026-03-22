import 'dotenv/config';
import { db } from '../../src/lib/db/drizzle';
import { vehicleValuations } from '../../src/lib/db/schema/vehicle-valuations';
import { eq, and } from 'drizzle-orm';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

// Mercedes-Benz vehicle valuation data from official Mercedes-Benz in Nigeria Comprehensive Price & Valuation Guide (March 2026)
// Transform the data into separate records for each condition category
const mercedesRawData = [
  // C-Class (2002-2024)
  { make: 'Mercedes-Benz', model: 'C-Class W203', year: 2002, nigUsedLow: 500000, nigUsedHigh: 1000000, tokunboLow: 800000, tokunboHigh: 1700000, avgUsed: 750000, avgTokunbo: 1300000 },
  { make: 'Mercedes-Benz', model: 'C-Class W203', year: 2005, nigUsedLow: 700000, nigUsedHigh: 1400000, tokunboLow: 1200000, tokunboHigh: 2500000, avgUsed: 1100000, avgTokunbo: 1900000 },
  { make: 'Mercedes-Benz', model: 'C-Class W204', year: 2008, nigUsedLow: 1000000, nigUsedHigh: 2500000, tokunboLow: 2000000, tokunboHigh: 5000000, avgUsed: 1800000, avgTokunbo: 3500000 },
  { make: 'Mercedes-Benz', model: 'C-Class W204', year: 2010, nigUsedLow: 1500000, nigUsedHigh: 3500000, tokunboLow: 3000000, tokunboHigh: 6500000, avgUsed: 2500000, avgTokunbo: 4800000 },
  { make: 'Mercedes-Benz', model: 'C-Class W204', year: 2012, nigUsedLow: 2000000, nigUsedHigh: 4500000, tokunboLow: 4500000, tokunboHigh: 9000000, avgUsed: 3300000, avgTokunbo: 6800000 },
  { make: 'Mercedes-Benz', model: 'C-Class W205', year: 2015, nigUsedLow: 3000000, nigUsedHigh: 7000000, tokunboLow: 8000000, tokunboHigh: 15000000, avgUsed: 5000000, avgTokunbo: 11500000 },
  { make: 'Mercedes-Benz', model: 'C-Class W205', year: 2017, nigUsedLow: 4500000, nigUsedHigh: 10000000, tokunboLow: 13000000, tokunboHigh: 22000000, avgUsed: 7300000, avgTokunbo: 17500000 },
  { make: 'Mercedes-Benz', model: 'C-Class W205', year: 2018, nigUsedLow: 6000000, nigUsedHigh: 13000000, tokunboLow: 18000000, tokunboHigh: 30000000, avgUsed: 9500000, avgTokunbo: 24000000 },
  { make: 'Mercedes-Benz', model: 'C-Class W206', year: 2022, tokunboLow: 45000000, tokunboHigh: 75000000, avgTokunbo: 60000000 },
  { make: 'Mercedes-Benz', model: 'C-Class W206', year: 2024, tokunboLow: 65000000, tokunboHigh: 95000000, avgTokunbo: 80000000 },
  { make: 'Mercedes-Benz', model: 'C43 AMG', year: 2017, tokunboLow: 25000000, tokunboHigh: 42000000, avgTokunbo: 33500000 },
  { make: 'Mercedes-Benz', model: 'C63 AMG', year: 2016, tokunboLow: 35000000, tokunboHigh: 65000000, avgTokunbo: 50000000 },

  // E-Class (2000-2024)
  { make: 'Mercedes-Benz', model: 'E-Class W210', year: 2000, nigUsedLow: 400000, nigUsedHigh: 800000, tokunboLow: 700000, tokunboHigh: 1500000, avgUsed: 600000, avgTokunbo: 1100000 },
  { make: 'Mercedes-Benz', model: 'E-Class W211', year: 2003, nigUsedLow: 600000, nigUsedHigh: 1200000, tokunboLow: 1000000, tokunboHigh: 2000000, avgUsed: 900000, avgTokunbo: 1500000 },
  { make: 'Mercedes-Benz', model: 'E-Class W211', year: 2006, nigUsedLow: 900000, nigUsedHigh: 2000000, tokunboLow: 1500000, tokunboHigh: 3500000, avgUsed: 1400000, avgTokunbo: 2500000 },
  { make: 'Mercedes-Benz', model: 'E-Class W212', year: 2010, nigUsedLow: 1500000, nigUsedHigh: 3500000, tokunboLow: 3000000, tokunboHigh: 7000000, avgUsed: 2500000, avgTokunbo: 5000000 },
  { make: 'Mercedes-Benz', model: 'E-Class W212', year: 2013, nigUsedLow: 2500000, nigUsedHigh: 5000000, tokunboLow: 6000000, tokunboHigh: 11000000, avgUsed: 3800000, avgTokunbo: 8500000 },
  { make: 'Mercedes-Benz', model: 'E-Class W212', year: 2014, nigUsedLow: 3000000, nigUsedHigh: 6000000, tokunboLow: 8000000, tokunboHigh: 14000000, avgUsed: 4500000, avgTokunbo: 11000000 },
  { make: 'Mercedes-Benz', model: 'E-Class W213', year: 2017, nigUsedLow: 5000000, nigUsedHigh: 10000000, tokunboLow: 14000000, tokunboHigh: 25000000, avgUsed: 7500000, avgTokunbo: 19500000 },
  { make: 'Mercedes-Benz', model: 'E-Class W213', year: 2019, tokunboLow: 30000000, tokunboHigh: 50000000, avgTokunbo: 40000000 },
  { make: 'Mercedes-Benz', model: 'E-Class W213', year: 2021, tokunboLow: 50000000, tokunboHigh: 80000000, avgTokunbo: 65000000 },
  { make: 'Mercedes-Benz', model: 'E-Class W214', year: 2024, tokunboLow: 80000000, tokunboHigh: 120000000, avgTokunbo: 100000000 },
  { make: 'Mercedes-Benz', model: 'E43 AMG W213', year: 2017, tokunboLow: 35000000, tokunboHigh: 58000000, avgTokunbo: 46500000 },
  { make: 'Mercedes-Benz', model: 'E63 AMG W213', year: 2018, tokunboLow: 70000000, tokunboHigh: 120000000, avgTokunbo: 95000000 },

  // GLK-Class (2009-2015)
  { make: 'Mercedes-Benz', model: 'GLK350', year: 2009, nigUsedLow: 1500000, nigUsedHigh: 3500000, tokunboLow: 3000000, tokunboHigh: 6500000, avgUsed: 2500000, avgTokunbo: 4800000 },
  { make: 'Mercedes-Benz', model: 'GLK350', year: 2010, nigUsedLow: 2000000, nigUsedHigh: 5000000, tokunboLow: 5000000, tokunboHigh: 10000000, avgUsed: 3500000, avgTokunbo: 7500000 },
  { make: 'Mercedes-Benz', model: 'GLK350', year: 2012, nigUsedLow: 3000000, nigUsedHigh: 7000000, tokunboLow: 8000000, tokunboHigh: 15000000, avgUsed: 5000000, avgTokunbo: 11500000 },
  { make: 'Mercedes-Benz', model: 'GLK350', year: 2013, nigUsedLow: 4000000, nigUsedHigh: 8000000, tokunboLow: 11000000, tokunboHigh: 18000000, avgUsed: 6000000, avgTokunbo: 14500000 },
  { make: 'Mercedes-Benz', model: 'GLK350', year: 2015, nigUsedLow: 5000000, nigUsedHigh: 10000000, tokunboLow: 15000000, tokunboHigh: 25000000, avgUsed: 7500000, avgTokunbo: 20000000 },

  // GLC-Class (2016-2025)
  { make: 'Mercedes-Benz', model: 'GLC300', year: 2016, nigUsedLow: 5000000, nigUsedHigh: 10000000, tokunboLow: 18000000, tokunboHigh: 30000000, avgUsed: 7500000, avgTokunbo: 24000000 },
  { make: 'Mercedes-Benz', model: 'GLC300', year: 2017, nigUsedLow: 6000000, nigUsedHigh: 13000000, tokunboLow: 25000000, tokunboHigh: 42000000, avgUsed: 9500000, avgTokunbo: 33500000 },
  { make: 'Mercedes-Benz', model: 'GLC300', year: 2019, nigUsedLow: 9000000, nigUsedHigh: 18000000, tokunboLow: 35000000, tokunboHigh: 58000000, avgUsed: 13500000, avgTokunbo: 46500000 },
  { make: 'Mercedes-Benz', model: 'GLC300', year: 2020, tokunboLow: 48000000, tokunboHigh: 72000000, avgTokunbo: 60000000 },
  { make: 'Mercedes-Benz', model: 'GLC300', year: 2022, tokunboLow: 70000000, tokunboHigh: 105000000, avgTokunbo: 87500000 },
  { make: 'Mercedes-Benz', model: 'GLC43 AMG', year: 2018, tokunboLow: 45000000, tokunboHigh: 75000000, avgTokunbo: 60000000 },
  { make: 'Mercedes-Benz', model: 'GLC43 AMG', year: 2022, tokunboLow: 100000000, tokunboHigh: 145000000, avgTokunbo: 122500000 },

  // GLE / ML-Class (2006-2025)
  { make: 'Mercedes-Benz', model: 'ML350 W164', year: 2006, nigUsedLow: 900000, nigUsedHigh: 2000000, tokunboLow: 1800000, tokunboHigh: 4000000, avgUsed: 1400000, avgTokunbo: 2900000 },
  { make: 'Mercedes-Benz', model: 'ML350 W164', year: 2008, nigUsedLow: 1200000, nigUsedHigh: 2800000, tokunboLow: 2500000, tokunboHigh: 5500000, avgUsed: 2000000, avgTokunbo: 4000000 },
  { make: 'Mercedes-Benz', model: 'ML350 W164', year: 2010, nigUsedLow: 1800000, nigUsedHigh: 4000000, tokunboLow: 4000000, tokunboHigh: 8000000, avgUsed: 2900000, avgTokunbo: 6000000 },
  { make: 'Mercedes-Benz', model: 'ML350 W166', year: 2012, nigUsedLow: 2500000, nigUsedHigh: 5500000, tokunboLow: 6000000, tokunboHigh: 12000000, avgUsed: 4000000, avgTokunbo: 9000000 },
  { make: 'Mercedes-Benz', model: 'ML350 W166', year: 2014, nigUsedLow: 4000000, nigUsedHigh: 8000000, tokunboLow: 12000000, tokunboHigh: 20000000, avgUsed: 6000000, avgTokunbo: 16000000 },
  { make: 'Mercedes-Benz', model: 'GLE350 W166', year: 2016, nigUsedLow: 5000000, nigUsedHigh: 12000000, tokunboLow: 18000000, tokunboHigh: 32000000, avgUsed: 8500000, avgTokunbo: 25000000 },
  { make: 'Mercedes-Benz', model: 'GLE350 W166', year: 2018, nigUsedLow: 7000000, nigUsedHigh: 16000000, tokunboLow: 28000000, tokunboHigh: 50000000, avgUsed: 11500000, avgTokunbo: 39000000 },
  { make: 'Mercedes-Benz', model: 'GLE350 W167', year: 2020, tokunboLow: 65000000, tokunboHigh: 100000000, avgTokunbo: 82500000 },
  { make: 'Mercedes-Benz', model: 'GLE450 W167', year: 2019, tokunboLow: 73000000, tokunboHigh: 140000000, avgTokunbo: 106500000 },
  { make: 'Mercedes-Benz', model: 'GLE450 W167', year: 2022, tokunboLow: 120000000, tokunboHigh: 180000000, avgTokunbo: 150000000 },
  { make: 'Mercedes-Benz', model: 'GLE53 AMG', year: 2021, tokunboLow: 120000000, tokunboHigh: 190000000, avgTokunbo: 155000000 },

  // G-Class / G-Wagon (2003-2025)
  { make: 'Mercedes-Benz', model: 'G500', year: 2003, nigUsedLow: 3000000, nigUsedHigh: 7000000, tokunboLow: 6000000, tokunboHigh: 15000000, avgUsed: 5000000, avgTokunbo: 10500000 },
  { make: 'Mercedes-Benz', model: 'G500', year: 2008, nigUsedLow: 5000000, nigUsedHigh: 12000000, tokunboLow: 12000000, tokunboHigh: 25000000, avgUsed: 8500000, avgTokunbo: 18500000 },
  { make: 'Mercedes-Benz', model: 'G63 AMG W463', year: 2013, tokunboLow: 50000000, tokunboHigh: 90000000, avgTokunbo: 70000000 },
  { make: 'Mercedes-Benz', model: 'G63 AMG W463', year: 2017, tokunboLow: 100000000, tokunboHigh: 165000000, avgTokunbo: 132500000 },
  { make: 'Mercedes-Benz', model: 'G63 AMG W464', year: 2019, tokunboLow: 150000000, tokunboHigh: 230000000, avgTokunbo: 190000000 },
  { make: 'Mercedes-Benz', model: 'G63 AMG W464', year: 2022, tokunboLow: 220000000, tokunboHigh: 340000000, avgTokunbo: 280000000 },
  { make: 'Mercedes-Benz', model: 'G550', year: 2020, tokunboLow: 120000000, tokunboHigh: 200000000, avgTokunbo: 160000000 },
  { make: 'Mercedes-Benz', model: 'G580 EQ', year: 2024, tokunboLow: 180000000, tokunboHigh: 280000000, avgTokunbo: 230000000 },

  // GLS-Class / GL-Class (2008-2025)
  { make: 'Mercedes-Benz', model: 'GL450 W164', year: 2008, nigUsedLow: 1500000, nigUsedHigh: 3500000, tokunboLow: 3000000, tokunboHigh: 7000000, avgUsed: 2500000, avgTokunbo: 5000000 },
  { make: 'Mercedes-Benz', model: 'GL450 W166', year: 2013, nigUsedLow: 2500000, nigUsedHigh: 6000000, tokunboLow: 6000000, tokunboHigh: 12000000, avgUsed: 4300000, avgTokunbo: 9000000 },
  { make: 'Mercedes-Benz', model: 'GLS450 W167', year: 2020, tokunboLow: 80000000, tokunboHigh: 140000000, avgTokunbo: 110000000 },
  { make: 'Mercedes-Benz', model: 'GLS580 W167', year: 2021, tokunboLow: 130000000, tokunboHigh: 200000000, avgTokunbo: 165000000 },
  { make: 'Mercedes-Benz', model: 'Maybach GLS', year: 2022, tokunboLow: 250000000, tokunboHigh: 400000000, avgTokunbo: 325000000 },

  // S-Class (2002-2022)
  { make: 'Mercedes-Benz', model: 'S-Class W220', year: 2002, nigUsedLow: 600000, nigUsedHigh: 1300000, tokunboLow: 1000000, tokunboHigh: 2500000, avgUsed: 950000, avgTokunbo: 1800000 },
  { make: 'Mercedes-Benz', model: 'S-Class W221', year: 2007, nigUsedLow: 1200000, nigUsedHigh: 3000000, tokunboLow: 2500000, tokunboHigh: 6000000, avgUsed: 2100000, avgTokunbo: 4300000 },
  { make: 'Mercedes-Benz', model: 'S-Class W221', year: 2010, nigUsedLow: 2000000, nigUsedHigh: 5000000, tokunboLow: 5000000, tokunboHigh: 10000000, avgUsed: 3500000, avgTokunbo: 7500000 },
  { make: 'Mercedes-Benz', model: 'S-Class W222', year: 2014, nigUsedLow: 4000000, nigUsedHigh: 9000000, tokunboLow: 12000000, tokunboHigh: 25000000, avgUsed: 6500000, avgTokunbo: 18500000 },
  { make: 'Mercedes-Benz', model: 'S-Class W222', year: 2017, nigUsedLow: 7000000, nigUsedHigh: 16000000, tokunboLow: 25000000, tokunboHigh: 50000000, avgUsed: 11500000, avgTokunbo: 37500000 },
  { make: 'Mercedes-Benz', model: 'S-Class W223', year: 2021, tokunboLow: 90000000, tokunboHigh: 160000000, avgTokunbo: 125000000 },
  { make: 'Mercedes-Benz', model: 'S680 Maybach', year: 2022, tokunboLow: 200000000, tokunboHigh: 400000000, avgTokunbo: 300000000 },

  // A-Class / CLA / GLA (2013-2024)
  { make: 'Mercedes-Benz', model: 'A-Class W176', year: 2013, nigUsedLow: 1000000, nigUsedHigh: 2500000, tokunboLow: 2000000, tokunboHigh: 4500000, avgUsed: 1800000, avgTokunbo: 3300000 },
  { make: 'Mercedes-Benz', model: 'A-Class W177', year: 2019, tokunboLow: 18000000, tokunboHigh: 35000000, avgTokunbo: 26500000 },
  { make: 'Mercedes-Benz', model: 'CLA250', year: 2015, nigUsedLow: 2000000, nigUsedHigh: 5000000, tokunboLow: 5000000, tokunboHigh: 10000000, avgUsed: 3500000, avgTokunbo: 7500000 },
  { make: 'Mercedes-Benz', model: 'CLA250', year: 2020, tokunboLow: 25000000, tokunboHigh: 45000000, avgTokunbo: 35000000 },
  { make: 'Mercedes-Benz', model: 'GLA250', year: 2015, nigUsedLow: 2000000, nigUsedHigh: 4500000, tokunboLow: 5000000, tokunboHigh: 10000000, avgUsed: 3300000, avgTokunbo: 7500000 },
  { make: 'Mercedes-Benz', model: 'GLA250', year: 2021, tokunboLow: 28000000, tokunboHigh: 50000000, avgTokunbo: 39000000 },

  // Sporty / Open-Top (2006-2016)
  { make: 'Mercedes-Benz', model: 'CLK350', year: 2006, nigUsedLow: 1000000, nigUsedHigh: 2500000, tokunboLow: 2000000, tokunboHigh: 5000000, avgUsed: 1800000, avgTokunbo: 3500000 },
  { make: 'Mercedes-Benz', model: 'SLK250', year: 2012, nigUsedLow: 1500000, nigUsedHigh: 3500000, tokunboLow: 3500000, tokunboHigh: 7000000, avgUsed: 2500000, avgTokunbo: 5300000 },
  { make: 'Mercedes-Benz', model: 'AMG GT', year: 2016, tokunboLow: 65000000, tokunboHigh: 120000000, avgTokunbo: 92500000 },
];

// Transform raw data into database records with condition categories
function transformToDbRecords() {
  const records: any[] = [];
  
  for (const item of mercedesRawData) {
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
        dataSource: 'Mercedes-Benz in Nigeria Comprehensive Price & Valuation Guide (March 2026)',
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
        dataSource: 'Mercedes-Benz in Nigeria Comprehensive Price & Valuation Guide (March 2026)',
      });
    }
  }
  
  return records;
}

const mercedesValuations = transformToDbRecords();

async function importMercedesValuations() {
  console.log('Starting Mercedes-Benz vehicle valuation import...');
  console.log(`Total records to import: ${mercedesValuations.length}`);

  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const valuation of mercedesValuations) {
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
  console.log(`Total records processed: ${mercedesValuations.length}`);
  console.log(`New records imported: ${imported}`);
  console.log(`Existing records updated: ${updated}`);
  console.log(`Records skipped (errors): ${skipped}`);
  console.log('======================\n');
}

importMercedesValuations()
  .then(() => {
    console.log('Mercedes-Benz valuation import completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error during import:', error);
    process.exit(1);
  });
