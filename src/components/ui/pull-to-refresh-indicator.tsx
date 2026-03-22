/**
 * Pull-to-Refresh Indicator
 * 
 * Visual feedback component for pull-to-refresh gesture
 * Shows spinner and progress based on pull distance
 */

'use client';

import { Loader2, ArrowDown } from 'lucide-react';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  threshold: number;
  isRefreshing: boolean;
  isThresholdReached: boolean;
}

export function PullToRefreshIndicator({
  pullDistance,
  threshold,
  isRefreshing,
  isThresholdReached,
}: PullToRefreshIndicatorProps) {
  if (pullDistance === 0 && !isRefreshing) return null;

  const progress = Math.min((pullDistance / threshold) * 100, 100);
  const opacity = Math.min(pullDistance / 40, 1); // Fade in as user pulls

  return (
    <div
      className="flex items-center justify-center py-4 transition-opacity"
      style={{
        opacity,
        transform: `translateY(${Math.min(pullDistance, threshold)}px)`,
      }}
      aria-live="polite"
      aria-busy={isRefreshing}
    >
      <div className="flex flex-col items-center gap-2">
        {isRefreshing ? (
          <>
            <Loader2 
              className="w-6 h-6 text-[#800020] animate-spin" 
              aria-hidden="true"
            />
            <span className="text-sm text-gray-600 font-medium">
              Refreshing...
            </span>
          </>
        ) : (
          <>
            <div
              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                isThresholdReached
                  ? 'border-[#800020] bg-[#800020] text-white rotate-180'
                  : 'border-gray-300 text-gray-400'
              }`}
              style={{
                transform: `rotate(${progress * 1.8}deg)`,
              }}
            >
              <ArrowDown size={16} aria-hidden="true" />
            </div>
            <span className="text-sm text-gray-600 font-medium">
              {isThresholdReached ? 'Release to refresh' : 'Pull to refresh'}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
