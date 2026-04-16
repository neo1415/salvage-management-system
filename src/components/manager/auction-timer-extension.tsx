/**
 * AuctionTimerExtension Component
 * 
 * Allows salvage managers to manually extend active auction end times.
 * 
 * Features:
 * - Number input for extension amount (1-999)
 * - Dropdown for time unit selection (Minutes, Hours, Days, Weeks)
 * - Real-time preview of new end time
 * - Validation for positive amounts
 * - Mobile-optimized with burgundy theme
 * - Error handling for failed extensions
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AuctionTimerExtensionProps {
  /**
   * Auction ID to extend
   */
  auctionId: string;

  /**
   * Current auction end time
   */
  currentEndTime: Date;

  /**
   * Callback when extension is confirmed
   * @param auctionId - The auction ID
   * @param extensionMinutes - Total extension in minutes
   */
  onExtend: (auctionId: string, extensionMinutes: number) => Promise<void>;

  /**
   * Loading state (optional)
   */
  isLoading?: boolean;
}

type TimeUnit = 'minutes' | 'hours' | 'days' | 'weeks';

/**
 * Convert time amount to minutes based on unit
 */
function convertToMinutes(amount: number, unit: TimeUnit): number {
  switch (unit) {
    case 'minutes':
      return amount;
    case 'hours':
      return amount * 60;
    case 'days':
      return amount * 24 * 60;
    case 'weeks':
      return amount * 7 * 24 * 60;
    default:
      return amount;
  }
}

/**
 * Format date for display
 */
function formatDateTime(date: Date): string {
  return date.toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * AuctionTimerExtension Component
 */
export function AuctionTimerExtension({
  auctionId,
  currentEndTime,
  onExtend,
  isLoading = false,
}: AuctionTimerExtensionProps) {
  const [amount, setAmount] = useState<string>('1');
  const [unit, setUnit] = useState<TimeUnit>('hours');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Parse amount as number
  const amountNum = parseInt(amount, 10);
  const isValidAmount = !isNaN(amountNum) && amountNum > 0 && amountNum <= 999;

  // Calculate total extension in minutes
  const extensionMinutes = useMemo(() => {
    if (!isValidAmount) return 0;
    return convertToMinutes(amountNum, unit);
  }, [amountNum, unit, isValidAmount]);

  // Calculate new end time
  const newEndTime = useMemo(() => {
    if (!isValidAmount) return null;
    const newDate = new Date(currentEndTime);
    newDate.setMinutes(newDate.getMinutes() + extensionMinutes);
    return newDate;
  }, [currentEndTime, extensionMinutes, isValidAmount]);

  // Reset error when inputs change
  useEffect(() => {
    setError(null);
  }, [amount, unit]);

  /**
   * Handle amount input change
   */
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Allow empty string for clearing
    if (value === '') {
      setAmount('');
      return;
    }

    // Only allow positive integers up to 999
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0 && num <= 999) {
      setAmount(value);
    }
  };

  /**
   * Handle unit change
   */
  const handleUnitChange = (value: string) => {
    setUnit(value as TimeUnit);
  };

  /**
   * Handle confirm button click
   */
  const handleConfirm = async () => {
    // Validate
    if (!isValidAmount) {
      setError('Please enter a valid amount between 1 and 999');
      return;
    }

    if (extensionMinutes <= 0) {
      setError('Extension must be greater than 0 minutes');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onExtend(auctionId, extensionMinutes);
      
      // Reset form on success
      setAmount('1');
      setUnit('hours');
    } catch (err) {
      console.error('Failed to extend auction:', err);
      setError(
        err instanceof Error 
          ? err.message 
          : 'Failed to extend auction. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDisabled = isLoading || isSubmitting || !isValidAmount;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <svg
          className="w-5 h-5 text-[#800020]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 className="font-semibold text-gray-900">Extend Auction Time</h3>
      </div>

      {/* Current End Time */}
      <div className="bg-gray-50 rounded-lg p-3">
        <p className="text-xs text-gray-600 mb-1">Current End Time</p>
        <p className="text-sm font-medium text-gray-900">
          {formatDateTime(currentEndTime)}
        </p>
      </div>

      {/* Extension Inputs */}
      <div className="grid grid-cols-2 gap-3">
        {/* Amount Input */}
        <div>
          <label
            htmlFor="extension-amount"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Amount
          </label>
          <input
            id="extension-amount"
            type="number"
            min="1"
            max="999"
            value={amount}
            onChange={handleAmountChange}
            disabled={isDisabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: '44px' }} // Mobile touch target
            placeholder="1-999"
          />
        </div>

        {/* Unit Select */}
        <div>
          <label
            htmlFor="extension-unit"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Unit
          </label>
          <Select
            value={unit}
            onValueChange={handleUnitChange}
            disabled={isDisabled}
          >
            <SelectTrigger
              id="extension-unit"
              className="w-full"
              style={{ minHeight: '44px' }} // Mobile touch target
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minutes">Minutes</SelectItem>
              <SelectItem value="hours">Hours</SelectItem>
              <SelectItem value="days">Days</SelectItem>
              <SelectItem value="weeks">Weeks</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Preview New End Time */}
      {isValidAmount && newEndTime && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <p className="text-xs text-blue-700 font-medium mb-1">
                New End Time Preview
              </p>
              <p className="text-sm font-semibold text-blue-900">
                {formatDateTime(newEndTime)}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                +{extensionMinutes.toLocaleString()} minutes
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Validation Error */}
      {!isValidAmount && amount !== '' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="text-sm text-yellow-700">
              Please enter a valid amount between 1 and 999
            </p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Confirm Button */}
      <Button
        onClick={handleConfirm}
        disabled={isDisabled}
        className="w-full"
        style={{ minHeight: '44px' }} // Mobile touch target
      >
        {isSubmitting ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Extending...
          </>
        ) : (
          <>
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Confirm Extension
          </>
        )}
      </Button>

      {/* Help Text */}
      <p className="text-xs text-gray-500 text-center">
        This will extend the auction end time by the specified amount
      </p>
    </div>
  );
}

export default AuctionTimerExtension;
