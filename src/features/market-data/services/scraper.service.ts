/**
 * Scraper Service
 * 
 * Executes web scraping operations across multiple Nigerian e-commerce sources.
 * Uses axios for HTTP requests and cheerio for HTML parsing.
 * Implements timeout handling, robots.txt checking, and parallel scraping.
 * 
 * Requirements: 1.1, 1.5-1.8, 6.4, 6.5, 7.1, 7.2, 9.1
 */

import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import type { PropertyIdentifier, SourcePrice, ScrapeResult, ScraperConfig } from '../types';
import { buildSearchQuery, buildFullUrl, getSupportedSources } from './query-builder.service';
import { checkRateLimit, recordRequest, waitForRateLimit } from './rate-limiter.service';
import { extractYear } from './year-extraction.service';
import { filterByYear } from './year-filter.service';
import type { QualityTier } from '@/features/valuations/services/condition-mapping.service';

/**
 * Source-specific scraper configurations
 * Defines CSS selectors and parsing rules for each e-commerce platform
 */
const SCRAPER_CONFIGS: Record<string, ScraperConfig> = {
  jiji: {
    source: 'jiji',
    baseUrl: 'https://jiji.ng',
    selectors: {
      containerSelector: '.qa-advert-list-item',
      priceSelector: '.qa-advert-price',
      titleSelector: '.qa-advert-title',
      linkSelector: 'a',
      conditionSelector: '.qa-advert-attributes', // Condition is often in attributes
    },
    rateLimit: {
      requestsPerSecond: 2,
      burstSize: 5,
    },
  },
  jumia: {
    source: 'jumia',
    baseUrl: 'https://www.jumia.com.ng',
    selectors: {
      containerSelector: 'article.prd',
      priceSelector: '.prc',
      titleSelector: '.name',
      linkSelector: 'a.core',
      conditionSelector: '.bdg', // Badge often shows condition
    },
    rateLimit: {
      requestsPerSecond: 2,
      burstSize: 5,
    },
  },
  cars45: {
    source: 'cars45',
    baseUrl: 'https://cars45.com',
    selectors: {
      containerSelector: '.car-item',
      priceSelector: '.car-price',
      titleSelector: '.car-title',
      linkSelector: 'a.car-link',
      conditionSelector: '.car-condition', // Condition field
    },
    rateLimit: {
      requestsPerSecond: 2,
      burstSize: 5,
    },
  },
  cheki: {
    source: 'cheki',
    baseUrl: 'https://cheki.com.ng',
    selectors: {
      containerSelector: '.listing-item',
      priceSelector: '.price',
      titleSelector: '.title',
      linkSelector: 'a.listing-link',
      conditionSelector: '.condition', // Condition field
    },
    rateLimit: {
      requestsPerSecond: 2,
      burstSize: 5,
    },
  },
};

/**
 * Check robots.txt for a source
 * Returns true if scraping is allowed
 */
async function checkRobotsTxt(baseUrl: string, path: string): Promise<boolean> {
  try {
    const robotsUrl = `${baseUrl}/robots.txt`;
    const response = await axios.get(robotsUrl, {
      timeout: 3000,
      validateStatus: (status) => status === 200 || status === 404,
    });

    if (response.status === 404) {
      // No robots.txt means scraping is allowed
      return true;
    }

    const robotsTxt = response.data as string;
    const lines = robotsTxt.split('\n');
    
    let userAgentMatch = false;
    let disallowed = false;

    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();
      
      // Check for User-agent: *
      if (trimmed.startsWith('user-agent:')) {
        const agent = trimmed.substring('user-agent:'.length).trim();
        userAgentMatch = agent === '*';
      }
      
      // Check for Disallow directives
      if (userAgentMatch && trimmed.startsWith('disallow:')) {
        const disallowPath = trimmed.substring('disallow:'.length).trim();
        if (disallowPath === '/' || path.startsWith(disallowPath)) {
          disallowed = true;
          break;
        }
      }
    }

    return !disallowed;
  } catch (error) {
    console.error(`Failed to check robots.txt for ${baseUrl}:`, error);
    // Fail open - allow scraping if robots.txt check fails
    return true;
  }
}

/**
 * Parse price from text
 * Handles Nigerian Naira format: ₦1,234,567 or NGN 1,234,567
 */
