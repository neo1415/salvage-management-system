/**
 * Offline Sync Service
 * 
 * Handles synchronization of offline cases when network connection is restored.
 * Implements conflict resolution and progress tracking.
 */

import {
  getDB,
  getOfflineCasesByStatus,
  updateOfflineCase,
  deleteOfflineCase,
  getSyncQueue,
  removeFromSyncQueue,
  type OfflineCase,
} from '@/lib/db/indexeddb';

/**
 * Sync progress callback
 */
export type SyncProgressCallback = (progress: SyncProgress) => void;

/**
 * Sync progress information
 */
export interface SyncProgress {
  total: number;
  completed: number;
  failed: number;
  current?: string; // Current case being synced
  status: 'idle' | 'syncing' | 'completed' | 'error';
}

/**
 * Conflict resolution strategy
 */
export type ConflictResolution = 'keep-local' | 'keep-remote' | 'merge';

/**
 * Conflict information
 */
export interface SyncConflict {
  offlineCase: OfflineCase;
  remoteCase: {
    id: string;
    claimReference: string;
    lastModified: Date;
    version: number;
  };
  reason: string;
}

/**
 * Sync result
 */
export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  conflicts: SyncConflict[];
  errors: Array<{ caseId: string; error: string }>;
}

let isSyncing = false;
let syncProgressCallback: SyncProgressCallback | null = null;

/**
 * Register sync progress callback
 */
export function onSyncProgress(callback: SyncProgressCallback): void {
  syncProgressCallback = callback;
}

/**
 * Notify sync progress
 */
function notifySyncProgress(progress: SyncProgress): void {
  if (syncProgressCallback) {
    syncProgressCallback(progress);
  }
}

/**
 * Sync a single offline case via API
 */
async function syncSingleCase(
  offlineCase: OfflineCase
): Promise<{ success: boolean; error?: string; conflict?: SyncConflict }> {
  try {
    // Update sync status to 'syncing'
    await updateOfflineCase(offlineCase.id, { syncStatus: 'syncing' });

    // Call sync API
    const response = await fetch('/api/cases/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cases: [offlineCase],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to sync case');
    }

    const result = await response.json();
    
    // Check if sync was successful
    if (result.data.synced > 0) {
      // Mark as synced
      await updateOfflineCase(offlineCase.id, {
        syncStatus: 'synced',
        syncError: undefined,
      });

      // Remove from sync queue
      const queueItems = await getSyncQueue();
      const relatedQueueItems = queueItems.filter(item => item.caseId === offlineCase.id);
      for (const item of relatedQueueItems) {
        await removeFromSyncQueue(item.id);
      }

      return { success: true };
    } else if (result.data.errors.length > 0) {
      const errorMessage = result.data.errors[0].error;
      
      // Update sync status to error
      await updateOfflineCase(offlineCase.id, {
        syncStatus: 'error',
        syncError: errorMessage,
      });

      return { success: false, error: errorMessage };
    }

    return { success: false, error: 'Unknown sync error' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Update sync status to error
    await updateOfflineCase(offlineCase.id, {
      syncStatus: 'error',
      syncError: errorMessage,
    });

    return { success: false, error: errorMessage };
  }
}

/**
 * Sync all pending offline cases
 */
