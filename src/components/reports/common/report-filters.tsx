'use client';

/**
 * Report Filters Component
 * 
 * Reusable filter component for all reports with date range,
 * asset type, region, and other common filters
 */

import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Filter, X } from 'lucide-react';
import { format } from 'date-fns';

export interface ReportFilters {
  startDate?: Date;
  endDate?: Date;
  assetTypes?: string[];
  regions?: string[];
  status?: string[];
  groupBy?: string;
}

interface ReportFiltersProps {
  filters: ReportFilters;
  onFiltersChange: (filters: ReportFilters) => void;
  onApply: () => void;
  onReset: () => void;
  showAssetTypes?: boolean;
  showRegions?: boolean;
  showStatus?: boolean;
  showGroupBy?: boolean;
}

const ASSET_TYPES = ['vehicle', 'electronics', 'machinery', 'property'];
const REGIONS = ['Lagos', 'Abuja', 'Port Harcourt', 'Kano', 'Ibadan'];
const STATUS_OPTIONS = ['pending', 'approved', 'completed', 'rejected'];
const GROUP_BY_OPTIONS = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'quarter', label: 'Quarterly' },
];

export function ReportFiltersComponent({
  filters,
  onFiltersChange,
  onApply,
  onReset,
  showAssetTypes = true,
  showRegions = true,
  showStatus = false,
  showGroupBy = true,
}: ReportFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);

  const handleDateChange = (field: 'startDate' | 'endDate', date: Date | undefined) => {
    onFiltersChange({ ...filters, [field]: date });
  };

  const toggleArrayFilter = (field: keyof ReportFilters, value: string) => {
    const current = (filters[field] as string[]) || [];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    onFiltersChange({ ...filters, [field]: updated });
  };

  const hasActiveFilters = 
    filters.assetTypes?.length || 
    filters.regions?.length || 
    filters.status?.length ||
    filters.groupBy;

  return (
    <div className="space-y-4">
      {/* Date Range */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Start Date
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal min-w-[240px]"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.startDate ? format(filters.startDate, 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-white min-w-[280px]" align="start">
              <Calendar
                mode="single"
                selected={filters.startDate}
                onSelect={(date) => handleDateChange('startDate', date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            End Date
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal min-w-[240px]"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.endDate ? format(filters.endDate, 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-white min-w-[280px]" align="start">
              <Calendar
                mode="single"
                selected={filters.endDate}
                onSelect={(date) => handleDateChange('endDate', date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Advanced Filters Toggle */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowFilters(!showFilters)}
        className="w-full sm:w-auto"
      >
        <Filter className="mr-2 h-4 w-4" />
        {showFilters ? 'Hide' : 'Show'} Advanced Filters
        {hasActiveFilters && (
          <span className="ml-2 bg-[#800020] text-white text-xs px-2 py-0.5 rounded-full">
            {(filters.assetTypes?.length || 0) + (filters.regions?.length || 0) + (filters.status?.length || 0)}
          </span>
        )}
      </Button>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
          {/* Asset Types */}
          {showAssetTypes && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Asset Types
              </label>
              <div className="flex flex-wrap gap-2">
                {ASSET_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => toggleArrayFilter('assetTypes', type)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      filters.assetTypes?.includes(type)
                        ? 'bg-[#800020] text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Regions */}
          {showRegions && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Regions
              </label>
              <div className="flex flex-wrap gap-2">
                {REGIONS.map((region) => (
                  <button
                    key={region}
                    onClick={() => toggleArrayFilter('regions', region)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      filters.regions?.includes(region)
                        ? 'bg-[#800020] text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {region}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Status */}
          {showStatus && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((status) => (
                  <button
                    key={status}
                    onClick={() => toggleArrayFilter('status', status)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      filters.status?.includes(status)
                        ? 'bg-[#800020] text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Group By */}
          {showGroupBy && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Group By
              </label>
              <div className="flex flex-wrap gap-2">
                {GROUP_BY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => onFiltersChange({ ...filters, groupBy: option.value })}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      filters.groupBy === option.value
                        ? 'bg-[#800020] text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filter Actions */}
          <div className="flex gap-2 pt-2">
            <Button onClick={onApply} className="flex-1 bg-[#800020] hover:bg-[#600018]">
              Apply Filters
            </Button>
            <Button onClick={onReset} variant="outline" className="flex-1">
              <X className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
