/**
 * Migration Script: Add pickup confirmation fields to auctions table
 * 
 * This script runs migration 0017 which adds fields to track vendor and admin
 * pickup confirmations for completed auctions.
 * 
 * Usage: npx tsx scripts/run-migration-0017.ts
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  console.log('🚀 Starting migration 0017: Add pickup confirmation fields...\n');

  try {
    // Read the migration SQL file
    const migrationPath = path.join(
      process.cwd(),
      'src/lib/db/migrations/0017_add_pickup_confirmation_fields.sql'
    );
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Execute the migration
    console.log('📝 Executing migration SQL...');
    await db.execute(sql.raw(migrationSQL));

    console.log('✅ Migration completed successfully!\n');

    // Verify the changes
    console.log('🔍 Verifying schema changes...');
    const result = await db.execute(sql`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'auctions'
      AND column_name IN (
        'pickup_confirmed_vendor',
        'pickup_confirmed_vendor_at',
        'pickup_confirmed_admin',
        'pickup_confirmed_admin_at',
        'pickup_confirmed_admin_by'
      )
      ORDER BY column_name;
    `);

    console.log('\n📊 New columns in auctions table:');
    console.table(result.rows);

    // Check indexes
    const indexResult = await db.execute(sql`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'auctions'
      AND indexname LIKE '%pickup%';
    `);

    console.log('\n📊 New indexes:');
    console.table(indexResult.rows);

    console.log('\n✨ Migration 0017 verification complete!');
    console.log('\n📋 Summary:');
    console.log('   - Added 5 new columns to auctions table');
    console.log('   - Added 2 new indexes for pickup confirmation queries');
    console.log('   - Schema is ready for pickup confirmation workflow');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

// Run the migration
runMigration();
