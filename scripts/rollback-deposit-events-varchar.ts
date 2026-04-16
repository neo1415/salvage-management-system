/**
 * Rollback Migration 0029: Restore UUID with Foreign Key
 * Reverts deposit_events.auction_id from VARCHAR back to UUID with foreign key
 */

import postgres from 'postgres';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function rollbackMigration() {
  console.log('🔄 Rolling back deposit_events VARCHAR change...\n');

  const sql = postgres(process.env.DATABASE_URL!);

  try {
    // Read rollback migration
    const rollbackSql = fs.readFileSync(
      'src/lib/db/migrations/0029_rollback_alter_deposit_events_auction_id.sql',
      'utf-8'
    );

    console.log('📄 Executing rollback migration...');
    await sql.unsafe(rollbackSql);

    console.log('✅ Rollback complete!\n');
    console.log('✨ deposit_events.auction_id is now:');
    console.log('   - Type: UUID');
    console.log('   - Foreign Key: ✅ (references auctions.id)');
    console.log('   - Data Integrity: ✅ Restored\n');

  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

rollbackMigration();
