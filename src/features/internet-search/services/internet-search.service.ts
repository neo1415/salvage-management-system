/**
 * Internet Search Service - Core Orchestration
 * 
 * This service orchestrates the universal internet search system, combining
 * query building, API calls, and price extraction to provide market pricing
 * for any item type.
 */

import { serperApi } from '@/lib/integrations/serper-api';
import { queryBuilder, type ItemIdentifier } from './query-builder.service';
import { priceExtractor, type PriceExtractionResult } from './price-extraction.service';
import { performanceMonitor, createSearchTimer } from '../utils/performance-monitor';
import { cacheIntegrationService } from './cache-integration.service';

export interface SearchMarketPriceOptions {
  /** Item to search for */
  item: ItemIdentifier;
  /** Maximum number of search results to process */
  maxResults?: number;
  /** Search timeout in milliseconds (default: 3000) */
  timeout?: number;
  /** Include part-specific searches for salvage calculations */
  includeParts?: boolean;
}

export interface SearchPartPriceOptions {
  /** Vehicle or item context */
  item: ItemIdentifier;
  /** Specific part or component name */
  partName: string;
  /** Damage type context (optional) */
  damageType?: string;
  /** Maximum number of search results to process */
  maxResults?: number;
  /** Search timeout in milliseconds (default: 3000) */
  timeout?: number;
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
}

export class InternetSearchService {
  
  /**
   * Search for market price of an item using internet search
   */
  async searchMarketPrice(options: SearchMarketPriceOptions): Promise<MarketPriceResult> {
    const timer = createSearchTimer();
    const { item, maxResults = 10, timeout = 3000 } = options;
    
    try {
      // Check cache first
      const cachedResult = await cacheIntegrationService.getCachedMarketPrice(item);
      if (cachedResult) {
        const executionTime = timer.end();
        
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
          success: true
        };
      }
      
      // Build search query
      const query = queryBuilder.buildMarketQuery(item);
      
      // Execute search with timeout
      const searchPromise = serperApi.search(query, { num: maxResults });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Search timeout')), timeout)
      );
      
      const searchResults = await Promise.race([searchPromise, timeoutPromise]) as Awaited<typeof searchPromise>;
      
      if (!searchResults.organic || searchResults.organic.length === 0) {
        throw new Error('No search results returned');
      }
      
      // Extract prices from results with year filtering
      const priceData = priceExtractor.extractPrices(
        searchResults.organic, 
        item.type,
        item.type === 'vehicle' ? item.year : undefined
      );
      
      const executionTime = timer.end();
      
      const result: MarketPriceResult = {
        priceData,
        query,
        resultsProcessed: searchResults.organic.length,
        executionTime,
        dataSource: 'internet_search',
        success: true
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
        resultsCount: searchResults.organic.length,
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
    const { item, partName, damageType, maxResults = 10, timeout = 3000 } = options;
    
    try {
      // Check cache first
      const cachedResult = await cacheIntegrationService.getCachedPartPrice(item, partName, damageType);
      if (cachedResult) {
        const executionTime = Date.now() - startTime;
        
        return {
          partName: cachedResult.partName,
          priceData: cachedResult.priceData,
          query: cachedResult.query,
          resultsProcessed: 0, // From cache
          executionTime,
          dataSource: 'internet_search',
          success: true
        };
      }
      
      // Build part-specific search query
      const query = queryBuilder.buildPartPriceQuery(item, partName, damageType);
      
      // Execute search with timeout
      const searchPromise = serperApi.search(query, { num: maxResults });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Search timeout')), timeout)
      );
      
      const searchResults = await Promise.race([searchPromise, timeoutPromise]) as Awaited<typeof searchPromise>;
      
      if (!searchResults.organic || searchResults.organic.length === 0) {
        throw new Error('No search results returned');
      }
      
      // Extract prices from results (no type filtering for parts)
      const priceData = priceExtractor.extractPrices(searchResults.organic);
      
      const executionTime = Date.now() - startTime;
      
      const result: PartPriceResult = {
        partName,
        priceData,
        query,
        resultsProcessed: searchResults.organic.length,
        executionTime,
        dataSource: 'internet_search',
        success: true
      };
      
      // Cache the result for future use
      await cacheIntegrationService.setCachedPartPrice(item, result);
      
      return result;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      return {
        partName,
        priceData: {
          prices: [],
          confidence: 0,
          currency: 'NGN',
          extractedAt: new Date()
        },
        query: queryBuilder.buildPartPriceQuery(item, partName, damageType),
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
    parts: Array<{ name: string; damageType?: string }>,
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
    parts: Array<{ name: string; damageType?: string }>
  ): Promise<Array<PartPriceResult | null>> {
    const cachePromises = parts.map(part => 
      cacheIntegrationService.getCachedPartPrice(item, part.name, part.damageType)
        .then(cached => cached ? this.convertCachedPartToResult(cached) : null)
        .catch(() => null) // Ignore cache errors
    );

    return Promise.all(cachePromises);
  }

  /**
   * Convert cached part result to PartPriceResult format
   */
  private convertCachedPartToResult(cached: any): PartPriceResult {
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
    parts: Array<{ name: string; damageType?: string }>,
    itemType: string
  ): Array<{ name: string; damageType?: string }> {
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
    parts: Array<{ name: string; damageType?: string }>,
    options: { maxResults: number; timeout: number; concurrencyLimit: number }
  ): Promise<PartPriceResult[]> {
    const { maxResults, timeout } = options;

    // Use Promise.allSettled for better error handling
    const searchPromises = parts.map(part => 
      this.searchPartPrice({
        item,
        partName: part.name,
        damageType: part.damageType,
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
        query: queryBuilder.buildPartPriceQuery(item, part.name, part.damageType),
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
    originalParts: Array<{ name: string; damageType?: string }>,
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
        query: queryBuilder.buildPartPriceQuery({} as ItemIdentifier, originalPart.name, originalPart.damageType),
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
      const testResult = await serperApi.search('test query', { num: 1 });
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