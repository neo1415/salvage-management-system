'use client';

import { useEffect, useState } from 'react';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Database
} from 'lucide-react';
import { 
  getSyncStatus, 
  syncOfflineCases, 
  onSyncProgress,
  type SyncProgress 
} from '@/features/cases/services/offline-sync.service';
import { getStorageStats } from '@/lib/db/indexeddb';

interface SyncStatusProps {
  className?: string;
  showDetails?: boolean;
}

/**
 * Sync Status Indicator Component
 * 
 * Displays real-time sync status including:
 * - Online/offline indicator
 * - Sync progress during sync operations
 * - Last sync timestamp
 * - Pending changes count
 * - Error notifications
 */
export function SyncStatus({ className = '', showDetails = true }: SyncStatusProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState<{
    isSyncing: boolean;
    pendingCount: number;
    errorCount: number;
    syncedCount: number;
  }>({
    isSyncing: false,
    pendingCount: 0,
    errorCount: 0,
    syncedCount: 0,
  });
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Monitor online/offline status
  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    updateOnlineStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  // Load sync status
  useEffect(() => {
    const loadSyncStatus = async () => {
      try {
        const status = await getSyncStatus();
        setSyncStatus(status);
      } catch (error) {
        console.error('Failed to load sync status:', error);
      }
    };

    loadSyncStatus();
    
    // Refresh every 10 seconds
    const interval = setInterval(loadSyncStatus, 10000);
    
    return () => clearInterval(interval);
  }, []);

  // Listen for sync progress
  useEffect(() => {
    onSyncProgress((progress) => {
      setSyncProgress(progress);
      setIsSyncing(progress.status === 'syncing');
      
      if (progress.status === 'completed') {
        setLastSyncTime(new Date());
        // Clear progress after 3 seconds
        setTimeout(() => setSyncProgress(null), 3000);
      }
    });
  }, []);

  // Manual sync trigger
  const handleManualSync = async () => {
    if (!isOnline || isSyncing) return;
    
    try {
      setIsSyncing(true);
      await syncOfflineCases();
      setLastSyncTime(new Date());
    } catch (error) {
      console.error('Manual sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Format last sync time
  const formatLastSync = (date: Date | null): string => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Calculate sync progress percentage
  const syncPercentage = syncProgress 
    ? Math.round((syncProgress.completed / syncProgress.total) * 100)
    : 0;

  return (
    <div className={`relative ${className}`}>
      {/* Main Status Indicator */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={handleManualSync}
      >
        {/* Online/Offline Indicator */}
        {isOnline ? (
          <Wifi 
            size={16} 
            className="text-green-600" 
            aria-label="Online"
          />
        ) : (
          <WifiOff 
            size={16} 
            className="text-red-600" 
            aria-label="Offline"
          />
        )}

        {/* Sync Status Icon */}
        {isSyncing ? (
          <RefreshCw 
            size={16} 
            className="text-blue-600 animate-spin" 
            aria-label="Syncing"
          />
        ) : syncStatus.errorCount > 0 ? (
          <AlertCircle 
            size={16} 
            className="text-amber-600" 
            aria-label="Sync errors"
          />
        ) : syncStatus.pendingCount > 0 ? (
          <Clock 
            size={16} 
            className="text-gray-600" 
            aria-label="Pending sync"
          />
        ) : (
          <CheckCircle 
            size={16} 
            className="text-green-600" 
            aria-label="Synced"
          />
        )}

        {/* Pending Count Badge */}
        {syncStatus.pendingCount > 0 && (
          <span className="px-2 py-0.5 bg-[#800020] text-white rounded-full text-xs font-medium">
            {syncStatus.pendingCount}
          </span>
        )}

        {/* Status Text */}
        {showDetails && (
          <span className="text-sm text-gray-700">
            {isSyncing 
              ? 'Syncing...' 
              : !isOnline 
              ? 'Offline' 
              : syncStatus.pendingCount > 0 
              ? `${syncStatus.pendingCount} pending`
              : 'Synced'}
          </span>
        )}
      </div>

      {/* Sync Progress Bar */}
      {syncProgress && syncProgress.status === 'syncing' && (
        <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700 font-medium">
                Syncing {syncProgress.current || 'cases'}...
              </span>
              <span className="text-gray-600">
                {syncProgress.completed}/{syncProgress.total}
              </span>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-[#800020] h-full transition-all duration-300 ease-out"
                style={{ width: `${syncPercentage}%` }}
                role="progressbar"
                aria-valuenow={syncPercentage}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            
            <div className="text-xs text-gray-500">
              {syncPercentage}% complete
            </div>
          </div>
        </div>
      )}

      {/* Detailed Tooltip */}
      {showTooltip && !syncProgress && (
        <div className="absolute top-full left-0 mt-2 p-4 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[280px]">
          <div className="space-y-3">
            {/* Connection Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Connection:</span>
              <span className={`text-sm font-medium ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>

            {/* Last Sync */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Last sync:</span>
              <span className="text-sm font-medium text-gray-900">
                {formatLastSync(lastSyncTime)}
              </span>
            </div>

            {/* Pending Changes */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Pending:</span>
              <span className="text-sm font-medium text-gray-900">
                {syncStatus.pendingCount} {syncStatus.pendingCount === 1 ? 'case' : 'cases'}
              </span>
            </div>

            {/* Synced Count */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Synced:</span>
              <span className="text-sm font-medium text-green-600">
                {syncStatus.syncedCount} {syncStatus.syncedCount === 1 ? 'case' : 'cases'}
              </span>
            </div>

            {/* Errors */}
            {syncStatus.errorCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Errors:</span>
                <span className="text-sm font-medium text-amber-600">
                  {syncStatus.errorCount} {syncStatus.errorCount === 1 ? 'case' : 'cases'}
                </span>
              </div>
            )}

            {/* Manual Sync Button */}
            {isOnline && syncStatus.pendingCount > 0 && !isSyncing && (
              <button
                onClick={handleManualSync}
                className="w-full mt-2 px-3 py-2 bg-[#800020] text-white rounded-lg text-sm font-medium hover:bg-[#600018] transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} />
                Sync Now
              </button>
            )}

            {/* Offline Message */}
            {!isOnline && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                Changes will sync automatically when connection is restored
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact Sync Status Badge
 * Minimal version for use in headers/footers
 */
export function SyncStatusBadge({ className = '' }: { className?: string }) {
  return <SyncStatus className={className} showDetails={false} />;
}

/**
 * Sync Status with Storage Info
 * Extended version with storage statistics
 */
export function SyncStatusExtended({ className = '' }: { className?: string }) {
  const [storageStats, setStorageStats] = useState<{
    totalCases: number;
    pendingSync: number;
    syncing: number;
    synced: number;
    errors: number;
    queueSize: number;
  } | null>(null);

  useEffect(() => {
    const loadStorageStats = async () => {
      try {
        const stats = await getStorageStats();
        setStorageStats(stats);
      } catch (error) {
        console.error('Failed to load storage stats:', error);
      }
    };

    loadStorageStats();
    const interval = setInterval(loadStorageStats, 30000); // Every 30s
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`space-y-4 ${className}`}>
      <SyncStatus showDetails={true} />
      
      {storageStats && (
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Database size={16} className="text-gray-600" />
            <h3 className="text-sm font-medium text-gray-900">Storage</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-600">Total cases:</span>
              <span className="ml-2 font-medium text-gray-900">{storageStats.totalCases}</span>
            </div>
            <div>
              <span className="text-gray-600">Queue size:</span>
              <span className="ml-2 font-medium text-gray-900">{storageStats.queueSize}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
