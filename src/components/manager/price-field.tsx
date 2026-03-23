/**
 * PriceField Component
 * 
 * Requirements: 4.1, 4.2, 8.4, 9.3
 * 
 * Features:
 * - Display AI estimate and override value
 * - Show confidence score if available
 * - Highlight low confidence fields in yellow
 * - Support edit mode and view mode
 * - Format currency with thousand separators
 * - Mobile-friendly touch targets (44x44px minimum)
 */

'use client';

import { useState, useEffect } from 'react';

interface PriceFieldProps {
  /**
   * Field label (e.g., "Market Value", "Salvage Value")
   */
  label: string;

  /**
   * AI-estimated value
   */
  aiValue: number;

  /**
   * Manager's override value (if any)
   */
  overrideValue?: number;

  /**
   * Whether the field is in edit mode
   */
  isEditMode: boolean;

  /**
   * Callback when value changes
   */
  onChange: (value: number) => void;

  /**
   * Optional confidence score (0-100)
   */
  confidence?: number;

  /**
   * Optional custom className
   */
  className?: string;

  /**
   * Currency symbol (default: ₦)
   */
  currencySymbol?: string;
}

/**
 * Format number with thousand separators
 * Example: 1234567 -> "1,234,567"
 */
function formatCurrency(value: number, symbol: string = '₦'): string {
  return `${symbol}${value.toLocaleString('en-US')}`;
}

/**
 * PriceField Component
 */
export function PriceField({
  label,
  aiValue,
  overrideValue,
  isEditMode,
  onChange,
  confidence,
  className = '',
  currencySymbol = '₦',
}: PriceFieldProps) {
  const displayValue = overrideValue ?? aiValue;
  const hasOverride = overrideValue !== undefined;
  const isLowConfidence = confidence !== undefined && confidence < 70;

  // Local state for input value (to handle typing)
  const [inputValue, setInputValue] = useState(displayValue.toString());

  // Update input value when displayValue changes
  useEffect(() => {
    setInputValue(displayValue.toString());
  }, [displayValue]);

  /**
   * Handle input change
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    // Parse and validate
    const numericValue = parseFloat(value);
    if (!isNaN(numericValue) && numericValue >= 0) {
      onChange(numericValue);
    }
  };

  /**
   * Handle input blur (format on blur)
   */
  const handleBlur = () => {
    const numericValue = parseFloat(inputValue);
    if (!isNaN(numericValue) && numericValue >= 0) {
      setInputValue(numericValue.toString());
    } else {
      // Reset to display value if invalid
      setInputValue(displayValue.toString());
    }
  };

  return (
    <div
      className={`p-3 rounded-lg ${
        isLowConfidence ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'
      } ${className}`}
    >
      {/* Label and Confidence */}
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {confidence !== undefined && (
          <span
            className={`text-xs ${
              confidence >= 80
                ? 'text-green-600'
                : confidence >= 60
                ? 'text-yellow-600'
                : 'text-red-600'
            }`}
          >
            {confidence}% confidence
          </span>
        )}
      </div>

      {/* Value Display or Input */}
      {isEditMode ? (
        <div className="space-y-1">
          <input
            type="number"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent text-lg font-semibold"
            style={{ minHeight: '44px' }} // Mobile touch target
            placeholder="Enter amount"
            min="0"
            step="1000"
          />
          {hasOverride && (
            <p className="text-xs text-blue-600">
              AI estimate: {formatCurrency(aiValue, currencySymbol)}
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-gray-900">
            {formatCurrency(displayValue, currencySymbol)}
          </span>
          {hasOverride && (
            <span className="text-xs text-blue-600">
              (AI: {formatCurrency(aiValue, currencySymbol)})
            </span>
          )}
        </div>
      )}

      {/* Low Confidence Warning */}
      {isLowConfidence && !isEditMode && (
        <div className="mt-2 flex items-start gap-1">
          <svg
            className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="text-xs text-yellow-700">
            Low confidence - manual review recommended
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * PriceFieldGroup Component
 * Groups multiple price fields together
 */
interface PriceFieldGroupProps {
  /**
   * Group title
   */
  title: string;

  /**
   * Child price fields
   */
  children: React.ReactNode;

  /**
   * Optional custom className
   */
  className?: string;
}

export function PriceFieldGroup({
  title,
  children,
  className = '',
}: PriceFieldGroupProps) {
  return (
    <div className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
      <h3 className="font-bold text-gray-900 mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export default PriceField;
