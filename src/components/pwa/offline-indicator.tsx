'use client';

import { useState, useEffect } from 'react';
import { useOffline } from '@/hooks/use-offline';
import { useOfflineSync } from '@/hooks/use-offline-sync';
import { WifiOff, X } from 'lucide-react';

/**
 * Offline Indicator Component
 * Shows a dismissible banner when the user is offline with pending sync count
 * Auto-sync happens automatically when connection is restored
 * 
 * Features:
 * - Dismissible with close button
 * - Compact badge mode after dismissal
 * - Proper z-index (z-40, below modals but above content)
 * - Slide animation
 * - Session storage for dismissal state
 */
export function OfflineIndicator() {
  const isOffline = useOffline();
  const { pendingCount } = useOfflineSync();
  const [isDismissed, setIsDismissed] = useState(false);
  const [showCompact, setShowCompact] = useState(false);

  // Load dismissal state from sessionStorage
  useEffect(() => {
    const dismissed = sessionStorage.getItem('offline-banner-dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
      setShowCompact(true);
    }
  }, []);

  // Reset dismissal when coming back online
  useEffect(() => {
    if (!isOffline) {
      setIsDismissed(false);
      setShowCompact(false);
      sessionStorage.removeItem('offline-banner-dismissed');
    }
  }, [isOffline]);

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('offline-banner-dismissed', 'true');
    // Show compact badge after animation
    setTimeout(() => setShowCompact(true), 300);
  };

  const handleCompactClick = () => {
    setShowCompact(false);
    setIsDismissed(false);
    sessionStorage.removeItem('offline-banner-dismissed');
  };

  if (!isOffline) {
    return null;
  }

  // Compact badge mode (after dismissal)
  if (showCompact) {
    return (
      <button
        onClick={handleCompactClick}
        className="fixed top-4 right-4 z-40 bg-yellow-500 text-white p-2 rounded-full shadow-lg hover:bg-yellow-600 transition-all duration-200 hover:scale-110"
        aria-label="Offline - Click to expand"
        title="You're offline. Click to see details."
      >
        <WifiOff size={20} />
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {pendingCount}
          </span>
        )}
      </button>
    );
  }

  // Full banner mode
  return (
    <div
      className={`fixed top-0 left-0 right-0 z-40 bg-yellow-500 text-white px-4 py-3 shadow-lg transition-transform duration-300 ${
        isDismissed ? '-translate-y-full' : 'translate-y-0'
      }`}
      role="alert"
      aria-live="polite"
    >
      <div className="container mx-auto flex items-center gap-3">
        <WifiOff size={20} className="flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-semibold block">You're offline</span>
          {pendingCount > 0 && (
            <span className="text-sm">
              {pendingCount} case{pendingCount !== 1 ? 's' : ''} will sync automatically when connection returns
            </span>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 hover:bg-yellow-600 rounded transition-colors"
          aria-label="Dismiss offline notification"
          title="Dismiss (will show compact badge)"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
