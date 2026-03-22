/**
 * Market Data Service
 * 
 * Main orchestration service for market price retrieval.
 * Implements database-first strategy with fallback chain:
 * 1. Valuation database (for vehicles)
 * 2. Fresh cache (< 7 days)
 * 3. Scrape from sources
 * 4. Stale cache (7+ days)
 * 5. Error
 * 
 * Requirements: 2.3-2.6, 5.1-5.6, 7.3, 7.4, 11.4
 */

import type { PropertyIdentifier, MarketPrice, SourcePrice } from '../types';
import { getCachedPrice, setCachedPrice, getCacheAge, isStale } from './cache.service';
import { scrapeAllSources } from './scraper.service';
import { aggregatePrices } from './aggregation.service';
import { calculateConfidence } from './confidence.service';
import {
  logScrapingStart,
  logScrapingSuccess,
  logScrapingFailure,
  logCacheHit,
  logStaleFallback,
  logDatabaseHit,
} from './scraping-logger.service';
import { enqueueScrapingJob } from './background-job.service';
import { ValuationQueryService } from '@/features/valuations/services/valuation-query.service';
import { internetSearchService } from '@/features/internet-search/services/internet-search.service';
import type { ItemIdentifier } from '@/features/internet-search/services/query-builder.service';

/**
 * Convert PropertyIdentifier to ItemIdentifier for internet search
 */
function convertToItemIdentifier(property: PropertyIdentifier): ItemIdentifier | null {
  switch (property.type) {
    case 'vehicle':
      // VehicleIdentifier requires make and model as strings
      if (!property.make || !property.model) {
        return null;
      }
      return {
        type: 'vehicle',
        make: property.make,
        model: property.model,
        year: property.year,
        mileage: property.mileage,
        condition: property.condition as any // Pass through condition from PropertyIdentifier
      };
    case 'electronics':
      // ElectronicsIdentifier requires brand and model as strings
      if (!property.brand || !property.productModel) {
        return null;
      }
      return {
        type: 'electronics',
        brand: property.brand,
        model: property.productModel,
        // Include storage information with new enhanced fields
        ...(property.storageCapacity && { storageCapacity: property.storageCapacity }),
        ...(property.storageType && { storageType: property.storageType }),
        ...(property.storage && !property.storageCapacity && !property.storageType && { storage: property.storage }),
        ...(property.color && { color: property.color }),
        condition: property.condition as any // Pass through condition
      };
    case 'building':
      // PropertyIdentifier requires propertyType and location as strings
      if (!property.propertyType || !property.location) {
        return null;
      }
      return {
        type: 'property',
        propertyType: property.propertyType,
        location: property.location,
        bedrooms: property.bedrooms,
        condition: property.condition as any // Pass through condition
      };
    default:
      return null;
  }
}

/**
 * Get market price for a property
 * Implements database-first strategy with fallback chain
 * 
 * Requirements:
 * - 5.1: Query valuation database first for vehicles
 * - 5.2: Use database data without scraping if found
 * - 5.5: Log whether data came from database or scraping
 * - 5.6: Prioritize database data over cached scraped data
 * - 2.3: Use fresh cache without re-scraping
 * - 2.4: Mark data older than 7 days as stale
 * - 2.5: Initiate background job for stale data
 * - 2.6: Return stale data if scraping fails
 * - 7.3: Return stale data when all sources fail
 * - 7.4: Return error when no cached data exists
 */
