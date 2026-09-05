/**
 * Internet Search Service - Core Orchestration
 * 
 * This service orchestrates the universal internet search system, combining
 * query building, API calls, and price extraction to provide market pricing
 * for any item type.
 */

import { serperApi } from '@/lib/integrations/serper-api';
import { queryBuilder, type ItemIdentifier } from './query-builder.service';
import { priceExtractor, type ExtractedPrice, type PriceExtractionResult } from './price-extraction.service';
import { performanceMonitor, createSearchTimer } from '../utils/performance-monitor';
import { cacheIntegrationService, type CachedPartResult } from './cache-integration.service';
import { getValuationPolicyConfig } from '@/features/valuations/services/valuation-policy.service';
import {
  priceAdjudicationService,
  type PriceAdjudicationResult,
} from '@/features/valuations/services/price-adjudication.service';
import type { DamageAction } from '@/lib/ai/damage-evidence';

const SPECIALIST_JEWELRY_BRANDS = [
  'rolex', 'cartier', 'patek philippe', 'audemars', 'omega',
  'vacheron constantin', 'van cleef', 'tiffany', 'bvlgari', 'bulgari', 'chopard',
];

const LOW_TRUST_LUXURY_MARKETPLACE_DOMAINS = [
  'jumia',
  'konga',
  'jiji',
  'instagram',
  'facebook',
  'tiktok',
  'ong.ng',
];

export interface SearchMarketPriceOptions {
  /** Item to search for */
  item: ItemIdentifier;
  /** Maximum number of search results to process */
  maxResults?: number;
  /** Search timeout in milliseconds (default: 3000) */
  timeout?: number;
  /** Include part-specific searches for salvage calculations */
  includeParts?: boolean;
  /** Skip cached pricing and fetch fresh market evidence */
  forceRefresh?: boolean;
}

export interface SearchPartPriceOptions {
  /** Vehicle or item context */
  item: ItemIdentifier;
  /** Specific part or component name */
  partName: string;
  /** Damage type context (optional) */
  damageType?: string;
  /** Pricing operation inferred from visible evidence */
  action?: DamageAction;
  /** Maximum number of search results to process */
  maxResults?: number;
  /** Search timeout in milliseconds (default: 3000) */
  timeout?: number;
  /** Skip cached pricing and fetch fresh part evidence */
  forceRefresh?: boolean;
}

export interface MarketPriceResult {
  /** Extracted price information */
  priceData: PriceExtractionResult;
  /** Search query used */
  query: string;
  /** Number of results processed */
  resultsProcessed: number;
  /** Search execution time in milliseconds */
  executionTime: number;
  /** Data source identifier */
  dataSource: 'internet_search';
  /** Search success status */
  success: boolean;
  /** Error message if search failed */
  error?: string;
  /** Enterprise adjudication decision over search and AI evidence */
  adjudication?: PriceAdjudicationResult;
}

export interface PartPriceResult {
  /** Part name searched */
  partName: string;
  /** Extracted price information */
  priceData: PriceExtractionResult;
  /** Search query used */
  query: string;
  /** Number of results processed */
  resultsProcessed: number;
  /** Search execution time in milliseconds */
  executionTime: number;
  /** Data source identifier */
  dataSource: 'internet_search';
  /** Search success status */
  success: boolean;
  /** Error message if search failed */
  error?: string;
  /** Enterprise adjudication decision over search and AI evidence */
  adjudication?: PriceAdjudicationResult;
}

export class InternetSearchService {
  private getResultKey(result: { link?: string; title?: string }): string {
    return (result.link || result.title || '').trim().toLowerCase();
  }

