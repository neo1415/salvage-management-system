/**
 * Check condition categories used by each make in the database
 */

import 'dotenv/config';
import { db } from '@/lib/db/drizzle';
import { vehicleValuations } from '@/lib/db/schema/vehicle-valuations';
import { sql } from 'drizzle-orm';

async function checkConditionCategories() {
  console.log('\n🔍 Checking condition categories by make...\n');
  
  // Get distinct makes
  const makes = await db
    .selectDistinct({ make: vehicleValuations.make })
    .from(vehicleValuations);
  
  for (const { make } of makes) {
    console.log(`\n${make}:`);
    console.log('='.repeat(50));
    
    // Get distinct condition categories for this make
    const conditions = await db
      .selectDistinct({ condition: vehicleValuations.conditionCategory })
      .from(vehicleValuations)
      .where(sql`${vehicleValuations.make} = ${make}`);
    
    // Count records per condition
    for (const { condition } of conditions) {
      const count = await db
        .select({ count: sql<number>`count(*)` })
        .from(vehicleValuations)
        .where(
          sql`${vehicleValuations.make} = ${make} AND ${vehicleValuations.conditionCategory} = ${condition}`
        );
      
      console.log(`  ${condition}: ${count[0].count} records`);
    }
  }
  
  console.log('\n✅ Check complete!\n');
  process.exit(0);
}

checkConditionCategories().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
