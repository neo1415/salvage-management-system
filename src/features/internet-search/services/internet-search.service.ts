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

const LUXURY_JEWELRY_PRICE_FLOORS_NGN: Record<string, number> = {
  rolex: 8_000_000,
  cartier: 3_500_000,
  'patek philippe': 20_000_000,
  audemars: 14_000_000,
  'audemars piguet': 14_000_000,
  omega: 2_500_000,
  'vacheron constantin': 18_000_000,
  'van cleef': 2_500_000,
  tiffany: 1_500_000,
  bvlgari: 2_000_000,
  bulgari: 2_000_000,
  chopard: 2_500_000,
};

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

  private luxuryJewelryFloor(item: ItemIdentifier): number | null {
    if (item.type !== 'jewelry') return null;
    const text = [
      item.brand,
      item.jewelryType,
      item.material,
      item.weight,
    ].filter(Boolean).join(' ').toLowerCase();
    const matches = Object.keys(LUXURY_JEWELRY_PRICE_FLOORS_NGN).filter((brand) => text.includes(brand));
    if (matches.length === 0) return null;
    return Math.max(
      matches.reduce((sum, brand) => sum + LUXURY_JEWELRY_PRICE_FLOORS_NGN[brand], 0),
      /\b(18k|18ct|750|gold|diamond|platinum)\b/.test(text) ? 1_500_000 : 0
    );
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
    const luxuryFloor = this.luxuryJewelryFloor(item);
    if (!luxuryFloor) return priceData;

    const rejectedForLuxury: Array<ExtractedPrice & { rejectionReason: string }> = [];
    const guardedPrices = priceData.prices.filter((price) => {
      const source = price.source.toLowerCase();
      if (LOW_TRUST_LUXURY_MARKETPLACE_DOMAINS.some((domain) => source.includes(domain))) {
        rejectedForLuxury.push({ ...price, rejectionReason: 'Low-trust marketplace source is not accepted for luxury jewelry valuation' });
        return false;
      }
      if (price.price < luxuryFloor) {
        rejectedForLuxury.push({ ...price, rejectionReason: `Luxury jewelry price below specialist appraisal floor of NGN ${luxuryFloor.toLocaleString()}` });
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
    // Increase maxResults for machinery to get more Nigerian marketplace results
    const defaultMaxResults = options.item.type === 'machinery' ? 15 : 10;
    const { item, maxResults = defaultMaxResults, timeout = 3000, forceRefresh = false } = options;
    
    try {
      // Check cache first
      const cachedResult = forceRefresh ? null : await cacheIntegrationService.getCachedMarketPrice(item);
      if (cachedResult) {
        const executionTime = timer.end();
        cachedResult.priceData = this.applyItemSpecificPriceGuards(cachedResult.priceData, item);
        const adjudication = await this.adjudicatePriceData({
          item,
          mode: 'market',
          priceData: cachedResult.priceData,
        });
        cachedResult.priceData = adjudication.priceData;
        
        console.log('💾 Using CACHED market price data');
        console.log(`📊 Cached prices: ${cachedResult.priceData.prices.length} prices`);
        cachedResult.priceData.prices.forEach((price, index) => {
          console.log(
            `  ${index + 1}. ₦${price.price.toLocaleString()} from ${price.source} ` +
            `(confidence: ${price.confidence}%)`
          );
        });
        console.log(`📊 Cached statistics: avg=₦${cachedResult.priceData.averagePrice?.toLocaleString()}, median=₦${cachedResult.priceData.medianPrice?.toLocaleString()}`);
        
        // CRITICAL FIX: Revalidate cached prices with current validation rules
        // This ensures old cached data with invalid prices (like ₦80 parts) gets filtered out
        const revalidatedPrices = cachedResult.priceData.prices.filter(price => {
          // Apply minimum price threshold
          const minPriceThresholds: Record<string, number> = {
            'vehicle': 500000,
            'electronics': 10000,
            'appliance': 20000,
            'machinery': 100000,
            'property': 1000000,
            'jewelry': 5000,
            'furniture': 10000,
          };
          const minPrice = item.type ? minPriceThresholds[item.type] || 1000 : 1000;
          
          if (price.price < minPrice) {
            console.log(`🚫 Filtering out cached price ₦${price.price.toLocaleString()} - below minimum threshold of ₦${minPrice.toLocaleString()}`);
            return false;
          }
          return true;
        });
        
        // Recalculate statistics if prices were filtered
        if (revalidatedPrices.length !== cachedResult.priceData.prices.length) {
          console.log(`📊 Revalidation: ${cachedResult.priceData.prices.length - revalidatedPrices.length} invalid prices removed from cache`);
          
          if (revalidatedPrices.length === 0) {
            console.log('⚠️ All cached prices were invalid, fetching fresh data...');
            // Don't use cache, fall through to fresh search
          } else {
            // Recalculate statistics with valid prices only
            const priceValues = revalidatedPrices.map(p => p.price);
            const sortedPrices = [...priceValues].sort((a, b) => a - b);
            const averagePrice = priceValues.reduce((sum, price) => sum + price, 0) / priceValues.length;
            const medianPrice = sortedPrices.length % 2 === 0
              ? (sortedPrices[sortedPrices.length / 2 - 1] + sortedPrices[sortedPrices.length / 2]) / 2
              : sortedPrices[Math.floor(sortedPrices.length / 2)];
            
            console.log(`📊 Recalculated statistics: avg=₦${Math.round(averagePrice).toLocaleString()}, median=₦${Math.round(medianPrice).toLocaleString()}`);
            
            // Update cached result with revalidated data
            cachedResult.priceData.prices = revalidatedPrices;
            cachedResult.priceData.averagePrice = Math.round(averagePrice);
            cachedResult.priceData.medianPrice = Math.round(medianPrice);
            cachedResult.priceData.priceRange = {
              min: Math.min(...priceValues),
              max: Math.max(...priceValues)
            };
            
            // Record cache hit in performance metrics
            performanceMonitor.recordSearch({
              query: cachedResult.query,
              itemType: item.type,
              startTime: timer.getStartTime(),
              endTime: Date.now(),
              success: true,
              resultsCount: cachedResult.resultsProcessed,
              pricesExtracted: revalidatedPrices.length,
              confidence: cachedResult.priceData.confidence,
              fromCache: true
            });
            
            return {
              priceData: cachedResult.priceData,
              query: cachedResult.query,
              resultsProcessed: cachedResult.resultsProcessed,
              executionTime,
              dataSource: 'internet_search',
              success: true,
              adjudication,
            };
          }
        } else {
          // No filtering needed, use cache as-is
          // Record cache hit in performance metrics
          performanceMonitor.recordSearch({
            query: cachedResult.query,
            itemType: item.type,
            startTime: timer.getStartTime(),
            endTime: Date.now(),
            success: true,
            resultsCount: cachedResult.resultsProcessed,
            pricesExtracted: cachedResult.priceData.prices.length,
            confidence: cachedResult.priceData.confidence,
            fromCache: true
          });
          
          return {
            priceData: cachedResult.priceData,
            query: cachedResult.query,
            resultsProcessed: cachedResult.resultsProcessed,
            executionTime,
            dataSource: 'internet_search',
            success: true,
            adjudication,
          };
        }
      }
      
      // Build search query
      const valuationPolicy = await getValuationPolicyConfig();
      const queries = queryBuilder.generateQueryVariations(
        item,
        Math.max(3, Math.min(5, valuationPolicy.minimumMarketSourceCount + 1))
      );
      const query = queries.join(' | ');
      
      // Log the actual query being sent to Serper
      console.log(`🔍 Serper Search Query: "${query}"`);
      console.log(`📊 Search Parameters: maxResults=${maxResults}, timeout=${timeout}ms, itemType=${item.type}`);
      
      // Execute search with timeout
      const perQueryLimit = Math.max(5, Math.ceil(maxResults / Math.max(1, queries.length)));
      const searchPromise = Promise.all(
        queries.map(async (singleQuery) => {
          try {
            return await serperApi.search(singleQuery, { num: perQueryLimit });
          } catch (error) {
            console.warn(`Serper query failed: "${singleQuery}"`, error);
            return { organic: [] };
          }
        })
      );
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Search timeout')), timeout)
      );
      
      const searchBatches = await Promise.race([searchPromise, timeoutPromise]) as Awaited<typeof searchPromise>;
      const organicResults = this.dedupeOrganicResults(searchBatches.flatMap(batch => batch.organic || [])).slice(0, maxResults);
      
      if (organicResults.length === 0) {
        console.warn('No Serper market results; falling back to Claude/Gemini web price search');
        const aiAdjudication = await this.tryAiPriceEstimate({ item, mode: 'market', query });
        if (aiAdjudication) {
          const executionTime = timer.end();
          return {
            priceData: aiAdjudication.priceData,
            query,
            resultsProcessed: 0,
            executionTime,
            dataSource: 'internet_search',
            success: true,
            adjudication: aiAdjudication,
          };
        }
        throw new Error('No search results returned');
      }
      
      // Log search results summary
      console.log(`Search Results: ${organicResults.length} unique results found`);
      console.log(`Result Sources: ${organicResults.map(r => {
        try {
          return new URL(r.link || '').hostname;
        } catch {
          return 'unknown';
        }
      }).join(', ')}`);
      
      // Extract prices from results with year filtering
      const priceData = this.applyItemSpecificPriceGuards(priceExtractor.extractPrices(
        organicResults, 
        item.type,
        item.type === 'vehicle' ? item.year : undefined,
        {
          exchangeRates: valuationPolicy.exchangeRates,
          pricePlausibility: valuationPolicy.pricePlausibility,
        }
      ), item);
      if (priceData.prices.length === 0) {
        console.warn('Serper returned listings but no usable prices; falling back to Claude/Gemini');
        const aiAdjudication = await this.tryAiPriceEstimate({ item, mode: 'market', query });
        if (aiAdjudication) {
          const executionTime = timer.end();
          return {
            priceData: aiAdjudication.priceData,
            query,
            resultsProcessed: organicResults.length,
            executionTime,
            dataSource: 'internet_search',
            success: true,
            adjudication: aiAdjudication,
          };
        }
      }
      const adjudication = await this.adjudicatePriceData({
        item,
        mode: 'market',
        priceData,
      });
      
      // Log extracted prices with sources
      console.log(`💰 Prices Extracted: ${priceData.prices.length} prices found`);
      priceData.prices.forEach((price, index) => {
        console.log(
          `  ${index + 1}. ₦${price.price.toLocaleString()} from ${price.source} ` +
          `(confidence: ${price.confidence}%) - "${price.originalText}"`
        );
      });
      
      const executionTime = timer.end();
      
      const result: MarketPriceResult = {
        priceData: adjudication.priceData,
        query,
        resultsProcessed: organicResults.length,
        executionTime,
        dataSource: 'internet_search',
        success: true,
        adjudication,
      };
      
      // Cache the result for future use
      await cacheIntegrationService.setCachedMarketPrice(item, result);
      
      // Record performance metrics
      performanceMonitor.recordSearch({
        query,
        itemType: item.type,
        startTime: timer.getStartTime(),
        endTime: Date.now(),
        success: true,
        resultsCount: organicResults.length,
        pricesExtracted: priceData.prices.length,
        confidence: priceData.confidence,
        fromCache: false
      });
      
      return result;
      
    } catch (error) {
      const executionTime = timer.end();
      
      // Record failed search metrics
      performanceMonitor.recordSearch({
        query: queryBuilder.buildMarketQuery(item),
        itemType: item.type,
        startTime: timer.getStartTime(),
        endTime: Date.now(),
        success: false,
        resultsCount: 0,
        pricesExtracted: 0,
        confidence: 0,
        error: error instanceof Error ? error.message : 'Unknown search error',
        fromCache: false
      });
      
      return {
        priceData: {
          prices: [],
          confidence: 0,
          currency: 'NGN',
          extractedAt: new Date()
        },
        query: queryBuilder.buildMarketQuery(item),
        resultsProcessed: 0,
        executionTime,
        dataSource: 'internet_search',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown search error'
      };
    }
  }

  /**
   * Search for specific part prices for salvage calculations
   */
  async searchPartPrice(options: SearchPartPriceOptions): Promise<PartPriceResult> {
    const startTime = Date.now();
    const { item, partName, damageType, action = 'specialist_review', maxResults = 10, timeout = 3000, forceRefresh = false } = options;
    
    try {
      // Check cache first
      const cachedResult = forceRefresh ? null : await cacheIntegrationService.getCachedPartPrice(item, partName, damageType, action);
      if (cachedResult) {
        const executionTime = Date.now() - startTime;
        const adjudication = await this.adjudicatePriceData({
          item,
          mode: 'part',
          priceData: cachedResult.priceData,
          partName,
          damageType,
        });
        
        return {
          partName: cachedResult.partName,
          priceData: adjudication.priceData,
          query: cachedResult.query,
          resultsProcessed: 0, // From cache
          executionTime,
          dataSource: 'internet_search',
          success: true,
          adjudication,
        };
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
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Search timeout')), timeout)
      );
      
      const searchBatches = await Promise.race([searchPromise, timeoutPromise]) as Awaited<typeof searchPromise>;
      const organicResults = this.dedupeOrganicResults(searchBatches.flatMap(batch => batch.organic || [])).slice(0, maxResults);
      
      if (organicResults.length === 0) {
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
          exchangeRates: valuationPolicy.exchangeRates,
          pricePlausibility: valuationPolicy.pricePlausibility,
        }
      );
      if (priceData.prices.length === 0) {
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
          };
        }
      }
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
        success: true,
        adjudication,
      };
      
      // Cache the result for future use
      await cacheIntegrationService.setCachedPartPrice(item, result, damageType, action);
      
      return result;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const fallbackQuery = queryBuilder.buildPartPriceQuery(item, partName, damageType, action);

      try {
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
