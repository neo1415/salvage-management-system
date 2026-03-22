/**
 * Valuation Query Service
 * 
 * Provides methods to query vehicle valuations from the database.
 * Implements fuzzy year matching (±2 years) when exact matches are not found.
 */

import { db } from '@/lib/db';
import { vehicleValuations } from '@/lib/db/schema/vehicle-valuations';
import { eq, and, sql } from 'drizzle-orm';
import type { ValuationQueryParams, ValuationResult } from '../types';
import { type QualityTier, isValidQualityTier } from './condition-mapping.service';

export class ValuationQueryService {
  /**
   * Query vehicle valuation from database
   * Implements fallback chain: exact match → fuzzy make/model → fuzzy year → not found
   */
  async queryValuation(params: ValuationQueryParams): Promise<ValuationResult> {
    const { make, model, year, conditionCategory } = params;
    const startTime = Date.now();

    // Validate condition parameter if provided
    if (conditionCategory && !isValidQualityTier(conditionCategory)) {
      console.error(`[ValuationQuery] ✗ INVALID CONDITION PARAMETER`, {
        providedCondition: conditionCategory,
        validConditions: ['excellent', 'good', 'fair', 'poor'],
        timestamp: new Date().toISOString(),
      });
      
      return {
        found: false,
        source: 'not_found',
      };
    }

    // Try exact match first
    let conditions = [
      eq(vehicleValuations.make, make),
      eq(vehicleValuations.model, model),
      eq(vehicleValuations.year, year),
    ];

    if (conditionCategory) {
      conditions.push(eq(vehicleValuations.conditionCategory, conditionCategory));
    }

    let results = await db
      .select()
      .from(vehicleValuations)
      .where(and(...conditions));

    // If exact match found, return it
    if (results.length > 0) {
      const valuation = results[0];
      const queryTime = Date.now() - startTime;
      
      console.log(`[ValuationQuery] ✓ Exact match SUCCESS`, {
        input: { make, model, year, conditionCategory },
        matchType: 'exact',
        queryTime: `${queryTime}ms`,
        timestamp: new Date().toISOString(),
      });
      
      if (queryTime > 200) {
        console.warn(`[ValuationQuery] ⚠️ PERFORMANCE WARNING: Slow query detected`, {
          queryTime: `${queryTime}ms`,
          threshold: '200ms',
          matchType: 'exact',
          input: { make, model, year },
        });
      }

      return {
        found: true,
        valuation: {
          lowPrice: parseFloat(valuation.lowPrice),
          highPrice: parseFloat(valuation.highPrice),
          averagePrice: parseFloat(valuation.averagePrice),
          mileageLow: valuation.mileageLow ?? undefined,
          mileageHigh: valuation.mileageHigh ?? undefined,
          marketNotes: valuation.marketNotes ?? undefined,
          conditionCategory: valuation.conditionCategory as QualityTier,
        },
        source: 'database',
        matchType: 'exact',
      };
    }

    // Try fuzzy make/model matching
    console.log(`[ValuationQuery] Exact match failed, attempting fuzzy make/model match`, {
      input: { make, model, year, conditionCategory },
      timestamp: new Date().toISOString(),
    });
    
    const fuzzyMakeModelResult = await this.fuzzyMakeModelMatch(make, model, year, conditionCategory);
    
    if (fuzzyMakeModelResult.found) {
      const queryTime = Date.now() - startTime;
      
      console.log(`[ValuationQuery] ✓ Fuzzy make/model match SUCCESS`, {
        input: { make, model, year },
        matched: fuzzyMakeModelResult.matchedValues,
        similarityScore: fuzzyMakeModelResult.similarityScore?.toFixed(3),
        matchType: 'fuzzy_make_model',
        queryTime: `${queryTime}ms`,
        timestamp: new Date().toISOString(),
      });

      if (queryTime > 200) {
        console.warn(`[ValuationQuery] ⚠️ PERFORMANCE WARNING: Slow query detected`, {
          queryTime: `${queryTime}ms`,
          threshold: '200ms',
          matchType: 'fuzzy_make_model',
          input: { make, model, year },
        });
      }

      return fuzzyMakeModelResult;
    }
    
    console.log(`[ValuationQuery] ✗ Fuzzy make/model match FAILED`, {
      input: { make, model, year },
      reason: 'No matches found or similarity score below threshold (0.6)',
      timestamp: new Date().toISOString(),
    });

    // Try fuzzy year matching (±2 years)
    console.log(`[ValuationQuery] Fuzzy make/model failed, attempting fuzzy year match (±2 years)`, {
      input: { make, model, year, conditionCategory },
      yearRange: { min: year - 2, max: year + 2 },
      timestamp: new Date().toISOString(),
    });
    
    const fuzzyYearResult = await this.fuzzyYearMatch(make, model, year, conditionCategory);
    
    if (fuzzyYearResult.found) {
      const queryTime = Date.now() - startTime;
      
      console.log(`[ValuationQuery] ✓ Fuzzy year match SUCCESS`, {
        input: { make, model, year },
        matched: fuzzyYearResult.matchedValues,
        matchType: 'fuzzy_year',
        queryTime: `${queryTime}ms`,
        timestamp: new Date().toISOString(),
      });

      if (queryTime > 200) {
        console.warn(`[ValuationQuery] ⚠️ PERFORMANCE WARNING: Slow query detected`, {
          queryTime: `${queryTime}ms`,
          threshold: '200ms',
          matchType: 'fuzzy_year',
          input: { make, model, year },
        });
      }

      return {
        ...fuzzyYearResult,
        matchType: 'fuzzy_year',
      };
    }
    
    console.log(`[ValuationQuery] ✗ Fuzzy year match FAILED`, {
      input: { make, model, year },
      yearRange: { min: year - 2, max: year + 2 },
      reason: 'No matches found within ±2 years',
      timestamp: new Date().toISOString(),
    });

    // No match found
    const queryTime = Date.now() - startTime;
    console.log(`[ValuationQuery] ✗ NO MATCH FOUND - All strategies exhausted`, {
      input: { make, model, year, conditionCategory },
      attemptedStrategies: ['exact', 'fuzzy_make_model', 'fuzzy_year'],
      queryTime: `${queryTime}ms`,
      timestamp: new Date().toISOString(),
      recommendation: 'Will fallback to web scraping',
    });

    return {
      found: false,
      source: 'not_found',
    };
  }

