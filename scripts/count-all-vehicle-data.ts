/**
 * Count ALL vehicle data in database - comprehensive check
 */

import 'dotenv/config';
import { db } from '@/lib/db/drizzle';
import { vehicleValuations, damageDeductions } from '@/lib/db/schema/vehicle-valuations';
import { sql } from 'drizzle-orm';

async function countAllData() {
  console.log('🔍 Comprehensive Database Check\n');
  console.log('='.repeat(60));

  try {
    // Get total counts
    const totalValuations = await db.select({ count: sql<number>`count(*)` }).from(vehicleValuations);
    const totalDeductions = await db.select({ count: sql<number>`count(*)` }).from(damageDeductions);

    console.log('\n📊 TOTAL COUNTS:');
    console.log(`   Vehicle Valuations: ${totalValuations[0].count}`);
    console.log(`   Damage Deductions: ${totalDeductions[0].count}`);

    // Get counts by make for valuations
    console.log('\n📊 VEHICLE VALUATIONS BY MAKE:');
    console.log('='.repeat(60));
    
    const valuationsByMake = await db
      .select({
        make: vehicleValuations.make,
        count: sql<number>`count(*)`
      })
      .from(vehicleValuations)
      .groupBy(vehicleValuations.make)
      .orderBy(vehicleValuations.make);

    for (const row of valuationsByMake) {
      console.log(`   ${row.make}: ${row.count} records`);
    }

    // Get counts by make for deductions
    console.log('\n🔧 DAMAGE DEDUCTIONS BY MAKE:');
    console.log('='.repeat(60));
    
    const deductionsByMake = await db
      .select({
        make: damageDeductions.make,
        count: sql<number>`count(*)`
      })
      .from(damageDeductions)
      .groupBy(damageDeductions.make)
      .orderBy(damageDeductions.make);

    for (const row of deductionsByMake) {
      console.log(`   ${row.make || 'NULL'}: ${row.count} records`);
    }

    // Sample records from each make
    console.log('\n📋 SAMPLE RECORDS (First 3 from each make):');
    console.log('='.repeat(60));

    for (const makeRow of valuationsByMake) {
      const samples = await db
        .select()
        .from(vehicleValuations)
        .where(sql`${vehicleValuations.make} = ${makeRow.make}`)
        .limit(3);

      console.log(`\n${makeRow.make}:`);
      samples.forEach((s, i) => {
        const price = s.basePrice ? Number(s.basePrice).toLocaleString() : 'N/A';
        console.log(`   ${i + 1}. ${s.year} ${s.make} ${s.model} - ₦${price}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Check complete!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

countAllData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
