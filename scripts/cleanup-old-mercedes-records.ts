import 'dotenv/config';
import { db } from '@/lib/db/drizzle';
import { vehicleValuations } from '@/lib/db/schema/vehicle-valuations';
import { eq, and, or } from 'drizzle-orm';

async function cleanupOldRecords() {
  console.log('\n🧹 CLEANING UP OLD MERCEDES VALUATION RECORDS\n');
  console.log('=' .repeat(80));
  
  // Delete records with non-standard condition categories
  const result = await db
    .delete(vehicleValuations)
    .where(
      and(
        eq(vehicleValuations.make, 'Mercedes-Benz'),
        or(
          eq(vehicleValuations.conditionCategory, 'nig_used_low'),
          eq(vehicleValuations.conditionCategory, 'tokunbo_low')
        )
      )
    )
    .returning();
  
  console.log(`\n✅ Deleted ${result.length} old records with non-standard condition categories\n`);
  
  // Verify cleanup
  const remaining = await db
    .select()
    .from(vehicleValuations)
    .where(
      and(
        eq(vehicleValuations.make, 'Mercedes-Benz'),
        eq(vehicleValuations.model, 'GLE350 W166'),
        eq(vehicleValuations.year, 2016)
      )
    );
  
  console.log(`\n📊 Remaining records for Mercedes GLE350 W166 2016:\n`);
  
  for (const record of remaining) {
    console.log(`  - ${record.conditionCategory}: ₦${parseFloat(record.averagePrice).toLocaleString()}`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Cleanup complete\n');
}

cleanupOldRecords()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  });
