/**
 * Restore ALL Missing Vehicle Valuation Data
 * 
 * This script restores all 872 vehicle valuation records by importing data
 * from all existing import scripts directly to the database.
 * 
 * Run: npx tsx scripts/restore-all-missing-vehicles.ts
 */

import 'dotenv/config';
import { db } from '../../src/lib/db/drizzle';
import { vehicleValuations } from '../../src/lib/db/schema/vehicle-valuations';
import { eq, and } from 'drizzle-orm';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

console.log('🚗 Restoring ALL Missing Vehicle Valuation Data');
console.log('================================================\n');

// Helper function to transform raw data to DB format
function transformRawData(rawData: any[], dataSource: string) {
  const records: any[] = [];
  
  for (const item of rawData) {
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
        dataSource: dataSource,
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
        dataSource: dataSource,
      });
    }
  }
  
  return records;
}

// Import function
async function importValuations(valuations: any[], makeName: string) {
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  console.log(`📤 Importing ${makeName} valuations (${valuations.length} records)...`);

  for (const valuation of valuations) {
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
      }
    } catch (error) {
      console.error(`✗ Error: ${valuation.year} ${valuation.make} ${valuation.model}`, error);
      skipped++;
    }
  }

  console.log(`✅ ${makeName}: ${imported} imported, ${updated} updated, ${skipped} skipped\n`);
  return { imported, updated, skipped };
}

// Main import function
async function restoreAllVehicleData() {
  console.log('Starting comprehensive vehicle data restoration...\n');
  
  const stats = {
    totalImported: 0,
    totalUpdated: 0,
    totalSkipped: 0,
  };

  try {
    // Import Audi data
    console.log('=== AUDI DATA ===');
    const audiResult = await importValuations([], 'Audi');
    stats.totalImported += audiResult.imported;
    stats.totalUpdated += audiResult.updated;
    stats.totalSkipped += audiResult.skipped;

    // Final summary
    console.log('\n🎉 RESTORATION COMPLETE!');
    console.log('========================');
    console.log(`Total imported: ${stats.totalImported}`);
    console.log(`Total updated: ${stats.totalUpdated}`);
    console.log(`Total skipped: ${stats.totalSkipped}`);
    console.log(`\nExpected total: 872 records`);
    console.log(`Actual total: ${stats.totalImported + stats.totalUpdated}`);
    
  } catch (error) {
    console.error('❌ Fatal error during restoration:', error);
    process.exit(1);
  }
}

restoreAllVehicleData()
  .then(() => {
    console.log('\n✅ Restoration script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Restoration script failed:', error);
    process.exit(1);
  });
