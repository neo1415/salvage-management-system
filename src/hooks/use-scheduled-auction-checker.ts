/**
 * useScheduledAuctionChecker Hook
 * 
 * Client-side polling mechanism to check and activate scheduled auctions.
 * Replaces the need for cron jobs - works in both local dev and production.
 * 
 * Features:
 * - Polls every 20 seconds when component is mounted
 * - Only runs when user is viewing auction pages
 * - Handles errors gracefully
 * - Calls onAuctionsActivated callback when auctions are activated
 * - Pauses when tab is not visible (Page Visibility API)
 * - Automatically resumes when tab becomes visible
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';

interface ActivatedAuction {
  auctionId: string;
  caseReference: string;
  assetType: string;
  notifiedVendors: number;
}

interface CheckResponse {
  success: boolean;
  activated: ActivatedAuction[];
  count: number;
  timestamp: string;
}

interface UseScheduledAuctionCheckerOptions {
  /**
   * Callback fired when auctions are activated
   * Use this to refresh the auction list
   */
  onAuctionsActivated?: (auctions: ActivatedAuction[]) => void;
  
  /**
   * Polling interval in milliseconds
   * @default 20000 (20 seconds)
   */
  intervalMs?: number;
  
  /**
   * Whether to enable polling
   * @default true
   */
  enabled?: boolean;
}

export function useScheduledAuctionChecker(options: UseScheduledAuctionCheckerOptions = {}) {
  const {
    onAuctionsActivated,
    intervalMs = 20000, // 20 seconds
    enabled = true,
  } = options;

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCheckingRef = useRef(false);

  const checkScheduledAuctions = useCallback(async () => {
    // Prevent concurrent checks
    if (isCheckingRef.current) {
      return;
    }

    // Skip if tab is not visible
    if (document.hidden) {
      return;
    }

    try {
      isCheckingRef.current = true;

      const response = await fetch('/api/auctions/check-and-activate-scheduled', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: CheckResponse = await response.json();

      if (data.success && data.count > 0) {
        console.log(`✅ Activated ${data.count} scheduled auction(s)`);
        
        // Notify parent component to refresh
        if (onAuctionsActivated) {
          onAuctionsActivated(data.activated);
        }
      }
    } catch (error) {
      // Silently fail - don't spam console or show errors to user
      // The next poll will retry
      console.debug('[Polling] Failed to check scheduled auctions:', error);
    } finally {
      isCheckingRef.current = false;
    }
  }, [onAuctionsActivated]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Check immediately on mount
    checkScheduledAuctions();

    // Set up polling interval
    intervalRef.current = setInterval(checkScheduledAuctions, intervalMs);

    // Handle visibility change - resume polling when tab becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Tab became visible - check immediately
        checkScheduledAuctions();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, intervalMs, checkScheduledAuctions]);

  return {
    checkNow: checkScheduledAuctions,
  };
}
