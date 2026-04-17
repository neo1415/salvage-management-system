#!/bin/bash
# Universal AI Internet Search System - Backup Script
# Generated automatically - do not edit manually

set -e

BACKUP_DIR="./backups"
DATE=$(date +%Y_%m_%d_%H_%M_%S)
DATABASE_URL="${DATABASE_URL}"

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
