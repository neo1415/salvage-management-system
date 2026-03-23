/**
 * Verification script for migration 0009: Condition Category Quality System
 * 
 * This script checks:
 * 1. Migration SQL file exists and is readable
 * 2. Database connection is working
 * 3. Current state of condition values in all tables
 * 4. Whether migration has already been run
 * 
 * Run this BEFORE running the migration to understand the current state.
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

async function verifyMigration() {
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL is not defined');
    process.exit(1);
  }

  const sql = postgres(DATABASE_URL);

  try {
    console.log('🔍 Verifying migration 0009 readiness...\n');

    // 1. Check migration file exists
    const migrationPath = path.join(
      process.cwd(),
      'src/lib/db/migrations/0009_condition_category_quality_system.sql'
    );

    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    const migrationSize = (migrationSQL.length / 1024).toFixed(2);
    console.log(`✅ Migration file found (${migrationSize} KB)\n`);

    // 2. Test database connection
    console.log('🔌 Testing database connection...');
    const connectionTest = await sql`SELECT NOW() as current_time`;
    console.log(`✅ Database connected: ${connectionTest[0].current_time}\n`);

    // 3. Check current state of salvage_cases.vehicle_condition
    console.log('📊 Current salvage_cases.vehicle_condition values:');
    const salvageCasesConditions = await sql`
      SELECT 
        vehicle_condition,
        COUNT(*) as count
      FROM salvage_cases
      WHERE vehicle_condition IS NOT NULL
      GROUP BY vehicle_condition
      ORDER BY vehicle_condition;
    `;

    if (salvageCasesConditions.length > 0) {
      console.table(salvageCasesConditions);
    } else {
      console.log('   (No records with vehicle_condition set)\n');
    }

    // Check for legacy values
    const legacySalvageCases = await sql`
      SELECT COUNT(*) as legacy_count
      FROM salvage_cases
      WHERE vehicle_condition IN ('brand_new', 'foreign_used', 'nigerian_used', 'tokunbo_low', 'tokunbo_high', 'nig_used_low', 'nig_used_high');
    `;

    if (Number(legacySalvageCases[0].legacy_count) > 0) {
      console.log(`   ⚠️  Found ${legacySalvageCases[0].legacy_count} records with legacy condition values`);
      console.log('   → Migration is NEEDED\n');
    } else {
      console.log('   ✅ No legacy condition values found\n');
    }

    // 4. Check current state of vehicle_valuations.condition_category
    console.log('📊 Current vehicle_valuations.condition_category values:');
    const valuationConditions = await sql`
      SELECT 
        condition_category,
        COUNT(*) as count
      FROM vehicle_valuations
      GROUP BY condition_category
      ORDER BY condition_category;
    `;

    if (valuationConditions.length > 0) {
      console.table(valuationConditions);
    } else {
      console.log('   (No valuation records found)\n');
    }

    // Check for legacy values
    const legacyValuations = await sql`
      SELECT COUNT(*) as legacy_count
      FROM vehicle_valuations
      WHERE condition_category IN ('brand_new', 'foreign_used', 'nigerian_used', 'tokunbo_low', 'tokunbo_high', 'nig_used_low', 'nig_used_high');
    `;

    if (Number(legacyValuations[0].legacy_count) > 0) {
      console.log(`   ⚠️  Found ${legacyValuations[0].legacy_count} records with legacy condition values`);
      console.log('   → Migration is NEEDED\n');
    } else {
      console.log('   ✅ No legacy condition values found\n');
    }

    // 5. Check current state of market_data_cache condition values
    console.log('📊 Current market_data_cache.property_details.condition values:');
    const marketDataConditions = await sql`
      SELECT 
        property_details->>'condition' as condition,
        COUNT(*) as count
      FROM market_data_cache
      WHERE property_details ? 'condition'
        AND property_details->>'condition' IS NOT NULL
      GROUP BY property_details->>'condition'
      ORDER BY condition;
    `;

    if (marketDataConditions.length > 0) {
      console.table(marketDataConditions);
    } else {
      console.log('   (No market data records with condition set)\n');
    }

    // Check for legacy values
    const legacyMarketData = await sql`
      SELECT COUNT(*) as legacy_count
      FROM market_data_cache
      WHERE property_details ? 'condition'
        AND property_details->>'condition' IN ('brand_new', 'foreign_used', 'nigerian_used', 'tokunbo_low', 'tokunbo_high', 'nig_used_low', 'nig_used_high');
    `;

    if (Number(legacyMarketData[0].legacy_count) > 0) {
      console.log(`   ⚠️  Found ${legacyMarketData[0].legacy_count} records with legacy condition values`);
      console.log('   → Migration is NEEDED\n');
    } else {
      console.log('   ✅ No legacy condition values found\n');
    }

    // 6. Check if migration has already been run
    console.log('🔍 Checking if migration has already been run...');
    const existingMigration = await sql`
      SELECT 
        id,
        action,
        created_at
      FROM valuation_audit_logs
      WHERE entity_type = 'migration'
        AND changed_fields->'migration'->>'name' = '0009_condition_category_quality_system'
      ORDER BY created_at DESC
      LIMIT 1;
    `;

    if (existingMigration.length > 0) {
      console.log('   ⚠️  Migration has already been run!');
      console.table(existingMigration);
      console.log('   → Migration is IDEMPOTENT and can be run again safely\n');
    } else {
      console.log('   ✅ Migration has not been run yet\n');
    }

    // 7. Summary
    const totalLegacy =
      Number(legacySalvageCases[0].legacy_count) +
      Number(legacyValuations[0].legacy_count) +
      Number(legacyMarketData[0].legacy_count);

    console.log('📋 Summary:');
    console.log(`   Total records with legacy condition values: ${totalLegacy}`);

    if (totalLegacy > 0) {
      console.log('\n✅ Migration is READY to run');
      console.log('   Run: npm run tsx scripts/run-migration-0009.ts');
    } else {
      console.log('\n✅ All condition values are already in the new format');
      console.log('   Migration can still be run (it is idempotent)');
    }

    console.log('\n💡 Migration will:');
    console.log('   - Map "brand_new" → "excellent"');
    console.log('   - Map "foreign_used" → "good"');
    console.log('   - Map "nigerian_used" → "fair"');
    console.log('   - Map "tokunbo_low/high" → "good"');
    console.log('   - Map "nig_used_low/high" → "fair"');
    console.log('   - Preserve already-migrated values');
    console.log('   - Create audit log entry');
    console.log('   - Verify all values are valid quality tiers\n');
  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Run verification
verifyMigration()
  .then(() => {
    console.log('✅ Verification completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });
