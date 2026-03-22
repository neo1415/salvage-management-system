/**
 * Script to run migration 0006: Add mileage, condition, and price override fields
 * Feature: case-creation-and-approval-enhancements
 * 
 * This migration adds:
 * - vehicle_mileage (INTEGER, nullable)
 * - vehicle_condition (VARCHAR(20), nullable, CHECK constraint)
 * - ai_estimates (JSONB, nullable)
 * - manager_overrides (JSONB, nullable)
 * - Indexes on mileage and condition columns
 */

import { sql } from 'drizzle-orm';
import { db } from '../src/lib/db';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  console.log('🚀 Running migration 0006: Add mileage, condition, and price overrides...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../src/lib/db/migrations/0006_add_mileage_condition_overrides.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Execute the migration
    console.log('📝 Executing SQL migration...');
    await db.execute(sql.raw(migrationSQL));

    console.log('✅ Migration completed successfully!\n');

    // Verify the changes
    console.log('🔍 Verifying schema changes...');
    
    const result = await db.execute(sql`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'salvage_cases'
      AND column_name IN ('vehicle_mileage', 'vehicle_condition', 'ai_estimates', 'manager_overrides')
      ORDER BY column_name;
    `);

    console.log('\n📊 New columns in salvage_cases table:');
    console.table(result.rows);

    // Check indexes
    const indexes = await db.execute(sql`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'salvage_cases'
      AND indexname IN ('idx_salvage_cases_mileage', 'idx_salvage_cases_condition')
      ORDER BY indexname;
    `);

    console.log('\n📇 New indexes:');
    console.table(indexes.rows);

    console.log('\n✨ Migration verification complete!');
    console.log('\n📋 Summary:');
    console.log('  - Added vehicle_mileage column (INTEGER, nullable)');
    console.log('  - Added vehicle_condition column (VARCHAR(20), nullable, CHECK constraint)');
    console.log('  - Added ai_estimates column (JSONB, nullable)');
    console.log('  - Added manager_overrides column (JSONB, nullable)');
    console.log('  - Created index on vehicle_mileage');
    console.log('  - Created index on vehicle_condition');
    console.log('\n🎯 The schema is now ready for case creation enhancements!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
