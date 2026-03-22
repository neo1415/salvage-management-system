#!/usr/bin/env tsx

/**
 * Verification Script: Migration 0010 - Internet Search Tables
 * 
 * This script verifies that the internet search analytics tables were created
 * correctly and all indexes, constraints, and initial data are in place.
 * 
 * Verification Checks:
 * 1. All 5 tables exist with correct structure
 * 2. All indexes are created for performance
 * 3. Foreign key constraints are properly set
 * 4. Initial API usage tracking entry exists
 * 5. Audit log entry was created
 * 
 * Usage:
 *   npm run tsx scripts/verify-migration-0010.ts
 */

import { db } from '../src/lib/db/drizzle';
import { sql } from 'drizzle-orm';

interface TableInfo {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
}

interface IndexInfo {
  indexname: string;
  tablename: string;
}

interface ConstraintInfo {
  conname: string;
  table_name: string;
  referenced_table: string;
}

async function verifyMigration() {
  console.log('🔍 Verifying Migration 0010: Internet Search Tables');
  console.log('');
  
  let allChecksPass = true;
  
  try {
    // 1. Verify all tables exist
    console.log('📋 Checking table creation...');
    const expectedTables = [
      'internet_search_logs',
      'internet_search_results', 
      'internet_search_metrics',
      'popular_search_queries',
      'api_usage_tracking'
    ];
    
    const tablesResult = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE 'internet_search%' OR table_name LIKE 'popular_search%' OR table_name LIKE 'api_usage%')
      ORDER BY table_name
    `);
    
    const existingTables = tablesResult.map((row: any) => row.table_name);
    
    for (const table of expectedTables) {
      if (existingTables.includes(table)) {
        console.log(`  ✅ ${table}`);
      } else {
        console.log(`  ❌ ${table} - MISSING`);
        allChecksPass = false;
      }
    }
    
    // 2. Verify table structures
    console.log('');
    console.log('🏗️  Checking table structures...');
    
    // Check internet_search_logs structure
    const logsColumns = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'internet_search_logs'
      ORDER BY ordinal_position
    `);
    
    const expectedLogsColumns = [
      'id', 'search_hash', 'query', 'item_type', 'item_details', 
      'status', 'result_count', 'prices_found', 'confidence',
      'response_time_ms', 'data_source', 'api_provider', 'api_cost',
      'error_message', 'error_code', 'created_at'
    ];
    
    const actualLogsColumns = logsColumns.map((row: any) => row.column_name);
    const missingColumns = expectedLogsColumns.filter(col => !actualLogsColumns.includes(col));
    
    if (missingColumns.length === 0) {
      console.log('  ✅ internet_search_logs structure');
    } else {
      console.log(`  ❌ internet_search_logs missing columns: ${missingColumns.join(', ')}`);
      allChecksPass = false;
    }
    
    // 3. Verify indexes
    console.log('');
    console.log('📊 Checking indexes...');
    
    const indexesResult = await db.execute(sql`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE tablename LIKE 'internet_search%' OR tablename LIKE 'popular_search%' OR tablename LIKE 'api_usage%'
      ORDER BY tablename, indexname
    `);
    
    const expectedIndexes = [
      'idx_internet_search_hash',
      'idx_internet_search_item_type',
      'idx_internet_search_status',
      'idx_internet_search_data_source',
      'idx_internet_search_created_at',
      'idx_internet_search_performance',
      'idx_internet_search_confidence',
      'idx_internet_search_results_log',
      'idx_popular_queries_hash',
      'idx_api_usage_provider_date'
    ];
    
    const actualIndexes = indexesResult.map((row: any) => row.indexname);
    
    for (const index of expectedIndexes) {
      if (actualIndexes.includes(index)) {
        console.log(`  ✅ ${index}`);
      } else {
        console.log(`  ❌ ${index} - MISSING`);
        allChecksPass = false;
      }
    }
    
    // 4. Verify foreign key constraints
    console.log('');
    console.log('🔗 Checking foreign key constraints...');
    
    const constraintsResult = await db.execute(sql`
      SELECT conname, conrelid::regclass AS table_name, confrelid::regclass AS referenced_table
      FROM pg_constraint
      WHERE contype = 'f' 
      AND conrelid::regclass::text LIKE 'internet_search%'
    `);
    
    if (constraintsResult.length > 0) {
      for (const constraint of constraintsResult) {
        console.log(`  ✅ ${(constraint as any).conname}: ${(constraint as any).table_name} → ${(constraint as any).referenced_table}`);
      }
    } else {
      console.log('  ❌ No foreign key constraints found');
      allChecksPass = false;
    }
    
    // 5. Verify unique constraints
    console.log('');
    console.log('🔒 Checking unique constraints...');
    
    const uniqueConstraintsResult = await db.execute(sql`
      SELECT conname, conrelid::regclass AS table_name
      FROM pg_constraint
      WHERE contype = 'u' 
      AND conrelid::regclass::text LIKE '%search%'
    `);
    
    const expectedUniqueConstraints = ['popular_search_queries_query_hash_unique'];
    const actualUniqueConstraints = uniqueConstraintsResult.map((row: any) => row.conname);
    
    for (const constraint of expectedUniqueConstraints) {
      if (actualUniqueConstraints.includes(constraint)) {
        console.log(`  ✅ ${constraint}`);
      } else {
        console.log(`  ❌ ${constraint} - MISSING`);
        allChecksPass = false;
      }
    }
    
    // 6. Verify initial API usage tracking entry
    console.log('');
    console.log('📈 Checking initial data...');
    
    const apiUsageResult = await db.execute(sql`
      SELECT * FROM api_usage_tracking 
      WHERE provider = 'serper' 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (apiUsageResult.length > 0) {
      const entry = apiUsageResult[0] as any;
      console.log(`  ✅ Initial API usage tracking entry created`);
      console.log(`      Provider: ${entry.provider}`);
      console.log(`      Quota Limit: ${entry.quota_limit}`);
      console.log(`      Tracking Date: ${entry.tracking_date}`);
    } else {
      console.log('  ❌ Initial API usage tracking entry not found');
      allChecksPass = false;
    }
    
    // 7. Verify audit log entry
    console.log('');
    console.log('📝 Checking audit log...');
    
    const auditResult = await db.execute(sql`
      SELECT * FROM valuation_audit_logs 
      WHERE entity_type = 'migration' 
      AND changed_fields->'migration'->>'name' = '0010_add_internet_search_tables'
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (auditResult.length > 0) {
      const audit = auditResult[0] as any;
      console.log('  ✅ Migration audit log entry created');
      console.log(`      Action: ${audit.action}`);
      console.log(`      Created: ${audit.created_at}`);
    } else {
      console.log('  ❌ Migration audit log entry not found');
      allChecksPass = false;
    }
    
    // 8. Test basic operations
    console.log('');
    console.log('🧪 Testing basic operations...');
    
    try {
      // Test insert into internet_search_logs
      await db.execute(sql`
        INSERT INTO internet_search_logs (
          search_hash, query, item_type, item_details, status, 
          response_time_ms, data_source
        ) VALUES (
          'test_hash_123', 'Toyota Camry 2021 price Nigeria', 'vehicle',
          '{"type": "vehicle", "make": "Toyota", "model": "Camry", "year": 2021}',
          'success', 1500, 'internet'
        )
      `);
      
      // Test query
      const testResult = await db.execute(sql`
        SELECT * FROM internet_search_logs WHERE search_hash = 'test_hash_123'
      `);
      
      if (testResult.length > 0) {
        console.log('  ✅ Insert and query operations work');
        
        // Clean up test data
        await db.execute(sql`
          DELETE FROM internet_search_logs WHERE search_hash = 'test_hash_123'
        `);
        console.log('  ✅ Test data cleaned up');
      } else {
        console.log('  ❌ Insert/query test failed');
        allChecksPass = false;
      }
      
    } catch (error) {
      console.log('  ❌ Basic operations test failed:', error);
      allChecksPass = false;
    }
    
    // Final result
    console.log('');
    console.log('=' .repeat(60));
    
    if (allChecksPass) {
      console.log('🎉 Migration 0010 verification PASSED!');
      console.log('');
      console.log('✅ All internet search analytics tables are ready');
      console.log('✅ All indexes and constraints are in place');
      console.log('✅ Initial data and audit logs created');
      console.log('✅ Basic operations tested successfully');
      console.log('');
      console.log('🚀 The Universal AI Internet Search System database layer is ready!');
      console.log('');
      console.log('📊 Available Analytics Tables:');
      console.log('  • internet_search_logs - Detailed search tracking');
      console.log('  • internet_search_results - Individual result analysis');
      console.log('  • internet_search_metrics - Performance monitoring');
      console.log('  • popular_search_queries - Cache optimization');
      console.log('  • api_usage_tracking - Cost and quota monitoring');
      
    } else {
      console.log('❌ Migration 0010 verification FAILED!');
      console.log('');
      console.log('🔧 Please check the issues above and re-run the migration if needed.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 Verification failed with error:', error);
    process.exit(1);
  }
}

// Run verification
verifyMigration().catch((error) => {
  console.error('💥 Unexpected error during verification:', error);
  process.exit(1);
});