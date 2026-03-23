/**
 * Price Validation Utilities
 * 
 * Validates price overrides for salvage case approvals.
 * Ensures price relationships are maintained and provides detailed error messages.
 * 
 * Requirements: 5.1, 5.2, 5.3, 4.4
 */

/**
 * Price override data structure
 */
export interface PriceOverrides {
  marketValue?: number;
  repairCost?: number;
  salvageValue?: number;
  reservePrice?: number;
}

/**
 * Validation result structure
 */
export interface PriceValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates price overrides for salvage case approval
 * 
 * Validation Rules:
 * - Market value must be > 0
 * - Salvage value ≤ market value
 * - Reserve price ≤ salvage value
 * - All values must be non-negative
 * 
 * Warnings:
 * - Salvage value > 90% of market value (unusually high)
 * - Reserve price < 50% of salvage value (unusually low)
 * 
 * @param overrides - Price overrides to validate
 * @param aiEstimates - Original AI estimates (used as defaults for missing overrides)
 * @returns Validation result with errors and warnings
 * 
 * @example
 * ```typescript
 * const result = validatePriceOverrides(
 *   { marketValue: 5000000, salvageValue: 3000000 },
 *   { marketValue: 4500000, salvageValue: 2800000, reservePrice: 1960000 }
 * );
 * 
 * if (!result.isValid) {
 *   console.error('Validation errors:', result.errors);
 * }
 * ```
 */
export function validatePriceOverrides(
  overrides: PriceOverrides,
  aiEstimates: {
    marketValue: number;
    salvageValue: number;
    reservePrice: number;
  }
): PriceValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Determine final values (use override if provided, else AI estimate)
  const marketValue = overrides.marketValue ?? aiEstimates.marketValue;
  const salvageValue = overrides.salvageValue ?? aiEstimates.salvageValue;
  const reservePrice = overrides.reservePrice ?? aiEstimates.reservePrice;
  
  // Validation Rule 1: Market value must be positive
  if (marketValue <= 0) {
    errors.push('Market value must be greater than zero');
  }
  
  // Validation Rule 2: Salvage value cannot exceed market value
  if (salvageValue > marketValue) {
    errors.push(
      `Salvage value (₦${salvageValue.toLocaleString()}) cannot exceed market value (₦${marketValue.toLocaleString()})`
    );
  }
  
  // Validation Rule 3: Reserve price cannot exceed salvage value
  if (reservePrice > salvageValue) {
    errors.push(
      `Reserve price (₦${reservePrice.toLocaleString()}) cannot exceed salvage value (₦${salvageValue.toLocaleString()})`
    );
  }
  
  // Validation Rule 4: Salvage value should be non-negative
  if (salvageValue < 0) {
    errors.push('Salvage value cannot be negative');
  }
  
  // Validation Rule 5: Reserve price should be non-negative
  if (reservePrice < 0) {
    errors.push('Reserve price cannot be negative');
  }
  
  // Warning 1: Unusually high salvage value (> 90% of market value)
  if (marketValue > 0 && salvageValue > marketValue * 0.9) {
    warnings.push(
      `⚠️ Salvage value is ${Math.round((salvageValue / marketValue) * 100)}% of market value - please verify this is correct`
    );
  }
  
  // Warning 2: Unusually low reserve price (< 50% of salvage value)
  if (salvageValue > 0 && reservePrice < salvageValue * 0.5) {
    warnings.push(
      `⚠️ Reserve price is only ${Math.round((reservePrice / salvageValue) * 100)}% of salvage value - this may result in undervaluation`
    );
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates that a comment is provided and meets minimum length requirement
 * 
 * @param comment - Comment text to validate
 * @param minLength - Minimum required length (default: 10)
 * @returns Error message if invalid, null if valid
 */
export function validateOverrideComment(
  comment: string,
  minLength: number = 10
): string | null {
  const trimmed = comment.trim();
  
  if (trimmed.length === 0) {
    return 'Please explain why you\'re adjusting these prices';
  }
  
  if (trimmed.length < minLength) {
    return `Comment must be at least ${minLength} characters (currently ${trimmed.length})`;
  }
  
  return null;
}
