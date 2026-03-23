/**
 * Faceted Filter Component
 * 
 * Dropdown filter with checkbox groups for multi-select filtering
 * Displays count badge and supports real-time result counts
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface FacetedFilterProps {
  title: string;
  options: FilterOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  className?: string;
}

export function FacetedFilter({ 
  title, 
  options, 
  selected, 
  onChange,
  className = '' 
}: FacetedFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);
  
  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };
  
  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-[#800020] focus:ring-offset-2"
        aria-expanded={isOpen}
        aria-haspopup="true"
        type="button"
      >
        <span className="text-sm font-medium text-gray-700">{title}</span>
        {selected.length > 0 && (
          <span 
            className="px-2 py-0.5 bg-[#800020] text-white rounded-full text-xs font-medium"
            aria-label={`${selected.length} filters selected`}
          >
            {selected.length}
          </span>
        )}
        <ChevronDown 
          size={16} 
          className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      
      {isOpen && (
        <div 
          className="absolute top-full mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10"
          role="menu"
          aria-label={`${title} filter options`}
        >
          <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500 text-center">
                No options available
              </div>
            ) : (
              options.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded cursor-pointer transition-colors"
                  role="menuitemcheckbox"
                  aria-checked={selected.includes(option.value)}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(option.value)}
                    onChange={() => toggleOption(option.value)}
                    className="rounded border-gray-300 text-[#800020] focus:ring-[#800020]"
                    aria-label={option.label}
                  />
                  <span className="flex-1 text-sm text-gray-700">{option.label}</span>
                  {option.count !== undefined && (
                    <span className="text-sm text-gray-500">({option.count})</span>
                  )}
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
