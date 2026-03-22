/**
 * Post-Migration Seed Runner
 * 
 * Executes seed scripts automatically after database migrations complete.
 * This ensures fresh deployments have all necessary vehicle data loaded.
 * 
 * Features:
 * - Runs master seed runner after migrations
 * - Handles seed failures gracefully (logs but doesn't fail deployment)
 * - Supports SKIP_SEEDS environment variable to disable seeding
 * - Supports FORCE_SEEDS environment variable to force re-run
 * - Provides clear logging for deployment visibility
 * 
 * Usage:
 *   import { runSeedsAfterMigration } from '@/lib/db/migrations/run-seeds-after-migration';
 *   await runSeedsAfterMigration();
 * 
 * Environment Variables:
 *   SKIP_SEEDS=true    - Skip seed execution entirely
 *   FORCE_SEEDS=true   - Force re-run all seeds even if already executed
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Run seed scripts after database migration
 * 
 * This function is designed to be called after database migrations complete.
 * It executes the master seed runner which discovers and runs all seed scripts.
 * 
 * Seed failures are logged but do not fail the deployment, allowing manual
 * seed execution later if needed.
 */
export async function runSeedsAfterMigration(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('🌱 POST-MIGRATION SEED EXECUTION');
  console.log('='.repeat(60) + '\n');
  
  // Check if seeds should be skipped
  if (process.env.SKIP_SEEDS === 'true') {
    console.log('⏭️  Skipping seed execution (SKIP_SEEDS=true)');
    console.log('💡 Seeds can be run manually later with: tsx scripts/seeds/run-all-seeds.ts\n');
    return;
  }
  
  // Build command with flags
  const flags: string[] = [];
  if (process.env.FORCE_SEEDS === 'true') {
    flags.push('--force');
    console.log('🔄 Force re-running all seeds (FORCE_SEEDS=true)');
  }
  
  const command = `tsx scripts/seeds/run-all-seeds.ts ${flags.join(' ')}`;
  console.log(`📦 Executing: ${command}\n`);
  
  try {
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
      env: {
        ...process.env,
        // Ensure database connection is available
        NODE_ENV: process.env.NODE_ENV || 'production',
      },
    });
    
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    
    console.log('\n✅ Seed execution completed successfully');
    console.log('='.repeat(60) + '\n');
  } catch (error: any) {
    console.error('\n❌ Seed execution failed:');
    console.error(error.message);
    
    if (error.stdout) console.log('\nStdout:', error.stdout);
    if (error.stderr) console.error('\nStderr:', error.stderr);
    
    console.log('\n⚠️  Deployment will continue despite seed failure');
    console.log('💡 Seeds can be run manually later with: tsx scripts/seeds/run-all-seeds.ts');
    console.log('💡 Check seed registry for execution history: tsx scripts/seeds/view-registry.ts');
    console.log('='.repeat(60) + '\n');
    
    // Don't throw - allow deployment to continue
    // Seeds can be run manually later if needed
  }
}

/**
 * Check if seeds should run based on environment
 * 
 * This is a helper function to determine if seed execution should proceed.
 * Useful for conditional seed execution in different environments.
 */
export function shouldRunSeeds(): boolean {
  // Skip if explicitly disabled
  if (process.env.SKIP_SEEDS === 'true') {
    return false;
  }
  
  // Run in production and staging by default
  const env = process.env.NODE_ENV;
  if (env === 'production' || env === 'staging') {
    return true;
  }
  
  // Skip in development and test by default (unless forced)
  if (env === 'development' || env === 'test') {
    return process.env.FORCE_SEEDS === 'true';
  }
  
  // Default to running seeds
  return true;
}
