'use client';

import { useState } from 'react';
import { Clock, Calendar, Timer } from 'lucide-react';

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
  const [customDuration, setCustomDuration] = useState<string>('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handleOptionSelect = (hours: number) => {
    onChange(hours);
    setShowCustomInput(false);
    setCustomDuration('');
  };

  const handleCustomDurationSubmit = () => {
    const hours = parseFloat(customDuration);
    if (hours > 0 && hours <= 168) { // Max 1 week
      onChange(hours);
      setShowCustomInput(false);
      setCustomDuration('');
    }
  };

  const formatDuration = (hours: number): string => {
    if (hours < 1) {
      return `${Math.round(hours * 60)} minutes`;
    } else if (hours < 24) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    } else {
      const days = Math.round(hours / 24);
      return `${days} day${days !== 1 ? 's' : ''}`;
    }
  };

  const getEndTime = (hours: number): string => {
    const endTime = new Date(Date.now() + hours * 60 * 60 * 1000);
    return endTime.toLocaleString('en-NG', {
      timeZone: 'Africa/Lagos',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

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
                ? 'border-[#800020] bg-[#800020]/5 ring-2 ring-[#800020]/20'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            {option.recommended && (
              <div className="absolute -top-2 -right-2 bg-[#FFD700] text-[#800020] text-xs font-bold px-2 py-1 rounded-full">
                Recommended
              </div>
            )}
            
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${
                value === option.value 
                  ? 'bg-[#800020] text-white' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {option.icon}
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className={`font-semibold text-sm ${
                  value === option.value ? 'text-[#800020]' : 'text-gray-900'
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
            onClick={() => setShowCustomInput(true)}
            disabled={disabled}
            className="text-sm text-[#800020] hover:text-[#600018] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Set Custom Duration
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label htmlFor="customDuration" className="block text-xs font-medium text-gray-700 mb-1">
                  Custom Duration (hours)
                </label>
                <input
                  id="customDuration"
                  type="number"
                  min="0.5"
                  max="168"
                  step="0.5"
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value)}
                  placeholder="e.g., 12 for 12 hours"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent text-sm"
                  disabled={disabled}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Min: 30 minutes (0.5), Max: 7 days (168)
                </p>
              </div>
              
              <div className="flex gap-2 pt-5">
                <button
                  type="button"
                  onClick={handleCustomDurationSubmit}
                  disabled={!customDuration || parseFloat(customDuration) <= 0 || parseFloat(customDuration) > 168 || disabled}
                  className="px-3 py-2 bg-[#800020] text-white text-sm font-medium rounded-lg hover:bg-[#600018] disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Set
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomInput(false);
                    setCustomDuration('');
                  }}
                  disabled={disabled}
                  className="px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
            
            {customDuration && parseFloat(customDuration) > 0 && parseFloat(customDuration) <= 168 && (
              <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                Preview: Auction will run for {formatDuration(parseFloat(customDuration))} and end on {getEndTime(parseFloat(customDuration))}
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