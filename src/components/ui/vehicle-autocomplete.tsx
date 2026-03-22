'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronDown, X, Loader2 } from 'lucide-react'

interface VehicleAutocompleteProps {
  /** Field name for form integration */
  name: string
  /** Label text */
  label: string
  /** Placeholder text */
  placeholder: string
  /** Current value */
  value: string
  /** Change handler */
  onChange: (value: string) => void
  /** API endpoint to fetch suggestions */
  endpoint: string
  /** Query parameters for API call */
  queryParams?: Record<string, string>
  /** Whether field is disabled */
  disabled?: boolean
  /** Whether field is required */
  required?: boolean
  /** Error message */
  error?: string
  /** Loading state */
  isLoading?: boolean
  /** Debounce delay in ms (default: 300) */
  debounceMs?: number
  /** Maximum suggestions to display (default: 10) */
  maxSuggestions?: number
  /** Mobile mode (shows fewer suggestions) */
  isMobile?: boolean
  /** Whether user is offline */
  isOffline?: boolean
  /** Whether to show degradation warning */
  showDegradationWarning?: boolean
}

export function VehicleAutocomplete({
  name,
  label,
  placeholder,
  value,
  onChange,
  endpoint,
  queryParams = {},
  disabled = false,
  required = false,
  error,
  isLoading: externalLoading = false,
  debounceMs = 300,
  maxSuggestions = 10,
  isMobile = false,
  isOffline = false,
  showDegradationWarning = true,
}: VehicleAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [internalLoading, setInternalLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState(value)
  const [hasFocus, setHasFocus] = useState(false)
  const [isDegraded, setIsDegraded] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout>()
  const listboxId = `${name}-listbox`
  const labelId = `${name}-label`

  const isLoading = externalLoading || internalLoading
  const maxDisplaySuggestions = isMobile ? 5 : maxSuggestions

  // Determine if autocomplete should be disabled (offline or degraded)
  const autocompleteDisabled = isOffline || isDegraded || disabled

  // Fetch suggestions from API
  const fetchSuggestions = useCallback(
    async (searchValue: string) => {
      // Don't fetch if offline or disabled
      if (!searchValue.trim() || disabled || isOffline) {
        setSuggestions([])
        setIsOpen(false)
        return
      }

      setInternalLoading(true)
      setApiError(null)

      try {
        const params = new URLSearchParams(queryParams)
        const url = `${endpoint}?${params.toString()}`
        const response = await fetch(url, {
          signal: AbortSignal.timeout(5000), // 5 second timeout
        })

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }

        const data = await response.json()
        
        // Handle different response formats
        let items: string[] = []
        if (Array.isArray(data)) {
          items = data.map(String)
        } else if (data.makes) {
          items = data.makes
        } else if (data.models) {
          items = data.models
        } else if (data.years) {
          items = data.years.map(String)
        } else if (data.data) {
          items = Array.isArray(data.data) ? data.data.map(String) : []
        }

        // Filter suggestions based on input
        const filtered = items.filter((item) =>
          item.toLowerCase().includes(searchValue.toLowerCase())
        )

        setSuggestions(filtered.slice(0, maxDisplaySuggestions))
        setIsOpen(true) // Always open to show results or "No results found"
        setSelectedIndex(-1)
        
        // Reset degraded state on successful fetch
        setIsDegraded(false)
      } catch (err) {
        console.error('Autocomplete API error:', err)
        
        // Track fallback to text input
        console.log('[Autocomplete Analytics] Fallback to text input due to API error', {
          field: name,
          endpoint,
          error: err instanceof Error ? err.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        })
        
        // Degrade gracefully to text input
        setIsDegraded(true)
        setApiError('Autocomplete unavailable')
        setSuggestions([])
        setIsOpen(false)
      } finally {
        setInternalLoading(false)
      }
    },
    [endpoint, queryParams, disabled, isOffline, maxDisplaySuggestions]
  )

  // Debounced fetch
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Don't fetch if offline or degraded
    if (isOffline || isDegraded) {
      return
    }

    debounceTimerRef.current = setTimeout(() => {
      if (hasFocus && inputValue) {
        fetchSuggestions(inputValue)
      }
    }, debounceMs)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [inputValue, fetchSuggestions, debounceMs, hasFocus, isOffline, isDegraded])

  // Sync external value changes
  useEffect(() => {
    setInputValue(value)
  }, [value])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    onChange(newValue)
    
    // Track manual text entry (when autocomplete is degraded or offline)
    if (isDegraded || isOffline) {
      console.log('[Autocomplete Analytics] Manual text entry (autocomplete unavailable)', {
        field: name,
        isDegraded,
        isOffline,
        timestamp: new Date().toISOString(),
      })
    }
  }

  // Handle suggestion selection
  const handleSelectSuggestion = (suggestion: string) => {
    setInputValue(suggestion)
    onChange(suggestion)
    setIsOpen(false)
    setSelectedIndex(-1)
    inputRef.current?.focus()
    
    // Track autocomplete usage
    console.log('[Autocomplete Analytics] Selection made via autocomplete', {
      field: name,
      value: suggestion,
      endpoint,
      timestamp: new Date().toISOString(),
    })
  }

  // Handle clear button
  const handleClear = () => {
    setInputValue('')
    onChange('')
    setSuggestions([])
    setIsOpen(false)
    setSelectedIndex(-1)
    inputRef.current?.focus()
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && suggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (!isOpen) {
          setIsOpen(true)
        } else {
          setSelectedIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : prev
          )
        }
        break

      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break

      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSelectSuggestion(suggestions[selectedIndex])
        }
        break

      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setSelectedIndex(-1)
        break

      case 'Tab':
        setIsOpen(false)
        setSelectedIndex(-1)
        break
    }
  }

  // Highlight matching text
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text

    const regex = new RegExp(`(${query})`, 'gi')
    const parts = text.split(regex)

    return (
      <>
        {parts.map((part, index) =>
          regex.test(part) ? (
            <mark
              key={index}
              className="bg-[#800020] text-white font-semibold"
            >
              {part}
            </mark>
          ) : (
            <span key={index}>{part}</span>
          )
        )}
      </>
    )
  }

  // Announce to screen readers
  const getAriaLiveMessage = () => {
    if (isOffline) return 'Offline - autocomplete unavailable'
    if (isDegraded) return 'Autocomplete unavailable - using text input'
    if (isLoading) return 'Loading suggestions'
    if (apiError) return apiError
    if (isOpen && suggestions.length > 0) {
      return `${suggestions.length} suggestion${suggestions.length === 1 ? '' : 's'} available`
    }
    if (isOpen && suggestions.length === 0 && inputValue) {
      return 'No results found'
    }
    return ''
  }

  // Get warning message for degraded state
  const getWarningMessage = () => {
    if (isOffline) {
      return '📡 Offline - Using text input mode'
    }
    if (isDegraded && showDegradationWarning) {
      return '⚠️ Autocomplete unavailable - Using text input mode'
    }
    return null
  }

  return (
    <div className="relative w-full">
      {/* Label */}
      <label
        id={labelId}
        htmlFor={name}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* Input container */}
      <div className="relative">
        <input
          ref={inputRef}
          id={name}
          name={name}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setHasFocus(true)
            if (inputValue && suggestions.length > 0) {
              setIsOpen(true)
            }
          }}
          onBlur={() => setHasFocus(false)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-labelledby={labelId}
          aria-autocomplete="list"
          aria-controls={isOpen ? listboxId : undefined}
          aria-expanded={isOpen}
          aria-activedescendant={
            selectedIndex >= 0 ? `${name}-option-${selectedIndex}` : undefined
          }
          role="combobox"
          autoComplete="off"
          className={`
            w-full px-4 py-3 pr-20 text-base border rounded-lg
            focus:outline-none focus:ring-2 focus:ring-[#800020] focus:border-transparent
            disabled:bg-gray-100 disabled:cursor-not-allowed
            ${error ? 'border-red-500' : 'border-gray-300'}
            ${isMobile ? 'text-base' : 'text-sm'}
          `}
          style={{
            fontSize: isMobile ? '16px' : undefined, // Prevent iOS zoom
          }}
        />

        {/* Icons */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isLoading && (
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          )}
          {inputValue && !disabled && !isLoading && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Clear selection"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          )}
          <ChevronDown
            className={`w-5 h-5 text-gray-400 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {/* Warning message for degraded/offline state */}
      {getWarningMessage() && (
        <p className="mt-1 text-sm text-amber-600 flex items-center gap-1" role="alert">
          {getWarningMessage()}
        </p>
      )}

      {/* API error message (only if not already showing degradation warning) */}
      {apiError && !getWarningMessage() && (
        <p className="mt-1 text-sm text-orange-600" role="alert">
          {apiError}
        </p>
      )}

      {/* Dropdown */}
      {isOpen && suggestions.length > 0 && !autocompleteDisabled && (
        <div
          ref={dropdownRef}
          id={listboxId}
          role="listbox"
          aria-labelledby={labelId}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto"
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion}-${index}`}
              id={`${name}-option-${index}`}
              role="option"
              aria-selected={index === selectedIndex}
              onClick={() => handleSelectSuggestion(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`
                px-4 py-3 cursor-pointer transition-colors
                min-h-[44px] flex items-center
                ${
                  index === selectedIndex
                    ? 'bg-[#800020] text-white'
                    : 'hover:bg-gray-100'
                }
              `}
            >
              {highlightMatch(suggestion, inputValue)}
            </div>
          ))}
        </div>
      )}

      {/* No results message */}
      {isOpen && suggestions.length === 0 && inputValue && !isLoading && !autocompleteDisabled && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg px-4 py-3 text-gray-500 text-sm"
        >
          No results found
        </div>
      )}

      {/* Screen reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {getAriaLiveMessage()}
      </div>
    </div>
  )
}
