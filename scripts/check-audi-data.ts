import 'dotenv/config';
import { db } from '@/lib/db/drizzle';
import { vehicleValuations } from '@/lib/db/schema/vehicle-valuations';
import { eq, sql } from 'drizzle-orm';

async function checkAudiData() {
  console.log('🚗 Checking Audi vehicle valuation data...\n');

  // Count total Audi valuations
  const audiCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(vehicleValuations)
    .where(eq(vehicleValuations.make, 'Audi'));

  console.log(`📊 Total Audi valuations: ${audiCount[0].count}`);

  // Get breakdown by model
  const modelBreakdown = await db
    .select({
      model: vehicleValuations.model,
      count: sql<number>`count(*)`,
    })
    .from(vehicleValuations)
    .where(eq(vehicleValuations.make, 'Audi'))
    .groupBy(vehicleValuations.model)
    .orderBy(vehicleValuations.model);

  console.log('\n📋 Breakdown by model:');
  for (const row of modelBreakdown) {
    console.log(`   - ${row.model}: ${row.count} records`);
  }

  // Sample some records
  const sampleRecords = await db
    .select()
    .from(vehicleValuations)
    .where(eq(vehicleValuations.make, 'Audi'))
    .limit(5);

  console.log('\n🔍 Sample records:');
  for (const record of sampleRecords) {
    console.log(`   ${record.year} ${record.make} ${record.model} (${record.conditionCategory}): ₦${Number(record.averagePrice).toLocaleString()}`);
  }

  console.log('\n✅ Audi data check complete!');
}

checkAudiData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
