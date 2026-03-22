/**
 * Cleanup Seed Registry
 * 
 * Cleanup stale 'running' entries and optionally reset the entire registry.
 * 
 * Usage:
 *   tsx scripts/seeds/cleanup-registry.ts              # Cleanup stale entries (> 1 hour old)
 *   tsx scripts/seeds/cleanup-registry.ts --reset      # Clear all registry entries (requires confirmation)
 *   tsx scripts/seeds/cleanup-registry.ts --reset -y   # Clear all without confirmation
 * 
 * Feature: enterprise-data-seeding-system
 * Requirements: 11.4
 */

import 'dotenv/config';
import { db } from '@/lib/db/drizzle';
import { seedRegistry } from '@/lib/db/schema/seed-registry';
import { seedRegistryService } from '@/features/seeds/services/seed-registry.service';
import { eq } from 'drizzle-orm';
import * as readline from 'readline';

/**
 * Prompt user for confirmation
 */
function promptConfirmation(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise((resolve) => {
    rl.question(`${message} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Cleanup stale running entries
 * 
 * Marks entries as 'failed' if they've been in 'running' status for > 1 hour.
 * This handles cases where seed scripts crash without updating the registry.
 */
async function cleanupStaleEntries(): Promise<void> {
  console.log('🧹 Cleaning up stale registry entries...\n');
  
  try {
    // Get stale entries before cleanup for reporting
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const staleEntries = await db
      .select()
      .from(seedRegistry)
      .where(eq(seedRegistry.status, 'running'));
    
    const staleCount = staleEntries.filter(
      e => new Date(e.executedAt) < oneHourAgo
    ).length;
    
    if (staleCount === 0) {
      console.log('✅ No stale entries found. Registry is clean!\n');
      return;
    }
    
    console.log(`Found ${staleCount} stale entries (running for > 1 hour):\n`);
    
    // Display stale entries
    for (const entry of staleEntries) {
      const executedAt = new Date(entry.executedAt);
      if (executedAt < oneHourAgo) {
        const hoursAgo = Math.floor((Date.now() - executedAt.getTime()) / (60 * 60 * 1000));
        console.log(`  - ${entry.scriptName} (started ${hoursAgo}h ago)`);
      }
    }
    
    console.log();
    
    // Perform cleanup
    const cleanedCount = await seedRegistryService.cleanupStaleEntries();
    
    console.log(`✅ Cleaned up ${cleanedCount} stale entries.\n`);
    console.log('These entries have been marked as "failed" with error message:');
    console.log('  "Execution timed out or crashed (stale entry cleanup)"\n');
  } catch (error) {
    console.error('❌ Failed to cleanup stale entries:', error);
    throw error;
  }
}

/**
 * Reset entire registry
 * 
 * Deletes all registry entries. This is a destructive operation
 * that requires explicit confirmation.
 */
async function resetRegistry(skipConfirmation: boolean = false): Promise<void> {
  console.log('⚠️  WARNING: DESTRUCTIVE OPERATION\n');
  console.log('This will delete ALL seed registry entries.');
  console.log('All seed execution history will be lost.');
  console.log('Seeds will be re-executed on next run unless --force flag is used.\n');
  
  // Get current count
  const allEntries = await seedRegistryService.getAllExecutions();
  const totalCount = allEntries.length;
  
  if (totalCount === 0) {
    console.log('✅ Registry is already empty. Nothing to reset.\n');
    return;
  }
  
  console.log(`Current registry contains ${totalCount} entries:\n`);
  
  // Show summary by status
  const completedCount = allEntries.filter(e => e.status === 'completed').length;
  const failedCount = allEntries.filter(e => e.status === 'failed').length;
  const runningCount = allEntries.filter(e => e.status === 'running').length;
  
  console.log(`  ✅ Completed: ${completedCount}`);
  console.log(`  ❌ Failed: ${failedCount}`);
  console.log(`  🔄 Running: ${runningCount}`);
  console.log();
  
  // Require confirmation
  if (!skipConfirmation) {
    const confirmed = await promptConfirmation('Are you sure you want to delete ALL registry entries?');
    
    if (!confirmed) {
      console.log('\n❌ Reset cancelled. No changes made.\n');
      return;
    }
  }
  
  console.log('\n🗑️  Deleting all registry entries...\n');
  
  try {
    // Delete all entries
    await db.delete(seedRegistry);
    
    console.log(`✅ Successfully deleted ${totalCount} registry entries.\n`);
    console.log('Registry has been reset. All seeds will be re-executed on next run.\n');
  } catch (error) {
    console.error('❌ Failed to reset registry:', error);
    throw error;
  }
}

/**
 * Display usage instructions
 */
function displayUsage(): void {
  console.log(`
📖 USAGE

  tsx scripts/seeds/cleanup-registry.ts [options]

OPTIONS

  --reset               Delete all registry entries (requires confirmation)
  -y, --yes             Skip confirmation prompt for --reset
  --help, -h            Display this help message

COMMANDS

  # Cleanup stale entries (running for > 1 hour)
  tsx scripts/seeds/cleanup-registry.ts

  # Reset entire registry (with confirmation)
  tsx scripts/seeds/cleanup-registry.ts --reset

  # Reset without confirmation (use with caution!)
  tsx scripts/seeds/cleanup-registry.ts --reset -y

WHAT DOES THIS DO?

  Default (no flags):
    - Finds seed entries in 'running' status for > 1 hour
    - Marks them as 'failed' with cleanup error message
    - Safe operation, does not delete data

  --reset flag:
    - Deletes ALL registry entries
    - Requires confirmation unless -y flag is used
    - DESTRUCTIVE: All execution history is lost
    - Seeds will re-execute on next run

WHEN TO USE

  Cleanup stale entries:
    - After a deployment crash or server restart
    - When seeds are stuck in 'running' status
    - Regular maintenance to keep registry clean

  Reset registry:
    - When you want to force re-execution of all seeds
    - After major data changes or corrections
    - When testing seed idempotence
    - CAUTION: Use sparingly in production

SAFETY

  - Stale cleanup is safe and non-destructive
  - Reset requires explicit confirmation
  - Use -y flag only in automated scripts
  - Always backup database before reset in production
`);
}

/**
 * Main execution function
 */
async function main() {
  try {
    const args = process.argv.slice(2);
    
    // Check for help flag
    if (args.includes('--help') || args.includes('-h')) {
      displayUsage();
      process.exit(0);
    }
    
    // Check for reset flag
    const resetFlag = args.includes('--reset');
    const skipConfirmation = args.includes('-y') || args.includes('--yes');
    
    console.log('\n' + '='.repeat(80));
    console.log('🧹 SEED REGISTRY CLEANUP');
    console.log('='.repeat(80) + '\n');
    
    if (resetFlag) {
      // Reset entire registry
      await resetRegistry(skipConfirmation);
    } else {
      // Cleanup stale entries only
      await cleanupStaleEntries();
    }
    
    console.log('='.repeat(80));
    console.log('✅ Cleanup completed successfully');
    console.log('='.repeat(80) + '\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ CLEANUP FAILED');
    console.error('='.repeat(80));
    console.error('\nError:', error);
    console.error('\nMake sure the database is accessible and the seed_registry table exists.');
    console.error('='.repeat(80) + '\n');
    process.exit(1);
  }
}

// Execute
main();
