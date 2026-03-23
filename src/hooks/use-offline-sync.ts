/**
 * React Hook for Offline Sync
 * 
 * Provides offline sync functionality and status to React components.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  syncOfflineCases,
  getSyncStatus,
  onSyncProgress,
  setupAutoSync,
  retryFailedSyncs,
  resolveSyncConflict,
  type SyncProgress,
  type SyncResult,
  type SyncConflict,
  type ConflictResolution,
} from '@/features/cases/services/offline-sync.service';
import { useOffline } from './use-offline';

/**
 * Offline sync hook state
 */
export interface UseOfflineSyncState {
  // Sync status
  isSyncing: boolean;
  pendingCount: number;
  errorCount: number;
  syncedCount: number;
  
  // Sync progress
  progress: SyncProgress | null;
  
  // Last sync result
  lastSyncResult: SyncResult | null;
  
  // Conflicts
  conflicts: SyncConflict[];
  
  // Actions
  sync: () => Promise<SyncResult>;
  retryFailed: () => Promise<SyncResult>;
  resolveConflict: (offlineCaseId: string, resolution: ConflictResolution) => Promise<void>;
  refreshStatus: () => Promise<void>;
}

/**
 * Hook for offline sync functionality
 */
export function useOfflineSync(): UseOfflineSyncState {
  const isOffline = useOffline();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [syncedCount, setSyncedCount] = useState(0);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);

  /**
   * Refresh sync status
   */
  const refreshStatus = useCallback(async () => {
    try {
      const status = await getSyncStatus();
      setIsSyncing(status.isSyncing);
      setPendingCount(status.pendingCount);
      setErrorCount(status.errorCount);
      setSyncedCount(status.syncedCount);
    } catch (error) {
      console.error('Failed to refresh sync status:', error);
    }
  }, []);

  /**
   * Trigger manual sync
   */
  const sync = useCallback(async (): Promise<SyncResult> => {
    if (isOffline) {
      throw new Error('Cannot sync while offline');
    }

    setIsSyncing(true);
    setProgress({ total: 0, completed: 0, failed: 0, status: 'syncing' });

    try {
      const result = await syncOfflineCases();
      setLastSyncResult(result);
      
      if (result.conflicts.length > 0) {
        setConflicts(result.conflicts);
      }
      
      await refreshStatus();
      
      return result;
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }, [isOffline, refreshStatus]);

  /**
   * Retry failed syncs
   */
  const retryFailed = useCallback(async (): Promise<SyncResult> => {
    if (isOffline) {
      throw new Error('Cannot sync while offline');
    }

    setIsSyncing(true);
    setProgress({ total: 0, completed: 0, failed: 0, status: 'syncing' });

    try {
      const result = await retryFailedSyncs();
      setLastSyncResult(result);
      
      if (result.conflicts.length > 0) {
        setConflicts(result.conflicts);
      }
      
      await refreshStatus();
      
      return result;
    } catch (error) {
      console.error('Retry failed:', error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }, [isOffline, refreshStatus]);

  /**
   * Resolve sync conflict
   */
  const resolveConflictHandler = useCallback(async (
    offlineCaseId: string,
    resolution: ConflictResolution
  ): Promise<void> => {
    try {
      await resolveSyncConflict(offlineCaseId, resolution);
      
      // Remove resolved conflict from state
      setConflicts(prev => prev.filter(c => c.offlineCase.id !== offlineCaseId));
      
      await refreshStatus();
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      throw error;
    }
  }, [refreshStatus]);

  /**
   * Setup sync progress listener
   */
  useEffect(() => {
    onSyncProgress((progressUpdate) => {
      setProgress(progressUpdate);
    });
  }, []);

  /**
   * Setup auto-sync on connection restore
   */
  useEffect(() => {
    const cleanup = setupAutoSync();
    return cleanup;
  }, []);

  /**
   * Refresh status on mount and when coming back online
   */
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!isOffline) {
      refreshStatus();
    }
  }, [isOffline, refreshStatus]);

  return {
    isSyncing,
    pendingCount,
    errorCount,
    syncedCount,
    progress,
    lastSyncResult,
    conflicts,
    sync,
    retryFailed,
    resolveConflict: resolveConflictHandler,
    refreshStatus,
  };
}
