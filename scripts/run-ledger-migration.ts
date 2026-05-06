/**
 * Run Ledger System Migration
 * 
 * This script runs the double-entry ledger migration.
 * 
 * SAFETY: This is ADDITIVE ONLY - does not modify existing tables
 */

import 'dotenv/config';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  console.log('🚀 Starting ledger system migration...\n');

  try {
    // Read migration file
    const migrationPath = path.join(
      process.cwd(),
      'src/lib/db/migrations/0032_add_ledger_system.sql'
    );
    
    console.log('📄 Migration file loaded');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Execute migration
    console.log('📊 Executing migration...');
    await db.execute(sql.raw(migrationSQL));
    console.log('✅ Migration completed successfully!\n');

    // Verify tables were created
    console.log('🔍 Verifying tables...');
    
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('ledger_accounts', 'ledger_entries', 'ledger_transaction_summary')
      ORDER BY table_name
    `);

    console.log('✅ Created tables:');
    if (Array.isArray(tables.rows)) {
      tables.rows.forEach((row: any) => {
        console.log(`  - ${row.table_name}`);
      });
    } else if (Array.isArray(tables)) {
      tables.forEach((row: any) => {
        console.log(`  - ${row.table_name}`);
      });
    }

    // Verify NEM accounts were created
    console.log('\n🔍 Verifying NEM accounts...');
    const accounts = await db.execute(sql`
      SELECT account_type, account_id, name 
      FROM ledger_accounts 
      WHERE account_id = 'nem'
      ORDER BY account_type
    `);

    console.log('✅ NEM accounts:');
    if (Array.isArray(accounts.rows)) {
      accounts.rows.forEach((row: any) => {
        console.log(`  - ${row.account_type}: ${row.name}`);
      });
    } else if (Array.isArray(accounts)) {
      accounts.forEach((row: any) => {
        console.log(`  - ${row.account_type}: ${row.name}`);
      });
    }

    console.log('\n✅ Ledger system migration complete!');
    console.log('\nNext steps:');
    console.log('1. Integrate ledger service into payment flows');
    console.log('2. Test ledger entries with sample transactions');
    console.log('3. Verify ledger balance matches wallet balances');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