  /**
   * Normalize string for fuzzy matching
   * - Convert to lowercase
   * - Trim whitespace
   * - Remove hyphens and special characters
   * - Collapse multiple spaces to single space
   */
  private normalizeString(input: string): string {
    return input
      .toLowerCase()
      .trim()
      .replace(/[-_]/g, ' ') // Replace hyphens and underscores with spaces
      .replace(/[^\w\s]/g, '') // Remove special characters except word chars and spaces
      .replace(/\s+/g, ' ') // Collapse multiple spaces to single space
      .trim(); // Final trim to remove any leading/trailing spaces
  }

  /**
   * Calculate similarity score between two strings using Levenshtein distance
   * Returns score from 0 (no match) to 1 (exact match)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = this.normalizeString(str1);
    const s2 = this.normalizeString(str2);

    if (s1 === s2) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0.0;

    // Levenshtein distance algorithm
    const matrix: number[][] = [];

    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    const distance = matrix[s2.length][s1.length];
    const maxLength = Math.max(s1.length, s2.length);
    return 1 - distance / maxLength;
  }

  /**
   * Fuzzy match make and model using PostgreSQL ILIKE and similarity scoring
   * Returns best match with similarity score
   */
  private async fuzzyMakeModelMatch(
    make: string,
    model: string,
    year: number,
    conditionCategory?: QualityTier
  ): Promise<ValuationResult & { similarityScore?: number }> {
    const normalizedMake = this.normalizeString(make);
    const normalizedModel = this.normalizeString(model);

    console.log(`[ValuationQuery] Fuzzy matching - normalized input`, {
      original: { make, model },
      normalized: { make: normalizedMake, model: normalizedModel },
    });

    // Build ILIKE patterns for partial matching
    const makePattern = `%${normalizedMake.replace(/\s/g, '%')}%`;
    const modelPattern = `%${normalizedModel.replace(/\s/g, '%')}%`;

    console.log(`[ValuationQuery] Fuzzy matching - ILIKE patterns`, {
      makePattern,
      modelPattern,
    });

    // Query with ILIKE for case-insensitive partial matching
    let conditions = [
      sql`LOWER(REPLACE(REPLACE(${vehicleValuations.make}, '-', ' '), '_', ' ')) ILIKE ${makePattern}`,
      sql`LOWER(REPLACE(REPLACE(${vehicleValuations.model}, '-', ' '), '_', ' ')) ILIKE ${modelPattern}`,
      eq(vehicleValuations.year, year),
    ];

    if (conditionCategory) {
      conditions.push(eq(vehicleValuations.conditionCategory, conditionCategory));
    }

    const results = await db
      .select()
      .from(vehicleValuations)
      .where(and(...conditions));

    console.log(`[ValuationQuery] Fuzzy matching - ILIKE query returned ${results.length} candidates`);

    if (results.length === 0) {
      return {
        found: false,
        source: 'not_found',
      };
    }

    // Calculate similarity scores for all matches
    const scoredResults = results.map(result => {
      const makeScore = this.calculateSimilarity(make, result.make);
      const modelScore = this.calculateSimilarity(model, result.model);
      const combinedScore = (makeScore + modelScore) / 2;

      return {
        result,
        makeScore,
        modelScore,
        similarityScore: combinedScore,
      };
    });

    // Log all candidates with their similarity scores
    console.log(`[ValuationQuery] Fuzzy matching - similarity scores for all candidates:`, 
      scoredResults.map(item => ({
        make: item.result.make,
        model: item.result.model,
        makeScore: item.makeScore.toFixed(3),
        modelScore: item.modelScore.toFixed(3),
        combinedScore: item.similarityScore.toFixed(3),
      }))
    );

    // Filter by threshold (≥ 0.6) and find best match
    const validMatches = scoredResults.filter(item => item.similarityScore >= 0.6);

    console.log(`[ValuationQuery] Fuzzy matching - ${validMatches.length} candidates above threshold (0.6)`);

    if (validMatches.length === 0) {
      console.log(`[ValuationQuery] Fuzzy matching - all candidates below similarity threshold`, {
        threshold: 0.6,
        bestScore: scoredResults.length > 0 ? Math.max(...scoredResults.map(r => r.similarityScore)).toFixed(3) : 'N/A',
      });
      
      return {
        found: false,
        source: 'not_found',
      };
    }

    // Return match with highest similarity score
    const bestMatch = validMatches.reduce((prev, curr) =>
      curr.similarityScore > prev.similarityScore ? curr : prev
    );

    console.log(`[ValuationQuery] Fuzzy matching - selected best match`, {
      matched: {
        make: bestMatch.result.make,
        model: bestMatch.result.model,
        year: bestMatch.result.year,
      },
      scores: {
        makeScore: bestMatch.makeScore.toFixed(3),
        modelScore: bestMatch.modelScore.toFixed(3),
        combinedScore: bestMatch.similarityScore.toFixed(3),
      },
    });

    const valuation = bestMatch.result;

    return {
      found: true,
      valuation: {
        lowPrice: parseFloat(valuation.lowPrice),
        highPrice: parseFloat(valuation.highPrice),
        averagePrice: parseFloat(valuation.averagePrice),
        mileageLow: valuation.mileageLow ?? undefined,
        mileageHigh: valuation.mileageHigh ?? undefined,
        marketNotes: valuation.marketNotes ?? undefined,
        conditionCategory: valuation.conditionCategory as QualityTier,
      },
      source: 'database',
      matchType: 'fuzzy_make_model',
      similarityScore: bestMatch.similarityScore,
      matchedValues: {
        make: valuation.make,
        model: valuation.model,
        year: valuation.year,
      },
    };
  }

