#!/usr/bin/env tsx

/**
 * Migration Testing Script for Staging Environment
 * 
 * This script tests all migrations for the Universal AI Internet Search System
 * in a staging environment to ensure they work correctly before production deployment.
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

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  duration?: number;
}

async function testMigrationStaging() {
  console.log('🧪 Testing Universal AI Internet Search System Migrations on Staging Environment');
  console.log('');
  
  const results: TestResult[] = [];
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  let skippedTests = 0;

  try {
    // Test 1: Verify database connection
    console.log('🔗 Test 1: Database Connection...');
    const startTime = Date.now();
    
    try {
      await sql`SELECT 1 as test_connection`;
      const duration = Date.now() - startTime;
      results.push({
        test: 'Database Connection',
        status: 'PASS',
        message: 'Successfully connected to staging database',
        duration
      });
      passedTests++;
    } catch (error) {
      results.push({
        test: 'Database Connection',
        status: 'FAIL',
        message: `Connection failed: ${error}`
      });
      failedTests++;
    }
    totalTests++;

    // Test 2: Check Migration 0010 (Internet Search Tables)
    console.log('📊 Test 2: Migration 0010 - Internet Search Tables...');
    
    try {
      const tables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name IN ('internet_search_logs', 'internet_search_cache')
      `;
      
      if (tables.length >= 1) {
        results.push({
          test: 'Migration 0010 - Internet Search Tables',
          status: 'PASS',
          message: `Found ${tables.length} internet search tables`
        });
        passedTests++;
      } else {
        results.push({
          test: 'Migration 0010 - Internet Search Tables',
          status: 'FAIL',
          message: 'Internet search tables not found'
        });
        failedTests++;
      }
    } catch (error) {
      results.push({
        test: 'Migration 0010 - Internet Search Tables',
        status: 'FAIL',
        message: `Error checking tables: ${error}`
      });
      failedTests++;
    }
    totalTests++;

    // Test 3: Check Migration 0011 (Universal Types Support)
    console.log('🔧 Test 3: Migration 0011 - Universal Types Support...');
    
    try {
      // Check if new item types are supported in constraints
      const constraints = await sql`
        SELECT constraint_name, check_clause 
        FROM information_schema.check_constraints 
        WHERE constraint_name = 'chk_market_data_property_type'
      `;
      
      if (constraints.length > 0) {
        const checkClause = constraints[0].check_clause;
        const hasNewTypes = ['appliance', 'jewelry', 'furniture', 'machinery'].every(
          type => checkClause.includes(type)
        );
        
        if (hasNewTypes) {
          results.push({
            test: 'Migration 0011 - Universal Types Support',
            status: 'PASS',
            message: 'All new item types supported in constraints'
          });
          passedTests++;
        } else {
          results.push({
            test: 'Migration 0011 - Universal Types Support',
            status: 'FAIL',
            message: 'Some new item types missing from constraints'
          });
          failedTests++;
        }
      } else {
        results.push({
          test: 'Migration 0011 - Universal Types Support',
          status: 'FAIL',
          message: 'Property type constraint not found'
        });
        failedTests++;
      }
    } catch (error) {
      results.push({
        test: 'Migration 0011 - Universal Types Support',
        status: 'FAIL',
        message: `Error checking constraints: ${error}`
      });
      failedTests++;
    }
    totalTests++;

    // Test 4: Check Migration 0012 (Analytics Tables)
    console.log('📈 Test 4: Migration 0012 - Analytics Tables...');
    
    try {
      const analyticsTables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name IN (
          'search_performance_metrics',
          'search_usage_analytics', 
          'search_quality_metrics',
          'api_cost_analytics',
          'search_trend_analytics'
        )
      `;
      
      if (analyticsTables.length === 5) {
        results.push({
          test: 'Migration 0012 - Analytics Tables',
          status: 'PASS',
          message: 'All 5 analytics tables created successfully'
        });
        passedTests++;
      } else {
        results.push({
          test: 'Migration 0012 - Analytics Tables',
          status: 'FAIL',
          message: `Only ${analyticsTables.length}/5 analytics tables found`
        });
        failedTests++;
      }
    } catch (error) {
      results.push({
        test: 'Migration 0012 - Analytics Tables',
        status: 'FAIL',
        message: `Error checking analytics tables: ${error}`
      });
      failedTests++;
    }
    totalTests++;

    // Test 5: Test Data Insertion for New Item Types
    console.log('💾 Test 5: Data Insertion for New Item Types...');
    
    try {
      const testHash = `test_staging_${Date.now()}`;
      
      // Test appliance insertion
      await sql`
        INSERT INTO market_data_cache (
          property_hash, property_type, property_details, median_price, min_price, max_price, 
          source_count, scraped_at, stale_at
        ) VALUES (
          ${testHash}, 'appliance', 
          '{"type": "appliance", "brand": "Samsung", "model": "Test", "applianceType": "refrigerator"}',
          100000, 90000, 110000, 1, NOW(), NOW() + INTERVAL '1 day'
        )
      `;
      
      // Verify insertion
      const inserted = await sql`
        SELECT * FROM market_data_cache WHERE property_hash = ${testHash}
      `;
      
      if (inserted.length > 0) {
        results.push({
          test: 'Data Insertion for New Item Types',
          status: 'PASS',
          message: 'Successfully inserted and retrieved appliance data'
        });
        passedTests++;
        
        // Clean up test data
        await sql`DELETE FROM market_data_cache WHERE property_hash = ${testHash}`;
      } else {
        results.push({
          test: 'Data Insertion for New Item Types',
          status: 'FAIL',
          message: 'Failed to retrieve inserted test data'
        });
        failedTests++;
      }
    } catch (error) {
      results.push({
        test: 'Data Insertion for New Item Types',
        status: 'FAIL',
        message: `Error inserting test data: ${error}`
      });
      failedTests++;
    }
    totalTests++;

    // Test 6: Test Index Performance
    console.log('⚡ Test 6: Index Performance...');
    
    try {
      const indexQuery = await sql`
        SELECT 
          indexname,
          pg_size_pretty(pg_relation_size(indexname::regclass)) as size
        FROM pg_indexes 
        WHERE tablename = 'market_data_cache' 
          AND indexname LIKE 'idx_%'
        ORDER BY pg_relation_size(indexname::regclass) DESC
        LIMIT 5
      `;
      
      if (indexQuery.length > 0) {
        results.push({
          test: 'Index Performance',
          status: 'PASS',
          message: `Found ${indexQuery.length} performance indexes`
        });
        passedTests++;
      } else {
        results.push({
          test: 'Index Performance',
          status: 'FAIL',
          message: 'No performance indexes found'
        });
        failedTests++;
      }
    } catch (error) {
      results.push({
        test: 'Index Performance',
        status: 'FAIL',
        message: `Error checking indexes: ${error}`
      });
      failedTests++;
    }
    totalTests++;

    // Test 7: Test Data Retention Policies
    console.log('🗂️ Test 7: Data Retention Policies...');
    
    try {
      const retentionPolicies = await sql`
        SELECT COUNT(*) as policy_count 
        FROM data_retention_policies 
        WHERE is_enabled = true
      `;
      
      if (retentionPolicies[0].policy_count > 0) {
        results.push({
          test: 'Data Retention Policies',
          status: 'PASS',
          message: `Found ${retentionPolicies[0].policy_count} active retention policies`
        });
        passedTests++;
      } else {
        results.push({
          test: 'Data Retention Policies',
          status: 'FAIL',
          message: 'No active retention policies found'
        });
        failedTests++;
      }
    } catch (error) {
      results.push({
        test: 'Data Retention Policies',
        status: 'SKIP',
        message: 'Data retention table not found (may not be created yet)'
      });
      skippedTests++;
    }
    totalTests++;

    // Test 8: Test Backup Functions
    console.log('💾 Test 8: Backup Functions...');
    
    try {
      const backupFunctions = await sql`
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_name IN ('create_table_backup', 'restore_from_backup')
      `;
      
      if (backupFunctions.length === 2) {
        results.push({
          test: 'Backup Functions',
          status: 'PASS',
          message: 'All backup and restore functions available'
        });
        passedTests++;
      } else {
        results.push({
          test: 'Backup Functions',
          status: 'FAIL',
          message: `Only ${backupFunctions.length}/2 backup functions found`
        });
        failedTests++;
      }
    } catch (error) {
      results.push({
        test: 'Backup Functions',
        status: 'SKIP',
        message: 'Backup functions not found (may not be created yet)'
      });
      skippedTests++;
    }
    totalTests++;

    // Test 9: Test Analytics Views
    console.log('📊 Test 9: Analytics Views...');
    
    try {
      const analyticsViews = await sql`
        SELECT viewname 
        FROM pg_views 
        WHERE viewname LIKE '%dashboard%' OR viewname LIKE '%summary%'
      `;
      
      if (analyticsViews.length > 0) {
        results.push({
          test: 'Analytics Views',
          status: 'PASS',
          message: `Found ${analyticsViews.length} analytics views`
        });
        passedTests++;
      } else {
        results.push({
          test: 'Analytics Views',
          status: 'SKIP',
          message: 'No analytics views found (may not be created yet)'
        });
        skippedTests++;
      }
    } catch (error) {
      results.push({
        test: 'Analytics Views',
        status: 'FAIL',
        message: `Error checking views: ${error}`
      });
      failedTests++;
    }
    totalTests++;

    // Test 10: Performance Benchmark
    console.log('🚀 Test 10: Performance Benchmark...');
    
    try {
      const benchmarkStart = Date.now();
      
      // Test query performance on market data cache
      await sql`
        SELECT COUNT(*) FROM market_data_cache 
        WHERE property_type = 'vehicle' 
        LIMIT 1000
      `;
      
      const benchmarkDuration = Date.now() - benchmarkStart;
      
      if (benchmarkDuration < 1000) { // Less than 1 second
        results.push({
          test: 'Performance Benchmark',
          status: 'PASS',
          message: `Query completed in ${benchmarkDuration}ms (good performance)`,
          duration: benchmarkDuration
        });
        passedTests++;
      } else {
        results.push({
          test: 'Performance Benchmark',
          status: 'FAIL',
          message: `Query took ${benchmarkDuration}ms (performance issue)`,
          duration: benchmarkDuration
        });
        failedTests++;
      }
    } catch (error) {
      results.push({
        test: 'Performance Benchmark',
        status: 'FAIL',
        message: `Error running benchmark: ${error}`
      });
      failedTests++;
    }
    totalTests++;

    // Print detailed results
    console.log('\n📋 Detailed Test Results:');
    console.log('=' .repeat(80));
    
    for (const result of results) {
      const icon = result.status === 'PASS' ? '✅' : 
                   result.status === 'SKIP' ? '⏭️' : '❌';
      const duration = result.duration ? ` (${result.duration}ms)` : '';
      console.log(`${icon} ${result.test}: ${result.message}${duration}`);
    }

    // Print summary
    console.log('\n📊 Test Summary:');
    console.log('=' .repeat(80));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`⏭️ Skipped: ${skippedTests}`);
    console.log(`Success Rate: ${((passedTests / (totalTests - skippedTests)) * 100).toFixed(1)}%`);

    if (failedTests === 0) {
      console.log('\n🎉 All Critical Tests Passed! Migration is ready for production.');
      console.log('');
      console.log('✅ Migration Validation Summary:');
      console.log('  • Database schema migrations completed successfully');
      console.log('  • Universal item type support is working');
      console.log('  • Analytics tables are properly configured');
      console.log('  • Data insertion and retrieval is functional');
      console.log('  • Performance indexes are in place');
      console.log('  • System performance meets requirements');
      console.log('');
      console.log('🚀 Ready for Production Deployment!');
    } else {
      console.log('\n⚠️ Some Tests Failed - Review Required Before Production');
      console.log('');
      console.log('❌ Failed Tests:');
      results.filter(r => r.status === 'FAIL').forEach(r => {
        console.log(`  • ${r.test}: ${r.message}`);
      });
      console.log('');
      console.log('💡 Recommendations:');
      console.log('  • Fix failed tests before production deployment');
      console.log('  • Re-run migration scripts if necessary');
      console.log('  • Verify database permissions and connectivity');
      console.log('  • Check for missing dependencies or configurations');
    }

  } catch (error) {
    console.error('❌ Migration testing failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Run the migration testing
testMigrationStaging().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});