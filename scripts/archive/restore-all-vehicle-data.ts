#!/usr/bin/env node
/**
 * ONE-COMMAND VEHICLE DATA RESTORATION SCRIPT
 * 
 * This script restores ALL vehicle valuation data in the correct order.
 * Run this if you ever lose data again: npx tsx scripts/restore-all-vehicle-data.ts
 * 
 * What it does:
 * 1. Imports all vehicle valuations (Mercedes, Nissan, Hyundai, Kia, Toyota, Lexus, Audi)
 * 2. Imports all damage deductions (make-specific repair costs)
 * 3. Verifies the data was imported correctly
 * 
 * Expected final counts:
 * - Vehicle Valuations: ~862 records
 * - Damage Deductions: 254 records
 */

import 'dotenv/config';
import { execSync } from 'child_process';

const scripts = [
  // Vehicle valuations (in order of import)
  { name: 'Mercedes-Benz Valuations', path: 'scripts/import-mercedes-valuations.ts', expected: 120 },
  { name: 'Nissan Valuations', path: 'scripts/import-nissan-valuations.ts', expected: 176 },
  { name: 'Hyundai & Kia Valuations', path: 'scripts/import-hyundai-kia-valuations.ts', expected: 210 },
  { name: 'Toyota Valuations (Main)', path: 'scripts/import-toyota-data-complete.ts', expected: 89 },
  { name: 'Toyota Valuations (Remaining)', path: 'scripts/import-remaining-toyota-direct.ts', expected: 71 },
  { name: 'Lexus Valuations', path: 'scripts/import-lexus-valuations.ts', expected: 132 },
  { name: 'Audi Valuations', path: 'scripts/import-audi-valuations-direct.ts', expected: 63 },
  
  // Damage deductions (make-specific)
  { name: 'Mercedes Damage Deductions', path: 'scripts/import-mercedes-damage-deductions.ts', expected: 35 },
  { name: 'Nissan Damage Deductions', path: 'scripts/import-nissan-damage-deductions.ts', expected: 35 },
  { name: 'Hyundai & Kia Damage Deductions', path: 'scripts/import-hyundai-kia-damage-deductions.ts', expected: 70 },
  { name: 'Toyota Damage Deductions', path: 'scripts/import-toyota-damage-deductions-correct.ts', expected: 35 },
  { name: 'Lexus Damage Deductions', path: 'scripts/import-lexus-damage-deductions.ts', expected: 35 },
  { name: 'Audi Damage Deductions', path: 'scripts/import-audi-damage-deductions.ts', expected: 35 },
];

async function restoreAllData() {
  console.log('🚗 VEHICLE DATA RESTORATION SCRIPT');
  console.log('===================================\n');
  console.log('This will restore ALL vehicle valuation data to the database.');
  console.log('Expected totals:');
  console.log('  - Vehicle Valuations: ~862 records');
  console.log('  - Damage Deductions: 254 records\n');
  console.log('Starting restoration...\n');

  let successCount = 0;
  let failCount = 0;
  const failedScripts: string[] = [];

  for (const script of scripts) {
    try {
      console.log(`\n📦 Running: ${script.name}`);
      console.log(`   Script: ${script.path}`);
      console.log(`   Expected: ${script.expected} records`);
      
      execSync(`npx tsx ${script.path}`, { 
        stdio: 'inherit',
        encoding: 'utf-8'
      });
      
      successCount++;
      console.log(`✅ ${script.name} completed successfully`);
    } catch (error) {
      failCount++;
      failedScripts.push(script.name);
      console.error(`❌ ${script.name} failed:`, error);
      console.log('Continuing with next script...');
    }
  }

  console.log('\n\n🎯 RESTORATION SUMMARY');
  console.log('======================');
  console.log(`✅ Successful: ${successCount}/${scripts.length}`);
  console.log(`❌ Failed: ${failCount}/${scripts.length}`);
  
  if (failedScripts.length > 0) {
    console.log('\nFailed scripts:');
    failedScripts.forEach(name => console.log(`  - ${name}`));
  }

  // Verify final counts
  console.log('\n\n🔍 Verifying final data...');
  try {
    execSync('npx tsx scripts/quick-count.ts', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }

  console.log('\n✅ Data restoration complete!');
  console.log('\nTo verify damage deductions, run:');
  console.log('  npx tsx scripts/check-both-tables-data.ts');
}

restoreAllData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
