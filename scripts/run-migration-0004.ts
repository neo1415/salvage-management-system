/**
 * Script to run migration 0004: Add market data tables
 */

import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function runMigration() {
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL is not defined');
    process.exit(1);
  }

  const sql = postgres(DATABASE_URL);

  try {
    console.log('🔄 Running migration 0004: Add market data tables...');

    // Read migration SQL file
    const migrationPath = path.join(process.cwd(), 'src/lib/db/migrations/0004_add_market_data_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Execute migration
    await sql.unsafe(migrationSQL);

    console.log('✅ Migration 0004 completed successfully');
    console.log('   - Created market_data_cache table');
    console.log('   - Created market_data_sources table');
    console.log('   - Created scraping_logs table');
    console.log('   - Created background_jobs table');
    console.log('   - Created all necessary indexes');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
