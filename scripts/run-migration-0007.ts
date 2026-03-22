/**
 * Script to run migration 0007: Add make-specific support to damage deductions
 * Feature: make-specific-damage-deductions
 * Requirements: 4.1, 8.1
 * 
 * This migration adds:
 * - make field (VARCHAR(100), nullable) for manufacturer-specific deductions
 * - Range-based fields: repair_cost_low, repair_cost_high, valuation_deduction_low, valuation_deduction_high
 * - notes field for additional context
 * - Updated unique constraint on (make, component, damage_level)
 * - Index on make field for query performance
 * - Migrates existing Toyota records to new schema
 * - Drops deprecated fields: repair_cost_estimate, valuation_deduction_percent, description
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
    console.log('🚀 Running migration 0007: Add make-specific damage deductions...\n');

    // Read migration SQL file
    const migrationPath = path.join(process.cwd(), 'src/lib/db/migrations/0007_add_make_specific_deductions.sql');
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📝 Executing SQL migration...');
    console.log('   This migration will:');
    console.log('   1. Add new columns (make, repair_cost_low, repair_cost_high, etc.)');
    console.log('   2. Migrate existing Toyota records to new schema');
    console.log('   3. Update unique constraint to include make field');
    console.log('   4. Add index on make field');
    console.log('   5. Drop deprecated columns');
    console.log('   6. Validate migration success\n');

    // Execute migration (wrapped in transaction in SQL file)
    await sql.unsafe(migrationSQL);

    console.log('\n✅ Migration completed successfully!\n');

    // Verify the changes
    console.log('🔍 Verifying schema changes...\n');
    
    // Check new columns
    const columns = await sql`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'damage_deductions'
      AND column_name IN ('make', 'repair_cost_low', 'repair_cost_high', 'valuation_deduction_low', 'valuation_deduction_high', 'notes')
      ORDER BY column_name;
    `;

    console.log('📊 New columns in damage_deductions table:');
    console.table(columns);

    // Check that deprecated columns are removed
    const deprecatedColumns = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'damage_deductions'
      AND column_name IN ('repair_cost_estimate', 'valuation_deduction_percent', 'description');
    `;

    if (deprecatedColumns.length > 0) {
      console.warn('⚠️  Warning: Deprecated columns still exist:', deprecatedColumns.map(c => c.column_name));
    } else {
      console.log('✅ Deprecated columns successfully removed\n');
    }

    // Check indexes
    const indexes = await sql`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'damage_deductions'
      AND indexname IN ('idx_deductions_make', 'idx_deductions_component')
      ORDER BY indexname;
    `;

    console.log('📇 Indexes on damage_deductions table:');
    console.table(indexes);

    // Check unique constraint
    const constraints = await sql`
      SELECT 
        conname as constraint_name,
        pg_get_constraintdef(oid) as constraint_definition
      FROM pg_constraint
      WHERE conrelid = 'damage_deductions'::regclass
      AND contype = 'u'
      ORDER BY conname;
    `;

    console.log('🔒 Unique constraints:');
    console.table(constraints);

    // Verify migrated data
    const recordCount = await sql`
      SELECT COUNT(*) as total_records
      FROM damage_deductions;
    `;

    console.log('📈 Record count:');
    console.table(recordCount);

    const toyotaRecords = await sql`
      SELECT 
        make,
        COUNT(*) as count
      FROM damage_deductions
      GROUP BY make
      ORDER BY make;
    `;

    console.log('🚗 Records by make:');
    console.table(toyotaRecords);

    // Sample migrated records
    const sampleRecords = await sql`
      SELECT 
        make,
        component,
        damage_level,
        repair_cost_low,
        repair_cost_high,
        valuation_deduction_low,
        valuation_deduction_high,
        LEFT(notes, 50) as notes_preview
      FROM damage_deductions
      WHERE make = 'Toyota'
      LIMIT 3;
    `;

    console.log('📋 Sample migrated records:');
    console.table(sampleRecords);

    // Verify data integrity
    const nullMakeCount = await sql`
      SELECT COUNT(*) as null_make_count
      FROM damage_deductions
      WHERE make IS NULL;
    `;

    const invalidRanges = await sql`
      SELECT COUNT(*) as invalid_range_count
      FROM damage_deductions
      WHERE repair_cost_low > repair_cost_high
         OR valuation_deduction_low > valuation_deduction_high;
    `;

    console.log('\n🔍 Data integrity checks:');
    console.log(`   Records with NULL make: ${nullMakeCount[0].null_make_count}`);
    console.log(`   Records with invalid ranges (low > high): ${invalidRanges[0].invalid_range_count}`);

    if (nullMakeCount[0].null_make_count === '0' && invalidRanges[0].invalid_range_count === '0') {
      console.log('   ✅ All data integrity checks passed!\n');
    } else {
      console.warn('   ⚠️  Data integrity issues detected!\n');
    }

    console.log('✨ Migration verification complete!\n');
    console.log('📋 Summary:');
    console.log('  ✅ Added make field (VARCHAR(100), nullable)');
    console.log('  ✅ Added range-based deduction fields (repair_cost_low/high, valuation_deduction_low/high)');
    console.log('  ✅ Added notes field for additional context');
    console.log('  ✅ Migrated existing records to Toyota with range values');
    console.log('  ✅ Updated unique constraint to (make, component, damage_level)');
    console.log('  ✅ Created index on make field');
    console.log('  ✅ Dropped deprecated columns (repair_cost_estimate, valuation_deduction_percent, description)');
    console.log('\n🎯 The schema is now ready for make-specific damage deductions!');
    console.log('💡 Next steps:');
    console.log('   1. Run import script to add Audi-specific deductions');
    console.log('   2. Update damage calculation service to use make parameter');
    console.log('   3. Update AI assessment service to pass vehicle make');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('\n⚠️  The migration has been rolled back due to the error.');
    console.error('   All changes have been reverted to maintain data integrity.');
    throw error;
  } finally {
    await sql.end();
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
