#!/bin/bash
# Universal AI Internet Search System - Restore Script

set -e

BACKUP_DIR="./backups"
DATABASE_URL="postgresql://postgres.htdehmkqfrwjewzjingm:K%40tsur0u1415@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"

if [ $# -eq 0 ]; then
    echo "Usage: $0 <backup_date> [table_type]"
    echo "Available backups:"
    ls -la "$BACKUP_DIR"/*.sql 2>/dev/null || echo "No backups found"
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
