#!/usr/bin/env tsx

/**
 * Data Retention Policies Setup Script
 * 
 * This script sets up automated data retention policies for the Universal AI Internet Search System
 * to manage storage costs and maintain optimal performance.
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

async function setupDataRetentionPolicies() {
  console.log('🗂️ Setting up Data Retention Policies for Universal AI Internet Search System');
  console.log('');

  try {
    // 1. Create data retention configuration table
    console.log('📋 Step 1: Creating data retention configuration table...');
    
    await sql`
      CREATE TABLE IF NOT EXISTS data_retention_policies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        table_name VARCHAR(50) NOT NULL UNIQUE,
        retention_days INTEGER NOT NULL,
        cleanup_frequency VARCHAR(20) NOT NULL DEFAULT 'daily', -- 'daily', 'weekly', 'monthly'
        last_cleanup_at TIMESTAMP,
        is_enabled BOOLEAN NOT NULL DEFAULT true,
        cleanup_batch_size INTEGER DEFAULT 1000,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    
    console.log('✅ Data retention configuration table created');

    // 2. Insert retention policies for each table
    console.log('📝 Step 2: Configuring retention policies...');
    
    const retentionPolicies = [
      // Market data cache - keep fresh data longer, stale data shorter
      {
        table_name: 'market_data_cache',
        retention_days: 90, // 3 months for market data
        cleanup_frequency: 'daily',
        cleanup_batch_size: 500
      },
      // Market data sources - detailed source data
      {
        table_name: 'market_data_sources', 
        retention_days: 30, // 1 month for detailed sources
        cleanup_frequency: 'daily',
        cleanup_batch_size: 1000
      },
      // Scraping logs - operational logs
      {
        table_name: 'scraping_logs',
        retention_days: 14, // 2 weeks for logs
        cleanup_frequency: 'daily', 
        cleanup_batch_size: 2000
      },
      // Background jobs - completed jobs
      {
        table_name: 'background_jobs',
        retention_days: 7, // 1 week for completed jobs
        cleanup_frequency: 'daily',
        cleanup_batch_size: 1000
      },
      // Analytics tables - longer retention for business intelligence
      {
        table_name: 'search_performance_metrics',
        retention_days: 365, // 1 year for performance metrics
        cleanup_frequency: 'weekly',
        cleanup_batch_size: 500
      },
      {
        table_name: 'search_usage_analytics',
        retention_days: 365, // 1 year for usage analytics
        cleanup_frequency: 'weekly', 
        cleanup_batch_size: 500
      },
      {
        table_name: 'search_quality_metrics',
        retention_days: 180, // 6 months for quality metrics
        cleanup_frequency: 'weekly',
        cleanup_batch_size: 500
      },
      {
        table_name: 'api_cost_analytics',
        retention_days: 730, // 2 years for cost analytics (important for budgeting)
        cleanup_frequency: 'monthly',
        cleanup_batch_size: 200
      },
      {
        table_name: 'search_trend_analytics',
        retention_days: 365, // 1 year for trend analytics
        cleanup_frequency: 'weekly',
        cleanup_batch_size: 300
      }
    ];
    
    for (const policy of retentionPolicies) {
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

    // 3. Create cleanup functions
    console.log('⚙️ Step 3: Creating automated cleanup functions...');
    
    // Generic cleanup function
    await sql`
      CREATE OR REPLACE FUNCTION cleanup_old_data(
        target_table TEXT,
        retention_days INTEGER,
        batch_size INTEGER DEFAULT 1000,
        date_column TEXT DEFAULT 'created_at'
      ) RETURNS INTEGER AS $$
      DECLARE
        deleted_count INTEGER := 0;
        total_deleted INTEGER := 0;
        cutoff_date TIMESTAMP;
      BEGIN
        -- Calculate cutoff date
        cutoff_date := NOW() - (retention_days || ' days')::INTERVAL;
        
        -- Log cleanup start
        RAISE NOTICE 'Starting cleanup for table % with cutoff date %', target_table, cutoff_date;
        
        -- Delete in batches to avoid long locks
        LOOP
          EXECUTE format(
            'DELETE FROM %I WHERE %I < $1 AND ctid IN (SELECT ctid FROM %I WHERE %I < $1 LIMIT $2)',
            target_table, date_column, target_table, date_column
          ) USING cutoff_date, batch_size;
          
          GET DIAGNOSTICS deleted_count = ROW_COUNT;
          total_deleted := total_deleted + deleted_count;
          
          -- Exit if no more rows to delete
          EXIT WHEN deleted_count = 0;
          
          -- Small delay between batches
          PERFORM pg_sleep(0.1);
        END LOOP;
        
        -- Update last cleanup time
        UPDATE data_retention_policies 
        SET last_cleanup_at = NOW() 
        WHERE table_name = target_table;
        
        RAISE NOTICE 'Cleanup completed for table %. Deleted % rows.', target_table, total_deleted;
        RETURN total_deleted;
      END;
      $$ LANGUAGE plpgsql
    `;
    
    // Specialized cleanup for market data cache (considers stale_at)
    await sql`
      CREATE OR REPLACE FUNCTION cleanup_market_data_cache() RETURNS INTEGER AS $$
      DECLARE
        deleted_count INTEGER := 0;
        total_deleted INTEGER := 0;
        policy RECORD;
      BEGIN
        -- Get retention policy
        SELECT retention_days, cleanup_batch_size 
        INTO policy
        FROM data_retention_policies 
        WHERE table_name = 'market_data_cache' AND is_enabled = true;
        
        IF NOT FOUND THEN
          RAISE NOTICE 'No retention policy found for market_data_cache';
          RETURN 0;
        END IF;
        
        -- Delete stale entries older than retention period
        LOOP
          DELETE FROM market_data_cache 
          WHERE ctid IN (
            SELECT ctid FROM market_data_cache 
            WHERE (
              stale_at < NOW() - (policy.retention_days || ' days')::INTERVAL
              OR created_at < NOW() - (policy.retention_days || ' days')::INTERVAL
            )
            LIMIT policy.cleanup_batch_size
          );
          
          GET DIAGNOSTICS deleted_count = ROW_COUNT;
          total_deleted := total_deleted + deleted_count;
          
          EXIT WHEN deleted_count = 0;
          PERFORM pg_sleep(0.1);
        END LOOP;
        
        -- Update last cleanup time
        UPDATE data_retention_policies 
        SET last_cleanup_at = NOW() 
        WHERE table_name = 'market_data_cache';
        
        RAISE NOTICE 'Market data cache cleanup completed. Deleted % rows.', total_deleted;
        RETURN total_deleted;
      END;
      $$ LANGUAGE plpgsql
    `;
    
    // Cleanup function for background jobs (only completed/failed jobs)
    await sql`
      CREATE OR REPLACE FUNCTION cleanup_background_jobs() RETURNS INTEGER AS $$
      DECLARE
        deleted_count INTEGER := 0;
        total_deleted INTEGER := 0;
        policy RECORD;
      BEGIN
        -- Get retention policy
        SELECT retention_days, cleanup_batch_size 
        INTO policy
        FROM data_retention_policies 
        WHERE table_name = 'background_jobs' AND is_enabled = true;
        
        IF NOT FOUND THEN
          RAISE NOTICE 'No retention policy found for background_jobs';
          RETURN 0;
        END IF;
        
        -- Delete completed/failed jobs older than retention period
        LOOP
          DELETE FROM background_jobs 
          WHERE ctid IN (
            SELECT ctid FROM background_jobs 
            WHERE status IN ('completed', 'failed', 'cancelled')
              AND created_at < NOW() - (policy.retention_days || ' days')::INTERVAL
            LIMIT policy.cleanup_batch_size
          );
          
          GET DIAGNOSTICS deleted_count = ROW_COUNT;
          total_deleted := total_deleted + deleted_count;
          
          EXIT WHEN deleted_count = 0;
          PERFORM pg_sleep(0.1);
        END LOOP;
        
        -- Update last cleanup time
        UPDATE data_retention_policies 
        SET last_cleanup_at = NOW() 
        WHERE table_name = 'background_jobs';
        
        RAISE NOTICE 'Background jobs cleanup completed. Deleted % rows.', total_deleted;
        RETURN total_deleted;
      END;
      $$ LANGUAGE plpgsql
    `;
    
    console.log('✅ Cleanup functions created');

    // 4. Create master cleanup procedure
    console.log('🔄 Step 4: Creating master cleanup procedure...');
    
    await sql`
      CREATE OR REPLACE FUNCTION run_data_retention_cleanup(
        force_all BOOLEAN DEFAULT false
      ) RETURNS TABLE(
        table_name TEXT,
        deleted_rows INTEGER,
        cleanup_duration INTERVAL,
        status TEXT
      ) AS $$
      DECLARE
        policy RECORD;
        deleted_count INTEGER;
        start_time TIMESTAMP;
        end_time TIMESTAMP;
        should_cleanup BOOLEAN;
      BEGIN
        FOR policy IN 
          SELECT * FROM data_retention_policies 
          WHERE is_enabled = true 
          ORDER BY table_name
        LOOP
          start_time := NOW();
          deleted_count := 0;
          
          -- Check if cleanup is due
          should_cleanup := force_all OR 
            policy.last_cleanup_at IS NULL OR
            (policy.cleanup_frequency = 'daily' AND policy.last_cleanup_at < NOW() - INTERVAL '1 day') OR
            (policy.cleanup_frequency = 'weekly' AND policy.last_cleanup_at < NOW() - INTERVAL '1 week') OR
            (policy.cleanup_frequency = 'monthly' AND policy.last_cleanup_at < NOW() - INTERVAL '1 month');
          
          IF should_cleanup THEN
            -- Use specialized cleanup functions where available
            IF policy.table_name = 'market_data_cache' THEN
              SELECT cleanup_market_data_cache() INTO deleted_count;
            ELSIF policy.table_name = 'background_jobs' THEN
              SELECT cleanup_background_jobs() INTO deleted_count;
            ELSE
              -- Use generic cleanup for other tables
              BEGIN
                SELECT cleanup_old_data(
                  policy.table_name, 
                  policy.retention_days, 
                  policy.cleanup_batch_size
                ) INTO deleted_count;
              EXCEPTION WHEN OTHERS THEN
                deleted_count := -1; -- Error indicator
              END;
            END IF;
            
            end_time := NOW();
            
            RETURN QUERY SELECT 
              policy.table_name,
              deleted_count,
              end_time - start_time,
              CASE 
                WHEN deleted_count = -1 THEN 'ERROR'
                WHEN deleted_count = 0 THEN 'NO_DATA_TO_CLEAN'
                ELSE 'SUCCESS'
              END;
          ELSE
            RETURN QUERY SELECT 
              policy.table_name,
              0,
              INTERVAL '0',
              'SKIPPED_NOT_DUE';
          END IF;
        END LOOP;
      END;
      $$ LANGUAGE plpgsql
    `;
    
    console.log('✅ Master cleanup procedure created');

    // 5. Create monitoring views
    console.log('📊 Step 5: Creating monitoring views...');
    
    await sql`
      CREATE OR REPLACE VIEW data_retention_status AS
      SELECT 
        p.table_name,
        p.retention_days,
        p.cleanup_frequency,
        p.last_cleanup_at,
        p.is_enabled,
        CASE 
          WHEN p.last_cleanup_at IS NULL THEN 'NEVER_RUN'
          WHEN p.cleanup_frequency = 'daily' AND p.last_cleanup_at < NOW() - INTERVAL '1 day' THEN 'OVERDUE'
          WHEN p.cleanup_frequency = 'weekly' AND p.last_cleanup_at < NOW() - INTERVAL '1 week' THEN 'OVERDUE'
          WHEN p.cleanup_frequency = 'monthly' AND p.last_cleanup_at < NOW() - INTERVAL '1 month' THEN 'OVERDUE'
          ELSE 'UP_TO_DATE'
        END as cleanup_status,
        -- Estimate table size (if table exists)
        COALESCE(
          (SELECT pg_size_pretty(pg_total_relation_size(p.table_name::regclass))), 
          'TABLE_NOT_FOUND'
        ) as estimated_size,
        -- Estimate old data count (approximate)
        CASE p.table_name
          WHEN 'market_data_cache' THEN 
            (SELECT COUNT(*) FROM market_data_cache 
             WHERE created_at < NOW() - (p.retention_days || ' days')::INTERVAL)
          WHEN 'background_jobs' THEN
            (SELECT COUNT(*) FROM background_jobs 
             WHERE status IN ('completed', 'failed', 'cancelled')
               AND created_at < NOW() - (p.retention_days || ' days')::INTERVAL)
          ELSE NULL
        END as estimated_old_records
      FROM data_retention_policies p
      ORDER BY p.table_name
    `;
    
    console.log('✅ Monitoring views created');

    // 6. Test the cleanup system
    console.log('🧪 Step 6: Testing cleanup system...');
    
    const testResults = await sql`
      SELECT * FROM run_data_retention_cleanup(false)
    `;
    
    console.log('\n📋 Cleanup Test Results:');
    for (const result of testResults) {
      const icon = result.status === 'SUCCESS' ? '✅' : 
                   result.status === 'NO_DATA_TO_CLEAN' ? '🟡' : 
                   result.status === 'SKIPPED_NOT_DUE' ? '⏭️' : '❌';
      console.log(`  ${icon} ${result.table_name}: ${result.deleted_rows} rows deleted (${result.status})`);
    }

    // 7. Show retention status
    console.log('\n📊 Current Retention Status:');
    
    const retentionStatus = await sql`
      SELECT * FROM data_retention_status
    `;
    
    for (const status of retentionStatus) {
      const statusIcon = status.cleanup_status === 'UP_TO_DATE' ? '🟢' : 
                        status.cleanup_status === 'OVERDUE' ? '🔴' : '🟡';
      console.log(`  ${statusIcon} ${status.table_name}: ${status.retention_days} days, ${status.cleanup_frequency} cleanup (${status.estimated_size})`);
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
    console.log('  • View status: SELECT * FROM data_retention_status;');
    console.log('  • Run cleanup: SELECT * FROM run_data_retention_cleanup();');
    console.log('  • Force cleanup: SELECT * FROM run_data_retention_cleanup(true);');
    console.log('');
    console.log('💡 Automation Recommendations:');
    console.log('  • Set up daily cron job to run cleanup');
    console.log('  • Monitor cleanup status in dashboards');
    console.log('  • Adjust retention periods based on storage costs');
    console.log('  • Review and optimize cleanup batch sizes');

  } catch (error) {
    console.error('❌ Data retention setup failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Run the setup
setupDataRetentionPolicies().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});