#!/usr/bin/env tsx

/**
 * Backup and Recovery Procedures Setup Script
 * 
 * This script sets up backup and recovery procedures for the Universal AI Internet Search System
 * to ensure data protection and disaster recovery capabilities.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

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

async function setupBackupRecovery() {
  console.log('💾 Setting up Backup and Recovery Procedures for Universal AI Internet Search System');
  console.log('');

  try {
    // 1. Create backup configuration table
    console.log('📋 Step 1: Creating backup configuration...');
    
    await sql`
      CREATE TABLE IF NOT EXISTS backup_configurations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        backup_type VARCHAR(20) NOT NULL, -- 'full', 'incremental', 'schema_only'
        table_pattern VARCHAR(100) NOT NULL, -- Pattern to match tables
        backup_frequency VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly'
        retention_days INTEGER NOT NULL DEFAULT 30,
        is_enabled BOOLEAN NOT NULL DEFAULT true,
        last_backup_at TIMESTAMP,
        backup_location VARCHAR(200),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    
    console.log('✅ Backup configuration table created');

    // 2. Insert backup configurations
    console.log('📝 Step 2: Configuring backup policies...');
    
    const backupConfigs = [
      {
        backup_type: 'full',
        table_pattern: 'market_data_%',
        backup_frequency: 'daily',
        retention_days: 7,
        backup_location: '/backups/market_data'
      },
      {
        backup_type: 'full', 
        table_pattern: 'search_%_analytics',
        backup_frequency: 'weekly',
        retention_days: 30,
        backup_location: '/backups/analytics'
      }
    ];
    
    for (const config of backupConfigs) {
      await sql`
        INSERT INTO backup_configurations (
          backup_type, table_pattern, backup_frequency, retention_days, backup_location
        ) VALUES (
          ${config.backup_type}, ${config.table_pattern}, ${config.backup_frequency}, 
          ${config.retention_days}, ${config.backup_location}
        ) ON CONFLICT DO NOTHING
      `;
      
      console.log(`  ✓ ${config.backup_type} backup for ${config.table_pattern} (${config.backup_frequency})`);
    }
    
    console.log('✅ Backup configurations set');

    // 3. Create backup functions
    console.log('⚙️ Step 3: Creating backup functions...');
    
    await sql`
      CREATE OR REPLACE FUNCTION create_table_backup(
        table_name TEXT,
        backup_type TEXT DEFAULT 'full'
      ) RETURNS TEXT AS $$
      DECLARE
        backup_table_name TEXT;
        timestamp_suffix TEXT;
        result_message TEXT;
      BEGIN
        -- Generate timestamp suffix
        timestamp_suffix := to_char(NOW(), 'YYYY_MM_DD_HH24_MI_SS');
        backup_table_name := table_name || '_backup_' || timestamp_suffix;
        
        -- Create backup table
        IF backup_type = 'full' THEN
          EXECUTE format('CREATE TABLE %I AS SELECT * FROM %I', backup_table_name, table_name);
          result_message := 'Full backup created: ' || backup_table_name;
        ELSIF backup_type = 'schema_only' THEN
          EXECUTE format('CREATE TABLE %I AS SELECT * FROM %I WHERE false', backup_table_name, table_name);
          result_message := 'Schema backup created: ' || backup_table_name;
        END IF;
        
        -- Add backup metadata
        EXECUTE format('COMMENT ON TABLE %I IS ''Backup of %I created at %s''', 
          backup_table_name, table_name, NOW()::TEXT);
        
        RETURN result_message;
      END;
      $$ LANGUAGE plpgsql
    `;
    
    await sql`
      CREATE OR REPLACE FUNCTION export_table_data(
        table_name TEXT,
        export_path TEXT DEFAULT '/tmp'
      ) RETURNS TEXT AS $$
      DECLARE
        export_file TEXT;
        row_count INTEGER;
      BEGIN
        export_file := export_path || '/' || table_name || '_' || 
          to_char(NOW(), 'YYYY_MM_DD_HH24_MI_SS') || '.csv';
        
        -- Export to CSV (requires superuser or appropriate permissions)
        EXECUTE format('COPY %I TO %L WITH CSV HEADER', table_name, export_file);
        
        -- Get row count
        EXECUTE format('SELECT COUNT(*) FROM %I', table_name) INTO row_count;
        
        RETURN 'Exported ' || row_count || ' rows to ' || export_file;
      END;
      $$ LANGUAGE plpgsql
    `;
    
    console.log('✅ Backup functions created');

    // 4. Create recovery functions
    console.log('🔄 Step 4: Creating recovery functions...');
    
    await sql`
      CREATE OR REPLACE FUNCTION restore_from_backup(
        original_table TEXT,
        backup_table TEXT,
        restore_mode TEXT DEFAULT 'replace'
      ) RETURNS TEXT AS $$
      DECLARE
        row_count INTEGER;
        result_message TEXT;
      BEGIN
        -- Validate backup table exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = backup_table) THEN
          RETURN 'ERROR: Backup table ' || backup_table || ' does not exist';
        END IF;
        
        -- Perform restore based on mode
        IF restore_mode = 'replace' THEN
          -- Replace all data
          EXECUTE format('TRUNCATE TABLE %I', original_table);
          EXECUTE format('INSERT INTO %I SELECT * FROM %I', original_table, backup_table);
          result_message := 'Replaced all data in ' || original_table;
          
        ELSIF restore_mode = 'append' THEN
          -- Append data
          EXECUTE format('INSERT INTO %I SELECT * FROM %I', original_table, backup_table);
          result_message := 'Appended data to ' || original_table;
          
        END IF;
        
        -- Get final row count
        EXECUTE format('SELECT COUNT(*) FROM %I', original_table) INTO row_count;
        
        RETURN result_message || '. Final row count: ' || row_count;
      END;
      $$ LANGUAGE plpgsql
    `;
    
    console.log('✅ Recovery functions created');

    // 5. Create backup monitoring
    console.log('📊 Step 5: Creating backup monitoring...');
    
    await sql`
      CREATE OR REPLACE VIEW backup_status AS
      SELECT 
        table_name,
        backup_type,
        backup_frequency,
        last_backup_at,
        retention_days,
        is_enabled,
        CASE 
          WHEN last_backup_at IS NULL THEN 'NEVER_BACKED_UP'
          WHEN backup_frequency = 'daily' AND last_backup_at < NOW() - INTERVAL '1 day' THEN 'OVERDUE'
          WHEN backup_frequency = 'weekly' AND last_backup_at < NOW() - INTERVAL '1 week' THEN 'OVERDUE'
          WHEN backup_frequency = 'monthly' AND last_backup_at < NOW() - INTERVAL '1 month' THEN 'OVERDUE'
          ELSE 'UP_TO_DATE'
        END as backup_status,
        backup_location
      FROM backup_configurations
      ORDER BY table_name
    `;
    
    console.log('✅ Backup monitoring view created');

    // 6. Create backup scripts
    console.log('📝 Step 6: Creating backup scripts...');
    
    // Ensure backup directory exists
    try {
      mkdirSync('backups', { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
    
    // Create backup script
    const backupScript = `#!/bin/bash
# Universal AI Internet Search System - Backup Script
# Generated automatically - do not edit manually

set -e

BACKUP_DIR="./backups"
DATE=$(date +%Y_%m_%d_%H_%M_%S)
DATABASE_URL="${process.env.DATABASE_URL}"

echo "🚀 Starting backup process at $(date)"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Backup market data tables
echo "📊 Backing up market data tables..."
pg_dump "$DATABASE_URL" -t "market_data_*" --data-only --inserts > "$BACKUP_DIR/market_data_$DATE.sql"

# Backup analytics tables
echo "📈 Backing up analytics tables..."
pg_dump "$DATABASE_URL" -t "search_*_analytics" --data-only --inserts > "$BACKUP_DIR/analytics_$DATE.sql"

# Backup configuration tables
echo "⚙️ Backing up configuration tables..."
pg_dump "$DATABASE_URL" -t "data_retention_policies" -t "backup_configurations" --data-only --inserts > "$BACKUP_DIR/config_$DATE.sql"

# Create full schema backup
echo "🗂️ Creating schema backup..."
pg_dump "$DATABASE_URL" --schema-only > "$BACKUP_DIR/schema_$DATE.sql"

# Cleanup old backups (keep last 7 days)
echo "🧹 Cleaning up old backups..."
find "$BACKUP_DIR" -name "*.sql" -mtime +7 -delete

echo "✅ Backup completed successfully at $(date)"
echo "📁 Backup files created in $BACKUP_DIR/"
ls -la "$BACKUP_DIR/"*_$DATE.sql
`;
    
    writeFileSync('backups/backup.sh', backupScript);
    
    // Create restore script
    const restoreScript = `#!/bin/bash
# Universal AI Internet Search System - Restore Script
# Generated automatically - do not edit manually

set -e

BACKUP_DIR="./backups"
DATABASE_URL="${process.env.DATABASE_URL}"

if [ $# -eq 0 ]; then
    echo "Usage: $0 <backup_date> [table_type]"
    echo "Available backups:"
    ls -la "$BACKUP_DIR"/*.sql | grep -E "(market_data|analytics|config|schema)_[0-9_]+\.sql"
    exit 1
fi

BACKUP_DATE=$1
TABLE_TYPE=${2:-"all"}

echo "🔄 Starting restore process for backup date: $BACKUP_DATE"

case $TABLE_TYPE in
    "market_data")
        echo "📊 Restoring market data tables..."
        psql "$DATABASE_URL" < "$BACKUP_DIR/market_data_$BACKUP_DATE.sql"
        ;;
    "analytics")
        echo "📈 Restoring analytics tables..."
        psql "$DATABASE_URL" < "$BACKUP_DIR/analytics_$BACKUP_DATE.sql"
        ;;
    "config")
        echo "⚙️ Restoring configuration tables..."
        psql "$DATABASE_URL" < "$BACKUP_DIR/config_$BACKUP_DATE.sql"
        ;;
    "schema")
        echo "🗂️ Restoring database schema..."
        psql "$DATABASE_URL" < "$BACKUP_DIR/schema_$BACKUP_DATE.sql"
        ;;
    "all")
        echo "🔄 Restoring all tables..."
        psql "$DATABASE_URL" < "$BACKUP_DIR/market_data_$BACKUP_DATE.sql"
        psql "$DATABASE_URL" < "$BACKUP_DIR/analytics_$BACKUP_DATE.sql"
        psql "$DATABASE_URL" < "$BACKUP_DIR/config_$BACKUP_DATE.sql"
        ;;
    *)
        echo "❌ Invalid table type. Use: market_data, analytics, config, schema, or all"
        exit 1
        ;;
esac

echo "✅ Restore completed successfully at $(date)"
`;
    
    writeFileSync('backups/restore.sh', restoreScript);
    
    console.log('✅ Backup scripts created');

    console.log('\n🎉 Backup and Recovery Procedures Setup Completed Successfully!');
    console.log('');
    console.log('📋 Backup Configuration Summary:');
    console.log('  • Market data tables: Daily backups (7 days retention)');
    console.log('  • Analytics tables: Weekly backups (30 days retention)');
    console.log('  • Configuration tables: Included in daily backups');
    console.log('  • Schema backups: Created with each backup run');
    console.log('');
    console.log('🔧 Management Commands:');
    console.log('  • View backup status: SELECT * FROM backup_status;');
    console.log('  • Create manual backup: SELECT create_table_backup(\'table_name\');');
    console.log('  • Restore from backup: SELECT restore_from_backup(\'table\', \'backup_table\');');
    console.log('');
    console.log('📁 Backup Scripts:');
    console.log('  • Run backup: ./backups/backup.sh');
    console.log('  • Restore data: ./backups/restore.sh YYYY_MM_DD_HH_MI_SS [table_type]');
    console.log('');
    console.log('💡 Automation Recommendations:');
    console.log('  • Set up daily cron job for backups');
    console.log('  • Monitor backup status in dashboards');
    console.log('  • Test restore procedures regularly');
    console.log('  • Store backups in secure, off-site location');
    console.log('');
    console.log('🔒 Security Considerations:');
    console.log('  • Encrypt backup files for sensitive data');
    console.log('  • Restrict access to backup directories');
    console.log('  • Verify backup integrity regularly');
    console.log('  • Document recovery procedures for team');

  } catch (error) {
    console.error('❌ Backup and recovery setup failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Run the setup
setupBackupRecovery().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});