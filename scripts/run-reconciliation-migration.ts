import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Run Reconciliation Migration
 * 
 * Applies the reconciliation tables migration to the database.
 * 
 * Usage: npx tsx scripts/run-reconciliation-migration.ts
 */

async function runMigration() {
  try {
    console.log('🚀 Starting reconciliation migration...');

    // Read the migration file
    const migrationPath = path.join(
      process.cwd(),
      'src/lib/db/migrations/0031_add_reconciliation_tables.sql'
    );

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📄 Migration file loaded');
    console.log('📊 Executing migration...');

    // Execute the migration
    await db.execute(sql.raw(migrationSQL));

    console.log('✅ Migration completed successfully!');
    console.log('\nCreated tables:');
    console.log('  - reconciliation_logs');
    console.log('  - unmatched_transactions');
    console.log('  - reconciliation_alerts');

    // Verify tables were created
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('reconciliation_logs', 'unmatched_transactions', 'reconciliation_alerts')
    `);

    const tableCount = Array.isArray(tables) ? tables.length : (tables.rows?.length || 0);
    console.log('\n✅ Verification: Found', tableCount, 'tables');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
