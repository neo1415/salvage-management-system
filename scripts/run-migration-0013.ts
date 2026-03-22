/**
 * Run Migration 0013: Add 'none' to damage_severity enum
 * 
 * This migration adds 'none' as a valid value to the damage_severity enum
 * to support pristine items with no damage in AI assessment.
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  console.log('🚀 Running Migration 0013: Add none to damage_severity enum');
  console.log('================================================\n');

  try {
    // Read the migration SQL file
    const migrationPath = path.join(process.cwd(), 'src/lib/db/migrations/0013_add_none_to_damage_severity.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📄 Migration SQL:');
    console.log(migrationSQL);
    console.log('\n');

    // Execute the migration
    console.log('⚙️ Executing migration...');
    await db.execute(sql.raw(migrationSQL));

    console.log('✅ Migration completed successfully!\n');

    // Verify the enum values
    console.log('🔍 Verifying enum values...');
    const result = await db.execute(sql`
      SELECT e.enumlabel 
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'damage_severity'
      ORDER BY e.enumsortorder;
    `);

    console.log('✅ Current damage_severity enum values:');
    if (result && Array.isArray(result)) {
      result.forEach((row: any) => {
        console.log(`   - ${row.enumlabel}`);
      });
    } else {
      console.log('   Unable to fetch enum values, but migration executed successfully');
    }

    console.log('\n✅ Migration 0013 completed successfully!');
    console.log('   The damage_severity enum now includes "none" for pristine items.');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('\n✅ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
