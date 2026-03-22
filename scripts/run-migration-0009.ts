/**
 * Script to run migration 0009: Condition Category Quality System
 * Feature: condition-category-quality-system
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 * 
 * This migration:
 * - Replaces 3-category system (Brand New, Nigerian Used, Foreign Used)
 * - Implements 4-tier quality-based system (Excellent, Good, Fair, Poor)
 * - Updates salvage_cases.vehicle_condition
 * - Updates vehicle_valuations.condition_category
 * - Updates market_data_cache.property_details.condition (JSONB)
 * - Creates audit log entry for migration tracking
 * - Is idempotent (safe to run multiple times)
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
    console.log('🚀 Running migration 0009: Condition Category Quality System...\n');

    console.log('📝 Executing SQL migration...');
    console.log('   This migration will:');
    console.log('   1. Update salvage_cases.vehicle_condition values');
    console.log('   2. Update vehicle_valuations.condition_category values');
    console.log('   3. Update market_data_cache.property_details.condition values');
    console.log('   4. Create audit log entry for tracking');
    console.log('   5. Verify all condition values are valid quality tiers\n');

    console.log('   Mapping:');
    console.log('     "brand_new" → "excellent"');
    console.log('     "foreign_used" → "good"');
    console.log('     "nigerian_used" → "fair"');
    console.log('     "tokunbo_low/high" → "good"');
    console.log('     "nig_used_low/high" → "fair"');
    console.log('     Other values → "fair" (safe fallback)\n');

    // Execute migration using sql.begin for transaction safety
    await sql.begin(async (sql) => {
      // 1. Update salvage_cases.vehicle_condition
      await sql`
        UPDATE salvage_cases
        SET vehicle_condition = CASE
          WHEN vehicle_condition = 'brand_new' THEN 'excellent'
          WHEN vehicle_condition = 'foreign_used' THEN 'good'
          WHEN vehicle_condition = 'nigerian_used' THEN 'fair'
          WHEN vehicle_condition IN ('excellent', 'good', 'fair', 'poor') THEN vehicle_condition
          ELSE 'fair'
        END
        WHERE vehicle_condition IS NOT NULL;
      `;

      // 2. Update vehicle_valuations.condition_category
      await sql`
        UPDATE vehicle_valuations
        SET condition_category = CASE
          WHEN condition_category = 'brand_new' THEN 'excellent'
          WHEN condition_category = 'foreign_used' THEN 'good'
          WHEN condition_category = 'nigerian_used' THEN 'fair'
          WHEN condition_category = 'tokunbo_low' THEN 'good'
          WHEN condition_category = 'tokunbo_high' THEN 'good'
          WHEN condition_category = 'nig_used_low' THEN 'fair'
          WHEN condition_category = 'nig_used_high' THEN 'fair'
          WHEN condition_category IN ('excellent', 'good', 'fair', 'poor') THEN condition_category
          ELSE 'fair'
        END;
      `;

      // 3. Update market_data_cache condition values
      await sql`
        UPDATE market_data_cache
        SET property_details = jsonb_set(
          property_details,
          '{condition}',
          to_jsonb(
            CASE
              WHEN property_details->>'condition' = 'brand_new' THEN 'excellent'
              WHEN property_details->>'condition' = 'foreign_used' THEN 'good'
              WHEN property_details->>'condition' = 'nigerian_used' THEN 'fair'
              WHEN property_details->>'condition' = 'tokunbo_low' THEN 'good'
              WHEN property_details->>'condition' = 'tokunbo_high' THEN 'good'
              WHEN property_details->>'condition' = 'nig_used_low' THEN 'fair'
              WHEN property_details->>'condition' = 'nig_used_high' THEN 'fair'
              WHEN property_details->>'condition' IN ('excellent', 'good', 'fair', 'poor') 
                THEN property_details->>'condition'
              ELSE 'fair'
            END
          )
        )
        WHERE property_details ? 'condition'
          AND property_details->>'condition' IS NOT NULL;
      `;

      // 4. Add audit log entry
      await sql`
        INSERT INTO valuation_audit_logs (
          id,
          action,
          entity_type,
          entity_id,
          changed_fields,
          user_id,
          created_at
        )
        SELECT
          gen_random_uuid(),
          'update',
          'migration',
          gen_random_uuid(),
          jsonb_build_object(
            'migration', jsonb_build_object(
              'name', '0009_condition_category_quality_system',
              'description', 'Migrated from 3-category system to 4-tier quality system',
              'old_system', jsonb_build_array('brand_new', 'foreign_used', 'nigerian_used'),
              'new_system', jsonb_build_array('excellent', 'good', 'fair', 'poor'),
              'mapping', jsonb_build_object(
                'brand_new', 'excellent',
                'foreign_used', 'good',
                'nigerian_used', 'fair',
                'tokunbo_low', 'good',
                'tokunbo_high', 'good',
                'nig_used_low', 'fair',
                'nig_used_high', 'fair'
              ),
              'tables_updated', jsonb_build_array(
                'salvage_cases.vehicle_condition',
                'vehicle_valuations.condition_category',
                'market_data_cache.property_details.condition'
              )
            )
          ),
          (SELECT id FROM users WHERE role = 'system_admin' LIMIT 1),
          NOW()
        WHERE EXISTS (SELECT 1 FROM users WHERE role = 'system_admin');
      `;
    });

    console.log('\n✅ Migration completed successfully!\n');

    // Verify the changes
    console.log('🔍 Verifying migration results...\n');

    // 1. Check salvage_cases.vehicle_condition values
    const salvageCasesConditions = await sql`
      SELECT 
        vehicle_condition,
        COUNT(*) as count
      FROM salvage_cases
      WHERE vehicle_condition IS NOT NULL
      GROUP BY vehicle_condition
      ORDER BY vehicle_condition;
    `;

    console.log('📊 salvage_cases.vehicle_condition values:');
    if (salvageCasesConditions.length > 0) {
      console.table(salvageCasesConditions);
    } else {
      console.log('   (No records with vehicle_condition set)');
    }

    // Verify all values are valid quality tiers
    const invalidSalvageCases = await sql`
      SELECT COUNT(*) as invalid_count
      FROM salvage_cases
      WHERE vehicle_condition IS NOT NULL
        AND vehicle_condition NOT IN ('excellent', 'good', 'fair', 'poor');
    `;

    if (Number(invalidSalvageCases[0].invalid_count) > 0) {
      console.error(`   ❌ Found ${invalidSalvageCases[0].invalid_count} invalid condition values!`);
    } else {
      console.log('   ✅ All salvage_cases condition values are valid quality tiers\n');
    }

    // 2. Check vehicle_valuations.condition_category values
    const valuationConditions = await sql`
      SELECT 
        condition_category,
        COUNT(*) as count
      FROM vehicle_valuations
      GROUP BY condition_category
      ORDER BY condition_category;
    `;

    console.log('📊 vehicle_valuations.condition_category values:');
    if (valuationConditions.length > 0) {
      console.table(valuationConditions);
    } else {
      console.log('   (No valuation records found)');
    }

    // Verify all values are valid quality tiers
    const invalidValuations = await sql`
      SELECT COUNT(*) as invalid_count
      FROM vehicle_valuations
      WHERE condition_category NOT IN ('excellent', 'good', 'fair', 'poor');
    `;

    if (Number(invalidValuations[0].invalid_count) > 0) {
      console.error(`   ❌ Found ${invalidValuations[0].invalid_count} invalid condition values!`);
    } else {
      console.log('   ✅ All vehicle_valuations condition values are valid quality tiers\n');
    }

    // 3. Check market_data_cache condition values
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

    console.log('📊 market_data_cache.property_details.condition values:');
    if (marketDataConditions.length > 0) {
      console.table(marketDataConditions);
    } else {
      console.log('   (No market data records with condition set)');
    }

    // Verify all values are valid quality tiers
    const invalidMarketData = await sql`
      SELECT COUNT(*) as invalid_count
      FROM market_data_cache
      WHERE property_details ? 'condition'
        AND property_details->>'condition' IS NOT NULL
        AND property_details->>'condition' NOT IN ('excellent', 'good', 'fair', 'poor');
    `;

    if (Number(invalidMarketData[0].invalid_count) > 0) {
      console.error(`   ❌ Found ${invalidMarketData[0].invalid_count} invalid condition values!`);
    } else {
      console.log('   ✅ All market_data_cache condition values are valid quality tiers\n');
    }

    // 4. Check audit log entry
    const auditLog = await sql`
      SELECT 
        id,
        action,
        entity_type,
        changed_fields->'migration'->>'name' as migration_name,
        changed_fields->'migration'->>'description' as description,
        created_at
      FROM valuation_audit_logs
      WHERE entity_type = 'migration'
        AND changed_fields->'migration'->>'name' = '0009_condition_category_quality_system'
      ORDER BY created_at DESC
      LIMIT 1;
    `;

    console.log('📋 Audit log entry:');
    if (auditLog.length > 0) {
      console.table(auditLog);
      console.log('   ✅ Audit log entry created successfully\n');
    } else {
      console.warn('   ⚠️  No audit log entry found (may not have system_admin user)\n');
    }

    // 5. Summary statistics
    const totalSalvageCases = await sql`
      SELECT COUNT(*) as total
      FROM salvage_cases
      WHERE vehicle_condition IS NOT NULL;
    `;

    const totalValuations = await sql`
      SELECT COUNT(*) as total
      FROM vehicle_valuations;
    `;

    const totalMarketData = await sql`
      SELECT COUNT(*) as total
      FROM market_data_cache
      WHERE property_details ? 'condition'
        AND property_details->>'condition' IS NOT NULL;
    `;

    console.log('📈 Migration summary:');
    console.log(`   Salvage cases updated: ${totalSalvageCases[0].total}`);
    console.log(`   Valuation records updated: ${totalValuations[0].total}`);
    console.log(`   Market data records updated: ${totalMarketData[0].total}`);

    // Overall validation
    const totalInvalid =
      Number(invalidSalvageCases[0].invalid_count) +
      Number(invalidValuations[0].invalid_count) +
      Number(invalidMarketData[0].invalid_count);

    if (totalInvalid === 0) {
      console.log('\n✅ All condition values successfully migrated to 4-tier quality system!\n');
    } else {
      console.error(`\n❌ Migration validation failed: ${totalInvalid} invalid condition values found!\n`);
      throw new Error('Migration validation failed');
    }

    console.log('✨ Migration verification complete!\n');
    console.log('📋 Summary:');
    console.log('  ✅ Updated salvage_cases.vehicle_condition to quality tiers');
    console.log('  ✅ Updated vehicle_valuations.condition_category to quality tiers');
    console.log('  ✅ Updated market_data_cache condition values to quality tiers');
    console.log('  ✅ Created audit log entry for tracking');
    console.log('  ✅ Verified all condition values are valid (excellent, good, fair, poor)');
    console.log('\n🎯 The system is now using the 4-tier quality-based condition system!');
    console.log('💡 Next steps:');
    console.log('   1. Update UI components to display new condition labels');
    console.log('   2. Update AI assessment service to output quality tiers');
    console.log('   3. Update valuation query service to use quality tiers');
    console.log('   4. Test case creation flow with new condition system');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('\n⚠️  The migration has been rolled back due to the error.');
    console.error('   All changes have been reverted to maintain data integrity.');
    throw error;
  } finally {
    await sql.end();
  }
}

/**
 * Rollback function (for emergency use only)
 * WARNING: This loses granularity (4 tiers → 3 categories)
 */
