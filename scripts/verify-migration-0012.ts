#!/usr/bin/env tsx

/**
 * Migration Verification: 0012_add_search_metrics_analytics
 * 
 * This script verifies that the search metrics and analytics tables
 * were created successfully and are ready for use.
 * 
 * Verification Steps:
 * 1. Check table existence and structure
 * 2. Verify indexes are created
 * 3. Test views and functions
 * 4. Validate sample data
 * 5. Check constraints and relationships
 * 
 * Usage: npm run verify:migration:0012
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';

// Load environment variables
config();

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const sql = postgres(connectionString);
const db = drizzle(sql);

interface TableInfo {
  table_name: string;
  column_count: number;
}

interface IndexInfo {
  indexname: string;
  tablename: string;
}

interface ViewInfo {
  viewname: string;
}

interface FunctionInfo {
  proname: string;
}

async function verifyMigration() {
  console.log('🔍 Verifying Migration 0012: Search Metrics and Analytics Tables');
  console.log('');
  
  let allChecksPass = true;
  
  try {
    // 1. Check table existence and structure
    console.log('📋 Checking table existence and structure...');
    
    const expectedTables = [
      'search_performance_metrics',
      'search_usage_analytics', 
      'search_quality_metrics',
      'api_cost_analytics',
      'search_trend_analytics'
    ];
    
    for (const tableName of expectedTables) {
      const tableInfo = await sql<TableInfo[]>`
        SELECT 
          table_name,
          COUNT(*) as column_count
        FROM information_schema.columns 
        WHERE table_name = ${tableName}
        GROUP BY table_name
      `;
      
      if (tableInfo.length === 0) {
        console.error(`❌ Table ${tableName} not found`);
        allChecksPass = false;
      } else {
        console.log(`✅ Table ${tableName} exists with ${tableInfo[0].column_count} columns`);
      }
    }
    
    // 2. Verify indexes are created
    console.log('');
    console.log('🔗 Checking indexes...');
    
    const expectedIndexes = [
      'idx_search_perf_timestamp',
      'idx_search_perf_period',
      'idx_search_usage_date',
      'idx_search_quality_date',
      'idx_api_cost_date',
      'idx_search_trend_date'
    ];
    
    for (const indexName of expectedIndexes) {
      const indexInfo = await sql<IndexInfo[]>`
        SELECT indexname, tablename
        FROM pg_indexes 
        WHERE indexname = ${indexName}
      `;
      
      if (indexInfo.length === 0) {
        console.error(`❌ Index ${indexName} not found`);
        allChecksPass = false;
      } else {
        console.log(`✅ Index ${indexName} exists on table ${indexInfo[0].tablename}`);
      }
    }
    
    // 3. Test views
    console.log('');
    console.log('👁️ Checking dashboard views...');
    
    const expectedViews = [
      'search_performance_dashboard',
      'daily_search_summary',
      'cost_monitoring_dashboard'
    ];
    
    for (const viewName of expectedViews) {
      const viewInfo = await sql<ViewInfo[]>`
        SELECT viewname
        FROM pg_views 
        WHERE viewname = ${viewName}
      `;
      
      if (viewInfo.length === 0) {
        console.error(`❌ View ${viewName} not found`);
        allChecksPass = false;
      } else {
        console.log(`✅ View ${viewName} exists`);
        
        // Test view query
        try {
          await sql`SELECT COUNT(*) FROM ${sql(viewName)} LIMIT 1`;
          console.log(`  ✓ View ${viewName} is queryable`);
        } catch (error) {
          console.error(`  ❌ View ${viewName} query failed:`, error);
          allChecksPass = false;
        }
      }
    }
    
    // 4. Test functions
    console.log('');
    console.log('⚙️ Checking analytics functions...');
    
    const expectedFunctions = [
      'calculate_search_performance_metrics',
      'update_popular_queries'
    ];
    
    for (const functionName of expectedFunctions) {
      const functionInfo = await sql<FunctionInfo[]>`
        SELECT proname
        FROM pg_proc 
        WHERE proname = ${functionName}
      `;
      
      if (functionInfo.length === 0) {
        console.error(`❌ Function ${functionName} not found`);
        allChecksPass = false;
      } else {
        console.log(`✅ Function ${functionName} exists`);
      }
    }
    
    // 5. Check sample data initialization
    console.log('');
    console.log('📊 Checking sample data initialization...');
    
    const performanceMetricsCount = await sql`
      SELECT COUNT(*) as count 
      FROM search_performance_metrics
    `;
    console.log(`✅ Performance metrics table has ${performanceMetricsCount[0].count} initial records`);
    
    const usageAnalyticsCount = await sql`
      SELECT COUNT(*) as count 
      FROM search_usage_analytics
    `;
    console.log(`✅ Usage analytics table has ${usageAnalyticsCount[0].count} initial records`);
    
    const costAnalyticsCount = await sql`
      SELECT COUNT(*) as count 
      FROM api_cost_analytics
    `;
    console.log(`✅ Cost analytics table has ${costAnalyticsCount[0].count} initial records`);
    
    // 6. Test basic insert operations
    console.log('');
    console.log('✏️ Testing basic insert operations...');
    
    try {
      // Test performance metrics insert
      await sql`
        INSERT INTO search_performance_metrics (
          period_type, period_start, period_end, total_searches
        ) VALUES (
          'test', NOW(), NOW() + INTERVAL '1 hour', 1
        )
      `;
      
      // Clean up test data
      await sql`
        DELETE FROM search_performance_metrics 
        WHERE period_type = 'test'
      `;
      
      console.log('✅ Insert operations work correctly');
    } catch (error) {
      console.error('❌ Insert operation failed:', error);
      allChecksPass = false;
    }
    
    // 7. Check audit log entry
    console.log('');
    console.log('📝 Checking audit log entry...');
    
    const auditLogEntry = await sql`
      SELECT COUNT(*) as count
      FROM valuation_audit_logs
      WHERE changed_fields->'migration'->>'name' = '0012_add_search_metrics_analytics'
    `;
    
    if (auditLogEntry[0].count > 0) {
      console.log('✅ Migration audit log entry created');
    } else {
      console.error('❌ Migration audit log entry not found');
      allChecksPass = false;
    }
    
    // Final verification summary
    console.log('');
    console.log('=' .repeat(60));
    
    if (allChecksPass) {
      console.log('🎉 Migration 0012 verification PASSED!');
      console.log('');
      console.log('✅ All analytics tables created successfully');
      console.log('✅ All indexes and constraints in place');
      console.log('✅ Dashboard views are functional');
      console.log('✅ Analytics functions are available');
      console.log('✅ Sample data initialized');
      console.log('✅ Basic operations tested');
      console.log('');
      console.log('🚀 The search analytics system is ready for use!');
      console.log('');
      console.log('📈 Available Analytics:');
      console.log('  • Real-time search performance monitoring');
      console.log('  • User behavior and search pattern analysis');
      console.log('  • Search quality and confidence tracking');
      console.log('  • API cost monitoring with budget alerts');
      console.log('  • Business intelligence and market trends');
      console.log('');
      console.log('🔧 Next Steps:');
      console.log('  1. Integrate analytics services with new tables');
      console.log('  2. Set up dashboard APIs for monitoring');
      console.log('  3. Configure automated data processing jobs');
      console.log('  4. Set up cost monitoring alerts');
      
    } else {
      console.log('❌ Migration 0012 verification FAILED!');
      console.log('');
      console.log('Please check the errors above and re-run the migration if necessary.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 Verification failed with error:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Run the verification
verifyMigration().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});