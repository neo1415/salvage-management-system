import { db } from '@/lib/db/drizzle';
import { seedRegistry, type SeedExecutionStats, type SeedStatus } from '@/lib/db/schema/seed-registry';
import { eq, and, lt } from 'drizzle-orm';

/**
 * Seed Registry Service
 * 
 * Manages seed script execution tracking to enable idempotent seeding.
 * Records execution status, statistics, and provides cleanup for stale entries.
 * 
 * Feature: enterprise-data-seeding-system
 * Requirements: 5.2, 5.3, 5.4, 11.2, 11.3, 11.4
 */

export interface SeedExecution {
  id: string;
  scriptName: string;
  executedAt: Date;
  status: SeedStatus;
  recordsAffected: number;
  recordsImported: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errorMessage?: string | null;
  executionTimeMs: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export class SeedRegistryService {
  /**
   * Check if a seed script has been executed successfully
   * 
   * @param scriptName - Name of the seed script
   * @returns True if the script has been executed with 'completed' status
   * 
   * Requirement 5.4: Check registry for previous execution
   */
  async hasBeenExecuted(scriptName: string): Promise<boolean> {
    const entries = await db
      .select()
      .from(seedRegistry)
      .where(
        and(
          eq(seedRegistry.scriptName, scriptName),
          eq(seedRegistry.status, 'completed')
        )
      )
      .limit(1);
    
    return entries.length > 0;
  }
  
  /**
   * Record the start of a seed execution
   * 
   * @param scriptName - Name of the seed script
   * @returns Registry ID for tracking this execution
   * 
   * Requirement 11.2: Create registry entry with status 'running' at start
   */
  async recordStart(scriptName: string): Promise<string> {
    const [entry] = await db
      .insert(seedRegistry)
      .values({
        scriptName,
        status: 'running',
        executedAt: new Date(),
        recordsAffected: 0,
        recordsImported: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        executionTimeMs: null,
        errorMessage: null,
      })
      .returning();
    
    return entry.id;
  }
  
  /**
   * Record successful completion of a seed
   * 
   * @param registryId - Registry ID from recordStart
   * @param stats - Execution statistics
   * 
   * Requirement 11.3: Update registry entry with status 'completed' and record counts
   */
  async recordSuccess(
    registryId: string,
    stats: SeedExecutionStats
  ): Promise<void> {
    await db
      .update(seedRegistry)
      .set({
        status: 'completed',
        recordsImported: stats.recordsImported,
        recordsUpdated: stats.recordsUpdated,
        recordsSkipped: stats.recordsSkipped,
        recordsAffected: stats.recordsImported + stats.recordsUpdated,
        executionTimeMs: stats.executionTimeMs,
        updatedAt: new Date(),
      })
      .where(eq(seedRegistry.id, registryId));
  }
  
  /**
   * Record failure of a seed
   * 
   * @param registryId - Registry ID from recordStart
   * @param error - Error that caused the failure
   * @param executionTimeMs - Time spent before failure
   * 
   * Requirement 11.4: Update registry entry with status 'failed' and error message
   */
  async recordFailure(
    registryId: string,
    error: Error,
    executionTimeMs: number
  ): Promise<void> {
    await db
      .update(seedRegistry)
      .set({
        status: 'failed',
        errorMessage: error.message,
        executionTimeMs,
        updatedAt: new Date(),
      })
      .where(eq(seedRegistry.id, registryId));
  }
  
  /**
   * Get execution history for a specific seed script
   * 
   * @param scriptName - Name of the seed script
   * @returns Array of execution records, ordered by execution time
   * 
   * Requirement 5.3: Provide query interface for execution history
   */
  async getHistory(scriptName: string): Promise<SeedExecution[]> {
    const results = await db
      .select()
      .from(seedRegistry)
      .where(eq(seedRegistry.scriptName, scriptName))
      .orderBy(seedRegistry.executedAt);
    
    return results as SeedExecution[];
  }
  
  /**
   * Get all seed executions
   * 
   * @returns Array of all execution records, ordered by execution time
   * 
   * Requirement 5.3: Provide query interface for execution history
   */
  async getAllExecutions(): Promise<SeedExecution[]> {
    const results = await db
      .select()
      .from(seedRegistry)
      .orderBy(seedRegistry.executedAt);
    
    return results as SeedExecution[];
  }
  
  /**
   * Cleanup stale entries that have been running for more than 1 hour
   * 
   * Marks entries as 'failed' if they've been in 'running' status for > 1 hour.
   * This handles cases where seed scripts crash without updating the registry.
   * 
   * @returns Number of entries cleaned up
   * 
   * Requirement 11.4: Cleanup stale running entries
   */
  async cleanupStaleEntries(): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const result = await db
      .update(seedRegistry)
      .set({
        status: 'failed',
        errorMessage: 'Execution timed out or crashed (stale entry cleanup)',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(seedRegistry.status, 'running'),
          lt(seedRegistry.executedAt, oneHourAgo)
        )
      );
    
    // Drizzle returns an array with the updated rows, get the count
    return Array.isArray(result) ? result.length : 0;
  }
}

/**
 * Singleton instance for use in seed scripts
 * 
 * Requirement: Service exports a singleton instance for use in seed scripts
 */
export const seedRegistryService = new SeedRegistryService();
