/**
 * Run Migration 0014: Make AI fields nullable for drafts
 * 
 * This migration makes AI assessment fields nullable to support draft cases
 * that haven't completed AI assessment yet.
 */

import { sql } from 'drizzle-orm';
import { db } from '../src/lib/db/drizzle';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  console.log('Starting migration 0014: Make AI fields nullable for drafts...\n');

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '../src/lib/db/migrations/0014_make_ai_fields_nullable_for_drafts.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Execute migration
    console.log('Executing migration SQL...');
    await db.execute(sql.raw(migrationSQL));

    console.log('\n✅ Migration 0014 completed successfully!');
    console.log('\nChanges made:');
    console.log('- damage_severity: NOW NULLABLE (was NOT NULL)');
    console.log('- estimated_salvage_value: NOW NULLABLE (was NOT NULL)');
    console.log('- reserve_price: NOW NULLABLE (was NOT NULL)');
    console.log('- ai_assessment: NOW NULLABLE (was NOT NULL)');
    console.log('\nDraft cases can now be saved without AI assessment data.');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
