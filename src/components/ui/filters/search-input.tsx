/**
 * Search Input Component
 * 
 * Search input with 300ms debounce and icon
 * Implements accessible search functionality
 */

'use client';

import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
}

export function SearchInput({ 
  value, 
  onChange, 
  placeholder = 'Search...',
  className = '',
  debounceMs = 300
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value);
  
  // Sync local value with prop value
  useEffect(() => {
    setLocalValue(value);
  }, [value]);
  
  // Debounce onChange callback
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, debounceMs);
    
    return () => clearTimeout(timer);
  }, [localValue, onChange, value, debounceMs]);
  
  const handleClear = () => {
    setLocalValue('');
    onChange('');
  };
  
  return (
    <div className={`relative ${className}`}>
      <Search 
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" 
        size={20}
        aria-hidden="true"
      />
      <input
        type="search"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent transition-colors"
        aria-label={placeholder}
      />
      {localValue && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-[#800020] focus:ring-offset-2 rounded"
          aria-label="Clear search"
          type="button"
        >
          <X size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
