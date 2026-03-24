/**
 * Check Index Usage Statistics
 * 
 * This script checks which indexes are being used and which are not.
 * Use this to identify:
 * 1. Unused indexes that can be removed
 * 2. Most frequently used indexes
 * 3. Indexes that need optimization
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function checkIndexUsage() {
  console.log('📊 Checking index usage statistics...\n');

  try {
    // Get all custom indexes (idx_*)
    const allIndexes = await db.execute(sql.raw(`
      SELECT 
        schemaname,
        relname as tablename,
        indexrelname as indexname,
        idx_scan as scans,
        idx_tup_read as tuples_read,
        idx_tup_fetch as tuples_fetched,
        pg_size_pretty(pg_relation_size(indexrelid)) as size
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
      AND indexrelname LIKE 'idx_%'
      ORDER BY idx_scan DESC
    `));

    if (!allIndexes.rows || allIndexes.rows.length === 0) {
      console.log('❌ No custom indexes found.\n');
      return;
    }

    const indexes = allIndexes.rows as Array<{
      schemaname: string;
      tablename: string;
      indexname: string;
      scans: number;
      tuples_read: number;
      tuples_fetched: number;
      size: string;
    }>;

    // Separate used and unused indexes
    const usedIndexes = indexes.filter(idx => idx.scans > 0);
    const unusedIndexes = indexes.filter(idx => idx.scans === 0);

    // Show most used indexes
    console.log('✅ MOST USED INDEXES (Top 15):\n');
    console.table(
      usedIndexes.slice(0, 15).map(idx => ({
        Table: idx.tablename,
        Index: idx.indexname,
        Scans: idx.scans.toLocaleString(),
        'Tuples Read': idx.tuples_read.toLocaleString(),
        'Tuples Fetched': idx.tuples_fetched.toLocaleString(),
        Size: idx.size,
      }))
    );

    // Show unused indexes
    if (unusedIndexes.length > 0) {
      console.log('\n⚠️  UNUSED INDEXES (0 scans):\n');
      console.table(
        unusedIndexes.map(idx => ({
          Table: idx.tablename,
          Index: idx.indexname,
          Size: idx.size,
        }))
      );

      console.log('\n💡 These indexes have never been used and may be candidates for removal.');
      console.log('   However, they might be used for specific queries that haven\'t run yet.');
      console.log('   Monitor for at least 24-48 hours of production traffic before removing.\n');
    } else {
      console.log('\n✅ All indexes are being used!\n');
    }

    // Calculate total index size
    const totalSize = await db.execute(sql.raw(`
      SELECT pg_size_pretty(SUM(pg_relation_size(indexrelid))) as total_size
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
      AND indexrelname LIKE 'idx_%'
    `));

    if (totalSize.rows && totalSize.rows.length > 0) {
      console.log(`📦 Total custom index size: ${(totalSize.rows[0] as any).total_size}\n`);
    }

    // Show redundant indexes that should be removed
    const redundantIndexes = [
      { name: 'idx_auctions_status', reason: 'Covered by idx_auctions_status_end_time' },
      { name: 'idx_auctions_end_time', reason: 'Covered by idx_auctions_status_end_time' },
      { name: 'idx_bids_auction_id', reason: 'Covered by idx_bids_auction_amount' },
      { name: 'idx_bids_vendor_id', reason: 'Covered by idx_bids_vendor_created' },
      { name: 'idx_bids_auction_vendor', reason: 'Not used in actual queries' },
      { name: 'idx_audit_logs_user_id', reason: 'Use entity-based queries instead' },
      { name: 'idx_audit_logs_entity_type_id', reason: 'Upgraded to idx_audit_logs_entity_full' },
      { name: 'idx_audit_logs_created_at', reason: 'Covered by composite indexes' },
      { name: 'idx_notifications_user_id', reason: 'Covered by idx_notifications_user_created' },
      { name: 'idx_notifications_read', reason: 'Low cardinality, not useful' },
      { name: 'idx_notifications_user_read', reason: 'Upgraded to idx_notifications_user_created' },
    ];

    const existingRedundant = indexes.filter(idx => 
      redundantIndexes.some(r => r.name === idx.indexname)
    );

    if (existingRedundant.length > 0) {
      console.log('\n🔍 REDUNDANT INDEXES DETECTED:\n');
      existingRedundant.forEach(idx => {
        const reason = redundantIndexes.find(r => r.name === idx.indexname)?.reason;
        console.log(`   ❌ ${idx.indexname} (${idx.size})`);
        console.log(`      Table: ${idx.tablename}`);
        console.log(`      Scans: ${idx.scans.toLocaleString()}`);
        console.log(`      Reason: ${reason}`);
        console.log('');
      });

      console.log('💡 To remove redundant indexes, run:');
      console.log('   npm run db:cleanup-redundant-indexes\n');
    }

    // Show critical indexes that should exist
    console.log('\n✅ CRITICAL INDEXES CHECK:\n');
    const criticalIndexes = [
      'idx_bids_auction_amount',
      'idx_auctions_status_end_time',
      'idx_auctions_created_at',
      'idx_bids_vendor_created',
      'idx_audit_logs_entity_full',
      'idx_notifications_user_created',
    ];

    for (const criticalIndex of criticalIndexes) {
      const exists = indexes.some(idx => idx.indexname === criticalIndex);
      if (exists) {
        const idx = indexes.find(i => i.indexname === criticalIndex);
        console.log(`   ✅ ${criticalIndex} (${idx?.scans.toLocaleString() || 0} scans)`);
      } else {
        console.log(`   ❌ ${criticalIndex} - MISSING!`);
      }
    }

    console.log('\n✅ Index usage check complete!\n');

  } catch (error) {
    console.error('\n❌ Failed to check index usage:', error);
    process.exit(1);
  }
}

// Run the check
checkIndexUsage()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
