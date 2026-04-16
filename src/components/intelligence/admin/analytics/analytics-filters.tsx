'use client';

/**
 * Analytics Filters Component
 * 
 * Provides filtering controls for analytics dashboard
 * Task: 11.3.10 - Implement advanced filters
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Filter, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export interface AnalyticsFilters {
  dateRange: {
    from: Date;
    to: Date;
  };
  assetType?: string;
  region?: string;
}

interface AnalyticsFiltersProps {
  filters: AnalyticsFilters;
  onFiltersChange: (filters: AnalyticsFilters) => void;
  onApply: () => void;
  onReset: () => void;
}

const ASSET_TYPES = [
  { value: 'all', label: 'All Asset Types' },
  { value: 'vehicle', label: 'Vehicles' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'machinery', label: 'Machinery' },
];

const REGIONS = [
  { value: 'all', label: 'All Regions' },
  { value: 'lagos', label: 'Lagos' },
  { value: 'abuja', label: 'Abuja' },
  { value: 'port-harcourt', label: 'Port Harcourt' },
  { value: 'kano', label: 'Kano' },
  { value: 'ibadan', label: 'Ibadan' },
];

export function AnalyticsFiltersComponent({ filters, onFiltersChange, onApply, onReset }: AnalyticsFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleDateRangeChange = (range: { from: Date; to: Date }) => {
    onFiltersChange({
      ...filters,
      dateRange: range,
    });
  };

  const handleAssetTypeChange = (value: string) => {
    onFiltersChange({
      ...filters,
      assetType: value === 'all' ? undefined : value,
    });
  };

  const handleRegionChange = (value: string) => {
    onFiltersChange({
      ...filters,
      region: value === 'all' ? undefined : value,
    });
  };

  const hasActiveFilters = filters.assetType || filters.region;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Date Range Picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-[280px] justify-start text-left font-normal">
            <CalendarIcon className="mr-2 h-4 w-4" />
            {filters.dateRange.from && filters.dateRange.to ? (
              <>
                {format(filters.dateRange.from, 'MMM dd, yyyy')} - {format(filters.dateRange.to, 'MMM dd, yyyy')}
              </>
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={{
              from: filters.dateRange.from,
              to: filters.dateRange.to,
            }}
            onSelect={(range) => {
              if (range?.from && range?.to) {
                handleDateRangeChange({ from: range.from, to: range.to });
              }
            }}
            numberOfMonths={2}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      {/* Asset Type Selector */}
      <Select
        value={filters.assetType || 'all'}
        onValueChange={handleAssetTypeChange}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Asset Type" />
        </SelectTrigger>
        <SelectContent>
          {ASSET_TYPES.map((type) => (
            <SelectItem key={type.value} value={type.value}>
              {type.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Region Selector */}
      <Select
        value={filters.region || 'all'}
        onValueChange={handleRegionChange}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Region" />
        </SelectTrigger>
        <SelectContent>
          {REGIONS.map((region) => (
            <SelectItem key={region.value} value={region.value}>
              {region.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Apply Button */}
      <Button onClick={onApply} className="bg-[#800020] hover:bg-[#600018]">
        <Filter className="mr-2 h-4 w-4" />
        Apply Filters
      </Button>

      {/* Reset Button */}
      {hasActiveFilters && (
        <Button onClick={onReset} variant="outline">
          <X className="mr-2 h-4 w-4" />
          Reset
        </Button>
      )}
    </div>
  );
}
