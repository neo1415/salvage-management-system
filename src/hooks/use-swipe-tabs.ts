'use client';

import { useCallback, useRef } from 'react';

const DEFAULT_THRESHOLD = 56;
const HORIZONTAL_RATIO = 1.25;

export interface UseSwipeTabsOptions<T extends string> {
  tabs: readonly T[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  enabled?: boolean;
  threshold?: number;
}

/**
 * Swipe left/right on touch devices to move between ordered tabs.
 * Ignores gestures that are mostly vertical (scroll / pull-to-refresh).
 */
export function useSwipeTabs<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  enabled = true,
  threshold = DEFAULT_THRESHOLD,
}: UseSwipeTabsOptions<T>) {
  const start = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || e.touches.length !== 1) return;
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    },
    [enabled]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !start.current) return;

      const touch = e.changedTouches[0];
      const dx = touch.clientX - start.current.x;
      const dy = touch.clientY - start.current.y;
      start.current = null;

      if (Math.abs(dx) < threshold) return;
      if (Math.abs(dx) < Math.abs(dy) * HORIZONTAL_RATIO) return;

      const index = tabs.indexOf(activeTab);
      if (index < 0) return;

      if (dx < 0 && index < tabs.length - 1) {
        onTabChange(tabs[index + 1]);
      } else if (dx > 0 && index > 0) {
        onTabChange(tabs[index - 1]);
      }
    },
    [enabled, threshold, tabs, activeTab, onTabChange]
  );

  const onTouchCancel = useCallback(() => {
    start.current = null;
  }, []);

  return {
    swipeTabProps: {
      onTouchStart,
      onTouchEnd,
      onTouchCancel,
    },
  };
}
