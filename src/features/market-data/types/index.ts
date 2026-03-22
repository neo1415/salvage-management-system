/**
 * Market Data Types
 * 
 * Type definitions for the market data scraping system that aggregates
 * pricing data from Nigerian e-commerce platforms.
 */

/**
 * Property identifier for market data lookup
 * Supports vehicles, electronics, buildings, appliances, property, jewelry, furniture, and machinery
 */
export interface PropertyIdentifier {
  type: 'vehicle' | 'electronics' | 'building' | 'appliance' | 'property' | 'jewelry' | 'furniture' | 'machinery';
  
  // Vehicle fields
  make?: string;
  model?: string;
  year?: number;
  mileage?: number;
  
  // Electronics fields
  brand?: string;
  productModel?: string;
  productType?: string;
  storage?: string; // Legacy field for backward compatibility
  storageCapacity?: string; // e.g., "256GB", "512GB", "1TB"
  storageType?: string; // e.g., "SSD", "HDD", "NVMe", "eUFS"
  color?: string;
  
  // Building fields
  location?: string;
  propertyType?: string;
  size?: number;
  bedrooms?: number;
  
  // Appliance fields
  applianceType?: string;
  
  // Property fields (real estate)
  // Note: propertyType and location are shared with building
  
  // Jewelry fields
  jewelryType?: string;
  material?: string;
  weight?: string;
  
  // Furniture fields
  furnitureType?: string;
  // Note: material is shared with jewelry
  
  // Machinery fields
  machineryType?: string;
  // Note: brand, model, year are shared with other types
  
  // Universal fields
  condition?: string; // 'Brand New' | 'Foreign Used (Tokunbo)' | 'Nigerian Used' | 'Heavily Used'
}

/**
 * Price data from a single source
 */
export interface SourcePrice {
  source: string;
  price: number;
  currency?: string;
  listingUrl?: string;
  listingTitle?: string;
  scrapedAt?: Date;
  
  // Database source fields (Requirement 5.2)
  url?: string; // Alias for listingUrl
  title?: string; // Alias for listingTitle
  
  // Year filtering fields (Task 6)
  extractedYear?: number | null;
  yearMatched?: boolean;
  depreciationApplied?: boolean;
  originalPrice?: number;
  depreciationRate?: number;
  
  // Condition normalization field (Task 6.1)
  condition?: string; // Quality tier: "excellent", "good", "fair", or "poor"
}

/**
 * Aggregated market price data with confidence metrics
 */
export interface MarketPrice {
  median: number;
  min: number;
  max: number;
  count: number;
  sources: SourcePrice[];
  confidence: number;
  isFresh: boolean;
  cacheAge: number; // days
  
  // Year filtering fields (Task 7)
  yearMatchRate?: number; // 0-100 percentage
  depreciationApplied?: boolean;
  
  // Data source indicator (Requirement 5.5)
  dataSource?: 'database' | 'cache' | 'scraping' | 'internet_search';
}

/**
 * Result from scraping a single source
 */
export interface ScrapeResult {
  success: boolean;
  source: string;
  prices: SourcePrice[];
  error?: string;
  duration: number;
  
  // Year filtering metadata (Task 6)
  yearFilterMetadata?: {
    targetYear?: number;
    tolerance: number;
    totalListings: number;
    validListings: number;
    rejectedListings: number;
    yearMatchRate: number;
    rejectionReasons: Record<string, number>;
  };
}

/**
 * Configuration for a scraper source
 */
export interface ScraperConfig {
  source: string;
  baseUrl: string;
  selectors: {
    priceSelector: string;
    titleSelector: string;
    linkSelector: string;
    containerSelector: string;
    conditionSelector?: string; // Optional condition selector
  };
  rateLimit: {
    requestsPerSecond: number;
    burstSize: number;
  };
}

/**
 * Cached market data from database
 */
export interface CachedMarketData {
  id: string;
  propertyHash: string;
  propertyType: string;
  propertyDetails: PropertyIdentifier;
  prices: SourcePrice[];
  medianPrice: number;
  scrapedAt: Date;
  isStale: boolean;
  staleAt: Date;
}

/**
 * Background job for async scraping
 */
export interface BackgroundJob {
  id: string;
  type: 'scrape_market_data';
  propertyHash: string;
  property: PropertyIdentifier;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

/**
 * Search query for a specific source
 */
export interface SearchQuery {
  source: string;
  url: string;
  params: Record<string, string>;
}

/**
 * Scraping log entry
 */
export interface ScrapingLog {
  id: string;
  propertyHash: string;
  sourceName: string;
  status: 'started' | 'success' | 'failed' | 'timeout';
  pricesFound: number;
  durationMs: number;
  errorMessage?: string;
  createdAt: Date;
}
