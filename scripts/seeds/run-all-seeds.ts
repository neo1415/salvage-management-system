/**
 * Master Seed Runner
 * Executes all seed scripts in deterministic order
 * 
 * Usage:
 *   tsx scripts/seeds/run-all-seeds.ts              # Run all seeds
 *   tsx scripts/seeds/run-all-seeds.ts --force      # Force re-run all seeds
 *   tsx scripts/seeds/run-all-seeds.ts --dry-run    # Test without changes
 *   tsx scripts/seeds/run-all-seeds.ts --fail-fast  # Stop on first failure
 * 
 * Features:
 * - Discovers all *.seed.ts files in scripts/seeds/
 * - Sorts alphabetically by make, valuations before damage-deductions
 * - Propagates command-line flags to individual seed scripts
 * - Provides comprehensive summary report
 * - Exit code reflects overall success/failure
 */

import { glob } from 'glob';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface SeedScript {
  path: string;
  make: string;
  type: 'valuations' | 'damage-deductions';
}

/**
 * Discover all seed scripts using glob pattern
 * Excludes template files in _template/ directory
 */
async function discoverSeeds(): Promise<SeedScript[]> {
  const seedFiles = await glob('scripts/seeds/**/*.seed.ts', {
    ignore: ['scripts/seeds/_template/**'],
  });
  
  return seedFiles
    .map(filePath => {
      // Normalize path separators for cross-platform compatibility
      const normalizedPath = filePath.replace(/\\/g, '/');
      const parts = normalizedPath.split('/');
      const make = parts[parts.length - 2];
      const fileName = parts[parts.length - 1];
      const type = fileName.includes('valuations') ? 'valuations' : 'damage-deductions';
      
      return { path: filePath, make, type } as SeedScript;
    })
    .sort((a, b) => {
      // Sort by make alphabetically, then valuations before deductions
      if (a.make !== b.make) return a.make.localeCompare(b.make);
      return a.type === 'valuations' ? -1 : 1;
    });
}

/**
 * Execute a single seed script with provided flags
 */
async function runSeed(seed: SeedScript, flags: string[]): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🌱 Running: ${seed.make} - ${seed.type}`);
  console.log(`${'='.repeat(60)}\n`);
  
  const command = `tsx ${seed.path} ${flags.join(' ')}`;
  
  try {
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
    });
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
  } catch (error: any) {
    console.error(`❌ Failed to run ${seed.path}:`);
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.error(error.stderr);
    throw error;
  }
}

/**
 * Main function to run all seeds
 */
async function runAllSeeds() {
  const startTime = Date.now();
  const flags = process.argv.slice(2);
  const failFast = flags.includes('--fail-fast');
  
  console.log('🚀 Master Seed Runner');
  console.log(`Flags: ${flags.join(' ') || 'none'}\n`);
  
  // Discover all seed scripts
  const seeds = await discoverSeeds();
  console.log(`📋 Discovered ${seeds.length} seed scripts\n`);
  
  if (seeds.length === 0) {
    console.log('⚠️  No seed scripts found');
    process.exit(0);
  }
  
  let successCount = 0;
  let failureCount = 0;
  const failedSeeds: string[] = [];
  
  // Execute each seed
  for (const seed of seeds) {
    try {
      await runSeed(seed, flags);
      successCount++;
    } catch (error) {
      failureCount++;
      failedSeeds.push(`${seed.make}/${seed.type}`);
      console.error(`❌ Seed failed: ${seed.path}`);
      
      // Stop immediately if --fail-fast flag is present
      if (failFast) {
        console.error('\n⚠️  Stopping execution due to --fail-fast flag');
        break;
      }
      
      // Otherwise continue with remaining seeds
      console.log('\n⏭️  Continuing with next seed...');
    }
  }
  
  const executionTime = Date.now() - startTime;
  
  // Print summary report
  console.log('\n' + '='.repeat(60));
  console.log('📊 MASTER SEED RUNNER SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Seeds: ${seeds.length}`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  console.log(`⏱️  Total Time: ${(executionTime / 1000).toFixed(2)}s`);
  
  if (failedSeeds.length > 0) {
    console.log('\n❌ Failed Seeds:');
    failedSeeds.forEach(seed => console.log(`  - ${seed}`));
  }
  
  console.log('='.repeat(60) + '\n');
  
  // Exit with non-zero code if any seed failed
  process.exit(failureCount > 0 ? 1 : 0);
}

// Execute master seed runner
runAllSeeds().catch(error => {
  console.error('\n❌ FATAL ERROR in master seed runner:', error);
  process.exit(1);
});
