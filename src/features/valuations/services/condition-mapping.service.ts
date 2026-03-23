/**
 * Condition Mapping Service
 * 
 * Implements a 4-tier quality-based vehicle condition categorization system.
 * 
 * Quality Tiers (Primary Labels):
 * - Excellent (Brand New)
 * - Good (Foreign Used)
 * - Fair (Nigerian Used)
 * - Poor
 * 
 * This service provides:
 * - Type definitions for quality tiers and legacy conditions
 * - Mapping functions from legacy to new system
 * - Display formatting with bracketed market terms
 * - Validation and utility functions
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * New 4-tier quality system
 * These are the canonical values stored in the database
 */
export type QualityTier = "excellent" | "good" | "fair" | "poor";

/**
 * Legacy condition values from the previous 3-category system
 * and the earlier 5-category system
 */
export type LegacyCondition = 
  | "brand_new" 
  | "foreign_used" 
  | "nigerian_used"
  | "tokunbo_low"
  | "tokunbo_high"
  | "nig_used_low"
  | "nig_used_high";

/**
 * Display format for UI components
 */
export interface ConditionDisplay {
  /** The quality tier value (stored in database) */
  value: QualityTier;
  /** The formatted label for display (e.g., "Excellent (Brand New)") */
  label: string;
  /** The market term shown in brackets (e.g., "Brand New"), undefined for "Poor" */
  marketTerm?: string;
}

// ============================================================================
// Core Mapping Functions
// ============================================================================

/**
 * Maps legacy condition values to new quality tiers
 * 
 * Mapping Logic:
 * - "brand_new" → "excellent"
 * - "foreign_used", "tokunbo_low", "tokunbo_high" → "good"
 * - "nigerian_used", "nig_used_low", "nig_used_high" → "fair"
 * 
 * @param legacy - The legacy condition value
 * @returns The equivalent quality tier
 * 
 * @example
 * mapLegacyToQuality("brand_new") // returns "excellent"
 * mapLegacyToQuality("tokunbo_low") // returns "good"
 * mapLegacyToQuality("nigerian_used") // returns "fair"
 */
export function mapLegacyToQuality(legacy: LegacyCondition): QualityTier {
  switch (legacy) {
    case "brand_new":
      return "excellent";
    
    case "foreign_used":
    case "tokunbo_low":
    case "tokunbo_high":
      return "good";
    
    case "nigerian_used":
    case "nig_used_low":
    case "nig_used_high":
      return "fair";
    
    default:
      // TypeScript exhaustiveness check
      const _exhaustive: never = legacy;
      throw new Error(`Unknown legacy condition: ${_exhaustive}`);
  }
}

/**
 * Formats quality tier for UI display with bracketed market term
 * 
 * Display Format:
 * - "excellent" → "Excellent (Brand New)"
 * - "good" → "Good (Foreign Used)"
 * - "fair" → "Fair (Nigerian Used)"
 * - "poor" → "Poor" (no brackets)
 * 
 * @param quality - The quality tier value
 * @returns Display object with value, label, and optional market term
 * 
 * @example
 * formatConditionForDisplay("excellent")
 * // returns { value: "excellent", label: "Excellent (Brand New)", marketTerm: "Brand New" }
 * 
 * formatConditionForDisplay("poor")
 * // returns { value: "poor", label: "Poor", marketTerm: undefined }
 */
export function formatConditionForDisplay(quality: QualityTier): ConditionDisplay {
  switch (quality) {
    case "excellent":
      return {
        value: "excellent",
        label: "Excellent (Brand New)",
        marketTerm: "Brand New",
      };
    
    case "good":
      return {
        value: "good",
        label: "Good (Foreign Used)",
        marketTerm: "Foreign Used",
      };
    
    case "fair":
      return {
        value: "fair",
        label: "Fair (Nigerian Used)",
        marketTerm: "Nigerian Used",
      };
    
    case "poor":
      return {
        value: "poor",
        label: "Poor",
        marketTerm: undefined,
      };
    
    default:
      // TypeScript exhaustiveness check
      const _exhaustive: never = quality;
      throw new Error(`Unknown quality tier: ${_exhaustive}`);
  }
}

