/**
 * PredictionService
 * 
 * Enterprise-grade auction price prediction service using SQL-based algorithms.
 * Implements similarity matching, weighted averages, market adjustments, and cold-start strategies.
 * 
 * Security: All queries use parameterized statements to prevent SQL injection.
 * Performance: Sub-200ms response time with Redis caching.
 * 
 * @module intelligence/services/prediction
 */

import { db } from '@/lib/db';
import { eq, and, sql, desc, gte, lte, isNotNull } from 'drizzle-orm';
import { 
  predictions, 
  algorithmConfig,
} from '@/lib/db/schema/intelligence';
import { 
  assetPerformanceAnalytics,
  attributePerformanceAnalytics,
  temporalPatternsAnalytics,
  geographicPatternsAnalytics,
} from '@/lib/db/schema/analytics';
import { predictionLogs } from '@/lib/db/schema/ml-training';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { bids } from '@/lib/db/schema/bids';
import { getCached, setCached, CACHE_KEYS, CACHE_TTL } from '@/lib/cache/redis';

/**
 * Prediction result interface
 */
export interface PredictionResult {
  auctionId: string;
  predictedPrice: number;
  lowerBound: number;
  upperBound: number;
  confidenceScore: number;
  confidenceLevel: 'High' | 'Medium' | 'Low';
  method: string;
  sampleSize: number;
  metadata: {
    similarAuctions?: number;
    marketAdjustment?: number;
    competitionLevel?: string;
    seasonalFactor?: number;
    warnings?: string[];
    notes?: string[];
  };
  algorithmVersion: string;
  createdAt: Date;
}

/**
 * Similar auction data structure
 */
interface SimilarAuction {
  auctionId: string;
  finalPrice: number;
  similarityScore: number;
  timeWeight: number;
  bidCount: number;
  damageSeverity: string;
  marketValue: number;
  endTime: Date;
}

/**
 * Market conditions data structure
 */
interface MarketConditions {
  competitionMultiplier: number;
  trendMultiplier: number;
  seasonalMultiplier: number;
  competitionLevel: string;
}

/**
 * Configuration interface
 */
interface PredictionConfig {
  similarityThreshold: number;
  timeDecayMonths: number;
  minSampleSize: number;
  confidenceBase: number;
}

export class PredictionService {
  private readonly ALGORITHM_VERSION = 'v1.0';
  private readonly CACHE_TTL_SECONDS = 300; // 5 minutes

  /**
   * Generate price prediction for an auction
   * Task 2.4.2: Implement prediction caching in Redis (5-min TTL)
   * 
   * @param auctionId - UUID of the auction
   * @returns Prediction result with price range and confidence
   */
  async generatePrediction(auctionId: string): Promise<PredictionResult> {
    // Validate input
    if (!auctionId || typeof auctionId !== 'string') {
      throw new Error('Invalid auction ID');
    }

    // Task 2.4.2: Check Redis cache first
    const cacheKey = `${CACHE_KEYS.PREDICTION}:${auctionId}`;
    const cachedPrediction = await getCached<PredictionResult>(cacheKey);
    
    if (cachedPrediction) {
      return cachedPrediction;
    }

    // Load configuration
    const config = await this.loadConfig();

    // Get auction and case details
    const auctionData = await this.getAuctionData(auctionId);
    if (!auctionData) {
      throw new Error('Auction not found');
    }

    // Try historical prediction first
    const historicalResult = await this.generateHistoricalPrediction(
      auctionData,
      config
    );

    if (historicalResult) {
      // Store prediction
      await this.storePrediction(auctionId, historicalResult);
      
      // Task 2.4.4: Log prediction to prediction_logs
      await this.logPrediction(auctionId, historicalResult, auctionData);
      
      // Task 2.4.2: Cache result in Redis
      await setCached(cacheKey, historicalResult, CACHE_TTL.PREDICTION);
      
      return historicalResult;
    }

    // Fallback to cold-start strategies
    const fallbackResult = await this.generateFallbackPrediction(
      auctionData,
      config
    );

    // Store prediction
    await this.storePrediction(auctionId, fallbackResult);
    
    // Task 2.4.4: Log prediction to prediction_logs
    await this.logPrediction(auctionId, fallbackResult, auctionData);
    
    // Task 2.4.2: Cache result in Redis
    await setCached(cacheKey, fallbackResult, CACHE_TTL.PREDICTION);
    
    return fallbackResult;
  }

  /**
   * Load algorithm configuration from database
   */
  private async loadConfig(): Promise<PredictionConfig> {
    const configs = await db
      .select()
      .from(algorithmConfig)
      .where(eq(algorithmConfig.isActive, true));

    const configMap = new Map(
      configs.map(c => [c.configKey, c.configValue])
    );

    return {
      similarityThreshold: Number(configMap.get('prediction.similarity_threshold') ?? 60),
      timeDecayMonths: Number(configMap.get('prediction.time_decay_months') ?? 6),
      minSampleSize: Number(configMap.get('prediction.min_sample_size') ?? 5),
      confidenceBase: Number(configMap.get('prediction.confidence_base') ?? 0.85),
    };
  }

