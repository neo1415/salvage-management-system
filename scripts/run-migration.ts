/**
 * Migration Runner Script
 * Runs a specific SQL migration file against the database
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';
import { readFileSync } from 'fs';
import { join } from 'path';

async function runMigration(migrationFile: string) {
  try {
    console.log(`\n🔄 Running migration: ${migrationFile}`);
    
    // Read migration file
    const migrationPath = join(process.cwd(), 'src/lib/db/migrations', migrationFile);
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log(`📄 Migration SQL:\n${migrationSQL}\n`);
    
    // Execute migration
    await db.execute(sql.raw(migrationSQL));
    
    console.log(`✅ Migration completed successfully: ${migrationFile}\n`);
  } catch (error) {
    console.error(`❌ Migration failed: ${migrationFile}`);
    console.error(error);
    process.exit(1);
  }
}

// Get migration file from command line argument
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('❌ Please provide a migration file name');
  console.error('Usage: tsx scripts/run-migration.ts <migration-file.sql>');
  process.exit(1);
}

runMigration(migrationFile);