/**
 * Returns all quality tiers for dropdown/select components
 * 
 * @returns Array of all four quality tiers with display formatting
 * 
 * @example
 * const options = getQualityTiers();
 * // returns [
 * //   { value: "excellent", label: "Excellent (Brand New)", marketTerm: "Brand New" },
 * //   { value: "good", label: "Good (Foreign Used)", marketTerm: "Foreign Used" },
 * //   { value: "fair", label: "Fair (Nigerian Used)", marketTerm: "Nigerian Used" },
 * //   { value: "poor", label: "Poor", marketTerm: undefined }
 * // ]
 */
export function getQualityTiers(): ConditionDisplay[] {
  return [
    formatConditionForDisplay("excellent"),
    formatConditionForDisplay("good"),
    formatConditionForDisplay("fair"),
    formatConditionForDisplay("poor"),
  ];
}

/**
 * Validates that a condition value is a valid quality tier
 * 
 * @param value - The value to validate
 * @returns True if the value is a valid quality tier, false otherwise
 * 
 * @example
 * isValidQualityTier("excellent") // returns true
 * isValidQualityTier("brand_new") // returns false
 * isValidQualityTier("invalid") // returns false
 */
export function isValidQualityTier(value: string): value is QualityTier {
  return value === "excellent" || 
         value === "good" || 
         value === "fair" || 
         value === "poor";
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validates and normalizes a condition value with fallback
 * 
 * If the value is invalid, logs a warning and returns "fair" as a safe default.
 * This function is useful for handling user input or data from external sources.
 * 
 * @param value - The condition value to validate
 * @param context - Optional context for logging (e.g., "case creation", "AI assessment")
 * @returns A valid quality tier (original value if valid, "fair" if invalid)
 * 
 * @example
 * validateQualityTier("excellent") // returns "excellent"
 * validateQualityTier("invalid") // logs warning, returns "fair"
 */
export function validateQualityTier(
  value: string,
  context?: string
): QualityTier {
  if (isValidQualityTier(value)) {
    return value;
  }
  
  const contextMsg = context ? ` Context: ${context}` : "";
  console.warn(
    `[ConditionMapping] Invalid quality tier: "${value}". ` +
    `Using fallback: "fair".${contextMsg}`
  );
  
  return "fair";
}

/**
 * Attempts to map any condition value (legacy or new) to a quality tier
 * 
 * This function handles both legacy condition values and new quality tiers,
 * making it useful for backward compatibility scenarios.
 * 
 * @param value - The condition value (can be legacy or new format)
 * @param context - Optional context for logging
 * @returns A valid quality tier
 * 
 * @example
 * mapAnyConditionToQuality("brand_new") // returns "excellent"
 * mapAnyConditionToQuality("excellent") // returns "excellent"
 * mapAnyConditionToQuality("invalid") // logs warning, returns "fair"
 */
export function mapAnyConditionToQuality(
  value: string,
  context?: string
): QualityTier {
  // First, check if it's already a valid quality tier
  if (isValidQualityTier(value)) {
    return value;
  }
  
  // Try to map universal conditions to quality tiers
  const universalConditionMapping: Record<string, QualityTier> = {
    'Brand New': 'excellent',
    'Foreign Used (Tokunbo)': 'good',
    'Nigerian Used': 'fair',
    'Heavily Used': 'poor'
  };
  
  if (universalConditionMapping[value]) {
    const mapped = universalConditionMapping[value];
    const contextMsg = context ? ` Context: ${context}` : "";
    console.info(
      `[ConditionMapping] Mapped universal condition "${value}" → "${mapped}".${contextMsg}`
    );
    return mapped;
  }
  
  // Try to map as legacy condition
  const legacyConditions: LegacyCondition[] = [
    "brand_new",
    "foreign_used",
    "nigerian_used",
    "tokunbo_low",
    "tokunbo_high",
    "nig_used_low",
    "nig_used_high",
  ];
  
  if (legacyConditions.includes(value as LegacyCondition)) {
    const mapped = mapLegacyToQuality(value as LegacyCondition);
    
    const contextMsg = context ? ` Context: ${context}` : "";
    console.info(
      `[ConditionMapping] Mapped legacy condition "${value}" → "${mapped}".${contextMsg}`
    );
    
    return mapped;
  }
  
  // Invalid value, use fallback
  return validateQualityTier(value, context);
}

// ============================================================================
// Backward Compatibility (Deprecated)
// ============================================================================

/**
 * @deprecated Use QualityTier instead
 * Legacy type for backward compatibility
 */
export type UniversalCondition = "Brand New" | "Nigerian Used" | "Foreign Used (Tokunbo)";

/**
 * @deprecated Use QualityTier instead
 * Legacy type for backward compatibility
 */
export type DbCondition = 
  | "brand_new"
  | "tokunbo_low"
  | "tokunbo_high"
  | "nig_used_low"
  | "nig_used_high";

/**
 * @deprecated This function is no longer needed with the 4-tier quality system
 * Use getQualityTiers() instead
 */
export function getUniversalConditionCategories(): UniversalCondition[] {
  console.warn(
    "[ConditionMapping] getUniversalConditionCategories() is deprecated. " +
    "Use getQualityTiers() instead."
  );
  return [
    "Brand New",
    "Nigerian Used",
    "Foreign Used (Tokunbo)",
  ];
}

/**
 * Maps quality tier to universal condition category
 * Used when converting form data to AI assessment format
 * 
 * @param quality - The quality tier value
 * @returns The equivalent universal condition category
 * 
 * @example
 * mapQualityToUniversalCondition("excellent") // returns "Brand New"
 * mapQualityToUniversalCondition("good") // returns "Foreign Used (Tokunbo)"
 */
export function mapQualityToUniversalCondition(
  quality: QualityTier | undefined
): 'Brand New' | 'Foreign Used (Tokunbo)' | 'Nigerian Used' | 'Heavily Used' {
  if (!quality) return 'Nigerian Used'; // Default
  
  switch (quality) {
    case 'excellent':
      return 'Brand New';
    case 'good':
      return 'Foreign Used (Tokunbo)';
    case 'fair':
      return 'Nigerian Used';
    case 'poor':
      return 'Heavily Used';
    default:
      return 'Nigerian Used';
  }
}

/**
 * @deprecated This function is no longer needed with the 4-tier quality system
 * The new system does not use mileage-based condition variants
 */
export function mapUserConditionToDbConditions(
  userCondition: UniversalCondition,
  mileage: number
): DbCondition[] {
  console.warn(
    "[ConditionMapping] mapUserConditionToDbConditions() is deprecated. " +
    "Use mapAnyConditionToQuality() instead."
  );
  
  // Provide basic mapping for backward compatibility
  switch (userCondition) {
    case "Brand New":
      return ["brand_new"];
    case "Foreign Used (Tokunbo)":
      return mileage < 100000 
        ? ["tokunbo_low", "tokunbo_high"] 
        : ["tokunbo_high", "tokunbo_low"];
    case "Nigerian Used":
      return mileage < 100000
        ? ["nig_used_low", "nig_used_high"]
        : ["nig_used_high", "nig_used_low"];
    default:
      const _exhaustive: never = userCondition;
      throw new Error(`Unknown condition: ${_exhaustive}`);
  }
}

/**
 * @deprecated This function is no longer needed with the 4-tier quality system
 */
export function getMileageThreshold(): number {
  console.warn(
    "[ConditionMapping] getMileageThreshold() is deprecated. " +
    "The new 4-tier quality system does not use mileage thresholds."
  );
  return 100000;
}
