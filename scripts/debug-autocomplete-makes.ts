/**
 * Debug autocomplete makes - check exact make names in database
 */

import 'dotenv/config';
import { db } from '@/lib/db/drizzle';
import { vehicleValuations } from '@/lib/db/schema/vehicle-valuations';
import { sql } from 'drizzle-orm';

async function debugMakes() {
  console.log('🔍 Debugging Make Names in Database\n');
  console.log('='.repeat(80));

  try {
    // Get all distinct makes with their exact values
    const makes = await db
      .selectDistinct({ make: vehicleValuations.make })
      .from(vehicleValuations)
      .orderBy(vehicleValuations.make);

    console.log('\n📊 EXACT MAKE VALUES IN DATABASE:');
    console.log('='.repeat(80));
    
    makes.forEach((row, i) => {
      const makeValue = row.make;
      const makeLength = makeValue.length;
      const makeBytes = Buffer.from(makeValue).toString('hex');
      
      console.log(`\n${i + 1}. Make: "${makeValue}"`);
      console.log(`   Length: ${makeLength} characters`);
      console.log(`   Hex: ${makeBytes}`);
      console.log(`   Trimmed: "${makeValue.trim()}"`);
      console.log(`   Lower: "${makeValue.toLowerCase()}"`);
    });

    // Check for specific makes that aren't working
    console.log('\n\n🔎 CHECKING SPECIFIC MAKES:');
    console.log('='.repeat(80));

    const testMakes = ['Audi', 'Hyundai', 'Kia', 'Mercedes-Benz', 'Nissan'];
    
    for (const testMake of testMakes) {
      const exactMatch = await db
        .select({ count: sql<number>`count(*)` })
        .from(vehicleValuations)
        .where(sql`${vehicleValuations.make} = ${testMake}`);
      
      const caseInsensitiveMatch = await db
        .select({ count: sql<number>`count(*)` })
        .from(vehicleValuations)
        .where(sql`LOWER(${vehicleValuations.make}) = LOWER(${testMake})`);
      
      console.log(`\n${testMake}:`);
      console.log(`   Exact match: ${exactMatch[0].count} records`);
      console.log(`   Case-insensitive: ${caseInsensitiveMatch[0].count} records`);
    }

    // Sample a few records to see exact make values
    console.log('\n\n📋 SAMPLE RECORDS (First 5):');
    console.log('='.repeat(80));
    
    const samples = await db
      .select()
      .from(vehicleValuations)
      .limit(5);
    
    samples.forEach((s, i) => {
      console.log(`\n${i + 1}. Make: "${s.make}" | Model: "${s.model}" | Year: ${s.year}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ Debug complete!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugMakes()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