export async function getMarketPrice(
  property: PropertyIdentifier
): Promise<MarketPrice> {
  const startTime = Date.now();

  // Validate property type - now supports universal types
  if (!['vehicle', 'electronics', 'building'].includes(property.type)) {
    throw new Error(`Unsupported property type: ${property.type}`);
  }

  try {
    // Step 1: PRIMARY - Try Internet Search first for all item types
    const itemIdentifier = convertToItemIdentifier(property);
    if (itemIdentifier) {
      try {
        console.log('🌐 PRIMARY: Attempting internet search for:', itemIdentifier);

        const searchResult = await internetSearchService.searchMarketPrice({
          item: itemIdentifier,
          maxResults: 15, // Increased for better results
          timeout: 5000   // Increased timeout for reliability
        });

        if (searchResult.success && searchResult.priceData.prices.length > 0) {
          console.log('✅ Internet search successful (PRIMARY):', {
            pricesFound: searchResult.priceData.prices.length,
            confidence: searchResult.priceData.confidence,
            averagePrice: searchResult.priceData.averagePrice
          });

          // Convert internet search result to MarketPrice format
          // Use the condition-specific MEDIAN price from internet search (more robust than average)
          const prices = searchResult.priceData.prices;
          const conditionSpecificPrice = searchResult.priceData.medianPrice || searchResult.priceData.averagePrice;
          
          // For condition-specific searches, use the search service's median
          // This preserves the condition differentiation from search queries
          const median = conditionSpecificPrice;
          const sortedPrices = prices.map(p => p.price).sort((a, b) => a - b);
          const min = Math.min(...sortedPrices);
          const max = Math.max(...sortedPrices);

          // Convert to SourcePrice format for compatibility
          const sources: SourcePrice[] = prices.map(price => ({
            source: 'internet_search',
            price: price.price,
            url: price.url || 'internet',
            title: price.title || `${itemIdentifier.type} listing`,
            extractedYear: null, // Internet search doesn't extract years for non-vehicles
            yearMatched: false,
          }));

          return {
            median,
            min,
            max,
            count: prices.length,
            sources,
            confidence: searchResult.priceData.confidence / 100, // Convert to 0-1 scale
            isFresh: true,
            cacheAge: 0,
            dataSource: 'internet_search', // PRIMARY source
          };
        }

        console.log('⚠️ Internet search returned no results, trying fallbacks...');
      } catch (error) {
        console.error('❌ Internet search failed, trying fallbacks:', error);
        // Continue to fallback options
      }
    }

    // Step 2: FALLBACK - Check valuation database (for vehicles only)
    if (property.type === 'vehicle' && property.make && property.model && property.year) {
      try {
        console.log('🗄️ FALLBACK: Querying valuation database...');

        const valuationService = new ValuationQueryService();
        const dbResult = await valuationService.queryValuation({
          make: property.make,
          model: property.model,
          year: property.year,
        });

        if (dbResult.found && dbResult.valuation) {
          console.log('✅ Valuation database hit (FALLBACK):', {
            make: property.make,
            model: property.model,
            year: property.year,
            averagePrice: dbResult.valuation.averagePrice,
          });

          // Log database hit for analytics
          await logDatabaseHit(property);

          // Return database result as fallback
          return {
            median: dbResult.valuation.averagePrice,
            min: dbResult.valuation.lowPrice,
            max: dbResult.valuation.highPrice,
            count: 1,
            sources: [{
              source: 'valuation_database',
              price: dbResult.valuation.averagePrice,
              url: 'internal',
              title: `${property.make} ${property.model} ${property.year}`,
              extractedYear: property.year,
              yearMatched: true,
            }],
            confidence: 0.85, // Lower confidence for fallback data
            isFresh: true,
            cacheAge: 0,
            dataSource: 'database', // FALLBACK source
          };
        }

        console.log('⚠️ No valuation database entry found, trying cache...');
      } catch (error) {
        console.error('❌ Valuation database query failed, trying cache:', error);
        // Continue to cache fallback
      }
    }

    // Step 3: FALLBACK - Check legacy cache (for backward compatibility)
    const cached = await getCachedPrice(property);

    if (cached) {
      const cacheAge = getCacheAge(cached.scrapedAt);
      const isFresh = !isStale(cached.scrapedAt);

      // Return cached data (fresh or stale)
      if (isFresh) {
        console.log('✅ Fresh cache hit (FALLBACK)');
        await logCacheHit(property, cacheAge);
      } else {
        console.log('⚠️ Stale cache hit (FALLBACK)');
        // Queue background refresh for next time
        await enqueueScrapingJob(property);
        await logStaleFallback(property, cacheAge, 'Cache is stale, returning cached data');
      }

      const confidence = calculateConfidence({
        sourceCount: cached.prices.length,
        dataAgeDays: cacheAge,
      });

      return {
        median: cached.medianPrice,
        min: Math.min(...cached.prices.map(p => p.price)),
        max: Math.max(...cached.prices.map(p => p.price)),
        count: cached.prices.length,
        sources: cached.prices,
        confidence: confidence.score,
        isFresh,
        cacheAge,
        dataSource: 'cache', // FALLBACK source
      };
    }

    // Step 4: LAST RESORT - Attempt legacy scraping (for vehicles only)
    if (property.type === 'vehicle') {
      console.log('🔄 LAST RESORT: Attempting legacy scraping...');

      const sources = ['jiji', 'jumia', 'cars45', 'cheki'];
      await logScrapingStart(property, sources);

      const scrapeResults = await scrapeAllSources(property);

      // Collect all successful prices
      const allPrices: SourcePrice[] = [];
      for (const result of scrapeResults) {
        if (result.success && result.prices.length > 0) {
          allPrices.push(...result.prices);
          await logScrapingSuccess(property, result.source, result.prices.length, result.duration);
        } else if (!result.success) {
          await logScrapingFailure(property, result.source, result.error || 'Unknown error', result.duration);
        }
      }

      // If scraping succeeded, aggregate and cache
      if (allPrices.length > 0) {
        console.log('✅ Legacy scraping successful (LAST RESORT)');

        // Year filtering orchestration (Task 7)
        let finalPrices = allPrices;
        let yearMatchRate = 100; // Default to 100% if no year filtering
        let depreciationApplied = false;

        // Only apply year filtering for vehicles with a target year
        if (property.type === 'vehicle' && property.year) {
          // Calculate year match rate
          const yearMatchedListings = allPrices.filter(p => p.yearMatched === true);
          yearMatchRate = allPrices.length > 0
            ? (yearMatchedListings.length / allPrices.length) * 100
            : 0;

          // Check if we have insufficient year-matched data
          if (yearMatchedListings.length < 3) {
            // Check if depreciation is applicable (non-year-matched newer listings exist)
            const targetYear = property.year; // Already checked above, guaranteed to be defined
            const newerListings = allPrices.filter(p => {
              const year = p.extractedYear;
              // Only consider listings that are NOT year-matched and are newer
              return p.yearMatched !== true && year !== null && year !== undefined && year > targetYear;
            });

            if (newerListings.length > 0) {
              // Apply depreciation to all listings
              const { applyDepreciation } = await import('./depreciation.service');
              const depreciationResult = applyDepreciation(allPrices, {
                targetYear,
                currentYear: new Date().getFullYear(),
              });

              finalPrices = depreciationResult.adjustedPrices;
              depreciationApplied = true;

              // Check if we still have enough data after depreciation
              if (finalPrices.length < 3) {
                throw new Error(
                  `Insufficient data: only ${finalPrices.length} listings available after year filtering and depreciation (minimum 3 required)`
                );
              }
            } else {
              // No newer listings to depreciate, insufficient data
              throw new Error(
                `Insufficient year-matched data: only ${yearMatchedListings.length} listings match target year ${targetYear} (minimum 3 required)`
              );
            }
          } else {
            // Sufficient year-matched data, use only those listings
            finalPrices = yearMatchedListings;
          }
        }

        const aggregated = aggregatePrices(finalPrices, { removeOutliers: true });

        // Store in cache
        await setCachedPrice(property, finalPrices);

        // Calculate confidence with year match factors (Task 8)
        const confidence = calculateConfidence({
          sourceCount: aggregated.count,
          dataAgeDays: 0,
          yearMatchRate,
          sampleSize: finalPrices.length,
          depreciationApplied,
        });

        return {
          median: aggregated.median,
          min: aggregated.min,
          max: aggregated.max,
          count: aggregated.count,
          sources: finalPrices,
          confidence: confidence.score,
          isFresh: true,
          cacheAge: 0,
          yearMatchRate,
          depreciationApplied,
          dataSource: 'scraping', // LAST RESORT source
        };
      }
    }

    // Step 5: All methods failed - return error
    throw new Error('Unable to retrieve market price: all sources failed and no cached data available');
  } catch (error) {
    // If error is from unsupported property type, rethrow
    if (error instanceof Error && error.message.includes('Unsupported property type')) {
      throw error;
    }

    // For other errors, check if we have stale cache to fall back to
    const cached = await getCachedPrice(property);
    if (cached) {
      const cacheAge = getCacheAge(cached.scrapedAt);
      console.log('🆘 EMERGENCY FALLBACK: Using stale cache due to all failures');
      await logStaleFallback(property, cacheAge, error instanceof Error ? error.message : 'Unknown error');

      const confidence = calculateConfidence({
        sourceCount: cached.prices.length,
        dataAgeDays: cacheAge,
      });

      return {
        median: cached.medianPrice,
        min: Math.min(...cached.prices.map(p => p.price)),
        max: Math.max(...cached.prices.map(p => p.price)),
        count: cached.prices.length,
        sources: cached.prices,
        confidence: confidence.score,
        isFresh: false,
        cacheAge,
        dataSource: 'cache', // EMERGENCY FALLBACK source
      };
    }

    // No fallback available
    throw new Error(
      error instanceof Error
        ? `Failed to get market price: ${error.message}`
        : 'Failed to get market price: unknown error'
    );
  }
}


