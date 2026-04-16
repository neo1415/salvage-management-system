/**
 * AuctionScheduleSelector Component
 * 
 * Reusable component for scheduling auction start times.
 * Features:
 * - Two modes: "Start Now" (default) or "Schedule for Later"
 * - Date picker with calendar component
 * - Time picker (hours and minutes)
 * - Timezone display (Africa/Lagos)
 * - Validation for future dates
 * - Mobile-optimized with burgundy theme (#800020)
 * 
 * Usage:
 * ```tsx
 * <AuctionScheduleSelector
 *   value={{ mode: 'now' }}
 *   onChange={(value) => console.log(value)}
 *   minDate={new Date()}
 * />
 * ```
 */

'use client';

import * as React from 'react';
import { Calendar } from './calendar';
import { Button } from './button';
import { Label } from './label';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { cn } from '@/lib/utils';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';

export interface AuctionScheduleValue {
  mode: 'now' | 'scheduled';
  scheduledTime?: Date;
  durationHours: number;
}

export interface AuctionScheduleSelectorProps {
  value: AuctionScheduleValue;
  onChange: (value: AuctionScheduleValue) => void;
  minDate?: Date;
  className?: string;
}

export function AuctionScheduleSelector({
  value,
  onChange,
  minDate = new Date(),
  className,
}: AuctionScheduleSelectorProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    value.scheduledTime
  );
  const [selectedHour, setSelectedHour] = React.useState<string>(
    value.scheduledTime ? value.scheduledTime.getHours().toString().padStart(2, '0') : '09'
  );
  const [selectedMinute, setSelectedMinute] = React.useState<string>(
    value.scheduledTime ? value.scheduledTime.getMinutes().toString().padStart(2, '0') : '00'
  );
  const [durationValue, setDurationValue] = React.useState<number>(
    value.durationHours ? Math.floor(value.durationHours / 24) || value.durationHours : 5
  );
  const [durationUnit, setDurationUnit] = React.useState<'minutes' | 'hours' | 'days' | 'weeks'>(
    value.durationHours >= 168 ? 'weeks' : value.durationHours >= 24 ? 'days' : value.durationHours >= 1 ? 'hours' : 'minutes'
  );
  const [error, setError] = React.useState<string>('');

  // Calculate duration in hours
  const calculateDurationHours = (value: number, unit: 'minutes' | 'hours' | 'days' | 'weeks'): number => {
    switch (unit) {
      case 'minutes':
        return value / 60;
      case 'hours':
        return value;
      case 'days':
        return value * 24;
      case 'weeks':
        return value * 24 * 7;
      default:
        return value;
    }
  };

  // Validate and update scheduled time
  const updateScheduledTime = React.useCallback(
    (date: Date | undefined, hour: string, minute: string) => {
      if (!date) {
        setError('Please select a date');
        return;
      }

      const scheduledTime = new Date(date);
      scheduledTime.setHours(parseInt(hour, 10));
      scheduledTime.setMinutes(parseInt(minute, 10));
      scheduledTime.setSeconds(0);
      scheduledTime.setMilliseconds(0);

      // Validate that scheduled time is in the future
      const now = new Date();
      if (scheduledTime <= now) {
        setError('Scheduled time must be in the future');
        return;
      }

      // Validate against minDate
      if (minDate && scheduledTime < minDate) {
        setError('Scheduled time must be after the minimum date');
        return;
      }

      setError('');
      onChange({
        mode: 'scheduled',
        scheduledTime,
        durationHours: calculateDurationHours(durationValue, durationUnit),
      });
    },
    [minDate, onChange, durationValue, durationUnit]
  );

  // Update duration
  const updateDuration = React.useCallback(
    (newValue: number, newUnit: 'minutes' | 'hours' | 'days' | 'weeks') => {
      const durationHours = calculateDurationHours(newValue, newUnit);
      
      // Validate duration (min 1 hour, max 720 hours = 30 days)
      if (durationHours < 1) {
        setError('Duration must be at least 1 hour');
        return;
      }
      if (durationHours > 720) {
        setError('Duration cannot exceed 30 days (720 hours)');
        return;
      }

      setError('');
      onChange({
        ...value,
        durationHours,
      });
    },
    [value, onChange]
  );

  // Handle mode change
  const handleModeChange = (mode: 'now' | 'scheduled') => {
    if (mode === 'now') {
      setError('');
      onChange({ 
        mode: 'now',
        durationHours: calculateDurationHours(durationValue, durationUnit),
      });
    } else {
      // When switching to scheduled mode, set default time if not already set
      if (!selectedDate) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        setSelectedDate(tomorrow);
        updateScheduledTime(tomorrow, selectedHour, selectedMinute);
      } else {
        updateScheduledTime(selectedDate, selectedHour, selectedMinute);
      }
    }
  };

  // Handle date selection
  const handleDateSelect = (date: Date | { from: Date; to: Date } | undefined) => {
    // Only handle single date selection
    if (date && !(date instanceof Date)) {
      return;
    }
    setSelectedDate(date);
    if (date && value.mode === 'scheduled') {
      updateScheduledTime(date, selectedHour, selectedMinute);
    }
  };

  // Handle hour change
  const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const hour = e.target.value;
    setSelectedHour(hour);
    if (selectedDate && value.mode === 'scheduled') {
      updateScheduledTime(selectedDate, hour, selectedMinute);
    }
  };

  // Handle minute change
  const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const minute = e.target.value;
    setSelectedMinute(minute);
    if (selectedDate && value.mode === 'scheduled') {
      updateScheduledTime(selectedDate, selectedHour, minute);
    }
  };

  // Handle duration value change
  const handleDurationValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10);
    if (!isNaN(newValue) && newValue > 0) {
      setDurationValue(newValue);
      updateDuration(newValue, durationUnit);
    }
  };

  // Handle duration unit change
  const handleDurationUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newUnit = e.target.value as 'minutes' | 'hours' | 'days' | 'weeks';
    setDurationUnit(newUnit);
    updateDuration(durationValue, newUnit);
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Generate hour options (00-23)
  const hourOptions = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));

  // Generate minute options (00, 15, 30, 45)
  const minuteOptions = ['00', '15', '30', '45'];

  return (
    <div className={cn('space-y-4', className)}>
      {/* Mode Selection */}
      <div>
        <Label className="text-sm font-medium text-gray-700 mb-2 block">
          Auction Start Time
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleModeChange('now')}
            className={cn(
              'px-4 py-3 rounded-lg border-2 font-medium text-sm transition-all',
              'focus:outline-none focus:ring-2 focus:ring-[#800020] focus:ring-offset-2',
              value.mode === 'now'
                ? 'border-[#800020] bg-[#800020] text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Start Now</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('scheduled')}
            className={cn(
              'px-4 py-3 rounded-lg border-2 font-medium text-sm transition-all',
              'focus:outline-none focus:ring-2 focus:ring-[#800020] focus:ring-offset-2',
              value.mode === 'scheduled'
                ? 'border-[#800020] bg-[#800020] text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              <span>Schedule</span>
            </div>
          </button>
        </div>
      </div>

      {/* Duration Selector - Always visible */}
      <div>
        <Label className="text-sm font-medium text-gray-700 mb-2 block">
          Auction Duration
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Duration</Label>
            <input
              type="number"
              min="1"
              max={durationUnit === 'minutes' ? '43200' : durationUnit === 'hours' ? '720' : durationUnit === 'days' ? '30' : '4'}
              value={durationValue}
              onChange={handleDurationValueChange}
              className={cn(
                'w-full h-10 px-3 py-2 rounded-md border border-gray-300 bg-white',
                'text-sm focus:outline-none focus:ring-2 focus:ring-[#800020] focus:border-[#800020]',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Unit</Label>
            <select
              value={durationUnit}
              onChange={handleDurationUnitChange}
              className={cn(
                'w-full h-10 px-3 py-2 rounded-md border border-gray-300 bg-white',
                'text-sm focus:outline-none focus:ring-2 focus:ring-[#800020] focus:border-[#800020]',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
              <option value="weeks">Weeks</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Default: 120 hours (5 days) • Min: 1 hour • Max: 720 hours (30 days)
        </p>
      </div>

      {/* Scheduled Mode Options */}
      {value.mode === 'scheduled' && (
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          {/* Date Picker */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2 block">
              Select Date
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !selectedDate && 'text-gray-500'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? formatDate(selectedDate) : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-white shadow-lg border border-gray-200 rounded-lg" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Picker */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2 block">
              Select Time
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Hour</Label>
                <select
                  value={selectedHour}
                  onChange={handleHourChange}
                  className={cn(
                    'w-full h-10 px-3 py-2 rounded-md border border-gray-300 bg-white',
                    'text-sm focus:outline-none focus:ring-2 focus:ring-[#800020] focus:border-[#800020]',
                    'disabled:cursor-not-allowed disabled:opacity-50'
                  )}
                >
                  {hourOptions.map((hour) => (
                    <option key={hour} value={hour}>
                      {hour}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Minute</Label>
                <select
                  value={selectedMinute}
                  onChange={handleMinuteChange}
                  className={cn(
                    'w-full h-10 px-3 py-2 rounded-md border border-gray-300 bg-white',
                    'text-sm focus:outline-none focus:ring-2 focus:ring-[#800020] focus:border-[#800020]',
                    'disabled:cursor-not-allowed disabled:opacity-50'
                  )}
                >
                  {minuteOptions.map((minute) => (
                    <option key={minute} value={minute}>
                      {minute}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Timezone Display */}
          <div className="flex items-center justify-between text-sm text-gray-600 pt-2 border-t border-gray-200">
            <span className="font-medium">Timezone:</span>
            <span className="text-gray-700">Africa/Lagos (WAT)</span>
          </div>

          {/* Preview */}
          {selectedDate && !error && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                <span className="font-medium">Auction will start:</span>
                <br />
                {formatDate(selectedDate)} at {selectedHour}:{selectedMinute} WAT
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                <span className="font-medium">⚠️ Error:</span> {error}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Start Now Info */}
      {value.mode === 'now' && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <span className="font-medium">ℹ️ Auction will start immediately</span>
            <br />
            Vendors will be notified as soon as the case is approved.
          </p>
        </div>
      )}
    </div>
  );
}