export async function syncOfflineCases(): Promise<SyncResult> {
  if (isSyncing) {
    throw new Error('Sync already in progress');
  }

  if (!navigator.onLine) {
    throw new Error('Cannot sync while offline');
  }

  isSyncing = true;

  try {
    // Get all pending cases
    const pendingCases = await getOfflineCasesByStatus('pending');
    const errorCases = await getOfflineCasesByStatus('error');
    const allCasesToSync = [...pendingCases, ...errorCases];

    if (allCasesToSync.length === 0) {
      notifySyncProgress({
        total: 0,
        completed: 0,
        failed: 0,
        status: 'completed',
      });
      
      return {
        success: true,
        synced: 0,
        failed: 0,
        conflicts: [],
        errors: [],
      };
    }

    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      conflicts: [],
      errors: [],
    };

    // Notify start of sync
    notifySyncProgress({
      total: allCasesToSync.length,
      completed: 0,
      failed: 0,
      status: 'syncing',
    });

    // Sync each case
    for (let i = 0; i < allCasesToSync.length; i++) {
      const offlineCase = allCasesToSync[i];

      // Notify current case
      notifySyncProgress({
        total: allCasesToSync.length,
        completed: result.synced,
        failed: result.failed,
        current: offlineCase.claimReference,
        status: 'syncing',
      });

      const syncResult = await syncSingleCase(offlineCase);

      if (syncResult.success) {
        result.synced++;
      } else {
        result.failed++;
        
        if (syncResult.conflict) {
          result.conflicts.push(syncResult.conflict);
        }
        
        if (syncResult.error) {
          result.errors.push({
            caseId: offlineCase.id,
            error: syncResult.error,
          });
        }
      }
    }

    // Notify completion
    notifySyncProgress({
      total: allCasesToSync.length,
      completed: result.synced,
      failed: result.failed,
      status: result.failed > 0 ? 'error' : 'completed',
    });

    result.success = result.failed === 0;
    
    return result;
  } finally {
    isSyncing = false;
  }
}

/**
 * Resolve sync conflict
 */
export async function resolveSyncConflict(
  offlineCaseId: string,
  resolution: ConflictResolution
): Promise<void> {
  const offlineCase = await getDB().then(db => db.get('offlineCases', offlineCaseId));
  
  if (!offlineCase) {
    throw new Error(`Offline case not found: ${offlineCaseId}`);
  }

  switch (resolution) {
    case 'keep-local':
      // Keep offline version - mark as pending to retry sync
      await updateOfflineCase(offlineCaseId, {
        syncStatus: 'pending',
        syncError: undefined,
      });
      break;

    case 'keep-remote':
      // Discard offline version - mark as synced and delete
      await updateOfflineCase(offlineCaseId, {
        syncStatus: 'synced',
        syncError: undefined,
      });
      // Optionally delete after a delay
      setTimeout(() => deleteOfflineCase(offlineCaseId), 5000);
      break;

    case 'merge':
      // Merge not implemented yet - would require custom logic
      throw new Error('Merge conflict resolution not implemented');
  }
}

/**
 * Get sync status
 */
export async function getSyncStatus(): Promise<{
  isSyncing: boolean;
  pendingCount: number;
  errorCount: number;
  syncedCount: number;
}> {
  const pendingCases = await getOfflineCasesByStatus('pending');
  const errorCases = await getOfflineCasesByStatus('error');
  const syncedCases = await getOfflineCasesByStatus('synced');

  return {
    isSyncing,
    pendingCount: pendingCases.length,
    errorCount: errorCases.length,
    syncedCount: syncedCases.length,
  };
}

/**
 * Retry failed syncs
 */
export async function retryFailedSyncs(): Promise<SyncResult> {
  // Reset error cases to pending
  const errorCases = await getOfflineCasesByStatus('error');
  
  for (const errorCase of errorCases) {
    await updateOfflineCase(errorCase.id, {
      syncStatus: 'pending',
      syncError: undefined,
    });
  }

  // Trigger sync
  return await syncOfflineCases();
}

/**
 * Auto-sync when connection is restored
 */
export function setupAutoSync(): () => void {
  const handleOnline = async () => {
    console.log('Connection restored, starting auto-sync...');
    
    try {
      const result = await syncOfflineCases();
      console.log('Auto-sync completed:', result);
    } catch (error) {
      console.error('Auto-sync failed:', error);
    }
  };

  window.addEventListener('online', handleOnline);

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
  };
}

/**
 * Clean up synced cases older than specified days
 */
export async function cleanupSyncedCases(olderThanDays: number = 7): Promise<number> {
  const syncedCases = await getOfflineCasesByStatus('synced');
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  let deletedCount = 0;

  for (const syncedCase of syncedCases) {
    if (syncedCase.lastModified < cutoffDate) {
      await deleteOfflineCase(syncedCase.id);
      deletedCount++;
    }
  }

  return deletedCount;
}
