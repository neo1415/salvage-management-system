/**
 * Hook: useAuctionExpiryCheck
 * 
 * Automatically checks if an auction has expired and triggers closure.
 * Implements client-side polling for real-time auction closure.
 * 
 * Features:
 * - Checks on mount
 * - Polls every 10 seconds while auction is active
 * - Stops polling when auction closes
 * - Triggers callback when auction closes
 */

import { useEffect, useRef, useState, useCallback } from 'react';

interface AuctionExpiryCheckOptions {
  auctionId: string;
  endTime: Date | string;
  status: string;
  onAuctionClosed?: () => void;
  enabled?: boolean;
}

interface AuctionExpiryState {
  isChecking: boolean;
  hasExpired: boolean;
  isClosed: boolean;
  error: string | null;
}

export function useAuctionExpiryCheck({
  auctionId,
  endTime,
  status,
  onAuctionClosed,
  enabled = true,
}: AuctionExpiryCheckOptions) {
  const [state, setState] = useState<AuctionExpiryState>({
    isChecking: false,
    hasExpired: false,
    isClosed: status !== 'active',
    error: null,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasClosedRef = useRef(false);
  const onAuctionClosedRef = useRef(onAuctionClosed);

  // Keep callback ref up to date
  useEffect(() => {
    onAuctionClosedRef.current = onAuctionClosed;
  }, [onAuctionClosed]);

  const checkExpiry = useCallback(async () => {
    // Don't check if already closed or disabled
    if (!enabled || hasClosedRef.current) {
      console.log('⏸️  Skipping expiry check - already closed or disabled');
      return;
    }

    // Check if auction has expired locally first
    const now = new Date();
    const auctionEndTime = new Date(endTime);
    const hasExpired = auctionEndTime <= now;

    console.log(`🔍 Checking auction ${auctionId} expiry:`, {
      now: now.toISOString(),
      endTime: auctionEndTime.toISOString(),
      hasExpired,
      status,
    });

    // CRITICAL FIX: If status is 'active' but auction has expired, we need to close it
    // If status is already 'closed', skip the check
    if (status !== 'active') {
      console.log(`⏸️  Auction status is '${status}', not 'active'. Skipping check.`);
      setState((prev) => ({ ...prev, isClosed: true }));
      hasClosedRef.current = true;
      return;
    }

    if (!hasExpired) {
      setState((prev) => ({ ...prev, hasExpired: false }));
      return;
    }

    // Auction has expired - call API to close it
    console.log(`⏰ Auction ${auctionId} has expired! Calling API to close...`);
    setState((prev) => ({ ...prev, isChecking: true, hasExpired: true }));

    try {
      const response = await fetch(
        `/api/auctions/check-expired?auctionId=${auctionId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to check auction expiry');
      }

      const data = await response.json();
      console.log(`📡 API response for auction ${auctionId}:`, data);

      if (data.closed) {
        // Auction was closed
        console.log(`✅ Auction ${auctionId} successfully closed by API`);
        setState({
          isChecking: false,
          hasExpired: true,
          isClosed: true,
          error: null,
        });

        hasClosedRef.current = true;

        // Stop polling
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        // Trigger callback
        if (onAuctionClosedRef.current) {
          console.log(`🔔 Triggering onAuctionClosed callback`);
          onAuctionClosedRef.current();
        }
      } else {
        console.log(`⚠️  Auction ${auctionId} not closed yet. Status: ${data.status}`);
        setState((prev) => ({
          ...prev,
          isChecking: false,
          isClosed: data.status !== 'active',
        }));
      }
    } catch (error) {
      console.error('❌ Error checking auction expiry:', error);
      setState((prev) => ({
        ...prev,
        isChecking: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [auctionId, endTime, status, enabled]);

  useEffect(() => {
    if (!enabled || hasClosedRef.current) {
      console.log('⏸️  Hook disabled or auction already closed');
      return;
    }

    console.log(`🚀 Starting expiry check for auction ${auctionId}`);

    // Check immediately on mount
    checkExpiry();

    // Set up polling every 10 seconds
    intervalRef.current = setInterval(() => {
      checkExpiry();
    }, 10000); // 10 seconds

    // Cleanup
    return () => {
      if (intervalRef.current) {
        console.log(`🧹 Cleaning up interval for auction ${auctionId}`);
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [auctionId, enabled, checkExpiry]);

  return {
    ...state,
    checkNow: checkExpiry,
  };
}
