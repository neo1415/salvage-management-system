/**
 * Type definitions for the Vehicle Valuation Database System
 */

import type { QualityTier } from '../services/condition-mapping.service';

export interface ValuationQueryParams {
  make: string;
  model: string;
  year: number;
  conditionCategory?: QualityTier; // Optional filter - must be a valid quality tier
}

export interface ValuationData {
  lowPrice: number;
  highPrice: number;
  averagePrice: number;
  mileageLow?: number;
  mileageHigh?: number;
  marketNotes?: string;
  conditionCategory: QualityTier;
}

export interface ValuationResult {
  found: boolean;
  valuation?: ValuationData;
  source: 'database' | 'not_found';
  matchType?: 'exact' | 'fuzzy_make_model' | 'fuzzy_year'; // NEW
  similarityScore?: number; // NEW (0-1, only for fuzzy matches)
  matchedValues?: { // NEW (for debugging)
    make?: string;
    model?: string;
    year?: number;
  };
}

export interface DamageInput {
  component: string;
  damageLevel: 'minor' | 'moderate' | 'severe';
}

export interface DamageDeduction {
  component: string;
  damageLevel: string;
  make?: string; // Optional make for make-specific deductions
  repairCostLow: number;
  repairCostHigh: number;
  valuationDeductionLow: number;
  valuationDeductionHigh: number;
  notes?: string;
  // Computed fields for backward compatibility
  repairCost?: number; // Midpoint of range
  deductionPercent?: number; // Calculated from deduction amount
  deductionAmount?: number; // Midpoint of range
  source?: 'database' | 'internet_search'; // NEW: Source of the deduction data
}

export interface SalvageCalculation {
  basePrice: number;
  totalDeductionPercent: number;
  totalDeductionAmount: number;
  salvageValue: number;
  deductions: DamageDeduction[];
  isTotalLoss: boolean;
  confidence: number;
}
