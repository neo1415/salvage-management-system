'use client';

import { useOffline } from '@/hooks/use-offline';
import { useOfflineSync } from '@/hooks/use-offline-sync';
import { WifiOff } from 'lucide-react';

/**
 * Offline Indicator Component
 * Shows a banner when the user is offline with pending sync count
 * Auto-sync happens automatically when connection is restored
 */
export function OfflineIndicator() {
  const isOffline = useOffline();
  const { pendingCount } = useOfflineSync();
  // const { sync } = useOfflineSync(); // Manual sync function available if needed

  if (!isOffline) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-white px-4 py-3 shadow-lg">
      <div className="container mx-auto flex items-center gap-2">
        <WifiOff size={20} />
        <div>
          <span className="font-semibold block">You're offline</span>
          {pendingCount > 0 && (
            <span className="text-sm">
              {pendingCount} case{pendingCount !== 1 ? 's' : ''} will sync automatically when connection returns
            </span>
          )}
        </div>
        {/* Manual sync button - commented out as auto-sync is preferred
        {pendingCount > 0 && (
          <button
            onClick={() => sync()}
            className="flex items-center gap-2 bg-white text-yellow-600 px-3 py-1 rounded font-semibold hover:bg-yellow-50 transition-colors text-sm ml-auto"
          >
            <RefreshCw size={16} />
            Sync Now
          </button>
        )}
        */}
      </div>
    </div>
  );
}
