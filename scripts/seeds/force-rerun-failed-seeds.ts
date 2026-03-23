/**
 * Force re-run failed seeds by removing their registry entries first
 */

import { db } from '@/lib/db/drizzle';
import { seedRegistry } from '@/lib/db/schema/seed-registry';
import { eq } from 'drizzle-orm';

const FAILED_SEEDS = [
  'audi-damage-deductions',
  'kia-valuations',
  'mercedes-valuations',
  'nissan-valuations',
  'toyota-damage-deductions'
];

async function forceRerunFailedSeeds() {
  console.log('🔧 Removing failed seed registry entries...\n');
  
  for (const seedName of FAILED_SEEDS) {
    try {
      await db
        .delete(seedRegistry)
        .where(eq(seedRegistry.scriptName, seedName));
      
      console.log(`✅ Removed registry entry: ${seedName}`);
    } catch (error) {
      console.error(`❌ Error removing ${seedName}:`, error);
    }
  }
  
  console.log('\n✅ Registry cleanup complete');
  console.log('📝 Now run: npx tsx scripts/seeds/run-all-seeds.ts\n');
  
  process.exit(0);
}

forceRerunFailedSeeds();
