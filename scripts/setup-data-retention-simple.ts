#!/usr/bin/env tsx

/**
 * Simple Data Retention Policies Setup Script
 * 
 * This script sets up basic data retention policies for the Universal AI Internet Search System.
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

async function setupDataRetentionSimple() {
  console.log('🗂️ Setting up Simple Data Retention Policies for Universal AI Internet Search System');
  console.log('');

  try {
    // 1. Create data retention configuration table
    console.log('📋 Step 1: Creating data retention configuration table...');
    
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
    
    console.log('✅ Data retention configuration table created');

    // 2. Insert retention policies
    console.log('📝 Step 2: Configuring retention policies...');
    
    const policies = [
      ['market_data_cache', 90, 'daily', 500],
      ['market_data_sources', 30, 'daily', 1000], 
      ['scraping_logs', 14, 'daily', 2000],
      ['background_jobs', 7, 'daily', 1000],
      ['search_performance_metrics', 365, 'weekly', 500],
      ['search_usage_analytics', 365, 'weekly', 500],
      ['search_quality_metrics', 180, 'weekly', 500],
      ['api_cost_analytics', 730, 'monthly', 200],
      ['search_trend_analytics', 365, 'weekly', 300]
    ];
    
    for (const [tableName, retentionDays, frequency, batchSize] of policies) {
      await sql`
        INSERT INTO data_retention_policies (
          table_name, retention_days, cleanup_frequency, cleanup_batch_size
        ) VALUES (
          ${tableName}, ${retentionDays}, ${frequency}, ${batchSize}
        ) ON CONFLICT (table_name) DO UPDATE SET
          retention_days = EXCLUDED.retention_days,
          cleanup_frequency = EXCLUDED.cleanup_frequency,
          cleanup_batch_size = EXCLUDED.cleanup_batch_size,
          updated_at = NOW()
      `;
      
      console.log(`  ✓ ${tableName}: ${retentionDays} days (${frequency})`);
    }
    
    console.log('✅ Retention policies configured');

    // 3. Create simple cleanup function
    console.log('⚙️ Step 3: Creating cleanup function...');
    
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
        sql_command TEXT;
      BEGIN
        cutoff_date := NOW() - (retention_days || ' days')::INTERVAL;
        
        -- Different cleanup strategies for different tables
        IF target_table = 'market_data_cache' THEN
          -- For market data cache, delete stale entries
          LOOP
            DELETE FROM market_data_cache 
            WHERE ctid IN (
              SELECT ctid FROM market_data_cache 
              WHERE stale_at < cutoff_date OR created_at < cutoff_date
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
          -- Generic cleanup for other tables
          sql_command := format(
            'DELETE FROM %I WHERE ctid IN (SELECT ctid FROM %I WHERE created_at < $1 LIMIT $2)',
            target_table, target_table
          );
          
          LOOP
            EXECUTE sql_command USING cutoff_date, batch_size;
            GET DIAGNOSTICS deleted_count = ROW_COUNT;
            total_deleted := total_deleted + deleted_count;
            EXIT WHEN deleted_count = 0;
            PERFORM pg_sleep(0.1);
          END LOOP;
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

    // 4. Create monitoring view
    console.log('📊 Step 4: Creating monitoring view...');
    
    await sql`
      CREATE OR REPLACE VIEW data_retention_status AS
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
        cleanup_batch_size
      FROM data_retention_policies
      ORDER BY table_name
    `;
    
    console.log('✅ Monitoring view created');

    // 5. Show current status
    console.log('📊 Step 5: Checking current retention status...');
    
    const retentionStatus = await sql`
      SELECT * FROM data_retention_status
    `;
    
    console.log('\n📋 Current Retention Policies:');
    for (const status of retentionStatus) {
      const statusIcon = status.cleanup_status === 'UP_TO_DATE' ? '🟢' : 
                        status.cleanup_status === 'OVERDUE' ? '🔴' : '🟡';
      console.log(`  ${statusIcon} ${status.table_name}: ${status.retention_days} days, ${status.cleanup_frequency} cleanup`);
    }

    // 6. Create a simple cleanup script
    console.log('\n📝 Step 6: Creating cleanup execution script...');
    
    await sql`
      CREATE OR REPLACE FUNCTION run_retention_cleanup() RETURNS TEXT AS $$
      DECLARE
        policy RECORD;
        deleted_count INTEGER;
        total_cleaned INTEGER := 0;
        result_text TEXT := '';
      BEGIN
        FOR policy IN 
          SELECT * FROM data_retention_policies 
          WHERE is_enabled = true 
          ORDER BY table_name
        LOOP
          BEGIN
            SELECT cleanup_old_records(
              policy.table_name, 
              policy.retention_days, 
              policy.cleanup_batch_size
            ) INTO deleted_count;
            
            total_cleaned := total_cleaned + deleted_count;
            result_text := result_text || policy.table_name || ': ' || deleted_count || ' rows cleaned' || E'\n';
            
          EXCEPTION WHEN OTHERS THEN
            result_text := result_text || policy.table_name || ': ERROR - ' || SQLERRM || E'\n';
          END;
        END LOOP;
        
        result_text := result_text || 'Total rows cleaned: ' || total_cleaned;
        RETURN result_text;
      END;
      $$ LANGUAGE plpgsql
    `;
    
    console.log('✅ Cleanup execution script created');

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
    console.log('  • Run cleanup: SELECT run_retention_cleanup();');
    console.log('  • Manual cleanup: SELECT cleanup_old_records(\'table_name\', days);');
    console.log('');
    console.log('💡 Automation Setup:');
    console.log('  • Set up daily cron job: SELECT run_retention_cleanup();');
    console.log('  • Monitor cleanup status in dashboards');
    console.log('  • Adjust retention periods based on storage needs');
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
setupDataRetentionSimple().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});