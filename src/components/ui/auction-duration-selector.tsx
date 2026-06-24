'use client';

import { useState } from 'react';
import { Clock, Calendar, Timer } from 'lucide-react';
import {
  type AuctionDurationUnit,
  clampDurationHours,
  durationToHours,
  getDurationInputMax,
  hoursToDisplayParts,
  validateDurationInput,
} from '@/lib/auction/duration';

interface AuctionDurationOption {
  value: number; // Duration in hours
  label: string;
  description: string;
  icon: React.ReactNode;
  recommended?: boolean;
}

interface AuctionDurationSelectorProps {
  value: number; // Current duration in hours
  onChange: (hours: number) => void;
  disabled?: boolean;
}

const DURATION_OPTIONS: AuctionDurationOption[] = [
  {
    value: 0.5, // 30 minutes
    label: '30 Minutes',
    description: 'Quick turnaround for urgent cases',
    icon: <Timer className="w-4 h-4" />,
  },
  {
    value: 2, // 2 hours
    label: '2 Hours',
    description: 'Fast auction for immediate needs',
    icon: <Clock className="w-4 h-4" />,
  },
  {
    value: 24, // 24 hours (1 day)
    label: '24 Hours',
    description: 'Standard short auction',
    icon: <Calendar className="w-4 h-4" />,
  },
  {
    value: 96, // 4 days
    label: '4 Days',
    description: 'Balanced time for vendor participation',
    icon: <Calendar className="w-4 h-4" />,
    recommended: true,
  },
  {
    value: 120, // 5 days
    label: '5 Days',
    description: 'Extended time for maximum participation',
    icon: <Calendar className="w-4 h-4" />,
  },
  {
    value: 168, // 7 days (1 week)
    label: '7 Days',
    description: 'Maximum exposure for high-value items',
    icon: <Calendar className="w-4 h-4" />,
  },
];