function parsePrice(priceText: string): number | null {
  if (!priceText) return null;

  // Remove currency symbols and whitespace
  const cleaned = priceText
    .replace(/₦|NGN|N/gi, '')
    .replace(/,/g, '')
    .trim();

  // Extract first number found
  const match = cleaned.match(/[\d.]+/);
  if (!match) return null;

  const price = parseFloat(match[0]);
  
  // Validate price is reasonable
  if (isNaN(price) || price <= 0 || price > 10000000000) {
    return null;
  }

  return price;
}

/**
 * Normalizes scraped condition text to quality tier
 * 
 * Maps common Nigerian market terms to the 4-tier quality system:
 * - "brand new" or "new" → "excellent"
 * - "tokunbo", "foreign used", "imported" → "good"
 * - "nigerian used", "locally used", "naija used" → "fair"
 * - "damaged", "accident", "salvage" → "poor"
 * 
 * Defaults to "fair" for unknown conditions with logging.
 * 
 * @param rawCondition - The raw condition text from the listing
 * @returns A valid quality tier value
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */
export function normalizeCondition(rawCondition: string): QualityTier {
  if (!rawCondition) {
    console.warn('[Scraper] Empty condition value, defaulting to "fair"');
    return 'fair';
  }

  const normalized = rawCondition.toLowerCase().trim();
  
  // Map "brand new" or "new" to "excellent"
  if (normalized.includes('brand new') || normalized === 'new') {
    return 'excellent';
  }
  
  // Map "tokunbo", "foreign used", or "imported" to "good"
  if (normalized.includes('tokunbo') || 
      normalized.includes('foreign used') || 
      normalized.includes('imported')) {
    return 'good';
  }
  
  // Map "nigerian used", "locally used", or "naija used" to "fair"
  if (normalized.includes('nigerian used') || 
      normalized.includes('locally used') ||
      normalized.includes('naija used')) {
    return 'fair';
  }
  
  // Map damage indicators to "poor"
  if (normalized.includes('damaged') || 
      normalized.includes('accident') ||
      normalized.includes('salvage')) {
    return 'poor';
  }
  
  // Default to 'fair' for unknown conditions
  console.warn(
    `[Scraper] Unknown condition term: "${rawCondition}", defaulting to "fair"`
  );
  return 'fair';
}

/**
 * Scrape a single source
 * Implements timeout handling, robots.txt checking, and error handling
 */
