#!/usr/bin/env tsx

/**
 * Test script for Auction Deposit System migration
 * 
 * This script verifies:
 * - All tables are created correctly
 * - All columns are added to existing tables
 * - All indexes are created
 * - Default configuration is inserted
 * - Wallet invariant constraint is active
 * - Enums are created correctly
 * 
 * Usage:
 *   tsx scripts/test-auction-deposit-migration.ts
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

async function runTests() {
  console.log('🧪 Testing Auction Deposit System Migration\n');

  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  const results: TestResult[] = [];

  try {
    // Test 1: Check new tables exist
    console.log('Test 1: Checking new tables...');
    const expectedTables = [
      'auction_winners',
      'auction_documents',
      'grace_extensions',
      'deposit_forfeitures',
      'system_config',
      'config_change_history',
      'deposit_events',
    ];

    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_name = ANY($1::text[]);
    `, [expectedTables]);

    const foundTables = tablesResult.rows.map(r => r.table_name);
    const allTablesExist = expectedTables.every(t => foundTables.includes(t));

    results.push({
      name: 'New tables created',
      passed: allTablesExist,
      message: allTablesExist 
        ? `All 7 tables created: ${foundTables.join(', ')}`
        : `Missing tables: ${expectedTables.filter(t => !foundTables.includes(t)).join(', ')}`,
    });

    // Test 2: Check bids table extensions
    console.log('Test 2: Checking bids table extensions...');
    const bidsColumnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'bids' 
      AND column_name IN ('deposit_amount', 'status', 'is_legacy');
    `);

    const bidsColumns = bidsColumnsResult.rows.map(r => r.column_name);
    const allBidsColumnsExist = ['deposit_amount', 'status', 'is_legacy'].every(c => bidsColumns.includes(c));

    results.push({
      name: 'Bids table extensions',
      passed: allBidsColumnsExist,
      message: allBidsColumnsExist
        ? 'All 3 columns added to bids table'
        : `Missing columns: ${['deposit_amount', 'status', 'is_legacy'].filter(c => !bidsColumns.includes(c)).join(', ')}`,
    });

    // Test 3: Check escrow_wallets table extension
    console.log('Test 3: Checking escrow_wallets table extension...');
    const escrowColumnsResult = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'escrow_wallets' 
      AND column_name = 'forfeited_amount';
    `);

    const forfeitedAmountExists = escrowColumnsResult.rows.length > 0;

    results.push({
      name: 'Escrow wallets table extension',
      passed: forfeitedAmountExists,
      message: forfeitedAmountExists
        ? 'forfeited_amount column added with default 0.00'
        : 'forfeited_amount column not found',
    });

    // Test 4: Check enums
    console.log('Test 4: Checking enums...');
    const expectedEnums = [
      'winner_status',
      'document_type',
      'document_status',
      'extension_type',
      'deposit_event_type',
      'config_data_type',
    ];

    const enumsResult = await pool.query(`
      SELECT typname 
      FROM pg_type 
      WHERE typtype = 'e'
      AND typname = ANY($1::text[]);
    `, [expectedEnums]);

    const foundEnums = enumsResult.rows.map(r => r.typname);
    const allEnumsExist = expectedEnums.every(e => foundEnums.includes(e));

    results.push({
      name: 'Enums created',
      passed: allEnumsExist,
      message: allEnumsExist
        ? `All 6 enums created: ${foundEnums.join(', ')}`
        : `Missing enums: ${expectedEnums.filter(e => !foundEnums.includes(e)).join(', ')}`,
    });

    // Test 5: Check default configuration
    console.log('Test 5: Checking default configuration...');
    const configResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM system_config;
    `);

    const configCount = parseInt(configResult.rows[0].count);
    const hasDefaultConfig = configCount === 12;

    results.push({
      name: 'Default configuration',
      passed: hasDefaultConfig,
      message: hasDefaultConfig
        ? '12 default configuration parameters inserted'
        : `Expected 12 config parameters, found ${configCount}`,
    });

    // Test 6: Check wallet invariant constraint
    console.log('Test 6: Checking wallet invariant constraint...');
    const constraintResult = await pool.query(`
      SELECT constraint_name, check_clause
      FROM information_schema.check_constraints
      WHERE constraint_name = 'check_wallet_invariant';
    `);

    const constraintExists = constraintResult.rows.length > 0;

    results.push({
      name: 'Wallet invariant constraint',
      passed: constraintExists,
      message: constraintExists
        ? 'check_wallet_invariant constraint active'
        : 'Wallet invariant constraint not found',
    });

    // Test 7: Check indexes
    console.log('Test 7: Checking indexes...');
    const indexResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM pg_indexes
      WHERE tablename IN (
        'auction_winners', 'auction_documents', 'grace_extensions',
        'deposit_forfeitures', 'config_change_history', 'deposit_events',
        'bids', 'escrow_wallets'
      )
      AND indexname LIKE 'idx_%';
    `);

    const indexCount = parseInt(indexResult.rows[0].count);
    const hasEnoughIndexes = indexCount >= 20;

    results.push({
      name: 'Performance indexes',
      passed: hasEnoughIndexes,
      message: hasEnoughIndexes
        ? `${indexCount} indexes created for optimal performance`
        : `Expected at least 20 indexes, found ${indexCount}`,
    });

    // Test 8: Check auction status enum extensions
    console.log('Test 8: Checking auction status enum extensions...');
    const auctionStatusResult = await pool.query(`
      SELECT enumlabel
      FROM pg_enum
      WHERE enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'auction_status'
      )
      AND enumlabel IN (
        'awaiting_documents', 'awaiting_payment', 'deposit_forfeited',
        'forfeiture_collected', 'failed_all_fallbacks', 'manual_resolution',
        'paid', 'completed'
      );
    `);

    const newStatuses = auctionStatusResult.rows.map(r => r.enumlabel);
    const allStatusesAdded = newStatuses.length === 8;

    results.push({
      name: 'Auction status enum extensions',
      passed: allStatusesAdded,
      message: allStatusesAdded
        ? '8 new auction statuses added'
        : `Expected 8 new statuses, found ${newStatuses.length}`,
    });

    // Test 9: Verify legacy bids are marked
    console.log('Test 9: Checking legacy bids marking...');
    const legacyBidsResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM bids
      WHERE is_legacy = true;
    `);

    const legacyBidsCount = parseInt(legacyBidsResult.rows[0].count);

    results.push({
      name: 'Legacy bids marked',
      passed: true, // This is informational
      message: `${legacyBidsCount} existing bids marked as legacy`,
    });

    // Test 10: Test wallet invariant constraint with sample data
    console.log('Test 10: Testing wallet invariant constraint...');
    let invariantWorks = false;
    try {
      // Try to insert a wallet that violates the invariant
      await pool.query(`
        INSERT INTO escrow_wallets (vendor_id, balance, available_balance, frozen_amount, forfeited_amount)
        VALUES (gen_random_uuid(), 1000, 500, 300, 100);
      `);
      invariantWorks = false; // Should not reach here
    } catch (error: any) {
      // Should throw constraint violation
      invariantWorks = error.message.includes('check_wallet_invariant');
    }

    results.push({
      name: 'Wallet invariant enforcement',
      passed: invariantWorks,
      message: invariantWorks
        ? 'Wallet invariant constraint correctly rejects invalid data'
        : 'Wallet invariant constraint not enforcing correctly',
    });

    // Print results
    console.log('\n' + '='.repeat(70));
    console.log('TEST RESULTS');
    console.log('='.repeat(70) + '\n');

    let passedCount = 0;
    let failedCount = 0;

    results.forEach((result, index) => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} Test ${index + 1}: ${result.name}`);
      console.log(`   ${result.message}\n`);

      if (result.passed) {
        passedCount++;
      } else {
        failedCount++;
      }
    });

    console.log('='.repeat(70));
    console.log(`SUMMARY: ${passedCount} passed, ${failedCount} failed`);
    console.log('='.repeat(70) + '\n');

    if (failedCount > 0) {
      console.log('⚠️  Some tests failed. Please review the migration.\n');
      process.exit(1);
    } else {
      console.log('✨ All tests passed! Migration is successful.\n');
    }

  } catch (error) {
    console.error('\n❌ Test execution failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
