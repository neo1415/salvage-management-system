/**
 * View Seed Registry
 * 
 * Query and display seed execution history with filtering options.
 * 
 * Usage:
 *   tsx scripts/seeds/view-registry.ts                    # View all executions
 *   tsx scripts/seeds/view-registry.ts --status completed # Filter by status
 *   tsx scripts/seeds/view-registry.ts --status failed    # Show only failures
 *   tsx scripts/seeds/view-registry.ts --days 7           # Last 7 days
 *   tsx scripts/seeds/view-registry.ts --script toyota-valuations # Specific script
 * 
 * Feature: enterprise-data-seeding-system
 * Requirements: 11.5
 */

import 'dotenv/config';
import { seedRegistryService, type SeedExecution } from '@/features/seeds/services/seed-registry.service';

interface FilterOptions {
  status?: 'running' | 'completed' | 'failed';
  days?: number;
  scriptName?: string;
}

/**
 * Parse command line arguments
 */
function parseArgs(): FilterOptions {
  const args = process.argv.slice(2);
  const options: FilterOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--status' && args[i + 1]) {
      const status = args[i + 1];
      if (['running', 'completed', 'failed'].includes(status)) {
        options.status = status as 'running' | 'completed' | 'failed';
      }
      i++;
    } else if (arg === '--days' && args[i + 1]) {
      options.days = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--script' && args[i + 1]) {
      options.scriptName = args[i + 1];
      i++;
    }
  }
  
  return options;
}

/**
 * Filter executions based on options
 */
function filterExecutions(
  executions: SeedExecution[],
  options: FilterOptions
): SeedExecution[] {
  let filtered = executions;
  
  // Filter by status
  if (options.status) {
    filtered = filtered.filter(e => e.status === options.status);
  }
  
  // Filter by date range
  if (options.days) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - options.days);
    filtered = filtered.filter(e => new Date(e.executedAt) >= cutoffDate);
  }
  
  // Filter by script name
  if (options.scriptName) {
    filtered = filtered.filter(e => 
      e.scriptName.toLowerCase().includes(options.scriptName!.toLowerCase())
    );
  }
  
  return filtered;
}

/**
 * Format execution time in human-readable format
 */
function formatExecutionTime(ms: number | null): string {
  if (ms === null) return 'N/A';
  
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

/**
 * Format date in readable format
 */
function formatDate(date: Date): string {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Get status emoji
 */
function getStatusEmoji(status: string): string {
  switch (status) {
    case 'completed': return '✅';
    case 'failed': return '❌';
    case 'running': return '🔄';
    default: return '❓';
  }
}

/**
 * Display executions in a formatted table
 */
function displayExecutions(executions: SeedExecution[]): void {
  if (executions.length === 0) {
    console.log('\n📭 No seed executions found matching the criteria.\n');
    return;
  }
  
  console.log('\n' + '='.repeat(120));
  console.log('📊 SEED EXECUTION REGISTRY');
  console.log('='.repeat(120));
  console.log();
  
  // Table header
  console.log(
    '  Status  | Script Name                    | Executed At          | Time    | Imported | Updated | Skipped | Affected'
  );
  console.log('-'.repeat(120));
  
  // Table rows
  for (const execution of executions) {
    const status = `${getStatusEmoji(execution.status)} ${execution.status.padEnd(9)}`;
    const scriptName = execution.scriptName.padEnd(30).substring(0, 30);
    const executedAt = formatDate(execution.executedAt).padEnd(20);
    const time = formatExecutionTime(execution.executionTimeMs).padEnd(7);
    const imported = execution.recordsImported.toString().padStart(8);
    const updated = execution.recordsUpdated.toString().padStart(7);
    const skipped = execution.recordsSkipped.toString().padStart(7);
    const affected = execution.recordsAffected.toString().padStart(8);
    
    console.log(
      `${status} | ${scriptName} | ${executedAt} | ${time} | ${imported} | ${updated} | ${skipped} | ${affected}`
    );
    
    // Show error message for failed executions
    if (execution.status === 'failed' && execution.errorMessage) {
      console.log(`         └─ Error: ${execution.errorMessage}`);
    }
  }
  
  console.log('-'.repeat(120));
  console.log();
  
  // Summary statistics
  const totalExecutions = executions.length;
  const completedCount = executions.filter(e => e.status === 'completed').length;
  const failedCount = executions.filter(e => e.status === 'failed').length;
  const runningCount = executions.filter(e => e.status === 'running').length;
  const totalImported = executions.reduce((sum, e) => sum + e.recordsImported, 0);
  const totalUpdated = executions.reduce((sum, e) => sum + e.recordsUpdated, 0);
  const totalSkipped = executions.reduce((sum, e) => sum + e.recordsSkipped, 0);
  const totalAffected = executions.reduce((sum, e) => sum + e.recordsAffected, 0);
  
  console.log('📈 SUMMARY');
  console.log('─'.repeat(120));
  console.log(`Total Executions: ${totalExecutions}`);
  console.log(`  ✅ Completed: ${completedCount}`);
  console.log(`  ❌ Failed: ${failedCount}`);
  console.log(`  🔄 Running: ${runningCount}`);
  console.log();
  console.log(`Total Records:`);
  console.log(`  Imported: ${totalImported}`);
  console.log(`  Updated: ${totalUpdated}`);
  console.log(`  Skipped: ${totalSkipped}`);
  console.log(`  Affected: ${totalAffected}`);
  console.log('='.repeat(120));
  console.log();
}

/**
 * Display usage instructions
 */
function displayUsage(): void {
  console.log(`
📖 USAGE

  tsx scripts/seeds/view-registry.ts [options]

OPTIONS

  --status <status>     Filter by status: running, completed, failed
  --days <number>       Show executions from last N days
  --script <name>       Filter by script name (partial match)

EXAMPLES

  # View all executions
  tsx scripts/seeds/view-registry.ts

  # View only completed executions
  tsx scripts/seeds/view-registry.ts --status completed

  # View failures from last 7 days
  tsx scripts/seeds/view-registry.ts --status failed --days 7

  # View specific script history
  tsx scripts/seeds/view-registry.ts --script toyota-valuations

  # Combine filters
  tsx scripts/seeds/view-registry.ts --status completed --days 30 --script toyota
`);
}

/**
 * Main execution function
 */
async function main() {
  try {
    // Check for help flag
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      displayUsage();
      process.exit(0);
    }
    
    // Parse command line arguments
    const options = parseArgs();
    
    // Fetch executions
    console.log('🔍 Fetching seed execution history...');
    
    let executions: SeedExecution[];
    if (options.scriptName && !options.status && !options.days) {
      // Optimize: fetch only specific script if no other filters
      executions = await seedRegistryService.getHistory(options.scriptName);
    } else {
      // Fetch all and filter
      executions = await seedRegistryService.getAllExecutions();
      executions = filterExecutions(executions, options);
    }
    
    // Display results
    displayExecutions(executions);
    
    // Show active filters
    if (options.status || options.days || options.scriptName) {
      console.log('🔎 Active Filters:');
      if (options.status) console.log(`  - Status: ${options.status}`);
      if (options.days) console.log(`  - Last ${options.days} days`);
      if (options.scriptName) console.log(`  - Script: ${options.scriptName}`);
      console.log();
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR:', error);
    console.error('\nFailed to fetch seed execution history.');
    console.error('Make sure the database is accessible and the seed_registry table exists.\n');
    process.exit(1);
  }
}

// Execute
main();
