'use client';

import { useOffline } from '@/hooks/use-offline';
import { WifiOff } from 'lucide-react';

/**
 * Offline Indicator Component
 * Shows a banner when the user is offline
 */
export function OfflineIndicator() {
  const isOffline = useOffline();

  if (!isOffline) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-white px-4 py-3 shadow-lg">
      <div className="container mx-auto flex items-center justify-center gap-2">
        <WifiOff size={20} />
        <span className="font-semibold">
          You're offline. Changes will sync automatically when you're back online.
        </span>
      </div>
    </div>
  );
}
