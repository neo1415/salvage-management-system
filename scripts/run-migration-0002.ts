/**
 * Script to run migration 0002: Add notification preferences column
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
    console.log('🔄 Running migration 0002: Add notification preferences...');

    // Read migration SQL file
    const migrationPath = path.join(process.cwd(), 'src/lib/db/migrations/0002_add_notification_preferences.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Execute migration
    await sql.unsafe(migrationSQL);

    console.log('✅ Migration 0002 completed successfully');
    console.log('   - Added notification_preferences column to users table');
    console.log('   - Added GIN index for notification_preferences');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