  /**
   * Fuzzy year matching: find closest year within ±2 years
   */
  private async fuzzyYearMatch(
    make: string,
    model: string,
    targetYear: number,
    conditionCategory?: QualityTier
  ): Promise<ValuationResult> {
    const minYear = targetYear - 2;
    const maxYear = targetYear + 2;

    console.log(`[ValuationQuery] Fuzzy year matching - searching range`, {
      targetYear,
      range: { min: minYear, max: maxYear },
    });

    let conditions = [
      eq(vehicleValuations.make, make),
      eq(vehicleValuations.model, model),
      sql`${vehicleValuations.year} >= ${minYear}`,
      sql`${vehicleValuations.year} <= ${maxYear}`,
    ];

    if (conditionCategory) {
      conditions.push(eq(vehicleValuations.conditionCategory, conditionCategory));
    }

    const results = await db
      .select()
      .from(vehicleValuations)
      .where(and(...conditions));

    console.log(`[ValuationQuery] Fuzzy year matching - found ${results.length} candidates in range`);

    if (results.length === 0) {
      return {
        found: false,
        source: 'not_found',
      };
    }

    // Log all candidate years with their distance from target
    const yearCandidates = results.map(r => ({
      year: r.year,
      distance: Math.abs(r.year - targetYear),
    }));
    
    console.log(`[ValuationQuery] Fuzzy year matching - candidate years:`, yearCandidates);

    // Find closest year
    const closest = results.reduce((prev, curr) => {
      const prevDiff = Math.abs(prev.year - targetYear);
      const currDiff = Math.abs(curr.year - targetYear);
      return currDiff < prevDiff ? curr : prev;
    });

    console.log(`[ValuationQuery] Fuzzy year matching - selected closest year`, {
      targetYear,
      matchedYear: closest.year,
      yearDifference: Math.abs(closest.year - targetYear),
    });

    return {
      found: true,
      valuation: {
        lowPrice: parseFloat(closest.lowPrice),
        highPrice: parseFloat(closest.highPrice),
        averagePrice: parseFloat(closest.averagePrice),
        mileageLow: closest.mileageLow ?? undefined,
        mileageHigh: closest.mileageHigh ?? undefined,
        marketNotes: closest.marketNotes ?? undefined,
        conditionCategory: closest.conditionCategory as QualityTier,
      },
      source: 'database',
      matchedValues: {
        make: closest.make,
        model: closest.model,
        year: closest.year,
      },
    };
  }

  /**
   * Get all available years for a make/model
   */
  async getAvailableYears(make: string, model: string): Promise<number[]> {
    const results = await db
      .selectDistinct({ year: vehicleValuations.year })
      .from(vehicleValuations)
      .where(
        and(
          eq(vehicleValuations.make, make),
          eq(vehicleValuations.model, model)
        )
      )
      .orderBy(vehicleValuations.year);

    return results.map(r => r.year);
  }

  /**
   * Get all makes in database
   */
  async getAllMakes(): Promise<string[]> {
    const results = await db
      .selectDistinct({ make: vehicleValuations.make })
      .from(vehicleValuations)
      .orderBy(vehicleValuations.make);

    return results.map(r => r.make);
  }

  /**
   * Get all models for a make
   */
  async getModelsForMake(make: string): Promise<string[]> {
    const results = await db
      .selectDistinct({ model: vehicleValuations.model })
      .from(vehicleValuations)
      .where(eq(vehicleValuations.make, make))
      .orderBy(vehicleValuations.model);

    return results.map(r => r.model);
  }
}

// Export singleton instance
export const valuationQueryService = new ValuationQueryService();
