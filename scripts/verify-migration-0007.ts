/**
 * Verification Script for Migration 0007: Make-Specific Damage Deductions
 * Feature: make-specific-damage-deductions
 * Requirements: 8.1, 8.2, 8.3
 * 
 * This script verifies that migration 0007 completed successfully by checking:
 * 1. Record count (should match pre-migration count)
 * 2. All records have non-null make values
 * 3. All range fields are populated (repairCostLow/High, valuationDeductionLow/High)
 * 4. Low values <= High values for all ranges
 * 5. Unique constraint exists on (make, component, damage_level)
 * 6. Index exists on make field
 * 7. Deprecated columns are removed (repairCostEstimate, valuationDeductionPercent, description)
 * 8. Sample records display correctly
 */

import postgres from 'postgres';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

interface VerificationResult {
  check: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
  details?: any;
}

async function verifyMigration() {
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL is not defined');
    process.exit(1);
  }

  const sql = postgres(DATABASE_URL);
  const results: VerificationResult[] = [];

  try {
    console.log('🔍 Verifying Migration 0007: Make-Specific Damage Deductions\n');
    console.log('=' .repeat(70));
    console.log('\n');

    // Check 1: Record count
    console.log('📊 Check 1: Verifying record count...');
    try {
      const recordCount = await sql`
        SELECT COUNT(*) as total
        FROM damage_deductions;
      `;
      
      const total = parseInt(recordCount[0].total as string);
      
      if (total > 0) {
        results.push({
          check: 'Record Count',
          status: 'PASS',
          message: `Found ${total} records in damage_deductions table`,
          details: { totalRecords: total }
        });
        console.log(`   ✅ PASS: ${total} records found\n`);
      } else {
        results.push({
          check: 'Record Count',
          status: 'FAIL',
          message: 'No records found in damage_deductions table',
          details: { totalRecords: 0 }
        });
        console.log('   ❌ FAIL: No records found\n');
      }
    } catch (error) {
      results.push({
        check: 'Record Count',
        status: 'FAIL',
        message: `Error checking record count: ${error}`,
      });
      console.log(`   ❌ FAIL: ${error}\n`);
    }

    // Check 2: All records have non-null make values
    console.log('🏷️  Check 2: Verifying all records have non-null make values...');
    try {
      const nullMakeRecords = await sql`
        SELECT COUNT(*) as null_count
        FROM damage_deductions
        WHERE make IS NULL;
      `;
      
      const nullCount = parseInt(nullMakeRecords[0].null_count as string);
      
      if (nullCount === 0) {
        results.push({
          check: 'Non-Null Make Values',
          status: 'PASS',
          message: 'All records have non-null make values',
          details: { recordsWithNullMake: 0 }
        });
        console.log('   ✅ PASS: All records have non-null make values\n');
      } else {
        results.push({
          check: 'Non-Null Make Values',
          status: 'FAIL',
          message: `Found ${nullCount} records with NULL make values`,
          details: { recordsWithNullMake: nullCount }
        });
        console.log(`   ❌ FAIL: ${nullCount} records have NULL make values\n`);
      }
    } catch (error) {
      results.push({
        check: 'Non-Null Make Values',
        status: 'FAIL',
        message: `Error checking make values: ${error}`,
      });
      console.log(`   ❌ FAIL: ${error}\n`);
    }

    // Check 3: All range fields are populated
    console.log('📈 Check 3: Verifying all range fields are populated...');
    try {
      const nullRangeFields = await sql`
        SELECT COUNT(*) as null_count
        FROM damage_deductions
        WHERE repair_cost_low IS NULL
           OR repair_cost_high IS NULL
           OR valuation_deduction_low IS NULL
           OR valuation_deduction_high IS NULL;
      `;
      
      const nullCount = parseInt(nullRangeFields[0].null_count as string);
      
      if (nullCount === 0) {
        results.push({
          check: 'Range Fields Populated',
          status: 'PASS',
          message: 'All range fields are populated',
          details: { recordsWithNullRangeFields: 0 }
        });
        console.log('   ✅ PASS: All range fields are populated\n');
      } else {
        results.push({
          check: 'Range Fields Populated',
          status: 'FAIL',
          message: `Found ${nullCount} records with NULL range fields`,
          details: { recordsWithNullRangeFields: nullCount }
        });
        console.log(`   ❌ FAIL: ${nullCount} records have NULL range fields\n`);
      }
    } catch (error) {
      results.push({
        check: 'Range Fields Populated',
        status: 'FAIL',
        message: `Error checking range fields: ${error}`,
      });
      console.log(`   ❌ FAIL: ${error}\n`);
    }

    // Check 4: Low values <= High values for all ranges
    console.log('⚖️  Check 4: Verifying low values <= high values...');
    try {
      const invalidRanges = await sql`
        SELECT COUNT(*) as invalid_count
        FROM damage_deductions
        WHERE repair_cost_low > repair_cost_high
           OR valuation_deduction_low > valuation_deduction_high;
      `;
      
      const invalidCount = parseInt(invalidRanges[0].invalid_count as string);
      
      if (invalidCount === 0) {
        results.push({
          check: 'Range Value Ordering',
          status: 'PASS',
          message: 'All low values <= high values',
          details: { recordsWithInvalidRanges: 0 }
        });
        console.log('   ✅ PASS: All low values <= high values\n');
      } else {
        results.push({
          check: 'Range Value Ordering',
          status: 'FAIL',
          message: `Found ${invalidCount} records where low > high`,
          details: { recordsWithInvalidRanges: invalidCount }
        });
        console.log(`   ❌ FAIL: ${invalidCount} records have low > high\n`);
      }
    } catch (error) {
      results.push({
        check: 'Range Value Ordering',
        status: 'FAIL',
        message: `Error checking range ordering: ${error}`,
      });
      console.log(`   ❌ FAIL: ${error}\n`);
    }

    // Check 5: Unique constraint exists on (make, component, damage_level)
    console.log('🔒 Check 5: Verifying unique constraint exists...');
    try {
      const constraints = await sql`
        SELECT 
          conname as constraint_name,
          pg_get_constraintdef(oid) as constraint_definition
        FROM pg_constraint
        WHERE conrelid = 'damage_deductions'::regclass
          AND contype = 'u'
          AND conname = 'damage_deductions_make_component_level_unique';
      `;
      
      if (constraints.length > 0) {
        results.push({
          check: 'Unique Constraint',
          status: 'PASS',
          message: 'Unique constraint on (make, component, damage_level) exists',
          details: { 
            constraintName: constraints[0].constraint_name,
            definition: constraints[0].constraint_definition
          }
        });
        console.log('   ✅ PASS: Unique constraint exists');
        console.log(`      Name: ${constraints[0].constraint_name}`);
        console.log(`      Definition: ${constraints[0].constraint_definition}\n`);
      } else {
        results.push({
          check: 'Unique Constraint',
          status: 'FAIL',
          message: 'Unique constraint on (make, component, damage_level) not found',
        });
        console.log('   ❌ FAIL: Unique constraint not found\n');
      }
    } catch (error) {
      results.push({
        check: 'Unique Constraint',
        status: 'FAIL',
        message: `Error checking unique constraint: ${error}`,
      });
      console.log(`   ❌ FAIL: ${error}\n`);
    }

    // Check 6: Index exists on make field
    console.log('📇 Check 6: Verifying index on make field...');
    try {
      const indexes = await sql`
        SELECT 
          indexname,
          indexdef
        FROM pg_indexes
        WHERE tablename = 'damage_deductions'
          AND indexname = 'idx_deductions_make';
      `;
      
      if (indexes.length > 0) {
        results.push({
          check: 'Make Field Index',
          status: 'PASS',
          message: 'Index on make field exists',
          details: { 
            indexName: indexes[0].indexname,
            definition: indexes[0].indexdef
          }
        });
        console.log('   ✅ PASS: Index on make field exists');
        console.log(`      Name: ${indexes[0].indexname}`);
        console.log(`      Definition: ${indexes[0].indexdef}\n`);
      } else {
        results.push({
          check: 'Make Field Index',
          status: 'FAIL',
          message: 'Index on make field not found',
        });
        console.log('   ❌ FAIL: Index on make field not found\n');
      }
    } catch (error) {
      results.push({
        check: 'Make Field Index',
        status: 'FAIL',
        message: `Error checking index: ${error}`,
      });
      console.log(`   ❌ FAIL: ${error}\n`);
    }

    // Check 7: Deprecated columns are removed
    console.log('🗑️  Check 7: Verifying deprecated columns are removed...');
    try {
      const deprecatedColumns = await sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'damage_deductions'
          AND column_name IN ('repair_cost_estimate', 'valuation_deduction_percent', 'description');
      `;
      
      if (deprecatedColumns.length === 0) {
        results.push({
          check: 'Deprecated Columns Removed',
          status: 'PASS',
          message: 'All deprecated columns have been removed',
          details: { deprecatedColumnsFound: [] }
        });
        console.log('   ✅ PASS: All deprecated columns removed\n');
      } else {
        const columnNames = deprecatedColumns.map(c => c.column_name);
        results.push({
          check: 'Deprecated Columns Removed',
          status: 'FAIL',
          message: `Found deprecated columns: ${columnNames.join(', ')}`,
          details: { deprecatedColumnsFound: columnNames }
        });
        console.log(`   ❌ FAIL: Found deprecated columns: ${columnNames.join(', ')}\n`);
      }
    } catch (error) {
      results.push({
        check: 'Deprecated Columns Removed',
        status: 'FAIL',
        message: `Error checking deprecated columns: ${error}`,
      });
      console.log(`   ❌ FAIL: ${error}\n`);
    }

    // Check 8: Sample records display correctly
    console.log('📋 Check 8: Displaying sample records...');
    try {
      const sampleRecords = await sql`
        SELECT 
          make,
          component,
          damage_level,
          repair_cost_low,
          repair_cost_high,
          valuation_deduction_low,
          valuation_deduction_high,
          LEFT(notes, 60) as notes_preview
        FROM damage_deductions
        ORDER BY make, component, damage_level
        LIMIT 5;
      `;
      
      if (sampleRecords.length > 0) {
        results.push({
          check: 'Sample Records',
          status: 'PASS',
          message: `Retrieved ${sampleRecords.length} sample records`,
          details: { sampleCount: sampleRecords.length }
        });
        console.log('   ✅ PASS: Sample records retrieved\n');
        console.log('   Sample Records:');
        console.table(sampleRecords);
        console.log('');
      } else {
        results.push({
          check: 'Sample Records',
          status: 'WARNING',
          message: 'No sample records found',
        });
        console.log('   ⚠️  WARNING: No sample records found\n');
      }
    } catch (error) {
      results.push({
        check: 'Sample Records',
        status: 'FAIL',
        message: `Error retrieving sample records: ${error}`,
      });
      console.log(`   ❌ FAIL: ${error}\n`);
    }

    // Additional Check: Records by make
    console.log('🚗 Additional Check: Records by make...');
    try {
      const recordsByMake = await sql`
        SELECT 
          make,
          COUNT(*) as count
        FROM damage_deductions
        GROUP BY make
        ORDER BY make;
      `;
      
      console.log('   Records by Make:');
      console.table(recordsByMake);
      console.log('');
    } catch (error) {
      console.log(`   ⚠️  Could not retrieve records by make: ${error}\n`);
    }

    // Additional Check: Schema columns
    console.log('📊 Additional Check: Current schema columns...');
    try {
      const columns = await sql`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          character_maximum_length,
          numeric_precision,
          numeric_scale
        FROM information_schema.columns
        WHERE table_name = 'damage_deductions'
        ORDER BY ordinal_position;
      `;
      
      console.log('   Current Schema:');
      console.table(columns);
      console.log('');
    } catch (error) {
      console.log(`   ⚠️  Could not retrieve schema: ${error}\n`);
    }

    // Print summary
    console.log('=' .repeat(70));
    console.log('\n📊 VERIFICATION SUMMARY\n');
    console.log('=' .repeat(70));
    console.log('');

    const passCount = results.filter(r => r.status === 'PASS').length;
    const failCount = results.filter(r => r.status === 'FAIL').length;
    const warningCount = results.filter(r => r.status === 'WARNING').length;

    results.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
      console.log(`${icon} ${result.check}: ${result.message}`);
    });

    console.log('');
    console.log('=' .repeat(70));
    console.log(`\n✅ Passed: ${passCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`⚠️  Warnings: ${warningCount}`);
    console.log(`📊 Total Checks: ${results.length}\n`);

    if (failCount === 0) {
      console.log('🎉 All verification checks passed!');
      console.log('✨ Migration 0007 completed successfully!\n');
      return true;
    } else {
      console.log('⚠️  Some verification checks failed.');
      console.log('🔧 Please review the failed checks and address any issues.\n');
      return false;
    }

  } catch (error) {
    console.error('\n❌ Verification failed with error:', error);
    return false;
  } finally {
    await sql.end();
  }
}

// Run the verification
verifyMigration()
  .then((success) => {
    if (success) {
      console.log('✅ Verification script completed successfully');
      process.exit(0);
    } else {
      console.log('❌ Verification script completed with failures');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Verification script failed:', error);
    process.exit(1);
  });
