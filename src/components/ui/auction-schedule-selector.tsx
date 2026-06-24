/**
 * AuctionScheduleSelector — start mode, schedule date/time, and auction duration.
 */

'use client';

import * as React from 'react';
import { Calendar } from './calendar';
import { Button } from './button';
import { Label } from './label';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { cn } from '@/lib/utils';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import {
  type AuctionDurationUnit,
  clampDurationHours,
  durationToHours,
  getDurationInputMax,
  hoursToDisplayParts,
  validateDurationInput,
} from '@/lib/auction/duration';

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
  const initialParts = hoursToDisplayParts(clampDurationHours(value.durationHours || 120));

  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(value.scheduledTime);
  const [selectedHour, setSelectedHour] = React.useState<string>(
    value.scheduledTime ? value.scheduledTime.getHours().toString().padStart(2, '0') : '09'
  );
  const [selectedMinute, setSelectedMinute] = React.useState<string>(
    value.scheduledTime ? value.scheduledTime.getMinutes().toString().padStart(2, '0') : '00'
  );
  const [durationInput, setDurationInput] = React.useState<string>(String(initialParts.value));
  const [durationUnit, setDurationUnit] = React.useState<AuctionDurationUnit>(initialParts.unit);
  const [error, setError] = React.useState<string>('');

  const getDurationHours = React.useCallback(() => {
    const parsed = parseInt(durationInput, 10);
    if (!durationInput.trim() || Number.isNaN(parsed) || parsed <= 0) {
      return clampDurationHours(value.durationHours || 120);
    }
    return clampDurationHours(durationToHours(parsed, durationUnit));
  }, [durationInput, durationUnit, value.durationHours]);

  const commitDuration = React.useCallback(
    (rawValue: string, unit: AuctionDurationUnit) => {
      const parsed = parseInt(rawValue, 10);
      if (!rawValue.trim() || Number.isNaN(parsed) || parsed <= 0) {
        setError('Enter a valid duration');
        return false;
      }

      const validationError = validateDurationInput(parsed, unit);
      if (validationError) {
        setError(validationError);
        return false;
      }

      const durationHours = clampDurationHours(durationToHours(parsed, unit));
      setDurationInput(String(parsed));
      setError('');
      onChange({
        ...value,
        durationHours,
      });
      return true;
    },
    [onChange, value]
  );

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

      const now = new Date();
      if (scheduledTime <= now) {
        setError('Scheduled time must be in the future');
        return;
      }

      if (minDate && scheduledTime < minDate) {
        setError('Scheduled time must be after the minimum date');
        return;
      }

      setError('');
      onChange({
        mode: 'scheduled',
        scheduledTime,
        durationHours: getDurationHours(),
      });
    },
    [minDate, onChange, getDurationHours]
  );

  const handleModeChange = (mode: 'now' | 'scheduled') => {
    const currentDurationHours = getDurationHours();

    if (mode === 'now') {
      setError('');
      onChange({
        mode: 'now',
        durationHours: currentDurationHours,
      });
      return;
    }

    if (!selectedDate) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      setSelectedDate(tomorrow);
      updateScheduledTime(tomorrow, selectedHour, selectedMinute);
    } else {
      updateScheduledTime(selectedDate, selectedHour, selectedMinute);
    }
  };

  const handleDateSelect = (date: Date | { from: Date; to: Date } | undefined) => {
    if (date && !(date instanceof Date)) return;
    setSelectedDate(date);
    if (date && value.mode === 'scheduled') {
      updateScheduledTime(date, selectedHour, selectedMinute);
    }
  };

  const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const hour = e.target.value;
    setSelectedHour(hour);
    if (selectedDate && value.mode === 'scheduled') {
      updateScheduledTime(selectedDate, hour, selectedMinute);
    }
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const minute = e.target.value;
    setSelectedMinute(minute);
    if (selectedDate && value.mode === 'scheduled') {
      updateScheduledTime(selectedDate, selectedHour, minute);
    }
  };

  const handleDurationInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDurationInput(e.target.value);
    if (error) setError('');
  };

  const handleDurationInputBlur = () => {
    if (!durationInput.trim()) {
      const fallback = hoursToDisplayParts(clampDurationHours(value.durationHours || 120));
      setDurationInput(String(fallback.value));
      setDurationUnit(fallback.unit);
      setError('');
      return;
    }
    commitDuration(durationInput, durationUnit);
  };

  const handleDurationUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newUnit = e.target.value as AuctionDurationUnit;
    setDurationUnit(newUnit);
    if (durationInput.trim()) {
      commitDuration(durationInput, newUnit);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const hourOptions = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minuteOptions = ['00', '15', '30', '45'];

  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <Label className="text-sm font-medium text-gray-700 mb-2 block">Auction start time</Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleModeChange('now')}
            className={cn(
              'px-4 py-3 rounded-lg border-2 font-medium text-sm transition-all',
              'focus:outline-none focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:ring-offset-2',
              value.mode === 'now'
                ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Start now</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('scheduled')}
            className={cn(
              'px-4 py-3 rounded-lg border-2 font-medium text-sm transition-all',
              'focus:outline-none focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:ring-offset-2',
              value.mode === 'scheduled'
                ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white'
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

      <div>
        <Label className="text-sm font-medium text-gray-700 mb-2 block">Auction duration</Label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Duration</Label>
            <input
              type="number"
              min="1"
              max={getDurationInputMax(durationUnit)}
              value={durationInput}
              onChange={handleDurationInputChange}
              onBlur={handleDurationInputBlur}
              className={cn(
                'w-full h-10 px-3 py-2 rounded-md border border-gray-300 bg-white',
                'text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-[var(--brand-primary)]'
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
                'text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-[var(--brand-primary)]'
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
          Default: 120 hours (5 days) · Min: 15 minutes · Max: 30 days
        </p>
      </div>

      {value.mode === 'scheduled' && (
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2 block">Select date</Label>
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
                <Calendar mode="single" selected={selectedDate} onSelect={handleDateSelect} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2 block">Select time</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Hour</Label>
                <select
                  value={selectedHour}
                  onChange={handleHourChange}
                  className="w-full h-10 px-3 py-2 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-[var(--brand-primary)]"
                >
                  {hourOptions.map((hour) => (
                    <option key={hour} value={hour}>{hour}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Minute</Label>
                <select
                  value={selectedMinute}
                  onChange={handleMinuteChange}
                  className="w-full h-10 px-3 py-2 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-[var(--brand-primary)]"
                >
                  {minuteOptions.map((minute) => (
                    <option key={minute} value={minute}>{minute}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-gray-600 pt-2 border-t border-gray-200">
            <span className="font-medium">Timezone:</span>
            <span className="text-gray-700">Africa/Lagos (WAT)</span>
          </div>

          {selectedDate && !error && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                <span className="font-medium">Auction will start:</span>
                <br />
                {formatDate(selectedDate)} at {selectedHour}:{selectedMinute} WAT
              </p>
            </div>
          )}
        </div>
      )}

      {value.mode === 'now' && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <span className="font-medium">Auction will start immediately</span>
            <br />
            Vendors will be notified when the case is approved.
          </p>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">
            <span className="font-medium">Error:</span> {error}
          </p>
        </div>
      )}
    </div>
  );
}
