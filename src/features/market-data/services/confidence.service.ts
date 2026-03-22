/**
 * Confidence Scoring Service
 * 
 * Calculates confidence scores for market price assessments based on:
 * - Number of sources providing data
 * - Data freshness (age in days)
 * - Year match rate (for vehicles)
 * - Sample size
 * - Depreciation applied flag
 * 
 * Requirements: 4.2, 4.3, 4.4, 4.5, 5.6, 7.6, 8.1-8.6
 */

export interface ConfidenceFactors {
  sourceCount: number;
  dataAgeDays: number;
  yearMatchRate?: number; // 0-100 percentage (optional, for vehicles)
  sampleSize?: number; // Total number of listings (optional)
  depreciationApplied?: boolean; // Whether depreciation was applied (optional)
}

export interface ConfidenceResult {
  score: number;
  warnings: string[]; // Quality warnings
  factors: {
    baseScore: number;
    sourceCount: number;
    dataAgeDays: number;
    stalenessPenalty: number;
    yearMatchPenalty?: number;
    sampleSizePenalty?: number;
    depreciationPenalty?: number;
  };
}

/**
 * Calculate confidence score based on multiple quality factors
 * 
 * Base scores by source count (fresh data < 7 days):
 * - 3+ sources: 90-100%
 * - 2 sources: 70-89%
 * - 1 source: 50-69%
 * 
 * Penalties:
 * - Staleness: 7-30 days (-20), 30+ days (-40)
 * - Year match rate: 40-69% (-20), 0-39% (-40)
 * - Sample size: <3 listings (-30), 3-5 listings (-15)
 * - Depreciation applied: -50 points
 * 
 * @param factors - Quality factors for confidence calculation
 * @returns Confidence result with score, warnings, and breakdown
 */
export function calculateConfidence(factors: ConfidenceFactors): ConfidenceResult {
  const { sourceCount, dataAgeDays, yearMatchRate, sampleSize, depreciationApplied } = factors;

  // Validate inputs
  if (sourceCount < 0) {
    throw new Error('Source count cannot be negative');
  }
  if (dataAgeDays < 0) {
    throw new Error('Data age cannot be negative');
  }
  if (yearMatchRate !== undefined && (yearMatchRate < 0 || yearMatchRate > 100)) {
    throw new Error('Year match rate must be between 0 and 100');
  }
  if (sampleSize !== undefined && sampleSize < 0) {
    throw new Error('Sample size cannot be negative');
  }

  const warnings: string[] = [];

  // Calculate base score from source count
  let baseScore: number;
  if (sourceCount >= 3) {
    baseScore = 95; // Mid-point of 90-100 range
  } else if (sourceCount === 2) {
    baseScore = 80; // Mid-point of 70-89 range
  } else if (sourceCount === 1) {
    baseScore = 60; // Mid-point of 50-69 range
  } else {
    // No sources - return 0 confidence
    return {
      score: 0,
      warnings: ['No data sources available'],
      factors: {
        baseScore: 0,
        sourceCount: 0,
        dataAgeDays,
        stalenessPenalty: 0,
      },
    };
  }

  // Calculate staleness penalty
  let stalenessPenalty = 0;
  if (dataAgeDays >= 30) {
    stalenessPenalty = 40;
    warnings.push('Data is very stale (30+ days old)');
  } else if (dataAgeDays >= 7) {
    stalenessPenalty = 20;
    warnings.push('Data is stale (7-30 days old)');
  }

  // Calculate year match penalty (for vehicles)
  let yearMatchPenalty: number | undefined;
  if (yearMatchRate !== undefined) {
    yearMatchPenalty = 0;
    if (yearMatchRate < 40) {
      yearMatchPenalty = 40;
      warnings.push(`Low year match rate (${yearMatchRate.toFixed(1)}%)`);
    } else if (yearMatchRate < 70) {
      yearMatchPenalty = 20;
      warnings.push(`Moderate year match rate (${yearMatchRate.toFixed(1)}%)`);
    }
  }

  // Calculate sample size penalty
  let sampleSizePenalty: number | undefined;
  if (sampleSize !== undefined) {
    sampleSizePenalty = 0;
    if (sampleSize < 3) {
      sampleSizePenalty = 30;
      warnings.push(`Very small sample size (${sampleSize} listings)`);
    } else if (sampleSize < 6) {
      sampleSizePenalty = 15;
      warnings.push(`Small sample size (${sampleSize} listings)`);
    }
  }

  // Calculate depreciation penalty
  let depreciationPenalty: number | undefined;
  if (depreciationApplied !== undefined) {
    depreciationPenalty = 0;
    if (depreciationApplied === true) {
      depreciationPenalty = 50;
      warnings.push('Depreciation was applied to newer vehicles');
    }
  }

  // Calculate final score (minimum 0)
  const finalScore = Math.max(
    0,
    baseScore - stalenessPenalty - (yearMatchPenalty || 0) - (sampleSizePenalty || 0) - (depreciationPenalty || 0)
  );

  return {
    score: finalScore,
    warnings,
    factors: {
      baseScore,
      sourceCount,
      dataAgeDays,
      stalenessPenalty,
      yearMatchPenalty,
      sampleSizePenalty,
      depreciationPenalty,
    },
  };
}

/**
 * Determine if data is considered fresh (< 7 days old)
 */
export function isFreshData(dataAgeDays: number): boolean {
  return dataAgeDays < 7;
}

/**
 * Determine if data is considered stale (7-30 days old)
 */
export function isStaleData(dataAgeDays: number): boolean {
  return dataAgeDays >= 7 && dataAgeDays < 30;
}

/**
 * Determine if data is considered very stale (30+ days old)
 */
export function isVeryStaleData(dataAgeDays: number): boolean {
  return dataAgeDays >= 30;
}