  private dedupeOrganicResults<T extends { title?: string; link?: string; snippet?: string }>(results: T[]): T[] {
    const seen = new Set<string>();
    return results.filter((result) => {
      const key = this.getResultKey(result);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private isSpecialistJewelry(item: ItemIdentifier): boolean {
    if (item.type !== 'jewelry') return false;
    const text = [
      item.brand,
      item.jewelryType,
      item.material,
      item.weight,
    ].filter(Boolean).join(' ').toLowerCase();
    return SPECIALIST_JEWELRY_BRANDS.some(brand => text.includes(brand));
  }

  private recalculatePriceData(prices: ExtractedPrice[], source: PriceExtractionResult): PriceExtractionResult {
    if (prices.length === 0) {
      return {
        ...source,
        prices: [],
        averagePrice: undefined,
        medianPrice: undefined,
        priceRange: undefined,
        confidence: 0,
        evidenceSummary: {
          uniqueSourceCount: 0,
          priceSpreadPercent: 0,
          highQualitySourceCount: 0,
          noYearPriceCount: 0,
        },
      };
    }

    const values = prices.map((price) => price.price).sort((a, b) => a - b);
    const averagePrice = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
    const medianPrice = values.length % 2 === 0
      ? Math.round((values[values.length / 2 - 1] + values[values.length / 2]) / 2)
      : values[Math.floor(values.length / 2)];
    const uniqueSources = new Set(prices.map((price) => price.source)).size;
    const spreadPercent = medianPrice > 0 ? Math.round(((values[values.length - 1] - values[0]) / medianPrice) * 100) : 0;

    return {
      ...source,
      prices,
      averagePrice,
      medianPrice,
      priceRange: {
        min: values[0],
        max: values[values.length - 1],
      },
      confidence: Math.min(source.confidence, Math.round(prices.reduce((sum, price) => sum + price.confidence, 0) / prices.length)),
      evidenceSummary: {
        uniqueSourceCount: uniqueSources,
        priceSpreadPercent: spreadPercent,
        highQualitySourceCount: prices.filter((price) => price.sourceQuality === 'high').length,
        noYearPriceCount: prices.filter((price) => price.extractedYear == null).length,
      },
    };
  }

  private applyItemSpecificPriceGuards(priceData: PriceExtractionResult, item: ItemIdentifier): PriceExtractionResult {
    if (!this.isSpecialistJewelry(item)) return priceData;

    const rejectedForLuxury: Array<ExtractedPrice & { rejectionReason: string }> = [];
    const guardedPrices = priceData.prices.filter((price) => {
      const source = price.source.toLowerCase();
      if (LOW_TRUST_LUXURY_MARKETPLACE_DOMAINS.some((domain) => source.includes(domain))) {
        rejectedForLuxury.push({ ...price, rejectionReason: 'Low-trust marketplace source is not accepted for luxury jewelry valuation' });
        return false;
      }
      return true;
    });

    return {
      ...this.recalculatePriceData(guardedPrices, priceData),
      rejectedPrices: [
        ...(priceData.rejectedPrices || []),
        ...rejectedForLuxury,
      ],
    };
  }

  private buildEmptyPriceData(): PriceExtractionResult {
    return {
      prices: [],
      confidence: 0,
      currency: 'NGN',
      extractedAt: new Date(),
    };
  }

  private async tryAiPriceEstimate(input: {
    item: ItemIdentifier;
    mode: 'market' | 'part';
    partName?: string;
    damageType?: string;
    query: string;
  }): Promise<PriceAdjudicationResult | null> {
    const adjudication = await this.adjudicatePriceData({
      item: input.item,
      mode: input.mode,
      priceData: this.buildEmptyPriceData(),
      partName: input.partName,
      damageType: input.damageType,
    });

    if (!adjudication.selectedPrice) {
      return null;
    }

    console.log(
      `🤖 AI price estimate (${adjudication.selectedSource}): ₦${adjudication.selectedPrice.toLocaleString()} for ${input.mode}`
    );
    return adjudication;
  }

  private async adjudicatePriceData(input: {
    item: ItemIdentifier;
    mode: 'market' | 'part';
    priceData: PriceExtractionResult;
    partName?: string;
    damageType?: string;
  }): Promise<PriceAdjudicationResult> {
    const valuationPolicy = await getValuationPolicyConfig();
    return priceAdjudicationService.adjudicate({
      item: input.item,
      mode: input.mode,
      priceData: input.priceData,
      policy: valuationPolicy,
      partName: input.partName,
      damageType: input.damageType,
    });
  }
  
  /**
   * Search for market price of an item using internet search
   */
  async searchMarketPrice(options: SearchMarketPriceOptions): Promise<MarketPriceResult> {
    const timer = createSearchTimer();
    const { item, maxResults = item.type === 'machinery' ? 15 : 10, timeout = 3000, forceRefresh = false } = options;
    let query = queryBuilder.buildMarketQuery(item);
    let priceData = this.buildEmptyPriceData();
    let resultsProcessed = 0;
    let fromCache = false;

    try {
      const policy = await getValuationPolicyConfig();
      const extractionOptions = {
        mode: 'market' as const,
        item,
        exchangeRates: policy.exchangeRates,
        pricePlausibility: policy.pricePlausibility,
      };
      const targetYear = item.type === 'vehicle' ? item.year : undefined;
      const cached = forceRefresh ? null : await cacheIntegrationService.getCachedMarketPrice(item);
      // Cache keys are not evidence of identity. Re-extract original listing text
      // under today's matching rules and policy, never trust cached aggregates.
      const identity = (value: ItemIdentifier) => JSON.stringify(
        Object.entries(value).filter(([, entry]) => entry != null && entry !== '')
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, entry]) => [key, typeof entry === 'string' ? entry.trim().toLowerCase().replace(/\s+/g, ' ') : entry])
      );
      if (cached && cached.item && identity(cached.item) === identity(item)
        && new Date(cached.expiresAt).getTime() > Date.now()) {
        const cachedEvidence = this.filterMarketEvidence(cached.priceData);
        const revalidated = priceExtractor.extractPrices(
          cachedEvidence.prices.map((price, index) => ({
            link: price.url, title: price.title, snippet: price.snippet, position: index + 1,
          })),
          item.type, targetYear, extractionOptions
        );
        const noLongerAccepted = cachedEvidence.prices
          .filter(price => !revalidated.prices.some(current => current.url === price.url && current.price === price.price))
          .map(price => ({ ...price, rejectionReason: 'Cached listing no longer passes current extraction and identity checks.' }));
        priceData = {
          ...revalidated,
          rejectedPrices: [
            ...(cachedEvidence.rejectedPrices || []),
            ...(revalidated.rejectedPrices || []),
            ...noLongerAccepted,
          ],
        };
        if (priceData.prices.length > 0) {
          query = cached.query;
          resultsProcessed = cached.resultsProcessed;
          fromCache = true;
        }
      }

      if (!fromCache) {
        const queries = queryBuilder.generateQueryVariations(item, Math.max(3, Math.min(5, policy.minimumMarketSourceCount + 1)));
        query = queries.join(' | ');
        const perQueryLimit = Math.max(5, Math.ceil(maxResults / Math.max(1, queries.length)));
        const searchPromise = Promise.all(queries.map(async singleQuery => {
          try {
            return await serperApi.search(singleQuery, { num: perQueryLimit });
          } catch (error) {
            console.warn(`Serper query failed: "${singleQuery}"`, error);
            return { organic: [] };
          }
        }));
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        const batches = await Promise.race([
          searchPromise,
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('Search timeout')), timeout);
          }),
        ]).catch(error => {
          console.warn('Search unavailable; continuing with grounded providers:', error instanceof Error ? error.message : 'Search failed');
          return [];
        }).finally(() => clearTimeout(timeoutId));
        const organic = this.dedupeOrganicResults(batches.flatMap(batch => batch.organic || [])).slice(0, maxResults);
        resultsProcessed = organic.length;
        const extracted = priceExtractor.extractPrices(organic, item.type, targetYear, extractionOptions);
        priceData = {
          ...extracted,
          rejectedPrices: [...(priceData.rejectedPrices || []), ...(extracted.rejectedPrices || [])],
        };
      }

      priceData = this.filterMarketEvidence(this.applyItemSpecificPriceGuards(priceData, item));
      const decision = await priceAdjudicationService.adjudicate({ item, mode: 'market', priceData, policy });
      // Opinions remain opinions: only accepted, extracted listings can back the
      // public market statistics. Never manufacture a listing from an AI quote.
      const supportedEvidence = [...priceData.prices, ...(decision.researchedPrices || [])];
      const unsupported = decision.priceData.prices.filter(price =>
        !supportedEvidence.some(evidence => evidence.url === price.url && evidence.price === price.price)
      );
      const rejectedPrices = Array.from(new Map([
        ...(priceData.rejectedPrices || []),
        ...(decision.priceData.rejectedPrices || []),
        ...decision.rejectedPrices,
        ...unsupported.map(price => ({ ...price, rejectionReason: 'Adjudication supplied a price without extracted listing evidence.' })),
      ].map(price => [JSON.stringify([price.url, price.price, price.rejectionReason]), price])).values());
      const accepted = supportedEvidence.filter(evidence =>
        decision.priceData.prices.some(price => price.url === evidence.url && price.price === evidence.price)
      );
      const finalPriceData = this.recalculatePriceData(accepted, { ...decision.priceData, rejectedPrices });
      const manualReviewRequired = decision.manualReviewRequired || accepted.length === 0 || unsupported.length > 0;
      const adjudication: PriceAdjudicationResult = {
        ...decision,
        priceData: finalPriceData,
        selectedPrice: finalPriceData.medianPrice,
        selectedSource: accepted.length ? 'serper' : 'none',
        confidence: finalPriceData.confidence,
        manualReviewRequired,
        reviewReasons: [...new Set([
          ...decision.reviewReasons,
          ...(accepted.length === 0 ? ['No accepted comparable listing evidence.'] : []),
          ...(unsupported.length ? ['Unsubstantiated adjudication prices require manual review.'] : []),
        ])],
        rejectedPrices,
      };
      const result: MarketPriceResult = {
        priceData: finalPriceData, query, resultsProcessed, executionTime: timer.end(),
        dataSource: 'internet_search',
        // A provisional range remains useful. manualReviewRequired controls
        // approval; it must not turn attributable market evidence into a total failure.
        success: accepted.length > 0,
        adjudication,
        ...(manualReviewRequired ? { error: adjudication.reviewReasons.join(' ') || 'Market evidence requires manual review.' } : {}),
      };
      if (result.success && !manualReviewRequired && !fromCache) {
        try {
          await cacheIntegrationService.setCachedMarketPrice(item, result);
        } catch (error) {
          console.warn('Unable to cache accepted market evidence:', error);
        }
      }
      performanceMonitor.recordSearch({
        query, itemType: item.type, startTime: timer.getStartTime(), endTime: Date.now(),
        success: result.success, resultsCount: resultsProcessed, pricesExtracted: accepted.length,
        confidence: finalPriceData.confidence, fromCache,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown search error';
      const rejectedPrices = [
        ...(priceData.rejectedPrices || []),
        ...priceData.prices.map(price => ({ ...price, rejectionReason: 'Market evidence could not complete safety adjudication.' })),
      ];
      const failedData = this.recalculatePriceData([], { ...priceData, rejectedPrices });
      performanceMonitor.recordSearch({
        query, itemType: item.type, startTime: timer.getStartTime(), endTime: Date.now(),
        success: false, resultsCount: resultsProcessed, pricesExtracted: 0, confidence: 0, error: message, fromCache,
      });
      return {
        priceData: failedData, query, resultsProcessed, executionTime: timer.end(),
        dataSource: 'internet_search', success: false, error: message,
        adjudication: {
          priceData: failedData, selectedSource: 'none', confidence: 0, manualReviewRequired: true,
          reviewReasons: [message], rejectedPrices, aiOpinions: [],
        },
      };
    }
  }

  private filterMarketEvidence(priceData: PriceExtractionResult): PriceExtractionResult {
    const rejectedPrices = [...(priceData.rejectedPrices || [])];
    const prices = priceData.prices.filter(price => {
      let validUrl = false;
      try {
        const url = new URL(price.url);
        validUrl = ['http:', 'https:'].includes(url.protocol) && !!url.hostname;
      } catch { /* A missing listing URL cannot establish market evidence. */ }
      const valid = Number.isFinite(price.price) && price.price > 0 && validUrl
        && !!price.source?.trim() && !!price.originalText?.trim()
        && !!(price.title?.trim() || price.snippet?.trim())
        && !/^(?:ai[_ -]|gemini[_ -]|claude[_ -]|policy[_ -])/i.test(price.source);
      if (!valid) rejectedPrices.push({ ...price, rejectionReason: 'Price lacks valid, attributable listing evidence.' });
      return valid;
    });
    return this.recalculatePriceData(prices, { ...priceData, rejectedPrices });
  }

  /**
   * Search for specific part prices for salvage calculations
   */
  async searchPartPrice(options: SearchPartPriceOptions): Promise<PartPriceResult> {
    const startTime = Date.now();
    let researchAttempted = false;
    const { item, partName, damageType, action = 'specialist_review', maxResults = 10, timeout = 3000, forceRefresh = false } = options;

    try {
      // Check cache first
      const cachedResult = forceRefresh ? null : await cacheIntegrationService.getCachedPartPrice(item, partName, damageType, action);
      if (cachedResult) {
        const executionTime = Date.now() - startTime;
        researchAttempted = true;
        const adjudication = await this.adjudicatePriceData({
          item,
          mode: 'part',
          priceData: cachedResult.priceData,
          partName,
          damageType,
        });
        
        if (adjudication.priceData.prices.length > 0) {
          return {
            partName: cachedResult.partName,
            priceData: adjudication.priceData,
            query: cachedResult.query,
            resultsProcessed: 0, // From cache
            executionTime,
            dataSource: 'internet_search',
            success: true,
            adjudication,
            ...(adjudication.manualReviewRequired
              ? { error: adjudication.reviewReasons.join(' ') || 'Part evidence requires manual review.' }
              : {}),
          };
        }
      }
      
      // Build part-specific search queries. The first query is the precise part query;
      // the additional market variations improve resilience when sellers describe
      // parts in broader item listing language.
      const valuationPolicy = await getValuationPolicyConfig();
      const primaryQuery = queryBuilder.buildPartPriceQuery(item, partName, damageType, action);
      const actionContext = queryBuilder.getPartPricingContext(action, item.type);
      const contextQueries = queryBuilder
        .generateQueryVariations(item, 2)
        .map((contextQuery) => `${contextQuery} ${partName} ${damageType || ''} ${actionContext}`.trim());
      const queries = [primaryQuery, ...contextQueries];
      const query = queries.join(' | ');
      
      // Execute search with timeout
      const perQueryLimit = Math.max(4, Math.ceil(maxResults / queries.length));
      const searchPromise = Promise.all(
        queries.map(async (singleQuery) => {
          try {
            return await serperApi.search(singleQuery, { num: perQueryLimit });
          } catch (error) {
            console.warn(`Serper part query failed: "${singleQuery}"`, error);
            return { organic: [] };
          }
        })
      );
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const searchBatches = await Promise.race([
        searchPromise,
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Search timeout')), timeout);
        }),
      ]).finally(() => clearTimeout(timeoutId)) as Awaited<typeof searchPromise>;
      const organicResults = this.dedupeOrganicResults(searchBatches.flatMap(batch => batch.organic || [])).slice(0, maxResults);
      
      if (organicResults.length === 0) {
        researchAttempted = true;
        const aiAdjudication = await this.tryAiPriceEstimate({
          item,
          mode: 'part',
          partName,
          damageType,
          query: primaryQuery,
        });
        if (aiAdjudication) {
          const executionTime = Date.now() - startTime;
          return {
            partName,
            priceData: aiAdjudication.priceData,
            query,
            resultsProcessed: 0,
            executionTime,
            dataSource: 'internet_search',
            success: true,
            adjudication: aiAdjudication,
            ...(aiAdjudication.manualReviewRequired
              ? { error: aiAdjudication.reviewReasons.join(' ') || 'Part evidence requires manual review.' }
              : {}),
          };
        }
        throw new Error('No search results returned');
      }
      
      const priceData = priceExtractor.extractPrices(
        organicResults,
        item.type,
        undefined,
        {
          mode: 'part',
          partName,
          item,
          exchangeRates: valuationPolicy.exchangeRates,
          pricePlausibility: valuationPolicy.pricePlausibility,
        }
      );
      if (priceData.prices.length === 0) {
        researchAttempted = true;
        const aiAdjudication = await this.tryAiPriceEstimate({
          item,
          mode: 'part',
          partName,
          damageType,
          query: primaryQuery,
        });
        if (aiAdjudication) {
          const executionTime = Date.now() - startTime;
          return {
            partName,
            priceData: aiAdjudication.priceData,
            query,
            resultsProcessed: organicResults.length,
            executionTime,
            dataSource: 'internet_search',
            success: true,
            adjudication: aiAdjudication,
            ...(aiAdjudication.manualReviewRequired
              ? { error: aiAdjudication.reviewReasons.join(' ') || 'Part evidence requires manual review.' }
              : {}),
          };
        }
        throw new Error('No supported part-price evidence returned');
      }
      researchAttempted = true;
      const adjudication = await this.adjudicatePriceData({
        item,
        mode: 'part',
        priceData,
        partName,
        damageType,
      });
      
      const executionTime = Date.now() - startTime;
      
      const result: PartPriceResult = {
        partName,
        priceData: adjudication.priceData,
        query,
        resultsProcessed: organicResults.length,
        executionTime,
        dataSource: 'internet_search',
        success: adjudication.priceData.prices.length > 0,
        adjudication,
        ...(adjudication.manualReviewRequired
          ? { error: adjudication.reviewReasons.join(' ') || 'Part evidence requires manual review.' }
          : {}),
      };
      
      if (result.success && !adjudication.manualReviewRequired) {
        try {
          await cacheIntegrationService.setCachedPartPrice(item, result, damageType, action);
        } catch (error) {
          console.warn('Unable to cache accepted part evidence:', error);
        }
      }
      
      return result;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const fallbackQuery = queryBuilder.buildPartPriceQuery(item, partName, damageType, action);

      try {
        if (researchAttempted) throw error;
        const aiAdjudication = await this.tryAiPriceEstimate({
          item,
          mode: 'part',
          partName,
          damageType,
          query: fallbackQuery,
        });
        if (aiAdjudication) {
          return {
            partName,
            priceData: aiAdjudication.priceData,
            query: fallbackQuery,
            resultsProcessed: 0,
            executionTime,
            dataSource: 'internet_search',
            success: true,
            adjudication: aiAdjudication,
            ...(aiAdjudication.manualReviewRequired
              ? { error: aiAdjudication.reviewReasons.join(' ') || 'Part evidence requires manual review.' }
              : {}),
          };
        }
      } catch (aiError) {
        console.warn('AI part price estimate failed after Serper error:', aiError);
      }

      return {
        partName,
        priceData: {
          prices: [],
          confidence: 0,
          currency: 'NGN',
          extractedAt: new Date()
        },
        query: queryBuilder.buildPartPriceQuery(item, partName, damageType, action),
        resultsProcessed: 0,
        executionTime,
        dataSource: 'internet_search',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown search error'
      };
    }
  }

  /**
   * Search for multiple parts with advanced optimization strategies
   * 
   * Performance Optimizations:
   * - Intelligent batching to respect API rate limits
   * - Concurrent processing with configurable concurrency limits
   * - Smart caching to reduce duplicate searches
   * - Progressive timeout handling for better user experience
   * - Fallback strategies for partial failures
   */
  async searchMultiplePartPrices(
    item: ItemIdentifier,
    parts: Array<{ name: string; damageType?: string; action?: DamageAction }>,
    options: { 
      maxResults?: number; 
      timeout?: number;
      concurrencyLimit?: number;
      enableBatching?: boolean;
      prioritizeCommonParts?: boolean;
    } = {}
  ): Promise<PartPriceResult[]> {
    const { 
      maxResults = 10, 
      timeout = 2000, // Reduced timeout for multiple searches
      concurrencyLimit = 3, // Limit concurrent searches to avoid overwhelming API
      enableBatching = true,
      prioritizeCommonParts = true
    } = options;
    
    const startTime = Date.now();
    
    // Early return for empty parts list
    if (parts.length === 0) {
      return [];
    }

    // Log the start of multiple part search
    console.info(
      `[InternetSearchService] Starting multiple part search for ${parts.length} parts. ` +
      `Concurrency limit: ${concurrencyLimit}, Batching: ${enableBatching}`
    );

    // Step 1: Check cache for all parts first
    const cacheResults = await this.checkMultiplePartCache(item, parts);
    const cachedParts = cacheResults.filter(result => result !== null) as PartPriceResult[];
    const uncachedParts = parts.filter((_, index) => cacheResults[index] === null);

    console.info(
      `[InternetSearchService] Cache check complete: ${cachedParts.length}/${parts.length} parts found in cache. ` +
      `${uncachedParts.length} parts need API search.`
    );

    // Step 2: If all parts are cached, return immediately
    if (uncachedParts.length === 0) {
      const totalTime = Date.now() - startTime;
      console.info(`[InternetSearchService] All parts found in cache. Total time: ${totalTime}ms`);
      
      // Record performance metrics for cache-only result
      performanceMonitor.recordSearch({
        query: `multiple_parts_cache_only_${parts.length}`,
        itemType: item.type,
        startTime,
        endTime: Date.now(),
        success: true,
        resultsCount: cachedParts.length,
        pricesExtracted: cachedParts.filter(p => p.success).length,
        confidence: this.calculateAverageConfidence(cachedParts),
        fromCache: true
      });

      return this.reorderResultsToMatchInput(parts, cachedParts);
    }

    // Step 3: Prioritize common parts if enabled
    const partsToSearch = prioritizeCommonParts 
      ? this.prioritizeCommonParts(uncachedParts, item.type)
      : uncachedParts;

    // Step 4: Execute searches with optimized batching and concurrency
    let searchResults: PartPriceResult[];
    
    if (enableBatching && partsToSearch.length > concurrencyLimit) {
      searchResults = await this.executeBatchedPartSearches(
        item, 
        partsToSearch, 
        { maxResults, timeout, concurrencyLimit }
      );
    } else {
      searchResults = await this.executeConcurrentPartSearches(
        item, 
        partsToSearch, 
        { maxResults, timeout, concurrencyLimit }
      );
    }

    // Step 5: Combine cached and searched results
    const allResults = [...cachedParts, ...searchResults];
    const orderedResults = this.reorderResultsToMatchInput(parts, allResults);

    const totalTime = Date.now() - startTime;
    const successfulSearches = orderedResults.filter(r => r.success).length;
    
    console.info(
      `[InternetSearchService] Multiple part search completed. ` +
      `${successfulSearches}/${parts.length} parts found. ` +
      `Cache hits: ${cachedParts.length}, API calls: ${searchResults.length}. ` +
      `Total time: ${totalTime}ms`
    );

    // Record comprehensive performance metrics
    performanceMonitor.recordSearch({
      query: `multiple_parts_${parts.length}_items`,
      itemType: item.type,
      startTime,
      endTime: Date.now(),
      success: successfulSearches > 0,
      resultsCount: orderedResults.length,
      pricesExtracted: successfulSearches,
      confidence: this.calculateAverageConfidence(orderedResults),
      fromCache: cachedParts.length > 0,
      apiResponseTime: totalTime - (cachedParts.length > 0 ? 50 : 0) // Estimate cache time
    });

    return orderedResults;
  }

  /**
   * Check cache for multiple parts concurrently
   */
  private async checkMultiplePartCache(
    item: ItemIdentifier,
    parts: Array<{ name: string; damageType?: string; action?: DamageAction }>
  ): Promise<Array<PartPriceResult | null>> {
    const cachePromises = parts.map(part => 
      cacheIntegrationService.getCachedPartPrice(item, part.name, part.damageType, part.action)
        .then(cached => cached ? this.convertCachedPartToResult(cached) : null)
        .catch(() => null) // Ignore cache errors
    );

    return Promise.all(cachePromises);
  }

  /**
   * Convert cached part result to PartPriceResult format
   */
  private convertCachedPartToResult(cached: CachedPartResult): PartPriceResult {
    return {
      partName: cached.partName,
      priceData: cached.priceData,
      query: cached.query,
      resultsProcessed: 0, // From cache
      executionTime: 0,
      dataSource: 'internet_search',
      success: true
    };
  }

  /**
   * Prioritize common parts that are more likely to have good search results
   */
  private prioritizeCommonParts(
    parts: Array<{ name: string; damageType?: string; action?: DamageAction }>,
    itemType: string
  ): Array<{ name: string; damageType?: string; action?: DamageAction }> {
    if (itemType !== 'vehicle') {
      return parts; // No prioritization for non-vehicle items
    }

    const commonPartsPriority = [
      'bumper', 'headlight', 'taillight', 'windshield', 'side mirror',
      'door', 'fender', 'hood', 'trunk', 'wheel', 'tire'
    ];

    const prioritized = [...parts].sort((a, b) => {
      const aPriority = commonPartsPriority.findIndex(common => 
        a.name.toLowerCase().includes(common)
      );
      const bPriority = commonPartsPriority.findIndex(common => 
        b.name.toLowerCase().includes(common)
      );

      // Higher priority (lower index) comes first
      if (aPriority !== -1 && bPriority !== -1) {
        return aPriority - bPriority;
      }
      if (aPriority !== -1) return -1; // a has priority
      if (bPriority !== -1) return 1;  // b has priority
      return 0; // No change in order
    });

    return prioritized;
  }

  /**
   * Execute part searches in optimized batches
   */
  private async executeBatchedPartSearches(
    item: ItemIdentifier,
    parts: Array<{ name: string; damageType?: string }>,
    options: { maxResults: number; timeout: number; concurrencyLimit: number }
  ): Promise<PartPriceResult[]> {
    const { concurrencyLimit } = options;
    const results: PartPriceResult[] = [];
    
    // Process parts in batches to respect concurrency limits
    for (let i = 0; i < parts.length; i += concurrencyLimit) {
      const batch = parts.slice(i, i + concurrencyLimit);
      const batchStartTime = Date.now();
      
      console.info(
        `[InternetSearchService] Processing batch ${Math.floor(i / concurrencyLimit) + 1}/${Math.ceil(parts.length / concurrencyLimit)}: ` +
        `${batch.length} parts`
      );

      const batchResults = await this.executeConcurrentPartSearches(item, batch, options);
      results.push(...batchResults);

      const batchTime = Date.now() - batchStartTime;
      console.info(`[InternetSearchService] Batch completed in ${batchTime}ms`);

      // Small delay between batches to be respectful to the API
      if (i + concurrencyLimit < parts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Execute part searches concurrently with improved error handling
   */
  private async executeConcurrentPartSearches(
    item: ItemIdentifier,
    parts: Array<{ name: string; damageType?: string; action?: DamageAction }>,
    options: { maxResults: number; timeout: number; concurrencyLimit: number }
  ): Promise<PartPriceResult[]> {
    const { maxResults, timeout } = options;

    // Use Promise.allSettled for better error handling
    const searchPromises = parts.map(part => 
      this.searchPartPrice({
        item,
        partName: part.name,
        damageType: part.damageType,
        action: part.action,
        maxResults,
        timeout
      }).catch(error => ({
        partName: part.name,
        priceData: {
          prices: [],
          confidence: 0,
          currency: 'NGN',
          extractedAt: new Date()
        },
        query: queryBuilder.buildPartPriceQuery(item, part.name, part.damageType, part.action),
        resultsProcessed: 0,
        executionTime: 0,
        dataSource: 'internet_search' as const,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
    );

    const settledResults = await Promise.allSettled(searchPromises);
    
    return settledResults.map(result => 
      result.status === 'fulfilled' ? result.value : result.reason
    );
  }

  /**
   * Reorder results to match the original input order
   */
  private reorderResultsToMatchInput(
    originalParts: Array<{ name: string; damageType?: string; action?: DamageAction }>,
    results: PartPriceResult[]
  ): PartPriceResult[] {
    return originalParts.map(originalPart => {
      const matchingResult = results.find(result => 
        result.partName === originalPart.name
      );
      
      return matchingResult || {
        partName: originalPart.name,
        priceData: {
          prices: [],
          confidence: 0,
          currency: 'NGN',
          extractedAt: new Date()
        },
        query: queryBuilder.buildPartPriceQuery({ type: 'other', description: 'asset' }, originalPart.name, originalPart.damageType, originalPart.action),
        resultsProcessed: 0,
        executionTime: 0,
        dataSource: 'internet_search',
        success: false,
        error: 'No matching result found'
      };
    });
  }

  /**
   * Calculate average confidence from multiple results
   */
  private calculateAverageConfidence(results: PartPriceResult[]): number {
    const successfulResults = results.filter(r => r.success);
    if (successfulResults.length === 0) return 0;
    
    const totalConfidence = successfulResults.reduce(
      (sum, result) => sum + result.priceData.confidence, 
      0
    );
    
    return Math.round(totalConfidence / successfulResults.length);
  }

  /**
   * Get aggregated market price with confidence scoring
   */
  async getAggregatedMarketPrice(
    item: ItemIdentifier,
    options: { maxResults?: number; timeout?: number; includePartPrices?: boolean } = {}
  ): Promise<{
    marketPrice: MarketPriceResult;
    partPrices?: PartPriceResult[];
    aggregatedConfidence: number;
    recommendedPrice?: number;
  }> {
    const { includePartPrices = false } = options;
    
    // Get main market price
    const marketPrice = await this.searchMarketPrice({ item, ...options });
    
    let partPrices: PartPriceResult[] | undefined;
    let aggregatedConfidence = marketPrice.priceData.confidence;
    
    // Optionally include part prices for additional validation
    if (includePartPrices && item.type === 'vehicle') {
      const commonParts = this.getCommonPartsForVehicle(item);
      if (commonParts.length > 0) {
        partPrices = await this.searchMultiplePartPrices(item, commonParts, options);
        
        // Adjust confidence based on part price consistency
        const partConfidences = partPrices
          .filter(p => p.success)
          .map(p => p.priceData.confidence);
        
        if (partConfidences.length > 0) {
          const avgPartConfidence = partConfidences.reduce((sum, conf) => sum + conf, 0) / partConfidences.length;
          aggregatedConfidence = Math.round((aggregatedConfidence + avgPartConfidence) / 2);
        }
      }
    }
    
    // Calculate recommended price
    let recommendedPrice: number | undefined;
    if (marketPrice.success && marketPrice.priceData.averagePrice) {
      recommendedPrice = marketPrice.priceData.averagePrice;
      
      // Adjust based on confidence
      if (aggregatedConfidence < 50) {
        // Low confidence - use median if available
        recommendedPrice = marketPrice.priceData.medianPrice || recommendedPrice;
      }
    }
    
    return {
      marketPrice,
      partPrices,
      aggregatedConfidence,
      recommendedPrice
    };
  }

  /**
   * Get common parts for vehicle-specific searches
   */
  private getCommonPartsForVehicle(item: ItemIdentifier): Array<{ name: string; damageType?: string }> {
    if (item.type !== 'vehicle') return [];
    
    // Common vehicle parts that are often searched for pricing
    return [
      { name: 'windshield', damageType: 'glass' },
      { name: 'headlight', damageType: 'lighting' },
      { name: 'bumper', damageType: 'body' },
      { name: 'side mirror', damageType: 'accessories' }
    ];
  }

  /**
   * Health check for the internet search system
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    apiStatus: boolean;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      await serperApi.search('test query', { num: 1 });
      const responseTime = Date.now() - startTime;
      
      // Serper API returns SerperResponse on success, throws on error
      return {
        status: responseTime < 2000 ? 'healthy' : 'degraded',
        apiStatus: true,
        responseTime
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        apiStatus: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get performance statistics for the search system
   */
  getPerformanceStats(timeWindowMs?: number) {
    return performanceMonitor.getStats(timeWindowMs);
  }

  /**
   * Clear performance metrics (useful for testing)
   */
  clearPerformanceMetrics() {
    performanceMonitor.clearMetrics();
  }

  /**
   * Get cache statistics and metrics
   */
  async getCacheStats() {
    return cacheIntegrationService.getCacheStats();
  }

  /**
   * Warm cache for popular items
   */
  async warmCache(popularItems: ItemIdentifier[]) {
    return cacheIntegrationService.warmCache(popularItems, (item) => this.searchMarketPrice({ item }));
  }

  /**
   * Clear all cache entries
   */
  async clearCache() {
    return cacheIntegrationService.clearAllCache();
  }
}

// Export singleton instance
export const internetSearchService = new InternetSearchService();
