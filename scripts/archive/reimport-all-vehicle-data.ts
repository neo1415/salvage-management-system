/**
 * Re-import ALL vehicle valuation data
 * This script runs all import scripts sequentially
 */

import { execSync } from 'child_process';

const importScripts = [
  'scripts/import-toyota-nigeria-data.ts',
  'scripts/import-audi-data.ts',
  'scripts/import-lexus-valuations.ts',
  'scripts/import-hyundai-kia-valuations.ts',
  'scripts/import-nissan-valuations.ts',
  'scripts/import-mercedes-valuations.ts',
];

console.log('🚀 Starting complete vehicle data re-import...\n');

for (const script of importScripts) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📦 Running: ${script}`);
  console.log('='.repeat(60));
  
  try {
    execSync(`npx tsx ${script}`, { stdio: 'inherit' });
    console.log(`✅ ${script} completed successfully\n`);
  } catch (error) {
    console.error(`❌ ${script} failed:`, error);
    process.exit(1);
  }
}

console.log('\n' + '='.repeat(60));
console.log('🎉 ALL VEHICLE DATA IMPORTED SUCCESSFULLY!');
console.log('='.repeat(60));
