/**
 * Verify Tier 0 Enum Values
 * 
 * Checks if tier0 was successfully added to the vendor_tier enum
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function verifyEnum() {
  console.log('🔍 Verifying vendor_tier enum values...\n');

  try {
    const result = await db.execute(sql`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (
        SELECT oid 
        FROM pg_type 
        WHERE typname = 'vendor_tier'
      )
      ORDER BY enumsortorder;
    `);

    console.log('✅ Current vendor_tier enum values:');
    if (result && Array.isArray(result)) {
      result.forEach((row: any) => {
        console.log(`   - ${row.enumlabel}`);
      });
    } else {
      console.log('Result:', result);
    }

    console.log('\n✅ Verification complete!');
  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  }
}

verifyEnum()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