/**
 * Refresh market price for a property
 * Forces scraping regardless of cache state
 * 
 * Requirement 2.5: Manual refresh functionality
 */
export async function refreshMarketPrice(
  property: PropertyIdentifier
): Promise<void> {
  // Validate property type
  if (!['vehicle', 'electronics', 'building'].includes(property.type)) {
    throw new Error(`Unsupported property type: ${property.type}`);
  }

  try {
    // Force scraping
    const sources = ['jiji', 'jumia', 'cars45', 'cheki'];
    await logScrapingStart(property, sources);

    const scrapeResults = await scrapeAllSources(property);

    // Collect all successful prices
    const allPrices: SourcePrice[] = [];
    for (const result of scrapeResults) {
      if (result.success && result.prices.length > 0) {
        allPrices.push(...result.prices);
        await logScrapingSuccess(property, result.source, result.prices.length, result.duration);
      } else if (!result.success) {
        await logScrapingFailure(property, result.source, result.error || 'Unknown error', result.duration);
      }
    }

    // If we got any prices, update cache
    if (allPrices.length > 0) {
      await setCachedPrice(property, allPrices);
    } else {
      throw new Error('Refresh failed: no prices retrieved from any source');
    }
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Failed to refresh market price: ${error.message}`
        : 'Failed to refresh market price: unknown error'
    );
  }
}
