/**
 * Migration Script: 0015 - Add Notifications System
 * 
 * Creates notifications table for in-app notification center.
 * Supports 8 vendor notification types and system notifications.
 * 
 * Usage: npx tsx scripts/run-migration-0015.ts
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  console.log('🚀 Starting migration 0015: Add Notifications System...\n');

  try {
    // Read migration SQL file
    const migrationPath = path.join(process.cwd(), 'src/lib/db/migrations/0015_add_notifications_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Execute migration
    console.log('📝 Executing migration SQL...');
    await db.execute(sql.raw(migrationSQL));

    console.log('✅ Migration completed successfully!\n');

    // Verify table creation
    console.log('🔍 Verifying notifications table...');
    const result = await db.execute(sql`
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'notifications'
      ORDER BY ordinal_position;
    `);

    console.log('\n📊 Notifications table structure:');
    console.table(result.rows);

    // Verify indexes
    console.log('\n🔍 Verifying indexes...');
    const indexes = await db.execute(sql`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'notifications';
    `);

    console.log('\n📊 Indexes created:');
    console.table(indexes.rows);

    console.log('\n✅ Migration 0015 verification complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Update src/lib/db/schema/index.ts to export notifications schema');
    console.log('2. Create notification service');
    console.log('3. Create API routes');
    console.log('4. Create UI components');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
