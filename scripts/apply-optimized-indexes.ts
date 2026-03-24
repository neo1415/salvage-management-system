/**
 * Apply Optimized Performance Indexes
 * 
 * This script applies the optimized index strategy based on:
 * 1. Actual query patterns in the codebase
 * 2. ChatGPT feedback on redundant indexes
 * 3. PostgreSQL best practices
 * 
 * Changes:
 * - Adds critical missing indexes (idx_bids_auction_amount, idx_auctions_created_at, etc.)
 * - Removes redundant indexes that are covered by composite indexes
 * - Optimizes for actual query patterns
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function applyOptimizedIndexes() {
  console.log('🚀 Starting optimized index migration...\n');

  try {
    // Read the optimized migration file
    const migrationPath = path.join(process.cwd(), 'drizzle', 'migrations', 'add-performance-indexes-optimized.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Split into individual statements (filter out comments and empty lines)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Extract index name for logging
      const indexNameMatch = statement.match(/idx_\w+/);
      const indexName = indexNameMatch ? indexNameMatch[0] : `statement ${i + 1}`;

      try {
        console.log(`⏳ Executing: ${indexName}...`);
        await db.execute(sql.raw(statement));
        console.log(`✅ Success: ${indexName}\n`);
      } catch (error) {
        // If index already exists, that's okay
        if (error instanceof Error && error.message.includes('already exists')) {
          console.log(`ℹ️  Already exists: ${indexName}\n`);
        } else {
          console.error(`❌ Failed: ${indexName}`);
          console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
          throw error;
        }
      }
    }

    console.log('\n✅ All optimized indexes created successfully!\n');

    // Now check for redundant indexes that should be removed
    console.log('🔍 Checking for redundant indexes...\n');

    const redundantIndexes = [
      'idx_auctions_status',
      'idx_auctions_end_time',
      'idx_bids_auction_id',
      'idx_bids_vendor_id',
      'idx_bids_auction_vendor',
      'idx_audit_logs_user_id',
      'idx_audit_logs_entity_type_id',
      'idx_audit_logs_created_at',
      'idx_notifications_user_id',
      'idx_notifications_read',
      'idx_notifications_user_read',
    ];

    // Check which redundant indexes exist
    const existingRedundantIndexes: string[] = [];
    for (const indexName of redundantIndexes) {
      try {
        const result = await db.execute(sql.raw(`
          SELECT indexname 
          FROM pg_indexes 
          WHERE schemaname = 'public' 
          AND indexname = '${indexName}'
        `));
        
        if (result.rows && result.rows.length > 0) {
          existingRedundantIndexes.push(indexName);
        }
      } catch (error) {
        console.error(`Error checking index ${indexName}:`, error);
      }
    }

    if (existingRedundantIndexes.length > 0) {
      console.log(`⚠️  Found ${existingRedundantIndexes.length} redundant indexes:\n`);
      existingRedundantIndexes.forEach(idx => console.log(`   - ${idx}`));
      console.log('\n📋 To remove these redundant indexes, run:');
      console.log('   npm run db:cleanup-redundant-indexes\n');
      console.log('⚠️  IMPORTANT: Monitor index usage for 24-48 hours before removing!\n');
    } else {
      console.log('✅ No redundant indexes found.\n');
    }

    // Show index usage statistics
    console.log('📊 Checking index usage statistics...\n');
    
    try {
      const stats = await db.execute(sql.raw(`
        SELECT 
          schemaname,
          relname as tablename,
          indexrelname as indexname,
          idx_scan as scans,
          idx_tup_read as tuples_read,
          idx_tup_fetch as tuples_fetched
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        AND indexrelname LIKE 'idx_%'
        ORDER BY idx_scan DESC
        LIMIT 20
      `));

      if (stats.rows && stats.rows.length > 0) {
        console.log('Top 20 most used indexes:');
        console.table(stats.rows);
      }
    } catch (error) {
      console.error('Error fetching index statistics:', error);
    }

    console.log('\n✅ Optimized index migration complete!\n');
    console.log('📝 Summary:');
    console.log('   - Critical indexes added (idx_bids_auction_amount, idx_auctions_created_at, etc.)');
    console.log('   - Composite indexes optimized for actual query patterns');
    console.log('   - Redundant indexes identified for future cleanup');
    console.log('\n💡 Next steps:');
    console.log('   1. Monitor application performance for 24-48 hours');
    console.log('   2. Check index usage with: npm run db:check-index-usage');
    console.log('   3. Remove redundant indexes with: npm run db:cleanup-redundant-indexes');
    console.log('   4. Continue monitoring after cleanup\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
applyOptimizedIndexes()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
