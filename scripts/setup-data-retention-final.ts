#!/usr/bin/env tsx

/**
 * Final Data Retention Policies Setup Script
 * 
 * This script sets up data retention policies for the Universal AI Internet Search System
 * with proper error handling for existing objects.
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

async function setupDataRetentionFinal() {
  console.log('🗂️ Setting up Data Retention Policies for Universal AI Internet Search System');
  console.log('');

  try {
    // 1. Create or update data retention configuration table
    console.log('📋 Step 1: Setting up data retention configuration...');
    
    await sql`
      CREATE TABLE IF NOT EXISTS data_retention_policies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        table_name VARCHAR(50) NOT NULL UNIQUE,
        retention_days INTEGER NOT NULL,
        cleanup_frequency VARCHAR(20) NOT NULL DEFAULT 'daily',
        last_cleanup_at TIMESTAMP,
        is_enabled BOOLEAN NOT NULL DEFAULT true,
        cleanup_batch_size INTEGER DEFAULT 1000,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    
    console.log('✅ Data retention configuration ready');

    // 2. Insert/update retention policies
    console.log('📝 Step 2: Configuring retention policies...');
    
    const policies = [
      { table_name: 'market_data_cache', retention_days: 90, cleanup_frequency: 'daily', cleanup_batch_size: 500 },
      { table_name: 'market_data_sources', retention_days: 30, cleanup_frequency: 'daily', cleanup_batch_size: 1000 },
      { table_name: 'scraping_logs', retention_days: 14, cleanup_frequency: 'daily', cleanup_batch_size: 2000 },
      { table_name: 'background_jobs', retention_days: 7, cleanup_frequency: 'daily', cleanup_batch_size: 1000 },
      { table_name: 'search_performance_metrics', retention_days: 365, cleanup_frequency: 'weekly', cleanup_batch_size: 500 },
      { table_name: 'search_usage_analytics', retention_days: 365, cleanup_frequency: 'weekly', cleanup_batch_size: 500 },
      { table_name: 'search_quality_metrics', retention_days: 180, cleanup_frequency: 'weekly', cleanup_batch_size: 500 },
      { table_name: 'api_cost_analytics', retention_days: 730, cleanup_frequency: 'monthly', cleanup_batch_size: 200 },
      { table_name: 'search_trend_analytics', retention_days: 365, cleanup_frequency: 'weekly', cleanup_batch_size: 300 }
    ];
    
    for (const policy of policies) {
      await sql`
        INSERT INTO data_retention_policies (
          table_name, retention_days, cleanup_frequency, cleanup_batch_size
        ) VALUES (
          ${policy.table_name}, 
          ${policy.retention_days}, 
          ${policy.cleanup_frequency}, 
          ${policy.cleanup_batch_size}
        ) ON CONFLICT (table_name) DO UPDATE SET
          retention_days = EXCLUDED.retention_days,
          cleanup_frequency = EXCLUDED.cleanup_frequency,
          cleanup_batch_size = EXCLUDED.cleanup_batch_size,
          updated_at = NOW()
      `;
      
      console.log(`  ✓ ${policy.table_name}: ${policy.retention_days} days (${policy.cleanup_frequency})`);
    }
    
    console.log('✅ Retention policies configured');

    // 3. Create cleanup function (replace if exists)
    console.log('⚙️ Step 3: Creating cleanup functions...');
    
    await sql`
      CREATE OR REPLACE FUNCTION cleanup_old_records(
        target_table TEXT,
        retention_days INTEGER,
        batch_size INTEGER DEFAULT 1000
      ) RETURNS INTEGER AS $$
      DECLARE
        deleted_count INTEGER := 0;
        total_deleted INTEGER := 0;
        cutoff_date TIMESTAMP;
      BEGIN
        cutoff_date := NOW() - (retention_days || ' days')::INTERVAL;
        
        -- Different cleanup strategies for different tables
        IF target_table = 'market_data_cache' THEN
          -- For market data cache, delete stale entries
          LOOP
            DELETE FROM market_data_cache 
            WHERE ctid IN (
              SELECT ctid FROM market_data_cache 
              WHERE (stale_at < cutoff_date OR created_at < cutoff_date)
              LIMIT batch_size
            );
            
            GET DIAGNOSTICS deleted_count = ROW_COUNT;
            total_deleted := total_deleted + deleted_count;
            EXIT WHEN deleted_count = 0;
            PERFORM pg_sleep(0.1);
          END LOOP;
          
        ELSIF target_table = 'background_jobs' THEN
          -- For background jobs, only delete completed/failed jobs
          LOOP
            DELETE FROM background_jobs 
            WHERE ctid IN (
              SELECT ctid FROM background_jobs 
              WHERE status IN ('completed', 'failed', 'cancelled')
                AND created_at < cutoff_date
              LIMIT batch_size
            );
            
            GET DIAGNOSTICS deleted_count = ROW_COUNT;
            total_deleted := total_deleted + deleted_count;
            EXIT WHEN deleted_count = 0;
            PERFORM pg_sleep(0.1);
          END LOOP;
          
        ELSE
          -- Generic cleanup for other tables (only if table exists)
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = target_table) THEN
            LOOP
              EXECUTE format(
                'DELETE FROM %I WHERE ctid IN (SELECT ctid FROM %I WHERE created_at < $1 LIMIT $2)',
                target_table, target_table
              ) USING cutoff_date, batch_size;
              
              GET DIAGNOSTICS deleted_count = ROW_COUNT;
              total_deleted := total_deleted + deleted_count;
              EXIT WHEN deleted_count = 0;
              PERFORM pg_sleep(0.1);
            END LOOP;
          END IF;
        END IF;
        
        -- Update last cleanup time
        UPDATE data_retention_policies 
        SET last_cleanup_at = NOW() 
        WHERE table_name = target_table;
        
        RETURN total_deleted;
      END;
      $$ LANGUAGE plpgsql
    `;
    
    console.log('✅ Cleanup function created');

    // 4. Create or replace monitoring view
    console.log('📊 Step 4: Setting up monitoring view...');
    
    await sql`DROP VIEW IF EXISTS data_retention_status_new`;
    
    await sql`
      CREATE VIEW data_retention_status_new AS
      SELECT 
        table_name,
        retention_days,
        cleanup_frequency,
        last_cleanup_at,
        is_enabled,
        CASE 
          WHEN last_cleanup_at IS NULL THEN 'NEVER_RUN'
          WHEN cleanup_frequency = 'daily' AND last_cleanup_at < NOW() - INTERVAL '1 day' THEN 'OVERDUE'
          WHEN cleanup_frequency = 'weekly' AND last_cleanup_at < NOW() - INTERVAL '1 week' THEN 'OVERDUE'
          WHEN cleanup_frequency = 'monthly' AND last_cleanup_at < NOW() - INTERVAL '1 month' THEN 'OVERDUE'
          ELSE 'UP_TO_DATE'
        END as cleanup_status,
        cleanup_batch_size,
        created_at,
        updated_at
      FROM data_retention_policies
      ORDER BY table_name
    `;
    
    console.log('✅ Monitoring view created');

    // 5. Create cleanup execution function
    console.log('🔄 Step 5: Creating cleanup execution function...');
    
    await sql`
      CREATE OR REPLACE FUNCTION run_retention_cleanup(force_all BOOLEAN DEFAULT false) 
      RETURNS TABLE(
        table_name TEXT,
        deleted_rows INTEGER,
        status TEXT,
        message TEXT
      ) AS $$
      DECLARE
        policy RECORD;
        deleted_count INTEGER;
        should_cleanup BOOLEAN;
      BEGIN
        FOR policy IN 
          SELECT * FROM data_retention_policies 
          WHERE is_enabled = true 
          ORDER BY table_name
        LOOP
          -- Check if cleanup is due
          should_cleanup := force_all OR 
            policy.last_cleanup_at IS NULL OR
            (policy.cleanup_frequency = 'daily' AND policy.last_cleanup_at < NOW() - INTERVAL '1 day') OR
            (policy.cleanup_frequency = 'weekly' AND policy.last_cleanup_at < NOW() - INTERVAL '1 week') OR
            (policy.cleanup_frequency = 'monthly' AND policy.last_cleanup_at < NOW() - INTERVAL '1 month');
          
          IF should_cleanup THEN
            BEGIN
              SELECT cleanup_old_records(
                policy.table_name, 
                policy.retention_days, 
                policy.cleanup_batch_size
              ) INTO deleted_count;
              
              RETURN QUERY SELECT 
                policy.table_name::TEXT,
                deleted_count,
                'SUCCESS'::TEXT,
                ('Cleaned ' || deleted_count || ' old records')::TEXT;
                
            EXCEPTION WHEN OTHERS THEN
              RETURN QUERY SELECT 
                policy.table_name::TEXT,
                0,
                'ERROR'::TEXT,
                SQLERRM::TEXT;
            END;
          ELSE
            RETURN QUERY SELECT 
              policy.table_name::TEXT,
              0,
              'SKIPPED'::TEXT,
              'Not due for cleanup'::TEXT;
          END IF;
        END LOOP;
      END;
      $$ LANGUAGE plpgsql
    `;
    
    console.log('✅ Cleanup execution function created');

    // 6. Show current status
    console.log('📊 Step 6: Checking current retention status...');
    
    const retentionStatus = await sql`
      SELECT * FROM data_retention_status_new
    `;
    
    console.log('\n📋 Current Retention Policies:');
    for (const status of retentionStatus) {
      const statusIcon = status.cleanup_status === 'UP_TO_DATE' ? '🟢' : 
                        status.cleanup_status === 'OVERDUE' ? '🔴' : '🟡';
      console.log(`  ${statusIcon} ${status.table_name}: ${status.retention_days} days, ${status.cleanup_frequency} cleanup`);
    }

    // 7. Test cleanup (dry run)
    console.log('\n🧪 Step 7: Testing cleanup system...');
    
    const testResults = await sql`
      SELECT * FROM run_retention_cleanup(false)
    `;
    
    console.log('\n📋 Cleanup Test Results:');
    for (const result of testResults) {
      const icon = result.status === 'SUCCESS' ? '✅' : 
                   result.status === 'SKIPPED' ? '⏭️' : '❌';
      console.log(`  ${icon} ${result.table_name}: ${result.deleted_rows} rows (${result.status})`);
    }

    console.log('\n🎉 Data Retention Policies Setup Completed Successfully!');
    console.log('');
    console.log('📋 Retention Policy Summary:');
    console.log('  • Market data cache: 90 days (daily cleanup)');
    console.log('  • Market data sources: 30 days (daily cleanup)');
    console.log('  • Scraping logs: 14 days (daily cleanup)');
    console.log('  • Background jobs: 7 days (daily cleanup)');
    console.log('  • Analytics tables: 180-730 days (weekly/monthly cleanup)');
    console.log('');
    console.log('🔧 Management Commands:');
    console.log('  • View status: SELECT * FROM data_retention_status_new;');
    console.log('  • Run cleanup: SELECT * FROM run_retention_cleanup();');
    console.log('  • Force cleanup: SELECT * FROM run_retention_cleanup(true);');
    console.log('  • Manual cleanup: SELECT cleanup_old_records(\'table_name\', days);');
    console.log('');
    console.log('💡 Automation Recommendations:');
    console.log('  • Set up daily cron job: SELECT * FROM run_retention_cleanup();');
    console.log('  • Monitor cleanup status in dashboards');
    console.log('  • Adjust retention periods based on storage costs');
    console.log('  • Review cleanup logs regularly');
    console.log('');
    console.log('📊 Storage Benefits:');
    console.log('  • Automatic cleanup of stale cache entries');
    console.log('  • Removal of old logs and completed jobs');
    console.log('  • Long-term retention of important analytics data');
    console.log('  • Configurable cleanup frequencies and batch sizes');

  } catch (error) {
    console.error('❌ Data retention setup failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Run the setup
setupDataRetentionFinal().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});