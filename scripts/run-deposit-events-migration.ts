/**
 * Run Migration: Alter deposit_events auction_id to VARCHAR
 * 
 * This script applies the migration to change auction_id from UUID to VARCHAR(255)
 * for testing flexibility.
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  console.log('🔄 Running migration: Alter deposit_events auction_id to VARCHAR...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'src/lib/db/migrations/0029_alter_deposit_events_auction_id.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Execute the migration
    await db.execute(sql.raw(migrationSQL));

    console.log('✅ Migration completed successfully!');
    console.log('\nChanges applied:');
    console.log('  - Dropped foreign key constraint on deposit_events.auction_id');
    console.log('  - Changed auction_id column type from UUID to VARCHAR(255)');
    console.log('  - Recreated index on auction_id');
    console.log('\n✨ deposit_events table is now ready for testing with flexible auction IDs');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runMigration();
