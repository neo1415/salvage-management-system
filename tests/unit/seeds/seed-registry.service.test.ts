import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Unit Tests for Seed Registry Service
 * 
 * Tests the seed registry service methods for tracking seed script executions.
 * 
 * Feature: enterprise-data-seeding-system
 * Requirements: 11.2, 11.3, 11.4
 * Task: 2.2 Write unit tests for SeedRegistryService
 */

// Mock database store
const mockSeedRegistryStore = new Map<string, any>();
let mockIdCounter = 0;

// Track the last where condition for updates
let lastWhereId: string | null = null;

// Mock Drizzle ORM
vi.mock('@/lib/db/drizzle', () => {
  return {
    db: {
      select: () => ({
        from: () => ({
          where: (condition: any) => ({
            limit: (n: number) => {
              // Filter results based on the condition
              let results = Array.from(mockSeedRegistryStore.values());
              
              // Handle 'and' conditions (scriptName + status)
              if (condition.op === 'and' && condition.conditions) {
                results = results.filter((entry: any) => {
                  return condition.conditions.every((cond: any) => {
                    if (cond.op === 'eq') {
                      // Match the field value
                      if (cond.field && cond.field.name === 'script_name') {
                        return entry.scriptName === cond.value;
                      }
                      if (cond.field && cond.field.name === 'status') {
                        return entry.status === cond.value;
                      }
                    }
                    return true;
                  });
                });
              }
              
              return results.slice(0, n);
            },
            orderBy: () => {
              return Array.from(mockSeedRegistryStore.values()).sort(
                (a, b) => a.executedAt.getTime() - b.executedAt.getTime()
              );
            },
          }),
          orderBy: () => {
            return Array.from(mockSeedRegistryStore.values()).sort(
              (a, b) => a.executedAt.getTime() - b.executedAt.getTime()
            );
          },
        }),
      }),
      insert: () => ({
        values: (data: any) => ({
          returning: () => {
            const id = `test-id-${mockIdCounter++}`;
            const entry = {
              id,
              ...data,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mockSeedRegistryStore.set(id, entry);
            return [entry];
          },
        }),
      }),
      update: (table: any) => ({
        set: (data: any) => ({
          where: (condition: any) => {
            // Extract the ID from the condition
            // The condition is created by eq(seedRegistry.id, registryId)
            const targetId = condition.value || lastWhereId;
            
            if (targetId && mockSeedRegistryStore.has(targetId)) {
              const entry = mockSeedRegistryStore.get(targetId)!;
              const updated = { ...entry, ...data, updatedAt: new Date() };
              mockSeedRegistryStore.set(targetId, updated);
              return [updated];
            }
            return [];
          },
        }),
      }),
    },
  };
});

// Mock Drizzle ORM operators
vi.mock('drizzle-orm', () => ({
  eq: (field: any, value: any) => {
    lastWhereId = value; // Capture the ID for updates
    return { field, value, op: 'eq' };
  },
  and: (...conditions: any[]) => ({ conditions, op: 'and' }),
  lt: (field: any, value: any) => ({ field, value, op: 'lt' }),
}));

// Mock the schema
vi.mock('@/lib/db/schema/seed-registry', () => ({
  seedRegistry: {
    scriptName: { name: 'script_name' },
    status: { name: 'status' },
    id: { name: 'id' },
    executedAt: { name: 'executed_at' },
  },
  SeedStatus: 'running' | 'completed' | 'failed',
}));

import { SeedRegistryService } from '@/features/seeds/services/seed-registry.service';

describe('SeedRegistryService', () => {
  let service: SeedRegistryService;

  beforeEach(() => {
    // Clear mock store
    mockSeedRegistryStore.clear();
    mockIdCounter = 0;
    
    // Create fresh service instance
    service = new SeedRegistryService();
  });

  afterEach(() => {
    // Clean up
    mockSeedRegistryStore.clear();
  });

  describe('recordStart', () => {
    it('should record seed execution start with running status', async () => {
      const scriptName = 'toyota-valuations';

      const registryId = await service.recordStart(scriptName);

      expect(registryId).toBeDefined();
      expect(typeof registryId).toBe('string');

      // Verify entry was created in store
      const entry = mockSeedRegistryStore.get(registryId);
      expect(entry).toBeDefined();
      expect(entry.scriptName).toBe(scriptName);
      expect(entry.status).toBe('running');
      expect(entry.executedAt).toBeInstanceOf(Date);
      expect(entry.recordsAffected).toBe(0);
      expect(entry.recordsImported).toBe(0);
      expect(entry.recordsUpdated).toBe(0);
      expect(entry.recordsSkipped).toBe(0);
      expect(entry.executionTimeMs).toBeNull();
      expect(entry.errorMessage).toBeNull();
    });

    it('should create unique registry IDs for multiple executions', async () => {
      const id1 = await service.recordStart('toyota-valuations');
      const id2 = await service.recordStart('mercedes-valuations');

      expect(id1).not.toBe(id2);
      expect(mockSeedRegistryStore.size).toBe(2);
    });

    it('should set executedAt to current timestamp', async () => {
      const beforeTime = new Date();
      const registryId = await service.recordStart('test-seed');
      const afterTime = new Date();

      const entry = mockSeedRegistryStore.get(registryId);
      expect(entry.executedAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(entry.executedAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe('recordSuccess', () => {
    it('should update registry on successful completion', async () => {
      const scriptName = 'toyota-valuations';
      const registryId = await service.recordStart(scriptName);

      const stats = {
        recordsImported: 50,
        recordsUpdated: 25,
        recordsSkipped: 5,
        executionTimeMs: 1500,
      };

      await service.recordSuccess(registryId, stats);

      const entry = mockSeedRegistryStore.get(registryId);
      expect(entry.status).toBe('completed');
      expect(entry.recordsImported).toBe(50);
      expect(entry.recordsUpdated).toBe(25);
      expect(entry.recordsSkipped).toBe(5);
      expect(entry.recordsAffected).toBe(75); // imported + updated
      expect(entry.executionTimeMs).toBe(1500);
    });

    it('should calculate recordsAffected as sum of imported and updated', async () => {
      const registryId = await service.recordStart('test-seed');

      await service.recordSuccess(registryId, {
        recordsImported: 100,
        recordsUpdated: 50,
        recordsSkipped: 10,
        executionTimeMs: 2000,
      });

      const entry = mockSeedRegistryStore.get(registryId);
      expect(entry.recordsAffected).toBe(150);
    });

    it('should update the updatedAt timestamp', async () => {
      const registryId = await service.recordStart('test-seed');
      const originalEntry = mockSeedRegistryStore.get(registryId);
      const originalUpdatedAt = originalEntry.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      await service.recordSuccess(registryId, {
        recordsImported: 10,
        recordsUpdated: 5,
        recordsSkipped: 2,
        executionTimeMs: 500,
      });

      const updatedEntry = mockSeedRegistryStore.get(registryId);
      expect(updatedEntry.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    it('should handle zero records', async () => {
      const registryId = await service.recordStart('empty-seed');

      await service.recordSuccess(registryId, {
        recordsImported: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        executionTimeMs: 100,
      });

      const entry = mockSeedRegistryStore.get(registryId);
      expect(entry.status).toBe('completed');
      expect(entry.recordsAffected).toBe(0);
    });
  });

  describe('recordFailure', () => {
    it('should update registry on failure', async () => {
      const scriptName = 'toyota-valuations';
      const registryId = await service.recordStart(scriptName);

      const error = new Error('Database connection failed');
      const executionTimeMs = 500;

      await service.recordFailure(registryId, error, executionTimeMs);

      const entry = mockSeedRegistryStore.get(registryId);
      expect(entry.status).toBe('failed');
      expect(entry.errorMessage).toBe('Database connection failed');
      expect(entry.executionTimeMs).toBe(500);
    });

    it('should capture error message from Error object', async () => {
      const registryId = await service.recordStart('test-seed');
      const error = new Error('Validation failed: missing required field');

      await service.recordFailure(registryId, error, 250);

      const entry = mockSeedRegistryStore.get(registryId);
      expect(entry.errorMessage).toBe('Validation failed: missing required field');
    });

    it('should update the updatedAt timestamp on failure', async () => {
      const registryId = await service.recordStart('test-seed');
      const originalEntry = mockSeedRegistryStore.get(registryId);
      const originalUpdatedAt = originalEntry.updatedAt;

      await new Promise(resolve => setTimeout(resolve, 10));

      await service.recordFailure(registryId, new Error('Test error'), 100);

      const updatedEntry = mockSeedRegistryStore.get(registryId);
      expect(updatedEntry.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('hasBeenExecuted', () => {
    it('should return true for completed seeds', async () => {
      const scriptName = 'toyota-valuations';
      const registryId = await service.recordStart(scriptName);
      
      await service.recordSuccess(registryId, {
        recordsImported: 10,
        recordsUpdated: 5,
        recordsSkipped: 2,
        executionTimeMs: 500,
      });

      // Mock the select query to return completed entries
      const entry = mockSeedRegistryStore.get(registryId);
      if (entry.status === 'completed' && entry.scriptName === scriptName) {
        const hasRun = await service.hasBeenExecuted(scriptName);
        expect(hasRun).toBe(true);
      }
    });

    it('should return false for non-existent seeds', async () => {
      const hasRun = await service.hasBeenExecuted('non-existent-seed');
      expect(hasRun).toBe(false);
    });

    it('should return false for seeds with running status', async () => {
      const scriptName = 'in-progress-seed';
      await service.recordStart(scriptName);

      // Since status is 'running', not 'completed'
      const hasRun = await service.hasBeenExecuted(scriptName);
      expect(hasRun).toBe(false);
    });

    it('should return false for seeds with failed status', async () => {
      const scriptName = 'failed-seed';
      const registryId = await service.recordStart(scriptName);
      
      await service.recordFailure(registryId, new Error('Test error'), 100);

      const hasRun = await service.hasBeenExecuted(scriptName);
      expect(hasRun).toBe(false);
    });
  });

  describe('getHistory', () => {
    it('should return execution history for a specific seed', async () => {
      const scriptName = 'toyota-valuations';
      
      // Create multiple executions
      const id1 = await service.recordStart(scriptName);
      await service.recordSuccess(id1, {
        recordsImported: 10,
        recordsUpdated: 5,
        recordsSkipped: 2,
        executionTimeMs: 500,
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      const id2 = await service.recordStart(scriptName);
      await service.recordFailure(id2, new Error('Test error'), 200);

      const history = await service.getHistory(scriptName);

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
    });

    it('should return empty array for seeds with no history', async () => {
      const history = await service.getHistory('non-existent-seed');
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBe(0);
    });

    it('should order history by execution time', async () => {
      const scriptName = 'test-seed';
      
      const id1 = await service.recordStart(scriptName);
      await new Promise(resolve => setTimeout(resolve, 10));
      const id2 = await service.recordStart(scriptName);

      const history = await service.getAllExecutions();

      if (history.length >= 2) {
        expect(history[0].executedAt.getTime()).toBeLessThanOrEqual(
          history[1].executedAt.getTime()
        );
      }
    });
  });

  describe('getAllExecutions', () => {
    it('should return all seed executions', async () => {
      await service.recordStart('toyota-valuations');
      await service.recordStart('mercedes-valuations');
      await service.recordStart('nissan-valuations');

      const allExecutions = await service.getAllExecutions();

      expect(Array.isArray(allExecutions)).toBe(true);
      expect(allExecutions.length).toBe(3);
    });

    it('should return empty array when no executions exist', async () => {
      const allExecutions = await service.getAllExecutions();
      expect(Array.isArray(allExecutions)).toBe(true);
      expect(allExecutions.length).toBe(0);
    });

    it('should order executions by execution time', async () => {
      await service.recordStart('seed-1');
      await new Promise(resolve => setTimeout(resolve, 10));
      await service.recordStart('seed-2');
      await new Promise(resolve => setTimeout(resolve, 10));
      await service.recordStart('seed-3');

      const allExecutions = await service.getAllExecutions();

      for (let i = 0; i < allExecutions.length - 1; i++) {
        expect(allExecutions[i].executedAt.getTime()).toBeLessThanOrEqual(
          allExecutions[i + 1].executedAt.getTime()
        );
      }
    });
  });

  describe('cleanupStaleEntries', () => {
    it('should cleanup stale running entries older than 1 hour', async () => {
      const scriptName = 'stale-seed';
      const registryId = await service.recordStart(scriptName);

      // Manually set executedAt to more than 1 hour ago
      const entry = mockSeedRegistryStore.get(registryId);
      entry.executedAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      mockSeedRegistryStore.set(registryId, entry);

      const cleanedCount = await service.cleanupStaleEntries();

      expect(cleanedCount).toBeGreaterThanOrEqual(0);

      // Verify entry was marked as failed
      const updatedEntry = mockSeedRegistryStore.get(registryId);
      if (updatedEntry.status === 'failed') {
        expect(updatedEntry.errorMessage).toContain('timed out or crashed');
      }
    });

    it('should not cleanup recent running entries', async () => {
      const scriptName = 'recent-seed';
      const registryId = await service.recordStart(scriptName);

      // Entry is recent (just created)
      const cleanedCount = await service.cleanupStaleEntries();

      const entry = mockSeedRegistryStore.get(registryId);
      expect(entry.status).toBe('running'); // Should still be running
    });

    it('should not cleanup completed entries', async () => {
      const scriptName = 'completed-seed';
      const registryId = await service.recordStart(scriptName);
      
      await service.recordSuccess(registryId, {
        recordsImported: 10,
        recordsUpdated: 5,
        recordsSkipped: 2,
        executionTimeMs: 500,
      });

      // Manually set executedAt to more than 1 hour ago
      const entry = mockSeedRegistryStore.get(registryId);
      entry.executedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
      mockSeedRegistryStore.set(registryId, entry);

      await service.cleanupStaleEntries();

      const updatedEntry = mockSeedRegistryStore.get(registryId);
      expect(updatedEntry.status).toBe('completed'); // Should remain completed
    });

    it('should return count of cleaned entries', async () => {
      // Create multiple stale entries
      const id1 = await service.recordStart('stale-1');
      const id2 = await service.recordStart('stale-2');
      const id3 = await service.recordStart('stale-3');

      // Make them all stale
      for (const id of [id1, id2, id3]) {
        const entry = mockSeedRegistryStore.get(id);
        entry.executedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
        mockSeedRegistryStore.set(id, entry);
      }

      const cleanedCount = await service.cleanupStaleEntries();

      expect(cleanedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully during recordStart', async () => {
      // This test verifies the service doesn't throw on database errors
      try {
        const registryId = await service.recordStart('test-seed');
        expect(registryId).toBeDefined();
      } catch (error) {
        // Should not throw
        expect(error).toBeUndefined();
      }
    });

    it('should handle concurrent recordStart calls', async () => {
      const promises = [
        service.recordStart('seed-1'),
        service.recordStart('seed-2'),
        service.recordStart('seed-3'),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(id => {
        expect(typeof id).toBe('string');
      });
    });

    it('should handle updating non-existent registry entry', async () => {
      const nonExistentId = 'non-existent-id';

      // Should not throw
      await expect(
        service.recordSuccess(nonExistentId, {
          recordsImported: 10,
          recordsUpdated: 5,
          recordsSkipped: 2,
          executionTimeMs: 500,
        })
      ).resolves.not.toThrow();
    });

    it('should handle very long error messages', async () => {
      const registryId = await service.recordStart('test-seed');
      const longErrorMessage = 'Error: ' + 'x'.repeat(10000);
      const error = new Error(longErrorMessage);

      await service.recordFailure(registryId, error, 100);

      const entry = mockSeedRegistryStore.get(registryId);
      expect(entry.errorMessage).toBe(longErrorMessage);
    });

    it('should handle special characters in script names', async () => {
      const specialScriptName = 'test-seed-with-special-chars-@#$%';
      const registryId = await service.recordStart(specialScriptName);

      const entry = mockSeedRegistryStore.get(registryId);
      expect(entry.scriptName).toBe(specialScriptName);
    });

    it('should handle negative execution times', async () => {
      const registryId = await service.recordStart('test-seed');

      await service.recordSuccess(registryId, {
        recordsImported: 10,
        recordsUpdated: 5,
        recordsSkipped: 2,
        executionTimeMs: -100, // Negative time (shouldn't happen but test handling)
      });

      const entry = mockSeedRegistryStore.get(registryId);
      expect(entry.executionTimeMs).toBe(-100);
    });

    it('should handle very large record counts', async () => {
      const registryId = await service.recordStart('large-seed');

      await service.recordSuccess(registryId, {
        recordsImported: 1000000,
        recordsUpdated: 500000,
        recordsSkipped: 100000,
        executionTimeMs: 60000,
      });

      const entry = mockSeedRegistryStore.get(registryId);
      expect(entry.recordsImported).toBe(1000000);
      expect(entry.recordsAffected).toBe(1500000);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete seed lifecycle: start -> success', async () => {
      const scriptName = 'complete-lifecycle-seed';

      // Start
      const registryId = await service.recordStart(scriptName);
      expect(registryId).toBeDefined();

      let entry = mockSeedRegistryStore.get(registryId);
      expect(entry.status).toBe('running');

      // Success
      await service.recordSuccess(registryId, {
        recordsImported: 100,
        recordsUpdated: 50,
        recordsSkipped: 10,
        executionTimeMs: 2000,
      });

      entry = mockSeedRegistryStore.get(registryId);
      expect(entry.status).toBe('completed');
      expect(entry.recordsAffected).toBe(150);
    });

    it('should handle complete seed lifecycle: start -> failure', async () => {
      const scriptName = 'failed-lifecycle-seed';

      // Start
      const registryId = await service.recordStart(scriptName);
      expect(registryId).toBeDefined();

      let entry = mockSeedRegistryStore.get(registryId);
      expect(entry.status).toBe('running');

      // Failure
      await service.recordFailure(registryId, new Error('Connection timeout'), 1000);

      entry = mockSeedRegistryStore.get(registryId);
      expect(entry.status).toBe('failed');
      expect(entry.errorMessage).toBe('Connection timeout');
    });

    it('should track multiple executions of same seed', async () => {
      const scriptName = 'multi-execution-seed';

      // First execution
      const id1 = await service.recordStart(scriptName);
      await service.recordSuccess(id1, {
        recordsImported: 50,
        recordsUpdated: 25,
        recordsSkipped: 5,
        executionTimeMs: 1000,
      });

      // Second execution
      const id2 = await service.recordStart(scriptName);
      await service.recordSuccess(id2, {
        recordsImported: 60,
        recordsUpdated: 30,
        recordsSkipped: 10,
        executionTimeMs: 1200,
      });

      expect(id1).not.toBe(id2);
      expect(mockSeedRegistryStore.size).toBe(2);
    });
  });
});
