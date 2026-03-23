'use client';

/**
 * Transaction Filters Component
 * Provides filtering controls for transaction history
 * 
 * Features:
 * - Date range picker (preset ranges + custom)
 * - Status filter dropdown
 * - Apply/Reset buttons
 */

import { useState } from 'react';

interface DateRange {
  startDate: string;
  endDate: string;
}

interface Filters {
  dateRange: DateRange;
  status?: string;
}

interface TransactionFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  transactionType: 'wallet' | 'bids' | 'payments';
}

export default function TransactionFilters({
  filters,
  onFiltersChange,
  transactionType,
}: TransactionFiltersProps) {
  const [localFilters, setLocalFilters] = useState<Filters>(filters);

  const dateRangePresets = [
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 30 days', days: 30 },
    { label: 'Last 90 days', days: 90 },
  ];

  const statusOptions: Record<string, string[]> = {
    wallet: ['completed', 'pending', 'failed'],
    bids: ['active', 'won', 'lost', 'outbid'],
    payments: ['pending', 'completed', 'failed', 'overdue'],
  };

  const handleDateRangePreset = (days: number) => {
    const endDate = new Date();
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    setLocalFilters({
      ...localFilters,
      dateRange: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      },
    });
  };

  const handleApply = () => {
    onFiltersChange(localFilters);
  };

  const handleReset = () => {
    const defaultFilters: Filters = {
      dateRange: {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
      },
    };
    setLocalFilters(defaultFilters);
    onFiltersChange(defaultFilters);
  };

  return (
    <div className="space-y-4">
      {/* Date Range Presets */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Quick Date Range</label>
        <div className="flex flex-wrap gap-2">
          {dateRangePresets.map((preset) => (
            <button
              key={preset.days}
              onClick={() => handleDateRangePreset(preset.days)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Range */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
            Start Date
          </label>
          <input
            type="date"
            id="startDate"
            value={localFilters.dateRange.startDate}
            onChange={(e) =>
              setLocalFilters({
                ...localFilters,
                dateRange: { ...localFilters.dateRange, startDate: e.target.value },
              })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
            End Date
          </label>
          <input
            type="date"
            id="endDate"
            value={localFilters.dateRange.endDate}
            onChange={(e) =>
              setLocalFilters({
                ...localFilters,
                dateRange: { ...localFilters.dateRange, endDate: e.target.value },
              })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
          />
        </div>
      </div>

      {/* Status Filter */}
      <div>
        <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
          Status
        </label>
        <select
          id="status"
          value={localFilters.status || ''}
          onChange={(e) =>
            setLocalFilters({
              ...localFilters,
              status: e.target.value || undefined,
            })
          }
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
        >
          <option value="">All Statuses</option>
          {statusOptions[transactionType].map((status) => (
            <option key={status} value={status}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleApply}
          className="flex-1 px-4 py-2 bg-[#800020] text-white rounded-lg hover:bg-[#600018] transition-colors"
        >
          Apply Filters
        </button>
        <button
          onClick={handleReset}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