export function AuctionDurationSelector({ value, onChange, disabled = false }: AuctionDurationSelectorProps) {
  const initialParts = hoursToDisplayParts(clampDurationHours(value));
  const [customDuration, setCustomDuration] = useState<string>('');
  const [customUnit, setCustomUnit] = useState<AuctionDurationUnit>(initialParts.unit);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customError, setCustomError] = useState<string>('');

  const handleOptionSelect = (hours: number) => {
    onChange(clampDurationHours(hours));
    setShowCustomInput(false);
    setCustomDuration('');
    setCustomError('');
  };

  const commitCustomDuration = (rawValue: string, unit: AuctionDurationUnit) => {
    const parsed = parseInt(rawValue, 10);
    if (!rawValue.trim() || Number.isNaN(parsed) || parsed <= 0) {
      setCustomError('Enter a valid duration');
      return false;
    }

    const validationError = validateDurationInput(parsed, unit);
    if (validationError) {
      setCustomError(validationError);
      return false;
    }

    onChange(clampDurationHours(durationToHours(parsed, unit)));
    setShowCustomInput(false);
    setCustomDuration('');
    setCustomError('');
    return true;
  };

  const handleCustomDurationBlur = () => {
    if (!customDuration.trim()) {
      const fallback = hoursToDisplayParts(clampDurationHours(value));
      setCustomDuration(String(fallback.value));
      setCustomUnit(fallback.unit);
      setCustomError('');
      return;
    }
    commitCustomDuration(customDuration, customUnit);
  };

  const formatDuration = (hours: number): string => {
    const parts = hoursToDisplayParts(clampDurationHours(hours));
    const unitLabel =
      parts.unit === 'minutes'
        ? `minute${parts.value !== 1 ? 's' : ''}`
        : parts.unit === 'hours'
          ? `hour${parts.value !== 1 ? 's' : ''}`
          : parts.unit === 'days'
            ? `day${parts.value !== 1 ? 's' : ''}`
            : `week${parts.value !== 1 ? 's' : ''}`;
    return `${parts.value} ${unitLabel}`;
  };

  const getEndTime = (hours: number): string => {
    const endTime = new Date(Date.now() + clampDurationHours(hours) * 60 * 60 * 1000);
    return endTime.toLocaleString('en-NG', {
      timeZone: 'Africa/Lagos',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const previewHours =
    customDuration.trim() && !Number.isNaN(parseInt(customDuration, 10))
      ? durationToHours(parseInt(customDuration, 10), customUnit)
      : null;
  const previewValid =
    previewHours !== null &&
    validateDurationInput(parseInt(customDuration, 10), customUnit) === null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Auction Duration
        </label>
        <div className="text-xs text-gray-500">
          Ends: {getEndTime(value)}
        </div>
      </div>

      {/* Preset Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {DURATION_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => handleOptionSelect(option.value)}
            disabled={disabled}
            className={`relative p-4 border-2 rounded-lg text-left transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
              value === option.value
                ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-surface)] ring-2 ring-[var(--brand-focus-ring)]'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            {option.recommended && (
              <div className="absolute -top-2 -right-2 bg-[var(--brand-accent)] text-[var(--brand-primary)] text-xs font-bold px-2 py-1 rounded-full">
                Recommended
              </div>
            )}

            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${
                value === option.value
                  ? 'bg-[var(--brand-primary)] text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {option.icon}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className={`font-semibold text-sm ${
                  value === option.value ? 'text-[var(--brand-primary)]' : 'text-gray-900'
                }`}>
                  {option.label}
                </h3>
                <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                  {option.description}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Custom Duration Option */}
      <div className="border-t border-gray-200 pt-4">
        {!showCustomInput ? (
          <button
            type="button"
            onClick={() => {
              const parts = hoursToDisplayParts(clampDurationHours(value));
              setCustomDuration(String(parts.value));
              setCustomUnit(parts.unit);
              setShowCustomInput(true);
            }}
            disabled={disabled}
            className="text-sm text-[var(--brand-primary)] hover:text-[var(--brand-primary-hover)] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Set Custom Duration
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <label htmlFor="customDuration" className="block text-xs font-medium text-gray-700 mb-1">
                  Custom duration
                </label>
                <input
                  id="customDuration"
                  type="number"
                  min="1"
                  max={getDurationInputMax(customUnit)}
                  value={customDuration}
                  onChange={(e) => {
                    setCustomDuration(e.target.value);
                    if (customError) setCustomError('');
                  }}
                  onBlur={handleCustomDurationBlur}
                  placeholder="e.g. 12"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent text-sm"
                  disabled={disabled}
                />
              </div>

              <div className="w-32">
                <label htmlFor="customDurationUnit" className="block text-xs font-medium text-gray-700 mb-1">
                  Unit
                </label>
                <select
                  id="customDurationUnit"
                  value={customUnit}
                  onChange={(e) => {
                    const unit = e.target.value as AuctionDurationUnit;
                    setCustomUnit(unit);
                    if (customDuration.trim()) {
                      commitCustomDuration(customDuration, unit);
                    }
                  }}
                  disabled={disabled}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent text-sm"
                >
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                </select>
              </div>

              <div className="flex gap-2 pt-5">
                <button
                  type="button"
                  onClick={() => commitCustomDuration(customDuration, customUnit)}
                  disabled={disabled || !previewValid}
                  className="px-3 py-2 bg-[var(--brand-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--brand-primary-hover)] disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Set
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomInput(false);
                    setCustomDuration('');
                    setCustomError('');
                  }}
                  disabled={disabled}
                  className="px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Min: 15 minutes · Max: 30 days (720 hours)
            </p>

            {customError && (
              <p className="text-xs text-red-600">{customError}</p>
            )}

            {previewValid && previewHours !== null && (
              <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                Preview: Auction will run for {formatDuration(previewHours)} and end on {getEndTime(previewHours)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Current Selection Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-center gap-2 text-blue-800">
          <Clock className="w-4 h-4" />
          <span className="text-sm font-medium">
            Selected Duration: {formatDuration(value)}
          </span>
        </div>
        <p className="text-xs text-blue-700 mt-1">
          Auction will end on {getEndTime(value)}
        </p>
      </div>
    </div>
  );
}