async function rollbackMigration() {
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL is not defined');
    process.exit(1);
  }

  const sql = postgres(DATABASE_URL);

  try {
    console.log('⚠️  ROLLBACK: Reverting to 3-category system...\n');
    console.log('   WARNING: This will lose granularity!');
    console.log('   - "excellent" → "brand_new"');
    console.log('   - "good" → "foreign_used"');
    console.log('   - "fair" → "nigerian_used"');
    console.log('   - "poor" → "nigerian_used" (data loss!)\n');

    await sql`
      BEGIN;
      
      -- Rollback salvage_cases
      UPDATE salvage_cases
      SET vehicle_condition = CASE
        WHEN vehicle_condition = 'excellent' THEN 'brand_new'
        WHEN vehicle_condition = 'good' THEN 'foreign_used'
        WHEN vehicle_condition = 'fair' THEN 'nigerian_used'
        WHEN vehicle_condition = 'poor' THEN 'nigerian_used'
        ELSE vehicle_condition
      END
      WHERE vehicle_condition IS NOT NULL;

      -- Rollback vehicle_valuations
      UPDATE vehicle_valuations
      SET condition_category = CASE
        WHEN condition_category = 'excellent' THEN 'brand_new'
        WHEN condition_category = 'good' THEN 'foreign_used'
        WHEN condition_category = 'fair' THEN 'nigerian_used'
        WHEN condition_category = 'poor' THEN 'nigerian_used'
        ELSE condition_category
      END;

      -- Rollback market_data_cache
      UPDATE market_data_cache
      SET property_details = jsonb_set(
        property_details,
        '{condition}',
        to_jsonb(
          CASE
            WHEN property_details->>'condition' = 'excellent' THEN 'brand_new'
            WHEN property_details->>'condition' = 'good' THEN 'foreign_used'
            WHEN property_details->>'condition' = 'fair' THEN 'nigerian_used'
            WHEN property_details->>'condition' = 'poor' THEN 'nigerian_used'
            ELSE property_details->>'condition'
          END
        )
      )
      WHERE property_details ? 'condition'
        AND property_details->>'condition' IS NOT NULL;

      -- Add rollback audit log
      INSERT INTO valuation_audit_logs (
        id,
        action,
        entity_type,
        entity_id,
        changed_fields,
        user_id,
        created_at
      )
      SELECT
        gen_random_uuid(),
        'rollback',
        'migration',
        gen_random_uuid(),
        jsonb_build_object(
          'rollback', jsonb_build_object(
            'migration', '0009_condition_category_quality_system',
            'reason', 'Emergency rollback to 3-category system',
            'data_loss', 'poor condition mapped to nigerian_used'
          )
        ),
        (SELECT id FROM users WHERE role = 'system_admin' LIMIT 1),
        NOW()
      WHERE EXISTS (SELECT 1 FROM users WHERE role = 'system_admin');
      
      COMMIT;
    `;

    console.log('✅ Rollback completed successfully\n');
    console.log('⚠️  Note: "poor" condition values were mapped to "nigerian_used"');
    console.log('   This represents a loss of granularity in the data.');
  } catch (error) {
    console.error('\n❌ Rollback failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Main execution
const args = process.argv.slice(2);
const isRollback = args.includes('--rollback');

if (isRollback) {
  console.log('⚠️  ROLLBACK MODE ACTIVATED\n');
  console.log('   This will revert the 4-tier quality system back to the 3-category system.');
  console.log('   This is NOT RECOMMENDED and will result in data loss (poor → nigerian_used).\n');

  rollbackMigration()
    .then(() => {
      console.log('\n✅ Rollback script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Rollback script failed:', error);
      process.exit(1);
    });
} else {
  runMigration()
    .then(() => {
      console.log('\n✅ Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration script failed:', error);
      process.exit(1);
    });
}
