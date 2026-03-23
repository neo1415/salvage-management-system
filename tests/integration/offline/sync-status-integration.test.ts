/**
 * Integration Tests for Sync Status with Offline Scenarios
 * 
 * Tests the complete offline workflow:
 * 1. Create case while offline
 * 2. Store in IndexedDB
 * 3. Go online
 * 4. Auto-sync
 * 5. Verify sync status updates
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  saveOfflineCase, 
  getOfflineCasesByStatus,
  clearOfflineData,
  getStorageStats,
  type OfflineCase 
} from '@/lib/db/indexeddb';
import { 
  syncOfflineCases, 
  getSyncStatus,
  setupAutoSync,
  type SyncProgress 
} from '@/features/cases/services/offline-sync.service';

// Mock fetch for API calls
global.fetch = vi.fn();

describe('Sync Status Integration Tests', () => {
  beforeEach(async () => {
    // Clear all offline data before each test
    await clearOfflineData();
    
    // Reset fetch mock
    vi.mocked(global.fetch).mockReset();
    
    // Mock successful sync API response
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          synced: 1,
          failed: 0,
          errors: [],
        },
      }),
    } as Response);
  });

  afterEach(async () => {
    // Cleanup
    await clearOfflineData();
  });

  describe('Offline Case Creation', () => {
    it('should save case to IndexedDB when offline', async () => {
      // Create offline case
      const caseData = {
        claimReference: 'TEST-001',
        assetType: 'vehicle' as const,
        assetDetails: { make: 'Toyota', model: 'Camry' },
        marketValue: 5000000,
        photos: ['data:image/jpeg;base64,test'],
        gpsLocation: { latitude: 6.5244, longitude: 3.3792 },
        locationName: 'Lagos, Nigeria',
        status: 'draft' as const,
        createdBy: 'test-user',
        syncStatus: 'pending' as const,
      };

      const savedCase = await saveOfflineCase(caseData);

      // Verify case was saved
      expect(savedCase.id).toBeDefined();
      expect(savedCase.claimReference).toBe('TEST-001');
      expect(savedCase.syncStatus).toBe('pending');

      // Verify case can be retrieved
      const pendingCases = await getOfflineCasesByStatus('pending');
      expect(pendingCases).toHaveLength(1);
      expect(pendingCases[0].id).toBe(savedCase.id);
    });

    it('should update storage stats after creating offline case', async () => {
      // Initial stats
      const initialStats = await getStorageStats();
      expect(initialStats.totalCases).toBe(0);
      expect(initialStats.pendingSync).toBe(0);

      // Create offline case
      await saveOfflineCase({
        claimReference: 'TEST-002',
        assetType: 'vehicle' as const,
        assetDetails: {},
        marketValue: 3000000,
        photos: [],
        gpsLocation: { latitude: 6.5244, longitude: 3.3792 },
        locationName: 'Lagos',
        status: 'draft' as const,
        createdBy: 'test-user',
        syncStatus: 'pending' as const,
      });

      // Updated stats
      const updatedStats = await getStorageStats();
      expect(updatedStats.totalCases).toBe(1);
      expect(updatedStats.pendingSync).toBe(1);
    });
  });

  describe('Sync Status Tracking', () => {
    it('should report correct sync status with pending cases', async () => {
      // Create multiple offline cases
      await saveOfflineCase({
        claimReference: 'TEST-003',
        assetType: 'vehicle' as const,
        assetDetails: {},
        marketValue: 2000000,
        photos: [],
        gpsLocation: { latitude: 6.5244, longitude: 3.3792 },
        locationName: 'Lagos',
        status: 'draft' as const,
        createdBy: 'test-user',
        syncStatus: 'pending' as const,
      });

      await saveOfflineCase({
        claimReference: 'TEST-004',
        assetType: 'property' as const,
        assetDetails: {},
        marketValue: 10000000,
        photos: [],
        gpsLocation: { latitude: 6.5244, longitude: 3.3792 },
        locationName: 'Lagos',
        status: 'draft' as const,
        createdBy: 'test-user',
        syncStatus: 'pending' as const,
      });

      // Get sync status
      const status = await getSyncStatus();

      expect(status.pendingCount).toBe(2);
      expect(status.errorCount).toBe(0);
      expect(status.isSyncing).toBe(false);
    });

    it('should track sync progress during sync operation', async () => {
      // Create offline case
      await saveOfflineCase({
        claimReference: 'TEST-005',
        assetType: 'vehicle' as const,
        assetDetails: {},
        marketValue: 4000000,
        photos: [],
        gpsLocation: { latitude: 6.5244, longitude: 3.3792 },
        locationName: 'Lagos',
        status: 'draft' as const,
        createdBy: 'test-user',
        syncStatus: 'pending' as const,
      });

      // Track progress
      const progressUpdates: SyncProgress[] = [];
      const { onSyncProgress } = require('@/features/cases/services/offline-sync.service');
      
      onSyncProgress((progress: SyncProgress) => {
        progressUpdates.push(progress);
      });

      // Trigger sync
      const result = await syncOfflineCases();

      // Verify progress was tracked
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0].status).toBe('syncing');
      expect(progressUpdates[progressUpdates.length - 1].status).toBe('completed');
      
      // Verify sync result
      expect(result.success).toBe(true);
      expect(result.synced).toBe(1);
      expect(result.failed).toBe(0);
    });
  });

  describe('Auto-Sync on Connection Restore', () => {
    it('should setup auto-sync listener', () => {
      const cleanup = setupAutoSync();

      // Verify cleanup function is returned
      expect(typeof cleanup).toBe('function');

      // Cleanup
      cleanup();
    });

    it('should trigger sync when online event fires', async () => {
      // Create offline case
      await saveOfflineCase({
        claimReference: 'TEST-006',
        assetType: 'vehicle' as const,
        assetDetails: {},
        marketValue: 3500000,
        photos: [],
        gpsLocation: { latitude: 6.5244, longitude: 3.3792 },
        locationName: 'Lagos',
        status: 'draft' as const,
        createdBy: 'test-user',
        syncStatus: 'pending' as const,
      });

      // Setup auto-sync
      const cleanup = setupAutoSync();

      // Simulate going online
      window.dispatchEvent(new Event('online'));

      // Wait for sync to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify sync was triggered
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/cases/sync',
        expect.objectContaining({
          method: 'POST',
        })
      );

      // Cleanup
      cleanup();
    });
  });

  describe('Sync Error Handling', () => {
    it('should handle sync errors gracefully', async () => {
      // Mock failed sync
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'Network error',
        }),
      } as Response);

      // Create offline case
      await saveOfflineCase({
        claimReference: 'TEST-007',
        assetType: 'vehicle' as const,
        assetDetails: {},
        marketValue: 2500000,
        photos: [],
        gpsLocation: { latitude: 6.5244, longitude: 3.3792 },
        locationName: 'Lagos',
        status: 'draft' as const,
        createdBy: 'test-user',
        syncStatus: 'pending' as const,
      });

      // Trigger sync
      const result = await syncOfflineCases();

      // Verify error was handled
      expect(result.success).toBe(false);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('Network error');

      // Verify case status was updated to error
      const errorCases = await getOfflineCasesByStatus('error');
      expect(errorCases).toHaveLength(1);
      expect(errorCases[0].syncError).toContain('Network error');
    });

    it('should track error count in sync status', async () => {
      // Mock failed sync
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'Server error',
        }),
      } as Response);

      // Create offline case
      await saveOfflineCase({
        claimReference: 'TEST-008',
        assetType: 'vehicle' as const,
        assetDetails: {},
        marketValue: 1500000,
        photos: [],
        gpsLocation: { latitude: 6.5244, longitude: 3.3792 },
        locationName: 'Lagos',
        status: 'draft' as const,
        createdBy: 'test-user',
        syncStatus: 'pending' as const,
      });

      // Trigger sync
      await syncOfflineCases();

      // Get sync status
      const status = await getSyncStatus();

      expect(status.errorCount).toBe(1);
      expect(status.pendingCount).toBe(0);
    });
  });

  describe('Multiple Cases Sync', () => {
    it('should sync multiple cases in order', async () => {
      // Create multiple offline cases
      const cases = [];
      for (let i = 0; i < 5; i++) {
        const savedCase = await saveOfflineCase({
          claimReference: `TEST-${100 + i}`,
          assetType: 'vehicle' as const,
          assetDetails: {},
          marketValue: 2000000 + i * 100000,
          photos: [],
          gpsLocation: { latitude: 6.5244, longitude: 3.3792 },
          locationName: 'Lagos',
          status: 'draft' as const,
          createdBy: 'test-user',
          syncStatus: 'pending' as const,
        });
        cases.push(savedCase);
      }

      // Track progress
      const progressUpdates: SyncProgress[] = [];
      const { onSyncProgress } = require('@/features/cases/services/offline-sync.service');
      
      onSyncProgress((progress: SyncProgress) => {
        progressUpdates.push(progress);
      });

      // Trigger sync
      const result = await syncOfflineCases();

      // Verify all cases were synced
      expect(result.success).toBe(true);
      expect(result.synced).toBe(5);
      expect(result.failed).toBe(0);

      // Verify progress was tracked for each case
      expect(progressUpdates.length).toBeGreaterThan(5);
      
      // Verify final progress
      const finalProgress = progressUpdates[progressUpdates.length - 1];
      expect(finalProgress.total).toBe(5);
      expect(finalProgress.completed).toBe(5);
      expect(finalProgress.status).toBe('completed');
    });

    it('should continue syncing after partial failure', async () => {
      // Create multiple offline cases
      await saveOfflineCase({
        claimReference: 'TEST-200',
        assetType: 'vehicle' as const,
        assetDetails: {},
        marketValue: 2000000,
        photos: [],
        gpsLocation: { latitude: 6.5244, longitude: 3.3792 },
        locationName: 'Lagos',
        status: 'draft' as const,
        createdBy: 'test-user',
        syncStatus: 'pending' as const,
      });

      await saveOfflineCase({
        claimReference: 'TEST-201',
        assetType: 'vehicle' as const,
        assetDetails: {},
        marketValue: 3000000,
        photos: [],
        gpsLocation: { latitude: 6.5244, longitude: 3.3792 },
        locationName: 'Lagos',
        status: 'draft' as const,
        createdBy: 'test-user',
        syncStatus: 'pending' as const,
      });

      // Mock first sync to fail, second to succeed
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Failed' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { synced: 1, failed: 0, errors: [] },
          }),
        } as Response);

      // Trigger sync
      const result = await syncOfflineCases();

      // Verify partial success
      expect(result.synced).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.success).toBe(false);
    });
  });

  describe('Storage Statistics', () => {
    it('should provide accurate storage statistics', async () => {
      // Create cases with different statuses
      await saveOfflineCase({
        claimReference: 'TEST-300',
        assetType: 'vehicle' as const,
        assetDetails: {},
        marketValue: 2000000,
        photos: [],
        gpsLocation: { latitude: 6.5244, longitude: 3.3792 },
        locationName: 'Lagos',
        status: 'draft' as const,
        createdBy: 'test-user',
        syncStatus: 'pending' as const,
      });

      await saveOfflineCase({
        claimReference: 'TEST-301',
        assetType: 'vehicle' as const,
        assetDetails: {},
        marketValue: 3000000,
        photos: [],
        gpsLocation: { latitude: 6.5244, longitude: 3.3792 },
        locationName: 'Lagos',
        status: 'draft' as const,
        createdBy: 'test-user',
        syncStatus: 'synced' as const,
      });

      // Get stats
      const stats = await getStorageStats();

      expect(stats.totalCases).toBe(2);
      expect(stats.pendingSync).toBe(1);
      expect(stats.synced).toBe(1);
    });
  });
});
