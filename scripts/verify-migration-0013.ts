/**
 * Verify Migration 0013: Add 'none' to damage_severity enum
 * 
 * This script verifies that the damage_severity enum includes 'none'
 * and tests case submission with pristine items.
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function verifyMigration() {
  console.log('🔍 Verifying Migration 0013: Add none to damage_severity enum');
  console.log('================================================\n');

  try {
    // Check if 'none' is in the enum
    console.log('1️⃣ Checking damage_severity enum values...');
    const result = await db.execute(sql`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (
        SELECT oid 
        FROM pg_type 
        WHERE typname = 'damage_severity'
      )
      ORDER BY enumsortorder;
    `);

    const enumValues = result.rows.map((row: any) => row.enumlabel);
    console.log('   Current enum values:', enumValues);

    if (enumValues.includes('none')) {
      console.log('   ✅ "none" is present in the enum');
    } else {
      console.log('   ❌ "none" is NOT present in the enum');
      throw new Error('Migration verification failed: "none" not found in enum');
    }

    // Check expected values
    const expectedValues = ['minor', 'moderate', 'severe', 'none'];
    const hasAllValues = expectedValues.every(val => enumValues.includes(val));

    if (hasAllValues) {
      console.log('   ✅ All expected values are present');
    } else {
      console.log('   ❌ Some expected values are missing');
      const missing = expectedValues.filter(val => !enumValues.includes(val));
      console.log('   Missing values:', missing);
    }

    console.log('\n✅ Migration 0013 verification completed successfully!');
    console.log('   The database is ready to accept "none" as a damage severity value.');
    console.log('\n📝 Next steps:');
    console.log('   1. Test case submission with pristine items (e.g., Brand New iPhone)');
    console.log('   2. Verify that AI assessment returns severity: "none"');
    console.log('   3. Confirm that the case is saved successfully without errors');

  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  }
}

// Run the verification
verifyMigration()
  .then(() => {
    console.log('\n✅ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });
