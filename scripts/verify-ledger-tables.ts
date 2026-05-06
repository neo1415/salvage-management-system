/**
 * Verify Ledger Tables
 * 
 * Simple script to verify ledger tables exist and are working
 */

import 'dotenv/config';
import { db } from '@/lib/db';
import { ledgerAccounts, ledgerEntries } from '@/lib/db/schema/ledger';
import { sql } from 'drizzle-orm';

async function verifyTables() {
  console.log('🔍 Verifying ledger tables...\n');

  try {
    // Check ledger_accounts table
    console.log('1. Checking ledger_accounts table...');
    const accounts = await db.select().from(ledgerAccounts);
    console.log(`✅ ledger_accounts table exists (${accounts.length} accounts)`);
    
    if (accounts.length > 0) {
      console.log('   NEM accounts:');
      accounts.forEach(account => {
        console.log(`   - ${account.accountType}: ${account.name}`);
      });
    }

    // Check ledger_entries table
    console.log('\n2. Checking ledger_entries table...');
    const entries = await db.select().from(ledgerEntries).limit(1);
    console.log(`✅ ledger_entries table exists (${entries.length} entries)`);

    // Check materialized view
    console.log('\n3. Checking ledger_transaction_summary view...');
    const summary = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM ledger_transaction_summary
    `);
    console.log(`✅ ledger_transaction_summary view exists`);

    console.log('\n✅ All ledger tables verified successfully!\n');
    console.log('Next steps:');
    console.log('1. Integrate ledger service into payment flows');
    console.log('2. Test ledger entries with sample transactions');
    console.log('3. Verify ledger balances match wallet balances');

  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  }
}

verifyTables()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