  /**
   * Get auction and salvage case data
   */
  private async getAuctionData(auctionId: string) {
    const result = await db
      .select({
        auctionId: auctions.id,
        caseId: auctions.caseId,
        currentBid: auctions.currentBid,
        reservePrice: salvageCases.reservePrice,
        watchingCount: auctions.watchingCount,
        extensionCount: auctions.extensionCount,
        status: auctions.status,
        assetType: salvageCases.assetType,
        assetDetails: salvageCases.assetDetails,
        damageSeverity: salvageCases.damageSeverity,
        marketValue: salvageCases.marketValue,
        estimatedSalvageValue: salvageCases.estimatedSalvageValue,
        aiAssessment: salvageCases.aiAssessment,
      })
      .from(auctions)
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .where(eq(auctions.id, auctionId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Generate prediction using historical data
   * Task 2.1.1, 2.1.2, 2.1.3: Similarity matching for vehicles, electronics, machinery
   * Task 2.2.3-2.2.7: Enhanced with analytics integrations
   */
  private async generateHistoricalPrediction(
    auctionData: any,
    config: PredictionConfig
  ): Promise<PredictionResult | null> {
    // Find similar historical auctions
    const similarAuctions = await this.findSimilarAuctions(
      auctionData,
      config
    );

    if (similarAuctions.length === 0) {
      return null; // No historical data available
    }

    // Task 2.1.4: Calculate weighted average with time decay
    const weightedPrice = this.calculateWeightedAverage(similarAuctions);

    // Task 2.1.5: Apply market condition adjustments
    const marketConditions = await this.getMarketConditions(auctionData.assetType);
    let adjustedPrice = weightedPrice * marketConditions.competitionMultiplier * 
                          marketConditions.trendMultiplier * 
                          marketConditions.seasonalMultiplier;

    // Task 2.2.3: Apply asset demand adjustments
    const assetDetails = auctionData.assetDetails || {};
    const demandAdjustment = await this.getAssetDemandAdjustment(
      auctionData.assetType,
      assetDetails.make || assetDetails.brand || assetDetails.manufacturer,
      assetDetails.model
    );
    adjustedPrice *= demandAdjustment;

    // Task 2.2.4: Apply attribute adjustments (color/trim)
    const attributeAdjustment = await this.getAttributeAdjustments(
      auctionData.assetType,
      assetDetails.color,
      assetDetails.trim
    );
    adjustedPrice *= attributeAdjustment;

    // Task 2.2.5: Apply temporal pattern adjustments
    const temporalAdjustment = await this.getTemporalAdjustment(auctionData.assetType);
    adjustedPrice *= temporalAdjustment.priceMultiplier;

    // Task 2.2.6: Apply geographic adjustments
    const region = auctionData.region || auctionData.assetDetails?.region;
    const geoAdjustment = await this.getGeographicAdjustment(auctionData.assetType, region);
    adjustedPrice *= geoAdjustment.demandMultiplier;

    // Task 2.1.6: Calculate confidence score
    let confidenceScore = this.calculateConfidenceScore(
      similarAuctions,
      config
    );

    // Task 2.2.7: Enhance confidence score with data quality factors
    confidenceScore = this.enhanceConfidenceScore(
      confidenceScore,
      similarAuctions,
      temporalAdjustment.confidenceAdjustment
    );

    // Task 2.1.7: Calculate confidence intervals with geographic variance
    const { lowerBound, upperBound } = this.calculateConfidenceIntervals(
      adjustedPrice,
      confidenceScore,
      auctionData.reservePrice,
      geoAdjustment.priceVariance
    );

    // Determine confidence level
    const confidenceLevel = this.getConfidenceLevel(confidenceScore);

    return {
      auctionId: auctionData.auctionId,
      predictedPrice: Math.round(adjustedPrice),
      lowerBound: Math.round(lowerBound),
      upperBound: Math.round(upperBound),
      confidenceScore: Number(confidenceScore.toFixed(4)),
      confidenceLevel,
      method: 'historical',
      sampleSize: similarAuctions.length,
      metadata: {
        similarAuctions: similarAuctions.length,
        marketAdjustment: Number((marketConditions.competitionMultiplier * 
                                  marketConditions.trendMultiplier * 
                                  marketConditions.seasonalMultiplier *
                                  demandAdjustment *
                                  attributeAdjustment *
                                  temporalAdjustment.priceMultiplier *
                                  geoAdjustment.demandMultiplier).toFixed(2)),
        competitionLevel: marketConditions.competitionLevel,
        seasonalFactor: marketConditions.seasonalMultiplier,
        notes: this.generatePredictionNotes(auctionData, similarAuctions),
      },
      algorithmVersion: this.ALGORITHM_VERSION,
      createdAt: new Date(),
    };
  }

  /**
   * Find similar historical auctions using SQL-based similarity matching
   * Implements Tasks 2.1.1, 2.1.2, 2.1.3, 2.2.1, 2.2.2
   */
  private async findSimilarAuctions(
    auctionData: any,
    config: PredictionConfig
  ): Promise<SimilarAuction[]> {
    const assetType = auctionData.assetType;
    const assetDetails = auctionData.assetDetails || {};
    const targetMake = assetDetails.make;
    const targetModel = assetDetails.model;
    const targetYear = assetDetails.year ? parseInt(assetDetails.year) : null;
    const targetDamage = auctionData.damageSeverity;
    const targetMarketValue = auctionData.marketValue || 0;
    const targetColor = assetDetails.color; // Task 2.2.1
    const targetTrim = assetDetails.trim; // Task 2.2.2

    // Calculate date threshold for time decay (12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const twelveMonthsAgoISO = twelveMonthsAgo.toISOString();

    // Build similarity query based on asset type
    const query = sql`
      WITH similar_auctions AS (
        SELECT 
          a.id AS auction_id,
          a.current_bid AS final_price,
          sc.asset_details,
          sc.damage_severity,
          sc.market_value,
          a.end_time,
          COUNT(b.id) AS bid_count,
          ${this.buildSimilarityScoreSQL(assetType, targetMake, targetModel, targetYear, targetDamage, targetMarketValue, targetColor, targetTrim)} AS similarity_score,
          EXP(-EXTRACT(EPOCH FROM (NOW() - a.end_time)) / (${config.timeDecayMonths} * 30 * 24 * 60 * 60)) AS time_weight
        FROM ${auctions} a
        INNER JOIN ${salvageCases} sc ON a.case_id = sc.id
        LEFT JOIN ${bids} b ON b.auction_id = a.id
        WHERE 
          a.status = 'closed'
          AND a.current_bid IS NOT NULL
          AND sc.asset_type = ${assetType}
          AND a.end_time > ${twelveMonthsAgoISO}
          AND a.id != ${auctionData.auctionId}
        GROUP BY a.id, sc.id
      )
      SELECT * FROM similar_auctions
      WHERE similarity_score >= ${config.similarityThreshold}
      ORDER BY similarity_score DESC, time_weight DESC
      LIMIT 50
    `;

    const results: any = await db.execute(query);

    return (results as any[]).map(row => ({
      auctionId: row.auction_id,
      finalPrice: parseFloat(row.final_price),
      similarityScore: parseFloat(row.similarity_score),
      timeWeight: parseFloat(row.time_weight),
      bidCount: parseInt(row.bid_count),
      damageSeverity: row.damage_severity,
      marketValue: parseFloat(row.market_value),
      endTime: new Date(row.end_time),
    }));
  }

  /**
   * Build similarity score SQL based on asset type
   * Task 2.1.1: Vehicles, Task 2.1.2: Electronics, Task 2.1.3: Machinery
   * Task 2.2.1: Color matching (+5 points)
   * Task 2.2.2: Trim level matching (+8 points)
   */
  private buildSimilarityScoreSQL(
    assetType: string,
    targetMake: string | undefined,
    targetModel: string | undefined,
    targetYear: number | null,
    targetDamage: string,
    targetMarketValue: number,
    targetColor?: string,
    targetTrim?: string
  ) {
    // Convert targetMarketValue to a proper numeric value for SQL
    const marketValueNumeric = Number(targetMarketValue) || 0;
    
    if (assetType === 'vehicle') {
      return sql`
        (
          CASE 
            WHEN sc.asset_details->>'make' = ${targetMake || ''} 
             AND sc.asset_details->>'model' = ${targetModel || ''} THEN 100
            WHEN sc.asset_details->>'make' = ${targetMake || ''} THEN 50
            ELSE 0
          END +
          CASE 
            WHEN (sc.asset_details->>'year')::int = ${targetYear || 0} THEN 20
            WHEN ABS((sc.asset_details->>'year')::int - ${targetYear || 0}) = 1 THEN 15
            WHEN ABS((sc.asset_details->>'year')::int - ${targetYear || 0}) = 2 THEN 10
            ELSE 0
          END +
          CASE 
            WHEN sc.damage_severity = ${targetDamage} THEN 30
            WHEN (
              (sc.damage_severity = 'minor' AND ${targetDamage} = 'moderate') OR
              (sc.damage_severity = 'moderate' AND ${targetDamage} IN ('minor', 'severe')) OR
              (sc.damage_severity = 'severe' AND ${targetDamage} = 'moderate')
            ) THEN 15
            ELSE 0
          END +
          CASE 
            WHEN ABS(sc.market_value::numeric - ${marketValueNumeric}::numeric) / NULLIF(${marketValueNumeric}::numeric, 0) < 0.2 THEN 10
            ELSE 0
          END +
          CASE 
            WHEN ${targetColor ? sql`sc.asset_details->>'color' = ${targetColor}` : sql`FALSE`} THEN 5
            ELSE 0
          END +
          CASE 
            WHEN ${targetTrim ? sql`sc.asset_details->>'trim' = ${targetTrim}` : sql`FALSE`} THEN 8
            ELSE 0
          END
        )
      `;
    } else if (assetType === 'electronics') {
      return sql`
        (
          CASE 
            WHEN sc.asset_details->>'brand' = ${targetMake || ''} 
             AND sc.asset_details->>'model' = ${targetModel || ''} THEN 100
            WHEN sc.asset_details->>'brand' = ${targetMake || ''} THEN 50
            ELSE 0
          END +
          CASE 
            WHEN sc.asset_details->>'category' = ${targetModel || ''} THEN 25
            ELSE 0
          END +
          CASE 
            WHEN sc.damage_severity = ${targetDamage} THEN 30
            WHEN (
              (sc.damage_severity = 'minor' AND ${targetDamage} = 'moderate') OR
              (sc.damage_severity = 'moderate' AND ${targetDamage} IN ('minor', 'severe')) OR
              (sc.damage_severity = 'severe' AND ${targetDamage} = 'moderate')
            ) THEN 15
            ELSE 0
          END +
          CASE 
            WHEN ABS(sc.market_value::numeric - ${marketValueNumeric}::numeric) / NULLIF(${marketValueNumeric}::numeric, 0) < 0.2 THEN 10
            ELSE 0
          END +
          CASE 
            WHEN ${targetColor ? sql`sc.asset_details->>'color' = ${targetColor}` : sql`FALSE`} THEN 5
            ELSE 0
          END
        )
      `;
    } else if (assetType === 'machinery') {
      return sql`
        (
          CASE 
            WHEN sc.asset_details->>'manufacturer' = ${targetMake || ''} 
             AND sc.asset_details->>'model' = ${targetModel || ''} THEN 100
            WHEN sc.asset_details->>'manufacturer' = ${targetMake || ''} THEN 50
            ELSE 0
          END +
          CASE 
            WHEN sc.asset_details->>'type' = ${targetModel || ''} THEN 25
            ELSE 0
          END +
          CASE 
            WHEN sc.damage_severity = ${targetDamage} THEN 30
            WHEN (
              (sc.damage_severity = 'minor' AND ${targetDamage} = 'moderate') OR
              (sc.damage_severity = 'moderate' AND ${targetDamage} IN ('minor', 'severe')) OR
              (sc.damage_severity = 'severe' AND ${targetDamage} = 'moderate')
            ) THEN 15
            ELSE 0
          END +
          CASE 
            WHEN ABS(sc.market_value::numeric - ${marketValueNumeric}::numeric) / NULLIF(${marketValueNumeric}::numeric, 0) < 0.2 THEN 10
            ELSE 0
          END
        )
      `;
    } else {
      // Generic similarity for other asset types
      return sql`
        (
          CASE 
            WHEN sc.damage_severity = ${targetDamage} THEN 50
            WHEN (
              (sc.damage_severity = 'minor' AND ${targetDamage} = 'moderate') OR
              (sc.damage_severity = 'moderate' AND ${targetDamage} IN ('minor', 'severe')) OR
              (sc.damage_severity = 'severe' AND ${targetDamage} = 'moderate')
            ) THEN 25
            ELSE 0
          END +
          CASE 
            WHEN ABS(sc.market_value::numeric - ${marketValueNumeric}::numeric) / NULLIF(${marketValueNumeric}::numeric, 0) < 0.2 THEN 30
            WHEN ABS(sc.market_value::numeric - ${marketValueNumeric}::numeric) / NULLIF(${marketValueNumeric}::numeric, 0) < 0.4 THEN 15
            ELSE 0
          END
        )
      `;
    }
  }

  /**
   * Calculate weighted average of similar auction prices
   * Task 2.1.4: Weighted average calculation with time decay
   */
  private calculateWeightedAverage(similarAuctions: SimilarAuction[]): number {
    if (similarAuctions.length === 0) {
      return 0;
    }

    let totalWeightedPrice = 0;
    let totalWeight = 0;

    for (const auction of similarAuctions) {
      // Normalize similarity score to 0-1.6 range
      const similarityWeight = auction.similarityScore / 100.0;
      const combinedWeight = similarityWeight * auction.timeWeight;

      totalWeightedPrice += auction.finalPrice * combinedWeight;
      totalWeight += combinedWeight;
    }

    return totalWeight > 0 ? totalWeightedPrice / totalWeight : 0;
  }

  /**
   * Get market conditions and calculate adjustment multipliers
   * Task 2.1.5: Market condition adjustments (competition, trend, seasonal)
   */
  private async getMarketConditions(assetType: string): Promise<MarketConditions> {
    // Calculate recent market metrics (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const ninetyDaysAgoISO = ninetyDaysAgo.toISOString();

    const recentMetrics: any = await db.execute(sql`
      WITH recent_auctions AS (
        SELECT 
          a.id,
          a.current_bid,
          COUNT(b.id) AS bid_count
        FROM ${auctions} a
        LEFT JOIN ${bids} b ON b.auction_id = a.id
        INNER JOIN ${salvageCases} sc ON a.case_id = sc.id
        WHERE a.status = 'closed'
          AND a.end_time > ${thirtyDaysAgoISO}
          AND sc.asset_type = ${assetType}
        GROUP BY a.id
      ),
      historical_auctions AS (
        SELECT 
          a.id,
          a.current_bid,
          COUNT(b.id) AS bid_count
        FROM ${auctions} a
        LEFT JOIN ${bids} b ON b.auction_id = a.id
        INNER JOIN ${salvageCases} sc ON a.case_id = sc.id
        WHERE a.status = 'closed'
          AND a.end_time BETWEEN ${ninetyDaysAgoISO} AND ${thirtyDaysAgoISO}
          AND sc.asset_type = ${assetType}
        GROUP BY a.id
      )
      SELECT 
        AVG(ra.bid_count) AS avg_bids_recent,
        (SELECT AVG(bid_count) FROM historical_auctions) AS avg_bids_historical,
        AVG(ra.current_bid) AS avg_price_recent,
        (SELECT AVG(current_bid) FROM historical_auctions) AS avg_price_historical
      FROM recent_auctions ra
    `);

    const metrics = recentMetrics[0] as any;

    // Calculate competition multiplier
    const avgBidsRecent = parseFloat(metrics?.avg_bids_recent || '0');
    const avgBidsHistorical = parseFloat(metrics?.avg_bids_historical || '0');
    
    let competitionMultiplier = 1.0;
    let competitionLevel = 'normal';

    if (avgBidsHistorical > 0) {
      const bidRatio = avgBidsRecent / avgBidsHistorical;
      if (bidRatio > 1.3) {
        competitionMultiplier = 1.15;
        competitionLevel = 'high';
      } else if (bidRatio > 1.1) {
        competitionMultiplier = 1.08;
        competitionLevel = 'moderate_high';
      } else if (bidRatio < 0.7) {
        competitionMultiplier = 0.85;
        competitionLevel = 'low';
      } else if (bidRatio < 0.9) {
        competitionMultiplier = 0.92;
        competitionLevel = 'moderate_low';
      }
    }

    // Calculate trend multiplier
    const avgPriceRecent = parseFloat(metrics?.avg_price_recent || '0');
    const avgPriceHistorical = parseFloat(metrics?.avg_price_historical || '0');
    
    let trendMultiplier = 1.0;

    if (avgPriceHistorical > 0) {
      const priceRatio = avgPriceRecent / avgPriceHistorical;
      if (priceRatio > 1.2) {
        trendMultiplier = 1.10;
      } else if (priceRatio > 1.05) {
        trendMultiplier = 1.05;
      } else if (priceRatio < 0.8) {
        trendMultiplier = 0.90;
      } else if (priceRatio < 0.95) {
        trendMultiplier = 0.95;
      }
    }

    // Calculate seasonal multiplier
    const currentMonth = new Date().getMonth() + 1; // 1-12
    let seasonalMultiplier = 1.0;

    if ([1, 2, 12].includes(currentMonth)) {
      seasonalMultiplier = 0.95; // Winter slowdown
    } else if ([4, 5, 6].includes(currentMonth)) {
      seasonalMultiplier = 1.05; // Spring/summer boost
    }

    return {
      competitionMultiplier,
      trendMultiplier,
      seasonalMultiplier,
      competitionLevel,
    };
  }

  /**
   * Calculate confidence score based on data quality
   * Task 2.1.6: Confidence score calculation
   */
  private calculateConfidenceScore(
    similarAuctions: SimilarAuction[],
    config: PredictionConfig
  ): number {
    if (similarAuctions.length === 0) {
      return 0;
    }

    // Base confidence
    const baseConfidence = config.confidenceBase;

    // Sample size factor
    const sampleSizeFactor = Math.min(1.0, similarAuctions.length / 10);

    // Recency factor (average time weight)
    const recencyFactor = similarAuctions.reduce((sum, a) => sum + a.timeWeight, 0) / similarAuctions.length;

    // Variance factor
    const prices = similarAuctions.map(a => a.finalPrice);
    const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
    const stddev = Math.sqrt(variance);
    const varianceFactor = mean > 0 ? 1 / (1 + (stddev / mean)) : 0.5;

    // Combined confidence score
    const confidenceScore = baseConfidence * sampleSizeFactor * recencyFactor * varianceFactor;

    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, confidenceScore));
  }

  /**
   * Enhance confidence score with data quality factors
   * Task 2.2.7: Implement enhanced confidence score with data quality factors
   */
  private enhanceConfidenceScore(
    baseConfidence: number,
    similarAuctions: SimilarAuction[],
    temporalAdjustment: number
  ): number {
    let enhancedConfidence = baseConfidence;

    // Factor 1: Number of similar auctions found (more = higher confidence)
    const sampleSizeBonus = Math.min(0.1, (similarAuctions.length / 20) * 0.1);
    enhancedConfidence += sampleSizeBonus;

    // Factor 2: Recency of data (newer = higher confidence)
    const avgRecency = similarAuctions.reduce((sum, a) => sum + a.timeWeight, 0) / similarAuctions.length;
    const recencyBonus = (avgRecency - 0.5) * 0.1; // -0.05 to +0.05
    enhancedConfidence += recencyBonus;

    // Factor 3: Completeness of asset attributes
    const completenessScore = similarAuctions.reduce((sum, a) => {
      let score = 0;
      if (a.damageSeverity) score += 0.25;
      if (a.marketValue > 0) score += 0.25;
      if (a.bidCount > 0) score += 0.25;
      score += 0.25; // Base for having the auction
      return sum + score;
    }, 0) / similarAuctions.length;
    const completenessBonus = (completenessScore - 0.75) * 0.1; // -0.075 to +0.025
    enhancedConfidence += completenessBonus;

    // Factor 4: Market volatility (lower = higher confidence)
    const prices = similarAuctions.map(a => a.finalPrice);
    const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
    const coefficientOfVariation = mean > 0 ? Math.sqrt(variance) / mean : 1;
    const volatilityPenalty = Math.min(0.1, coefficientOfVariation * 0.2);
    enhancedConfidence -= volatilityPenalty;

    // Factor 5: Temporal adjustment from peak activity
    enhancedConfidence += temporalAdjustment;

    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, enhancedConfidence));
  }

  /**
   * Calculate confidence intervals (lower and upper bounds)
   * Task 2.1.7: Confidence interval calculation
   * Task 2.2.6: Enhanced with geographic price variance
   */
  private calculateConfidenceIntervals(
    predictedPrice: number,
    confidenceScore: number,
    reservePrice: number | null,
    geographicVariance: number = 0
  ): { lowerBound: number; upperBound: number } {
    // Calculate interval width based on confidence
    let intervalFactor = (1 - confidenceScore) * 0.3; // 30% max spread

    // Adjust for geographic variance
    if (geographicVariance > 0) {
      const varianceAdjustment = (geographicVariance / predictedPrice) * 0.5;
      intervalFactor += Math.min(0.1, varianceAdjustment); // Max +10% additional spread
    }

    let lowerBound = predictedPrice * (1 - intervalFactor);
    let upperBound = predictedPrice * (1 + intervalFactor);

    // Ensure lower bound is at least the reserve price
    if (reservePrice && lowerBound < reservePrice) {
      lowerBound = reservePrice;
    }

    return { lowerBound, upperBound };
  }

  /**
   * Determine confidence level from score
   */
  private getConfidenceLevel(confidenceScore: number): 'High' | 'Medium' | 'Low' {
    if (confidenceScore >= 0.75) return 'High';
    if (confidenceScore >= 0.50) return 'Medium';
    return 'Low';
  }

  /**
   * Generate fallback prediction when historical data is insufficient
   * Tasks 2.3.1, 2.3.2, 2.3.3, 2.3.4: Cold-start and fallback strategies
   */
  private async generateFallbackPrediction(
    auctionData: any,
    config: PredictionConfig
  ): Promise<PredictionResult> {
    const estimatedSalvageValue = auctionData.estimatedSalvageValue;
    const marketValue = auctionData.marketValue;
    const reservePrice = auctionData.reservePrice;
    const damageSeverity = auctionData.damageSeverity;

    let predictedPrice: number;
    let method: string;
    let confidenceScore: number;

    // Task 2.3.1: Salvage value fallback
    if (estimatedSalvageValue && estimatedSalvageValue > 0) {
      predictedPrice = estimatedSalvageValue;
      method = 'salvage_value';
      confidenceScore = 0.30;
    }
    // Task 2.3.2: Market value calculation fallback
    else if (marketValue && marketValue > 0) {
      const damageMultiplier = this.getDamageMultiplier(damageSeverity);
      predictedPrice = marketValue * (1 - damageMultiplier);
      method = 'market_value_calc';
      confidenceScore = 0.20;
    }
    // Last resort: use reserve price
    else if (reservePrice && reservePrice > 0) {
      predictedPrice = reservePrice * 1.15;
      method = 'reserve_price_estimate';
      confidenceScore = 0.15;
    }
    else {
      throw new Error('Insufficient data for price prediction');
    }

    // Calculate bounds
    let lowerBound = reservePrice || predictedPrice * 0.8;
    let upperBound = predictedPrice * 1.3;

    // Task 2.3.4: Edge case handling
    const warnings: string[] = [];
    
    // Handle high reserve price
    if (reservePrice && reservePrice > predictedPrice) {
      lowerBound = reservePrice;
      predictedPrice = reservePrice * 1.15;
      upperBound = reservePrice * 1.35;
      confidenceScore *= 0.6;
      warnings.push('Reserve price exceeds historical data - prediction based on extrapolation');
    }

    // Handle no bids scenario
    if (!auctionData.currentBid || auctionData.currentBid === 0) {
      warnings.push('No bids placed yet - prediction may change significantly');
    }

    const confidenceLevel = this.getConfidenceLevel(confidenceScore);

    return {
      auctionId: auctionData.auctionId,
      predictedPrice: Math.round(predictedPrice),
      lowerBound: Math.round(lowerBound),
      upperBound: Math.round(upperBound),
      confidenceScore: Number(confidenceScore.toFixed(4)),
      confidenceLevel,
      method,
      sampleSize: 0,
      metadata: {
        warnings,
        notes: ['Prediction based on fallback method due to insufficient historical data'],
      },
      algorithmVersion: this.ALGORITHM_VERSION,
      createdAt: new Date(),
    };
  }

  /**
   * Get damage severity multiplier for market value calculation
   */
  private getDamageMultiplier(damageSeverity: string): number {
    switch (damageSeverity) {
      case 'none':
        return 0.10;
      case 'minor':
        return 0.25;
      case 'moderate':
        return 0.50;
      case 'severe':
        return 0.75;
      default:
        return 0.50;
    }
  }

  /**
   * Generate prediction notes
   */
  private generatePredictionNotes(auctionData: any, similarAuctions: SimilarAuction[]): string[] {
    const notes: string[] = [];

    if (similarAuctions.length < 5) {
      notes.push(`Limited historical data (${similarAuctions.length} similar auctions)`);
    }

    if (auctionData.extensionCount > 0) {
      notes.push(`Auction extended ${auctionData.extensionCount} time(s) - increased competition expected`);
    }

    if (auctionData.watchingCount > 10) {
      notes.push('High interest - above average watching count');
    }

    return notes;
  }

  /**
   * Store prediction in database
   * Task 2.4.3: Implement prediction storage
   */
  private async storePrediction(auctionId: string, result: PredictionResult): Promise<void> {
    await db.insert(predictions).values({
      auctionId,
      predictedPrice: result.predictedPrice.toString(),
      lowerBound: result.lowerBound.toString(),
      upperBound: result.upperBound.toString(),
      confidenceScore: result.confidenceScore.toString(),
      confidenceLevel: result.confidenceLevel,
      algorithmVersion: result.algorithmVersion,
      method: result.method as any,
      sampleSize: result.sampleSize,
      metadata: result.metadata,
    });
  }

  /**
   * Log prediction to prediction_logs table
   * Task 2.4.4: Implement prediction logging to prediction_logs table
   */
  private async logPrediction(
    auctionId: string,
    result: PredictionResult,
    auctionData: any
  ): Promise<void> {
    try {
      // Get the prediction ID from the predictions table
      const predictionRecord = await db
        .select({ id: predictions.id })
        .from(predictions)
        .where(eq(predictions.auctionId, auctionId))
        .orderBy(desc(predictions.createdAt))
        .limit(1);

      if (!predictionRecord || predictionRecord.length === 0) {
        console.error('Prediction record not found for logging');
        return;
      }

      const predictionId = predictionRecord[0].id;

      // Extract calculation details
      const calculationDetails: any = {
        similarAuctionsCount: result.sampleSize,
        method: result.method,
        confidenceFactors: {
          sampleSize: result.sampleSize,
          confidenceScore: result.confidenceScore,
        },
      };

      if (result.metadata?.marketAdjustment) {
        calculationDetails.marketAdjustments = {
          competitionMultiplier: result.metadata.marketAdjustment,
          seasonalFactor: result.metadata.seasonalFactor,
        };
      }

      // Insert into prediction_logs
      await db.insert(predictionLogs).values({
        predictionId,
        auctionId,
        predictedPrice: result.predictedPrice.toString(),
        actualPrice: null, // Will be updated when auction closes
        confidenceScore: result.confidenceScore.toString(),
        method: result.method,
        algorithmVersion: result.algorithmVersion,
        calculationDetails,
        accuracy: null, // Will be calculated when auction closes
        absoluteError: null,
        percentageError: null,
      });
    } catch (error) {
      console.error('Error logging prediction:', error);
      // Don't throw - logging failure shouldn't break prediction
    }
  }

  /**
   * Integrate asset_performance_analytics for demand adjustments
   * Task 2.2.3: Integrate asset_performance_analytics for demand adjustments
   */
  private async getAssetDemandAdjustment(
    assetType: string,
    make?: string,
    model?: string
  ): Promise<number> {
    try {
      const result = await db
        .select({
          demandScore: assetPerformanceAnalytics.demandScore,
        })
        .from(assetPerformanceAnalytics)
        .where(
          and(
            eq(assetPerformanceAnalytics.assetType, assetType as any),
            make ? eq(assetPerformanceAnalytics.make, make) : sql`TRUE`,
            model ? eq(assetPerformanceAnalytics.model, model) : sql`TRUE`
          )
        )
        .orderBy(desc(assetPerformanceAnalytics.updatedAt))
        .limit(1);

      if (!result || result.length === 0) {
        return 1.0; // No adjustment
      }

      const demandScore = result[0].demandScore || 50;

      // High demand (>70) = +5% to +10% price adjustment
      if (demandScore > 70) {
        const adjustment = 1.05 + ((demandScore - 70) / 30) * 0.05;
        return Math.min(1.10, adjustment);
      }
      // Low demand (<30) = -5% to -10% price adjustment
      else if (demandScore < 30) {
        const adjustment = 0.95 - ((30 - demandScore) / 30) * 0.05;
        return Math.max(0.90, adjustment);
      }

      return 1.0; // Normal demand
    } catch (error) {
      console.error('Error getting asset demand adjustment:', error);
      return 1.0; // Fail gracefully
    }
  }

  /**
   * Integrate attribute_performance_analytics for color/trim adjustments
   * Task 2.2.4: Integrate attribute_performance_analytics for color/trim adjustments
   */
  private async getAttributeAdjustments(
    assetType: string,
    color?: string,
    trim?: string
  ): Promise<number> {
    try {
      let totalAdjustment = 0;
      let adjustmentCount = 0;

      // Get color premium
      if (color) {
        const colorResult = await db
          .select({
            avgPricePremium: attributePerformanceAnalytics.avgPricePremium,
            popularityScore: attributePerformanceAnalytics.popularityScore,
          })
          .from(attributePerformanceAnalytics)
          .where(
            and(
              eq(attributePerformanceAnalytics.assetType, assetType as any),
              eq(attributePerformanceAnalytics.attributeType, 'color'),
              eq(attributePerformanceAnalytics.attributeValue, color)
            )
          )
          .orderBy(desc(attributePerformanceAnalytics.updatedAt))
          .limit(1);

        if (colorResult && colorResult.length > 0) {
          const premium = parseFloat(colorResult[0].avgPricePremium || '0');
          const popularity = colorResult[0].popularityScore || 50;
          
          // Weight premium by popularity
          const weightedPremium = premium * (popularity / 100);
          totalAdjustment += weightedPremium;
          adjustmentCount++;
        }
      }

      // Get trim premium
      if (trim) {
        const trimResult = await db
          .select({
            avgPricePremium: attributePerformanceAnalytics.avgPricePremium,
            popularityScore: attributePerformanceAnalytics.popularityScore,
          })
          .from(attributePerformanceAnalytics)
          .where(
            and(
              eq(attributePerformanceAnalytics.assetType, assetType as any),
              eq(attributePerformanceAnalytics.attributeType, 'trim'),
              eq(attributePerformanceAnalytics.attributeValue, trim)
            )
          )
          .orderBy(desc(attributePerformanceAnalytics.updatedAt))
          .limit(1);

        if (trimResult && trimResult.length > 0) {
          const premium = parseFloat(trimResult[0].avgPricePremium || '0');
          const popularity = trimResult[0].popularityScore || 50;
          
          // Weight premium by popularity
          const weightedPremium = premium * (popularity / 100);
          totalAdjustment += weightedPremium;
          adjustmentCount++;
        }
      }

      // Return average adjustment as multiplier
      if (adjustmentCount > 0) {
        const avgAdjustment = totalAdjustment / adjustmentCount;
        // Convert to multiplier (e.g., 50000 premium on 1M = 1.05)
        return 1.0 + (avgAdjustment / 1000000); // Assuming base price ~1M
      }

      return 1.0; // No adjustment
    } catch (error) {
      console.error('Error getting attribute adjustments:', error);
      return 1.0; // Fail gracefully
    }
  }

  /**
   * Integrate temporal_patterns_analytics for peak hour adjustments
   * Task 2.2.5: Integrate temporal_patterns_analytics for peak hour adjustments
   */
  private async getTemporalAdjustment(
    assetType: string
  ): Promise<{ priceMultiplier: number; confidenceAdjustment: number }> {
    try {
      const now = new Date();
      const hourOfDay = now.getHours();
      const dayOfWeek = now.getDay();

      const result = await db
        .select({
          peakActivityScore: temporalPatternsAnalytics.peakActivityScore,
          avgFinalPrice: temporalPatternsAnalytics.avgFinalPrice,
        })
        .from(temporalPatternsAnalytics)
        .where(
          and(
            eq(temporalPatternsAnalytics.assetType, assetType as any),
            eq(temporalPatternsAnalytics.hourOfDay, hourOfDay),
            eq(temporalPatternsAnalytics.dayOfWeek, dayOfWeek)
          )
        )
        .orderBy(desc(temporalPatternsAnalytics.updatedAt))
        .limit(1);

      if (!result || result.length === 0) {
        return { priceMultiplier: 1.0, confidenceAdjustment: 0 };
      }

      const peakScore = result[0].peakActivityScore || 50;

      // Peak hours (score >70) = higher confidence, slight price increase
      if (peakScore > 70) {
        return {
          priceMultiplier: 1.02, // 2% increase
          confidenceAdjustment: 0.05, // +5% confidence
        };
      }
      // Off-peak hours (score <30) = lower confidence
      else if (peakScore < 30) {
        return {
          priceMultiplier: 0.98, // 2% decrease
          confidenceAdjustment: -0.05, // -5% confidence
        };
      }

      return { priceMultiplier: 1.0, confidenceAdjustment: 0 };
    } catch (error) {
      console.error('Error getting temporal adjustment:', error);
      return { priceMultiplier: 1.0, confidenceAdjustment: 0 };
    }
  }

  /**
   * Integrate geographic_patterns_analytics for regional price variance
   * Task 2.2.6: Integrate geographic_patterns_analytics for regional price variance
   */
  private async getGeographicAdjustment(
    assetType: string,
    region?: string
  ): Promise<{ priceVariance: number; demandMultiplier: number }> {
    try {
      if (!region) {
        return { priceVariance: 0, demandMultiplier: 1.0 };
      }

      const result = await db
        .select({
          priceVariance: geographicPatternsAnalytics.priceVariance,
          demandScore: geographicPatternsAnalytics.demandScore,
        })
        .from(geographicPatternsAnalytics)
        .where(
          and(
            eq(geographicPatternsAnalytics.region, region),
            eq(geographicPatternsAnalytics.assetType, assetType as any)
          )
        )
        .orderBy(desc(geographicPatternsAnalytics.updatedAt))
        .limit(1);

      if (!result || result.length === 0) {
        return { priceVariance: 0, demandMultiplier: 1.0 };
      }

      const variance = parseFloat(result[0].priceVariance || '0');
      const demandScore = result[0].demandScore || 50;

      // Apply regional demand adjustment
      let demandMultiplier = 1.0;
      if (demandScore > 70) {
        demandMultiplier = 1.05; // High regional demand
      } else if (demandScore < 30) {
        demandMultiplier = 0.95; // Low regional demand
      }

      return {
        priceVariance: variance,
        demandMultiplier,
      };
    } catch (error) {
      console.error('Error getting geographic adjustment:', error);
      return { priceVariance: 0, demandMultiplier: 1.0 };
    }
  }
}
