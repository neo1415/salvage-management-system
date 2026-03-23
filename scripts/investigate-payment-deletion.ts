/**
 * Investigate what happened to the original payment records
 * Check for any audit logs, soft deletes, or traces
 */

import { db } from '@/lib/db/drizzle';
import { payments, auctions, salvageCases } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

async function investigatePaymentDeletion() {
  console.log('🔍 Investigating payment deletion...\n');

  // Check if payments table has a deletedAt column (soft delete)
  console.log('1. Checking for soft-deleted payments...');
  try {
    const softDeleted = await db.execute(sql`
      SELECT * FROM payments WHERE deleted_at IS NOT NULL
    `);
    console.log(`   Found ${softDeleted.rows.length} soft-deleted payments\n`);
  } catch (error) {
    console.log('   No deletedAt column (hard deletes only)\n');
  }

  // Check database size and table info
  console.log('2. Checking payments table info...');
  try {
    const tableInfo = await db.execute(sql`
      SELECT 
        pg_size_pretty(pg_total_relation_size('payments')) as total_size,
        (SELECT count(*) FROM payments) as row_count
    `);
    console.log(`   Table size: ${tableInfo.rows[0]?.total_size}`);
    console.log(`   Row count: ${tableInfo.rows[0]?.row_count}\n`);
  } catch (error) {
    console.log(`   Error: ${error}\n`);
  }

  // Check for audit logs table
  console.log('3. Checking for audit logs...');
  try {
    const auditLogs = await db.execute(sql`
      SELECT * FROM audit_logs 
      WHERE table_name = 'payments' 
      AND action = 'DELETE'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    console.log(`   Found ${auditLogs.rows.length} payment deletion audit logs`);
    if (auditLogs.rows.length > 0) {
      console.log('   Recent deletions:');
      for (const log of auditLogs.rows) {
        console.log(`     - ${log.created_at}: ${log.action} by ${log.user_id}`);
      }
    }
    console.log('');
  } catch (error) {
    console.log('   No audit_logs table found\n');
  }

  // Check PostgreSQL WAL/logs for DELETE statements
  console.log('4. Checking for recent database activity...');
  try {
    const recentActivity = await db.execute(sql`
      SELECT 
        query,
        query_start,
        state
      FROM pg_stat_activity
      WHERE query LIKE '%payments%'
      AND query NOT LIKE '%pg_stat_activity%'
      ORDER BY query_start DESC
      LIMIT 5
    `);
    console.log(`   Found ${recentActivity.rows.length} recent queries involving payments`);
    for (const activity of recentActivity.rows) {
      console.log(`     - ${activity.query_start}: ${activity.query.substring(0, 100)}...`);
    }
    console.log('');
  } catch (error) {
    console.log(`   Error: ${error}\n`);
  }

  // Check if there are any payment-related foreign key violations
  console.log('5. Checking for orphaned references...');
  try {
    // Check if there are any references to non-existent payments
    const orphanedRefs = await db.execute(sql`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE column_name LIKE '%payment%'
      AND table_name != 'payments'
    `);
    console.log(`   Found ${orphanedRefs.rows.length} tables with payment references`);
    for (const ref of orphanedRefs.rows) {
      console.log(`     - ${ref.table_name}.${ref.column_name}`);
    }
    console.log('');
  } catch (error) {
    console.log(`   Error: ${error}\n`);
  }

  // Summary
  console.log('='.repeat(60));
  console.log('INVESTIGATION SUMMARY');
  console.log('='.repeat(60));
  console.log('Current state: 0 payment records in database');
  console.log('Expected: 7 payments totaling ₦1,720,000');
  console.log('Missing: 7 payments worth ₦1,720,000');
  console.log('');
  console.log('Possible causes:');
  console.log('1. Database migration that dropped/recreated payments table');
  console.log('2. Manual deletion via database client');
  console.log('3. Code that deleted payments during UI modernization');
  console.log('4. Database restore from old backup');
  console.log('5. Test data cleanup script');
  console.log('='.repeat(60));
}

investigatePaymentDeletion()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
