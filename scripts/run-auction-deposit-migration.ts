#!/usr/bin/env tsx

/**
 * Script to run the Auction Deposit System migration
 * 
 * This script applies migration 0028 which adds:
 * - 7 new tables for deposit system
 * - Extensions to bids and escrow_wallets tables
 * - Default configuration values
 * - Performance indexes
 * 
 * Usage:
 *   tsx scripts/run-auction-deposit-migration.ts
 */

import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function runMigration() {
  console.log('🚀 Starting Auction Deposit System Migration...\n');

  const sql = postgres(DATABASE_URL);

  try {
    // Read and execute the migration SQL directly
    const migrationPath = path.join(
      process.cwd(),
      'src/lib/db/migrations/0028_add_auction_deposit_system.sql'
    );

    console.log('📄 Reading migration file...');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('⚙️  Executing migration...');
    await sql.unsafe(migrationSQL);

    console.log('\n✅ Migration completed successfully!\n');

    // Verify migration
    console.log('🔍 Verifying migration...\n');

    // Check new tables
    const tablesResult = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN (
        'auction_winners', 'auction_documents', 'grace_extensions',
        'deposit_forfeitures', 'system_config', 'config_change_history',
        'deposit_events'
      )
      ORDER BY table_name
    `;

    console.log('📊 New tables created:');
    tablesResult.forEach((row) => {
      console.log(`   ✓ ${row.table_name}`);
    });

    // Check bids columns
    const bidsColumnsResult = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bids' 
      AND column_name IN ('deposit_amount', 'status', 'is_legacy')
      ORDER BY column_name
    `;

    console.log('\n📊 Bids table extensions:');
    bidsColumnsResult.forEach((row) => {
      console.log(`   ✓ ${row.column_name}`);
    });

    // Check escrow_wallets column
    const escrowColumnsResult = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'escrow_wallets' 
      AND column_name = 'forfeited_amount'
    `;

    console.log('\n📊 Escrow wallets table extensions:');
    escrowColumnsResult.forEach((row) => {
      console.log(`   ✓ ${row.column_name}`);
    });

    // Check default config
    const configResult = await sql`
      SELECT parameter, value, data_type 
      FROM system_config 
      ORDER BY parameter
    `;

    console.log('\n⚙️  Default configuration:');
    configResult.forEach((row) => {
      console.log(`   ✓ ${row.parameter}: ${row.value} (${row.data_type})`);
    });

    // Check wallet invariant constraint
    const constraintResult = await sql`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'escrow_wallets' 
      AND constraint_name = 'check_wallet_invariant'
    `;

    console.log('\n🔒 Wallet invariant constraint:');
    if (constraintResult.length > 0) {
      console.log('   ✓ check_wallet_invariant (active)');
    } else {
      console.log('   ⚠️  Constraint not found');
    }

    // Count indexes
    const indexResult = await sql`
      SELECT COUNT(*) as count
      FROM pg_indexes
      WHERE tablename IN (
        'auction_winners', 'auction_documents', 'grace_extensions',
        'deposit_forfeitures', 'config_change_history', 'deposit_events',
        'bids', 'escrow_wallets'
      )
      AND indexname LIKE 'idx_%'
    `;

    console.log('\n📈 Performance indexes:');
    console.log(`   ✓ ${indexResult[0].count} indexes created`);

    console.log('\n✨ Migration verification complete!\n');
    console.log('📖 Next steps:');
    console.log('   1. Review the migration in src/lib/db/migrations/0028_README.md');
    console.log('   2. Update your application code to use the new schema');
    console.log('   3. Test the deposit system with the feature flag enabled');
    console.log('   4. Monitor wallet invariant violations in production\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('\n💡 To rollback, run:');
    console.error('   psql -U your_user -d your_database -f src/lib/db/migrations/0028_rollback_auction_deposit_system.sql\n');
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Run migration
runMigration().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
