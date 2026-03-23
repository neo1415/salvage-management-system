/**
 * Pull-to-Refresh Hook
 * 
 * Implements pull-to-refresh gesture for mobile list views
 * Follows iOS/Android native patterns with visual feedback
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number; // Distance to trigger refresh (default: 80px)
  resistance?: number; // Pull resistance factor (default: 2.5)
  enabled?: boolean; // Enable/disable pull-to-refresh (default: true)
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  resistance = 2.5,
  enabled = true,
}: UsePullToRefreshOptions) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef<number>(0);
  const scrollableRef = useRef<HTMLElement | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled || isRefreshing) return;
    
    const scrollable = scrollableRef.current;
    if (!scrollable) return;
    
    // Only trigger if at top of scroll
    if (scrollable.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  }, [enabled, isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled || isRefreshing || touchStartY.current === 0) return;
    
    const scrollable = scrollableRef.current;
    if (!scrollable || scrollable.scrollTop > 0) return;
    
    const touchY = e.touches[0].clientY;
    const distance = touchY - touchStartY.current;
    
    if (distance > 0) {
      // Apply resistance to pull distance
      const resistedDistance = distance / resistance;
      setPullDistance(Math.min(resistedDistance, threshold * 1.5));
      
      // Prevent default scroll behavior when pulling
      if (distance > 10) {
        e.preventDefault();
      }
    }
  }, [enabled, isRefreshing, threshold, resistance]);

  const handleTouchEnd = useCallback(async () => {
    if (!enabled || isRefreshing) return;
    
    touchStartY.current = 0;
    
    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      setPullDistance(threshold); // Lock at threshold during refresh
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [enabled, isRefreshing, pullDistance, threshold, onRefresh]);

  useEffect(() => {
    const scrollable = scrollableRef.current;
    if (!scrollable || !enabled) return;

    scrollable.addEventListener('touchstart', handleTouchStart, { passive: true });
    scrollable.addEventListener('touchmove', handleTouchMove, { passive: false });
    scrollable.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      scrollable.removeEventListener('touchstart', handleTouchStart);
      scrollable.removeEventListener('touchmove', handleTouchMove);
      scrollable.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    scrollableRef,
    isRefreshing,
    pullDistance,
    isPulling: pullDistance > 0,
    isThresholdReached: pullDistance >= threshold,
  };
}
