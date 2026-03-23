#!/usr/bin/env node
/**
 * DATA INTEGRITY CHECK SCRIPT
 * 
 * This script checks if all expected vehicle data exists in the database.
 * Run this on startup or periodically to ensure data hasn't been lost.
 * 
 * Usage:
 *   npx tsx scripts/check-data-integrity.ts
 * 
 * Exit codes:
 *   0 = All data present
 *   1 = Data missing or corrupted
 */

import 'dotenv/config';
import { db } from '../src/lib/db/drizzle';
import { vehicleValuations, damageDeductions } from '../src/lib/db/schema/vehicle-valuations';
import { sql, eq } from 'drizzle-orm';

interface ExpectedCounts {
  make: string;
  valuations: number;
  deductions: number;
}

const EXPECTED_DATA: ExpectedCounts[] = [
  { make: 'Mercedes-Benz', valuations: 120, deductions: 35 },
  { make: 'Nissan', valuations: 176, deductions: 35 },
  { make: 'Hyundai', valuations: 106, deductions: 35 },
  { make: 'Kia', valuations: 104, deductions: 35 },
  { make: 'Toyota', valuations: 160, deductions: 35 },
  { make: 'Lexus', valuations: 132, deductions: 35 },
  { make: 'Audi', valuations: 63, deductions: 35 },
];

const TOTAL_EXPECTED_VALUATIONS = 861; // Sum of all makes (excluding Honda which has 1)
const TOTAL_EXPECTED_DEDUCTIONS = 245; // Sum of all make-specific deductions

async function checkDataIntegrity() {
  console.log('🔍 VEHICLE DATA INTEGRITY CHECK');
  console.log('================================\n');

  let hasErrors = false;
  const issues: string[] = [];

  try {
    // Check total counts
    const totalValuations = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vehicleValuations);
    
    const totalDeductions = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(damageDeductions);

    const actualValuations = Number(totalValuations[0].count);
    const actualDeductions = Number(totalDeductions[0].count);

    console.log('📊 TOTAL COUNTS:');
    console.log(`   Vehicle Valuations: ${actualValuations} (expected: ~${TOTAL_EXPECTED_VALUATIONS})`);
    console.log(`   Damage Deductions: ${actualDeductions} (expected: ~${TOTAL_EXPECTED_DEDUCTIONS})`);

    // Check if totals are significantly off
    if (actualValuations < TOTAL_EXPECTED_VALUATIONS * 0.9) {
      hasErrors = true;
      issues.push(`⚠️  Vehicle valuations count is too low: ${actualValuations} < ${TOTAL_EXPECTED_VALUATIONS}`);
    }

    if (actualDeductions < TOTAL_EXPECTED_DEDUCTIONS * 0.9) {
      hasErrors = true;
      issues.push(`⚠️  Damage deductions count is too low: ${actualDeductions} < ${TOTAL_EXPECTED_DEDUCTIONS}`);
    }

    // Check per-make counts
    console.log('\n📋 PER-MAKE BREAKDOWN:');
    console.log('======================\n');

    for (const expected of EXPECTED_DATA) {
      // Check valuations
      const valuationCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(vehicleValuations)
        .where(eq(vehicleValuations.make, expected.make));

      const actualValCount = Number(valuationCount[0].count);
      const valStatus = actualValCount >= expected.valuations ? '✅' : '❌';
      
      // Check deductions
      const deductionCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(damageDeductions)
        .where(eq(damageDeductions.make, expected.make));

      const actualDedCount = Number(deductionCount[0].count);
      const dedStatus = actualDedCount >= expected.deductions ? '✅' : '❌';

      console.log(`${expected.make}:`);
      console.log(`   ${valStatus} Valuations: ${actualValCount}/${expected.valuations}`);
      console.log(`   ${dedStatus} Deductions: ${actualDedCount}/${expected.deductions}`);

      if (actualValCount < expected.valuations) {
        hasErrors = true;
        issues.push(`${expected.make} valuations missing: ${actualValCount}/${expected.valuations}`);
      }

      if (actualDedCount < expected.deductions) {
        hasErrors = true;
        issues.push(`${expected.make} deductions missing: ${actualDedCount}/${expected.deductions}`);
      }
    }

    // Summary
    console.log('\n\n🎯 INTEGRITY CHECK RESULT:');
    console.log('==========================\n');

    if (hasErrors) {
      console.log('❌ DATA INTEGRITY ISSUES DETECTED!\n');
      console.log('Issues found:');
      issues.forEach(issue => console.log(`   ${issue}`));
      console.log('\n🔧 TO FIX: Run the restoration script:');
      console.log('   npx tsx scripts/restore-all-vehicle-data.ts');
      process.exit(1);
    } else {
      console.log('✅ ALL DATA PRESENT AND CORRECT!');
      console.log('\nYour vehicle valuation database is healthy.');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ Error checking data integrity:', error);
    process.exit(1);
  }
}

checkDataIntegrity();
