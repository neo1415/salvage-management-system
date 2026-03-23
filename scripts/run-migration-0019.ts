/**
 * Migration Script: 0019 - Add Unique Constraint to Prevent Duplicate Documents
 * 
 * This migration adds a unique constraint to the release_forms table
 * to prevent duplicate documents from being created.
 * 
 * IMPORTANT: Run the duplicate cleanup script FIRST before running this migration!
 * 
 * Steps:
 * 1. Run: npm run ts-node scripts/find-and-delete-duplicate-documents.ts --live
 * 2. Then run: npm run ts-node scripts/run-migration-0019.ts
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('MIGRATION 0019: Add Unique Constraint to Documents');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // Read migration SQL file
    const migrationPath = path.join(
      process.cwd(),
      'src/lib/db/migrations/0019_add_unique_constraint_documents.sql'
    );
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📄 Migration SQL:');
    console.log(migrationSQL);
    console.log('');

    // Execute the migration
    console.log('⚙️  Executing migration...\n');
    await db.execute(sql.raw(migrationSQL));

    console.log('✅ Migration completed successfully!\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('NEXT STEPS:');
    console.log('═══════════════════════════════════════════════════════');
    console.log('1. Verify the unique constraint was created:');
    console.log('   SELECT * FROM pg_indexes WHERE tablename = \'release_forms\';');
    console.log('');
    console.log('2. Test document generation to ensure no duplicates:');
    console.log('   - Let an auction expire');
    console.log('   - Reload the page multiple times');
    console.log('   - Verify only 2 documents exist (not 4)');
    console.log('═══════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('');
    console.error('🔧 Troubleshooting:');
    console.error('  1. Did you run the duplicate cleanup script first?');
    console.error('     npm run ts-node scripts/find-and-delete-duplicate-documents.ts --live');
    console.error('');
    console.error('  2. Check if duplicates still exist:');
    console.error('     SELECT auction_id, vendor_id, document_type, COUNT(*)');
    console.error('     FROM release_forms');
    console.error('     GROUP BY auction_id, vendor_id, document_type');
    console.error('     HAVING COUNT(*) > 1;');
    console.error('');
    console.error('  3. If duplicates exist, delete them manually before running migration');
    console.error('');
    process.exit(1);
  }
}

runMigration();