export async function scrapeSource(
  source: string,
  property: PropertyIdentifier
): Promise<ScrapeResult> {
  const startTime = Date.now();
  const config = SCRAPER_CONFIGS[source];

  if (!config) {
    return {
      success: false,
      source,
      prices: [],
      error: `Unknown source: ${source}`,
      duration: Date.now() - startTime,
    };
  }

  try {
    // Build search query
    const searchQuery = buildSearchQuery(property, source);
    const url = buildFullUrl(searchQuery);

    // Check robots.txt
    const robotsAllowed = await checkRobotsTxt(config.baseUrl, new URL(url).pathname);
    if (!robotsAllowed) {
      return {
        success: false,
        source,
        prices: [],
        error: 'Scraping disallowed by robots.txt',
        duration: Date.now() - startTime,
      };
    }

    // Check rate limit
    await waitForRateLimit(source);

    // Record request for rate limiting
    await recordRequest(source);

    // Make HTTP request with 5-second timeout
    const response = await axios.get(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SalvageBot/1.0; +https://salvage.com/bot)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      validateStatus: (status) => status >= 200 && status < 300,
    });

    // Parse HTML with cheerio
    const $ = cheerio.load(response.data as string);
    const prices: SourcePrice[] = [];

    // Extract listings
    $(config.selectors.containerSelector).each((_, element) => {
      const $element = $(element);
      
      // Extract price
      const priceText = $element.find(config.selectors.priceSelector).first().text();
      const price = parsePrice(priceText);
      
      if (!price) return; // Skip if price is invalid

      // Extract title
      const title = $element.find(config.selectors.titleSelector).first().text().trim();
      
      // Extract URL - for Jiji, the link is on the container itself
      let listingUrl = $element.find(config.selectors.linkSelector).first().attr('href') || 
                       $element.attr('href') || '';
      
      // Make URL absolute if relative
      if (listingUrl && !listingUrl.startsWith('http')) {
        listingUrl = `${config.baseUrl}${listingUrl.startsWith('/') ? '' : '/'}${listingUrl}`;
      }

      // Extract condition (if selector is configured)
      let condition: QualityTier | undefined;
      if (config.selectors.conditionSelector) {
        const conditionText = $element.find(config.selectors.conditionSelector).first().text().trim();
        if (conditionText) {
          condition = normalizeCondition(conditionText);
        }
      }

      if (price && title) {
        // Extract year from title (Task 6)
        const extractedYear = extractYear(title);
        
        prices.push({
          source,
          price,
          currency: 'NGN',
          listingUrl: listingUrl || `${config.baseUrl}/search`,
          listingTitle: title,
          scrapedAt: new Date(),
          extractedYear, // Store extracted year
          condition, // Store normalized condition
        });
      }
    });

    // Apply year filtering if property has a year (Task 6)
    let filteredPrices = prices;
    let yearFilterMetadata;
    
    if (property.year && prices.length > 0) {
      const filterResult = filterByYear(prices, {
        targetYear: property.year,
        tolerance: 1, // ±1 year tolerance
      });
      
      // Mark listings as year-matched
      filteredPrices = filterResult.valid.map(listing => ({
        ...listing,
        yearMatched: true,
      }));
      
      // Build rejection reasons summary
      const rejectionReasons: Record<string, number> = {};
      for (const rejected of filterResult.rejected) {
        rejectionReasons[rejected.reason] = (rejectionReasons[rejected.reason] || 0) + 1;
      }
      
      yearFilterMetadata = {
        targetYear: property.year,
        tolerance: 1,
        totalListings: prices.length,
        validListings: filterResult.valid.length,
        rejectedListings: filterResult.rejected.length,
        yearMatchRate: filterResult.yearMatchRate,
        rejectionReasons,
      };
    }

    return {
      success: true,
      source,
      prices: filteredPrices,
      duration: Date.now() - startTime,
      yearFilterMetadata,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      
      if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
        return {
          success: false,
          source,
          prices: [],
          error: 'Request timeout after 5 seconds',
          duration,
        };
      }

      if (axiosError.response) {
        return {
          success: false,
          source,
          prices: [],
          error: `HTTP ${axiosError.response.status}: ${axiosError.response.statusText}`,
          duration,
        };
      }

      return {
        success: false,
        source,
        prices: [],
        error: `Network error: ${axiosError.message}`,
        duration,
      };
    }

    return {
      success: false,
      source,
      prices: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
    };
  }
}

/**
 * Scrape all supported sources in parallel
 * Implements 10-second total timeout and partial failure resilience
 */
export async function scrapeAllSources(
  property: PropertyIdentifier
): Promise<ScrapeResult[]> {
  const sources = getSupportedSources(property.type);
  
  if (sources.length === 0) {
    throw new Error(`No sources available for property type: ${property.type}`);
  }

  // Create scraping promises for all sources
  const scrapePromises = sources.map((source) => scrapeSource(source, property));

  // Implement 10-second total timeout
  const timeoutPromise = new Promise<ScrapeResult[]>((resolve) => {
    setTimeout(() => {
      resolve([]);
    }, 10000);
  });

  try {
    // Race between scraping and timeout
    const results = await Promise.race([
      Promise.allSettled(scrapePromises),
      timeoutPromise,
    ]);

    // Handle timeout case
    if (Array.isArray(results) && results.length === 0) {
      // Timeout occurred - return partial results
      return sources.map((source) => ({
        success: false,
        source,
        prices: [],
        error: 'Total scraping timeout exceeded 10 seconds',
        duration: 10000,
      }));
    }

    // Extract results from settled promises
    const scrapeResults: ScrapeResult[] = [];
    
    if (Array.isArray(results) && results.length > 0) {
      for (const result of results as PromiseSettledResult<ScrapeResult>[]) {
        if (result.status === 'fulfilled') {
          scrapeResults.push(result.value);
        } else {
          // Promise rejected - create error result
          const source = sources[scrapeResults.length] || 'unknown';
          scrapeResults.push({
            success: false,
            source,
            prices: [],
            error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
            duration: 0,
          });
        }
      }
    }

    return scrapeResults;
  } catch (error) {
    // Unexpected error - return error results for all sources
    return sources.map((source) => ({
      success: false,
      source,
      prices: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: 0,
    }));
  }
}

/**
 * Get scraper configuration for a source
 * Useful for testing and debugging
 */
export function getScraperConfig(source: string): ScraperConfig | undefined {
  return SCRAPER_CONFIGS[source];
}

/**
 * Get all available scraper sources
 */
export function getAvailableSources(): string[] {
  return Object.keys(SCRAPER_CONFIGS);
}
