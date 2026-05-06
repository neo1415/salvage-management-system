import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * Verify Reconciliation Tables
 * 
 * Checks that all reconciliation tables were created successfully.
 */

async function verifyTables() {
  try {
    console.log('🔍 Verifying reconciliation tables...\n');

    // Check reconciliation_logs
    const logsCount = await db.execute(sql`
      SELECT COUNT(*) as count FROM reconciliation_logs
    `);
    console.log('✅ reconciliation_logs table exists');

    // Check unmatched_transactions
    const unmatchedCount = await db.execute(sql`
      SELECT COUNT(*) as count FROM unmatched_transactions
    `);
    console.log('✅ unmatched_transactions table exists');

    // Check reconciliation_alerts
    const alertsCount = await db.execute(sql`
      SELECT COUNT(*) as count FROM reconciliation_alerts
    `);
    console.log('✅ reconciliation_alerts table exists');

    console.log('\n✅ All reconciliation tables verified successfully!');
    console.log('\nNext steps:');
    console.log('1. Configure cron jobs in vercel.json');
    console.log('2. Set CRON_SECRET environment variable');
    console.log('3. Access dashboard at /finance/reconciliation');

    process.exit(0);
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

verifyTables();
