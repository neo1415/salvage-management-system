/**
 * Sync Progress Indicator Component
 * 
 * Displays offline case sync progress and status.
 */

'use client';

import { useOfflineSync } from '@/hooks/use-offline-sync';
import { useOffline } from '@/hooks/use-offline';

export function SyncProgressIndicator() {
  const isOffline = useOffline();
  const {
    isSyncing,
    pendingCount,
    errorCount,
    progress,
    conflicts,
    sync,
    retryFailed,
    resolveConflict,
  } = useOfflineSync();

  // Don't show anything if there's nothing to sync
  if (!isOffline && pendingCount === 0 && errorCount === 0 && !isSyncing) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      {/* Offline indicator */}
      {isOffline && (
        <div className="bg-yellow-500 text-white px-4 py-3 rounded-lg shadow-lg mb-2">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
              />
            </svg>
            <div>
              <p className="font-semibold">You&apos;re offline</p>
              <p className="text-sm">Changes will sync automatically when connection returns</p>
            </div>
          </div>
          {pendingCount > 0 && (
            <p className="text-sm mt-2">
              {pendingCount} case{pendingCount !== 1 ? 's' : ''} waiting to sync
            </p>
          )}
        </div>
      )}

      {/* Sync progress */}
      {isSyncing && progress && (
        <div className="bg-blue-500 text-white px-4 py-3 rounded-lg shadow-lg mb-2">
          <div className="flex items-center gap-2 mb-2">
            <svg
              className="w-5 h-5 animate-spin"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <p className="font-semibold">Syncing cases...</p>
          </div>
          
          {progress.current && (
            <p className="text-sm mb-2">Current: {progress.current}</p>
          )}
          
          <div className="w-full bg-blue-700 rounded-full h-2 mb-2">
            <div
              className="bg-white h-2 rounded-full transition-all duration-300"
              style={{
                width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%`,
              }}
            />
          </div>
          
          <p className="text-sm">
            {progress.completed} of {progress.total} synced
            {progress.failed > 0 && ` (${progress.failed} failed)`}
          </p>
        </div>
      )}

      {/* Pending sync indicator */}
      {!isOffline && !isSyncing && pendingCount > 0 && (
        <div className="bg-orange-500 text-white px-4 py-3 rounded-lg shadow-lg mb-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold">
                {pendingCount} case{pendingCount !== 1 ? 's' : ''} pending sync
              </p>
              <p className="text-sm">Tap to sync now</p>
            </div>
            <button
              onClick={() => sync()}
              className="bg-white text-orange-500 px-3 py-1 rounded font-semibold hover:bg-orange-100 transition-colors"
            >
              Sync
            </button>
          </div>
        </div>
      )}

      {/* Error indicator */}
      {!isOffline && !isSyncing && errorCount > 0 && (
        <div className="bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg mb-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold">
                {errorCount} case{errorCount !== 1 ? 's' : ''} failed to sync
              </p>
              <p className="text-sm">Tap to retry</p>
            </div>
            <button
              onClick={() => retryFailed()}
              className="bg-white text-red-500 px-3 py-1 rounded font-semibold hover:bg-red-100 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Conflict resolution modal */}
      {conflicts.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Sync Conflict Detected
            </h2>
            
            <div className="mb-4">
              <p className="text-gray-700 mb-2">
                A case with claim reference <strong>{conflicts[0].offlineCase.claimReference}</strong> already exists online.
              </p>
              <p className="text-sm text-gray-600">
                {conflicts[0].reason}
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => resolveConflict(conflicts[0].offlineCase.id, 'keep-remote')}
                className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
              >
                Keep Online Version
              </button>
              
              <button
                onClick={() => resolveConflict(conflicts[0].offlineCase.id, 'keep-local')}
                className="w-full bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors"
              >
                Keep Offline Version (Retry)
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-4 text-center">
              {conflicts.length > 1 && `${conflicts.length - 1} more conflict${conflicts.length - 1 !== 1 ? 's' : ''} remaining`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
