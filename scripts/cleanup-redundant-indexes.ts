/**
 * Cleanup Redundant Indexes
 * 
 * This script removes redundant indexes that are covered by composite indexes.
 * 
 * ⚠️ IMPORTANT: Only run this after monitoring index usage for 24-48 hours!
 * 
 * Run: npm run db:check-index-usage
 * to verify these indexes are not being used before removing them.
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function cleanupRedundantIndexes() {
  console.log('🧹 Starting redundant index cleanup...\n');
  console.log('⚠️  WARNING: This will permanently remove indexes!\n');

  const redundantIndexes = [
    { 
      name: 'idx_auctions_status', 
      reason: 'Covered by idx_auctions_status_end_time',
      table: 'auctions'
    },
    { 
      name: 'idx_auctions_end_time', 
      reason: 'Covered by idx_auctions_status_end_time',
      table: 'auctions'
    },
    { 
      name: 'idx_bids_auction_id', 
      reason: 'Covered by idx_bids_auction_amount',
      table: 'bids'
    },
    { 
      name: 'idx_bids_vendor_id', 
      reason: 'Covered by idx_bids_vendor_created',
      table: 'bids'
    },
    { 
      name: 'idx_bids_auction_vendor', 
      reason: 'Not used in actual queries',
      table: 'bids'
    },
    { 
      name: 'idx_audit_logs_user_id', 
      reason: 'Use entity-based queries instead',
      table: 'audit_logs'
    },
    { 
      name: 'idx_audit_logs_entity_type_id', 
      reason: 'Upgraded to idx_audit_logs_entity_full',
      table: 'audit_logs'
    },
    { 
      name: 'idx_audit_logs_created_at', 
      reason: 'Covered by composite indexes',
      table: 'audit_logs'
    },
    { 
      name: 'idx_notifications_user_id', 
      reason: 'Covered by idx_notifications_user_created',
      table: 'notifications'
    },
    { 
      name: 'idx_notifications_read', 
      reason: 'Low cardinality, not useful',
      table: 'notifications'
    },
    { 
      name: 'idx_notifications_user_read', 
      reason: 'Upgraded to idx_notifications_user_created',
      table: 'notifications'
    },
  ];

  try {
    // Check which indexes actually exist
    console.log('🔍 Checking which redundant indexes exist...\n');
    const existingIndexes: typeof redundantIndexes = [];

    for (const idx of redundantIndexes) {
      try {
        const result = await db.execute(sql.raw(`
          SELECT indexrelname as indexname, pg_size_pretty(pg_relation_size(indexrelid)) as size
          FROM pg_stat_user_indexes
          WHERE schemaname = 'public'
          AND indexrelname = '${idx.name}'
        `));

        if (result.rows && result.rows.length > 0) {
          existingIndexes.push({
            ...idx,
            size: (result.rows[0] as any).size
          });
        }
      } catch (error) {
        console.error(`Error checking ${idx.name}:`, error);
      }
    }

    if (existingIndexes.length === 0) {
      console.log('✅ No redundant indexes found. Nothing to clean up!\n');
      return;
    }

    console.log(`Found ${existingIndexes.length} redundant indexes:\n`);
    existingIndexes.forEach(idx => {
      console.log(`   ❌ ${idx.name} (${(idx as any).size})`);
      console.log(`      Table: ${idx.table}`);
      console.log(`      Reason: ${idx.reason}\n`);
    });

    // Calculate total space to be freed
    const totalSizeResult = await db.execute(sql.raw(`
      SELECT pg_size_pretty(SUM(pg_relation_size(indexrelid))) as total_size
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
      AND indexrelname IN (${existingIndexes.map(idx => `'${idx.name}'`).join(', ')})
    `));

    const totalSize = totalSizeResult.rows?.[0] ? (totalSizeResult.rows[0] as any).total_size : 'unknown';
    console.log(`💾 Total space to be freed: ${totalSize}\n`);

    // Drop each redundant index
    console.log('🗑️  Removing redundant indexes...\n');
    let successCount = 0;
    let failCount = 0;

    for (const idx of existingIndexes) {
      try {
        console.log(`⏳ Dropping ${idx.name}...`);
        await db.execute(sql.raw(`DROP INDEX IF EXISTS ${idx.name}`));
        console.log(`✅ Dropped ${idx.name}\n`);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to drop ${idx.name}:`);
        console.error(`   ${error instanceof Error ? error.message : 'Unknown error'}\n`);
        failCount++;
      }
    }

    console.log('\n📊 Cleanup Summary:');
    console.log(`   ✅ Successfully removed: ${successCount} indexes`);
    if (failCount > 0) {
      console.log(`   ❌ Failed to remove: ${failCount} indexes`);
    }
    console.log(`   💾 Space freed: ${totalSize}\n`);

    console.log('✅ Redundant index cleanup complete!\n');
    console.log('💡 Next steps:');
    console.log('   1. Monitor application performance');
    console.log('   2. Check index usage: npm run db:check-index-usage');
    console.log('   3. Verify queries are still fast\n');

  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupRedundantIndexes()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
