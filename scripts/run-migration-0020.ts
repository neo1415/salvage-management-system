/**
 * Script: Run Migration 0020 - Add Unique Constraint to Payments
 * 
 * IMPORTANT: Run scripts/find-and-delete-duplicate-payments.ts --live FIRST
 * to clean up existing duplicates, otherwise this migration will fail.
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';

async function runMigration() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('MIGRATION 0020: Add Unique Constraint to Payments');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // Read migration file
    const migrationPath = path.join(
      process.cwd(),
      'src/lib/db/migrations/0020_add_unique_constraint_payments.sql'
    );
    const migrationSQL = await fs.readFile(migrationPath, 'utf-8');

    console.log('📄 Migration SQL:');
    console.log(migrationSQL);
    console.log('');

    // Check for existing duplicates
    console.log('🔍 Checking for duplicate payment records...\n');
    const duplicates = await db.execute(sql`
      SELECT auction_id, COUNT(*) as count
      FROM payments
      GROUP BY auction_id
      HAVING COUNT(*) > 1
    `);

    const duplicateCount = Array.isArray(duplicates) ? duplicates.length : (duplicates.rows?.length || 0);

    if (duplicateCount > 0) {
      console.error('❌ ERROR: Duplicate payment records found!');
      console.error(`   Found ${duplicateCount} auctions with duplicate payments.\n`);
      console.error('⚠️  You MUST run the cleanup script first:');
      console.error('   npm run script scripts/find-and-delete-duplicate-payments.ts --live\n');
      process.exit(1);
    }

    console.log('✅ No duplicate payment records found. Safe to proceed.\n');

    // Execute migration
    console.log('🚀 Executing migration...\n');
    await db.execute(sql.raw(migrationSQL));

    console.log('✅ Migration completed successfully!\n');

    // Verify constraint was created
    console.log('🔍 Verifying constraint...\n');
    const indexes = await db.execute(sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'payments'
      AND indexname = 'idx_payments_unique_auction'
    `);

    const indexCount = Array.isArray(indexes) ? indexes.length : (indexes.rows?.length || 0);

    if (indexCount > 0) {
      const indexRow = Array.isArray(indexes) ? indexes[0] : indexes.rows[0];
      console.log('✅ Unique constraint verified:');
      console.log(`   Index: ${indexRow.indexname}`);
      console.log(`   Definition: ${indexRow.indexdef}\n`);
    } else {
      console.error('❌ ERROR: Constraint not found after migration!');
      process.exit(1);
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('MIGRATION COMPLETE');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('✅ Unique constraint added to payments table');
    console.log('✅ Future duplicate payment attempts will be rejected');
    console.log('✅ Database integrity protected\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
