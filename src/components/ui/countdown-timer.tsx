/**
 * Countdown Timer Component
 * 
 * Requirements: 17, NFR5.3
 * 
 * Features:
 * - Format: "Xd Xh Xm Xs" (>24h), "Xh Xm Xs" (1-24h), "Xm Xs" (<1h)
 * - Color coding: green (>24h), yellow (1-24h), red (<1h)
 * - Pulsing animation when <1h
 * - Updates every 1 second
 * - Syncs with server time
 * - Sends push notification at 1 hour remaining
 * - Sends SMS notification at 30 minutes remaining
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface CountdownTimerProps {
  /**
   * Target end time (ISO string or Date)
   */
  endTime: string | Date;

  /**
   * Optional callback when countdown reaches zero
   */
  onComplete?: () => void;

  /**
   * Optional callback when 1 hour remaining (for push notification)
   */
  onOneHourRemaining?: () => void;

  /**
   * Optional callback when 30 minutes remaining (for SMS notification)
   */
  onThirtyMinutesRemaining?: () => void;

  /**
   * Optional custom className
   */
  className?: string;

  /**
   * Optional server time offset in milliseconds (for sync)
   */
  serverTimeOffset?: number;

  /**
   * Show full format or compact
   */
  compact?: boolean;
}

/**
 * Format time remaining for countdown display
 */
function formatCountdown(milliseconds: number, compact: boolean = false): string {
  if (milliseconds <= 0) {
    return '0s';
  }

  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const remainingHours = hours % 24;
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;

  // Format: "Xd Xh Xm Xs" (>24h)
  if (days > 0) {
    if (compact) {
      return `${days}d ${remainingHours}h`;
    }
    return `${days}d ${remainingHours}h ${remainingMinutes}m ${remainingSeconds}s`;
  }

  // Format: "Xh Xm Xs" (1-24h)
  if (hours > 0) {
    if (compact) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
  }

  // Format: "Xm Xs" (<1h)
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Get color class based on time remaining
 */
function getCountdownColor(milliseconds: number): string {
  const hours = milliseconds / (1000 * 60 * 60);

  if (hours > 24) {
    return 'text-green-600'; // green (>24h)
  }

  if (hours >= 1) {
    return 'text-yellow-600'; // yellow (1-24h)
  }

  return 'text-red-600'; // red (<1h)
}

/**
 * Check if countdown should pulse (when <1h)
 */
function shouldPulse(milliseconds: number): boolean {
  const hours = milliseconds / (1000 * 60 * 60);
  return hours < 1;
}

/**
 * Countdown Timer Component
 */
export function CountdownTimer({
  endTime,
  onComplete,
  onOneHourRemaining,
  onThirtyMinutesRemaining,
  className = '',
  serverTimeOffset = 0,
  compact = false,
}: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);

  // Track if notifications have been sent
  const oneHourNotificationSent = useRef(false);
  const thirtyMinutesNotificationSent = useRef(false);

  /**
   * Calculate time remaining with server time sync
   */
  const calculateTimeRemaining = useCallback(() => {
    const now = Date.now() + serverTimeOffset;
    const end = typeof endTime === 'string' ? new Date(endTime).getTime() : endTime.getTime();
    const remaining = end - now;

    return Math.max(0, remaining);
  }, [endTime, serverTimeOffset]);

  /**
   * Update countdown every second
   */
  useEffect(() => {
    // Initial calculation
    const remaining = calculateTimeRemaining();
    setTimeRemaining(remaining);

    if (remaining <= 0) {
      setIsExpired(true);
      if (onComplete) {
        onComplete();
      }
      return;
    }

    // Update every second
    const interval = setInterval(() => {
      const newRemaining = calculateTimeRemaining();
      setTimeRemaining(newRemaining);

      if (newRemaining <= 0) {
        setIsExpired(true);
        clearInterval(interval);
        if (onComplete) {
          onComplete();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [calculateTimeRemaining]);

  /**
   * Handle notification triggers
   */
  useEffect(() => {
    const hours = timeRemaining / (1000 * 60 * 60);
    const minutes = timeRemaining / (1000 * 60);

    // Send push notification at 1 hour remaining (once)
    if (hours <= 1 && hours > 0 && !oneHourNotificationSent.current && onOneHourRemaining) {
      oneHourNotificationSent.current = true;
      onOneHourRemaining();
    }

    // Send SMS notification at 30 minutes remaining (once)
    if (minutes <= 30 && minutes > 0 && !thirtyMinutesNotificationSent.current && onThirtyMinutesRemaining) {
      thirtyMinutesNotificationSent.current = true;
      onThirtyMinutesRemaining();
    }
  }, [timeRemaining]);

  const formatted = formatCountdown(timeRemaining, compact);
  const colorClass = getCountdownColor(timeRemaining);
  const pulse = shouldPulse(timeRemaining);

  if (isExpired) {
    return (
      <span className={`font-bold text-red-600 ${className}`}>
        Expired
      </span>
    );
  }

  return (
    <span
      className={`font-bold ${colorClass} ${pulse ? 'animate-pulse' : ''} ${className}`}
      data-testid="countdown-timer"
      aria-live="polite"
      aria-atomic="true"
    >
      {formatted}
    </span>
  );
}

/**
 * Countdown Timer Card Component
 * A card wrapper for the countdown timer with label
 */
interface CountdownTimerCardProps extends CountdownTimerProps {
  label?: string;
  showIcon?: boolean;
}

export function CountdownTimerCard({
  label = 'Time Remaining',
  showIcon = true,
  ...timerProps
}: CountdownTimerCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 text-center">
      <div className="flex items-center justify-center gap-2 mb-2">
        {showIcon && (
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        )}
        <p className="text-sm text-gray-600 font-medium">{label}</p>
      </div>
      <CountdownTimer {...timerProps} className="text-3xl" />
    </div>
  );
}

/**
 * Inline Countdown Timer
 * A compact inline version for use in cards and lists
 */
export function InlineCountdownTimer(props: CountdownTimerProps) {
  return <CountdownTimer {...props} compact={true} className="text-sm" />;
}

export default CountdownTimer;
