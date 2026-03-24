'use client';

/**
 * Location Autocomplete Component
 * 
 * Provides autocomplete suggestions for location search with case-insensitive partial matching.
 * Requirements: 9.1, 9.2, 9.3
 */

import { useState, useEffect, useRef } from 'react';
import { MapPin, X } from 'lucide-react';

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function LocationAutocomplete({
  value,
  onChange,
  placeholder = 'Enter location...',
  className = '',
}: LocationAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch suggestions when value changes
  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Don't fetch if value is too short
    if (value.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    // Debounce API call by 300ms
    debounceTimerRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/locations/autocomplete?q=${encodeURIComponent(value)}`);
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.data.locations || []);
          setIsOpen(data.data.locations.length > 0);
        }
      } catch (error) {
        console.error('Error fetching location suggestions:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (location: string) => {
    onChange(location);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setSuggestions([]);
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020] focus:border-transparent"
          aria-label="Location filter"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls="location-suggestions"
        />
        {value && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Clear location"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {isOpen && (
        <div
          id="location-suggestions"
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
          role="listbox"
        >
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              Loading suggestions...
            </div>
          ) : suggestions.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              No locations found
            </div>
          ) : (
            suggestions.map((location, index) => (
              <button
                key={index}
                onClick={() => handleSelect(location)}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors focus:outline-none focus:bg-gray-100 flex items-center gap-2"
                role="option"
                aria-selected={value === location}
              >
                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
                <span className="truncate">{location}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
