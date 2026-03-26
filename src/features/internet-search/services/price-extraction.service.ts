/**
 * Price Extraction Service for Universal Internet Search
 * 
 * This service extracts and validates price information from Google search results,
 * with specialized handling for Nigerian Naira and various price formats.
 */

import type { SerperSearchResult } from '@/lib/integrations/serper-api';
import type { ItemIdentifier } from './query-builder.service';

export interface ExtractedPrice {
  price: number;
  currency: 'NGN' | 'USD' | 'GBP' | 'EUR';
  originalText: string;
  confidence: number; // 0-100
  source: string;
  url: string;
  title: string;
  snippet: string;
  extractedYear?: number | null; // Year extracted from listing
  yearMatched?: boolean; // Whether year matches target year
}

export interface PriceExtractionResult {
  prices: ExtractedPrice[];
  averagePrice?: number;
  medianPrice?: number;
  priceRange?: {
    min: number;
    max: number;
  };
  confidence: number; // Overall confidence 0-100
  currency: 'NGN';
  extractedAt: Date;
}

// Nigerian Naira price patterns
const NAIRA_PATTERNS = [
  // Standard formats: ₦1,000,000 or ₦ 1,000,000 (with optional spaces)
  /₦\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi,
  
  // NGN format: NGN 1,000,000 or NGN1,000,000
  /NGN\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi,
  
  // Naira word format: 1,000,000 naira or 1000000 naira
  /([0-9,]+(?:\.[0-9]{1,2})?)\s*naira/gi,
  
  // Million/thousand abbreviations: ₦2.5m, ₦500k, ₦1.2million, ₦ 2.5m (with spaces)
  /₦\s*([0-9]+(?:\.[0-9]+)?)\s*([mk]|million|thousand)/gi,
  
  // Number followed by million/thousand naira
  /([0-9]+(?:\.[0-9]+)?)\s*(million|thousand)\s*naira/gi,
  
  // Ranges: ₦1m - ₦2m, ₦500k to ₦800k
  /₦\s*([0-9]+(?:\.[0-9]+)?)\s*([mk]|million|thousand)\s*(?:[-–—to]|and)\s*₦?\s*([0-9]+(?:\.[0-9]+)?)\s*([mk]|million|thousand)?/gi,
  
  // Jiji.ng specific format: "₦ 120,000,000" (space after ₦ and commas in large numbers)
  /₦\s+([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?)/gi
];

// Other currency patterns for conversion
const CURRENCY_PATTERNS = {
  USD: [/\$\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi, /USD\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi],
  GBP: [/£\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi, /GBP\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi],
  EUR: [/€\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi, /EUR\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi]
};

// Conversion rates (approximate, should be updated regularly)
const CONVERSION_RATES = {
  USD: 1600, // 1 USD = 1600 NGN (approximate)
  GBP: 2000, // 1 GBP = 2000 NGN (approximate)
  EUR: 1700  // 1 EUR = 1700 NGN (approximate)
};

export class PriceExtractionService {
  
  /**
   * Extract prices from search results with year filtering
   */
  extractPrices(
    results: SerperSearchResult[], 
    itemType?: ItemIdentifier['type'],
    targetYear?: number
  ): PriceExtractionResult {
    const extractedPrices: ExtractedPrice[] = [];
    
    console.log(`🔍 Starting price extraction from ${results.length} search results`);
    
    for (const result of results) {
      const domain = this.extractDomain(result.link);
      console.log(`\n📄 Processing result from: ${domain}`);
      console.log(`   Title: ${result.title.substring(0, 80)}...`);
      console.log(`   Snippet: ${result.snippet.substring(0, 100)}...`);
      
      // Extract from snippet
      const snippetPrices = this.extractFromText(
        result.snippet, 
        result.link, 
        result.title, 
        result.snippet
      );
      if (snippetPrices.length > 0) {
        console.log(`   ✅ Found ${snippetPrices.length} price(s) in snippet`);
        snippetPrices.forEach(p => console.log(`      - ${p.originalText} = ₦${p.price.toLocaleString()}`));
      }
      extractedPrices.push(...snippetPrices);
      
      // Extract from title
      const titlePrices = this.extractFromText(
        result.title, 
        result.link, 
        result.title, 
        result.snippet
      );
      if (titlePrices.length > 0) {
        console.log(`   ✅ Found ${titlePrices.length} price(s) in title`);
        titlePrices.forEach(p => console.log(`      - ${p.originalText} = ₦${p.price.toLocaleString()}`));
      }
      extractedPrices.push(...titlePrices);
      
      // Use structured price data if available
      if (result.price && result.currency) {
        const structuredPrice = this.createStructuredPrice(result);
        if (structuredPrice) {
          console.log(`   ✅ Found structured price: ${result.currency} ${result.price}`);
          extractedPrices.push(structuredPrice);
        }
      }
      
      if (snippetPrices.length === 0 && titlePrices.length === 0 && !result.price) {
        console.log(`   ❌ No prices found in this result`);
      }
    }
    
    console.log(`\n📊 Total prices extracted before filtering: ${extractedPrices.length}`);
    
    // Extract years from all prices
    this.extractYearsFromPrices(extractedPrices);
    
    // Remove duplicates and validate (with year filtering if target year provided)
    const validPrices = this.validateAndDeduplicatePrices(extractedPrices, itemType, targetYear);
    
    console.log(`📊 Valid prices after filtering: ${validPrices.length}`);
    
    // Calculate statistics
    const statistics = this.calculatePriceStatistics(validPrices);
    
    return {
      prices: validPrices,
      ...statistics,
      confidence: this.calculateOverallConfidence(validPrices),
      currency: 'NGN',
      extractedAt: new Date()
    };
  }

  /**
   * Extract year from title and snippet for each price
   */
  private extractYearsFromPrices(prices: ExtractedPrice[]): void {
    const yearPattern = /\b(19|20)\d{2}\b/g;
    
    for (const price of prices) {
      // Try to extract year from title first, then snippet
      const textToSearch = `${price.title} ${price.snippet}`;
      const yearMatches = textToSearch.match(yearPattern);
      
      if (yearMatches && yearMatches.length > 0) {
        // Take the most recent year found (likely the vehicle year)
        const years = yearMatches.map(y => parseInt(y));
        const mostRecentYear = Math.max(...years);
        
        // Validate year is reasonable (1990-2026)
        if (mostRecentYear >= 1990 && mostRecentYear <= 2026) {
          price.extractedYear = mostRecentYear;
        }
      }
    }
  }

  /**
   * Extract prices from a text string
   */
  private extractFromText(
    text: string, 
    url: string, 
    title: string, 
    snippet: string
  ): ExtractedPrice[] {
    const prices: ExtractedPrice[] = [];
    
    // Extract Naira prices
    for (const pattern of NAIRA_PATTERNS) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const extractedPrice = this.parseNairaPrice(match, text, url, title, snippet);
        if (extractedPrice) {
          prices.push(extractedPrice);
        }
      }
    }
    
    // Extract other currencies and convert
    for (const [currency, patterns] of Object.entries(CURRENCY_PATTERNS)) {
      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const extractedPrice = this.parseOtherCurrency(
            match, 
            currency as keyof typeof CONVERSION_RATES, 
            text, 
            url, 
            title, 
            snippet
          );
          if (extractedPrice) {
            prices.push(extractedPrice);
          }
        }
      }
    }
    
    return prices;
  }

  /**
   * Parse Naira price from regex match
   */
  private parseNairaPrice(
    match: RegExpExecArray, 
    originalText: string, 
    url: string, 
    title: string, 
    snippet: string
  ): ExtractedPrice | null {
    try {
      let price = 0;
      let confidence = 70; // Base confidence for Naira prices
      
      if (match.length >= 3 && match[2]) {
        // Handle million/thousand abbreviations
        const number = parseFloat(match[1].replace(/,/g, ''));
        const multiplier = match[2].toLowerCase();
        
        if (multiplier.startsWith('m')) {
          price = number * 1000000;
        } else if (multiplier.startsWith('k') || multiplier.startsWith('t')) {
          price = number * 1000;
        }
        
        confidence += 20; // Higher confidence for abbreviated formats
      } else {
        // Handle regular number format (including large numbers with commas like "120,000,000")
        const cleanedNumber = match[1].replace(/,/g, '');
        price = parseFloat(cleanedNumber);
        
        // Higher confidence for properly formatted large numbers (with commas)
        if (match[1].includes(',')) {
          confidence += 10;
        }
      }
      
      // Adjust confidence based on source
      const sourceBonus = this.getSourceConfidenceBonus(url);
      confidence += sourceBonus;
      
      const domain = this.extractDomain(url);
      console.log(`   💵 Parsed: ${match[0]} → ₦${price.toLocaleString()} (confidence: ${Math.min(confidence, 100)}%, source: ${domain})`);
      
      return {
        price,
        currency: 'NGN',
        originalText: match[0],
        confidence: Math.min(confidence, 100),
        source: domain,
        url,
        title,
        snippet
      };
    } catch (error) {
      console.log(`   ❌ Failed to parse price: ${match[0]} - ${error}`);
      return null;
    }
  }

  /**
   * Parse other currency and convert to Naira
   */
  private parseOtherCurrency(
    match: RegExpExecArray,
    currency: keyof typeof CONVERSION_RATES,
    originalText: string,
    url: string,
    title: string,
    snippet: string
  ): ExtractedPrice | null {
    try {
      const foreignPrice = parseFloat(match[1].replace(/,/g, ''));
      const conversionRate = CONVERSION_RATES[currency];
      const nairaPrice = foreignPrice * conversionRate;
      
      // Lower confidence for converted prices
      let confidence = 40;
      confidence += this.getSourceConfidenceBonus(url);
      
      return {
        price: nairaPrice,
        currency: 'NGN',
        originalText: `${match[0]} (converted from ${currency})`,
        confidence: Math.min(confidence, 80), // Cap converted prices at 80%
        source: this.extractDomain(url),
        url,
        title,
        snippet
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Create price from structured data
   */
  private createStructuredPrice(result: SerperSearchResult): ExtractedPrice | null {
    if (!result.price || !result.currency) return null;
    
    let price = result.price;
    let confidence = 90; // High confidence for structured data
    
    // Convert to Naira if needed
    if (result.currency !== 'NGN' && result.currency in CONVERSION_RATES) {
      const conversionRate = CONVERSION_RATES[result.currency as keyof typeof CONVERSION_RATES];
      price = result.price * conversionRate;
      confidence = 70; // Lower confidence for converted structured data
    }
    
    return {
      price,
      currency: 'NGN',
      originalText: `${result.currency} ${result.price} (structured data)`,
      confidence,
      source: this.extractDomain(result.link),
      url: result.link,
      title: result.title,
      snippet: result.snippet
    };
  }

  /**
   * Validate prices and remove duplicates with year filtering
   */
  private validateAndDeduplicatePrices(
    prices: ExtractedPrice[], 
    itemType?: ItemIdentifier['type'],
    targetYear?: number
  ): ExtractedPrice[] {
    // Filter out invalid prices
    let validPrices = prices.filter(price => this.validatePrice(price, itemType));
    
    // Apply year filtering for vehicles if target year provided
    if (itemType === 'vehicle' && targetYear) {
      const yearTolerance = 2; // ±2 years
      
      validPrices = validPrices.filter(price => {
        // If no year extracted, REJECT the price for year-specific searches
        // This prevents contamination from listings that don't specify year
        if (!price.extractedYear) {
          console.log(`🚫 Rejecting price ₦${price.price.toLocaleString()} - no year found in listing`);
          return false;
        }
        
        // Check if year is within tolerance
        const yearDiff = Math.abs(price.extractedYear - targetYear);
        const isYearMatch = yearDiff <= yearTolerance;
        
        // Mark whether year matched
        price.yearMatched = isYearMatch;
        
        // Log rejected prices
        if (!isYearMatch) {
          console.log(`🚫 Rejecting price ₦${price.price.toLocaleString()} - wrong year (${price.extractedYear} vs ${targetYear})`);
        }
        
        return isYearMatch;
      });
      
      console.log(`📊 Year filtering: ${validPrices.length}/${prices.length} prices match year ${targetYear} ±${yearTolerance}`);
    }
    
    // Apply statistical outlier detection
    if (validPrices.length >= 5) {
      const beforeOutlierRemoval = validPrices.length;
      validPrices = this.removeStatisticalOutliers(validPrices);
      
      if (validPrices.length < beforeOutlierRemoval) {
        console.log(`📊 Outlier removal: ${beforeOutlierRemoval - validPrices.length} outliers removed`);
      }
    }
    
    // Remove duplicates (same price from same source with same original text)
    const deduplicatedPrices: ExtractedPrice[] = [];
    const seen = new Set<string>();
    
    for (const price of validPrices) {
      const key = `${price.price}-${price.source}-${price.originalText}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicatedPrices.push(price);
      }
    }
    
    // Sort by confidence (highest first)
    return deduplicatedPrices.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Remove statistical outliers using IQR method
   */
  private removeStatisticalOutliers(prices: ExtractedPrice[]): ExtractedPrice[] {
    if (prices.length < 5) return prices;
    
    const priceValues = prices.map(p => p.price).sort((a, b) => a - b);
    
    // Calculate quartiles
    const q1Index = Math.floor(priceValues.length * 0.25);
    const q3Index = Math.floor(priceValues.length * 0.75);
    const q1 = priceValues[q1Index];
    const q3 = priceValues[q3Index];
    const iqr = q3 - q1;
    
    // Calculate bounds (1.5 * IQR is standard for outlier detection)
    const lowerBound = q1 - (1.5 * iqr);
    const upperBound = q3 + (1.5 * iqr);
    
    // Filter out outliers
    return prices.filter(price => {
      const isOutlier = price.price < lowerBound || price.price > upperBound;
      
      if (isOutlier) {
        console.log(`🚫 Statistical outlier removed: ₦${price.price.toLocaleString()} (bounds: ₦${lowerBound.toLocaleString()} - ₦${upperBound.toLocaleString()})`);
      }
      
      return !isOutlier;
    });
  }

  /**
   * Validate individual price
   * 
   * Philosophy: Trust internet search results. Only reject clearly invalid data.
   */
  private validatePrice(price: ExtractedPrice, itemType?: ItemIdentifier['type']): boolean {
    // Basic validation - only reject clearly invalid prices
    if (!price.price || price.price <= 0 || !isFinite(price.price)) {
      return false;
    }
    
    // Confidence threshold - reject low confidence extractions
    if (price.confidence < 30) {
      return false;
    }
    
    // CRITICAL FIX: Add minimum price thresholds by item type to filter out part prices
    const minPriceThresholds: Record<string, number> = {
      'vehicle': 500000, // Minimum ₦500k for vehicles (filters out part prices like ₦80)
      'electronics': 10000, // Minimum ₦10k for electronics
      'appliance': 20000, // Minimum ₦20k for appliances
      'machinery': 100000, // Minimum ₦100k for machinery
      'property': 1000000, // Minimum ₦1M for property
      'jewelry': 5000, // Minimum ₦5k for jewelry
      'furniture': 10000, // Minimum ₦10k for furniture
    };
    
    const minPrice = itemType ? minPriceThresholds[itemType] || 1000 : 1000;
    if (price.price < minPrice) {
      console.log(`🚫 Rejecting price ₦${price.price.toLocaleString()} - below minimum threshold of ₦${minPrice.toLocaleString()} for ${itemType || 'unknown'} type`);
      return false;
    }
    
    return true;
  }

  /**
   * Calculate price statistics
   */
  private calculatePriceStatistics(prices: ExtractedPrice[]) {
    if (prices.length === 0) {
      return {};
    }
    
    const priceValues = prices.map(p => p.price);
    const sortedPrices = [...priceValues].sort((a, b) => a - b);
    
    const averagePrice = priceValues.reduce((sum, price) => sum + price, 0) / priceValues.length;
    const medianPrice = sortedPrices.length % 2 === 0
      ? (sortedPrices[sortedPrices.length / 2 - 1] + sortedPrices[sortedPrices.length / 2]) / 2
      : sortedPrices[Math.floor(sortedPrices.length / 2)];
    
    return {
      averagePrice: Math.round(averagePrice),
      medianPrice: Math.round(medianPrice),
      priceRange: {
        min: Math.min(...priceValues),
        max: Math.max(...priceValues)
      }
    };
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(prices: ExtractedPrice[]): number {
    if (prices.length === 0) return 0;
    
    // Base confidence from individual prices
    const avgConfidence = prices.reduce((sum, price) => sum + price.confidence, 0) / prices.length;
    
    // Bonus for multiple sources
    const uniqueSources = new Set(prices.map(p => p.source)).size;
    const sourceBonus = Math.min(uniqueSources * 10, 30);
    
    // Bonus for price consistency
    const priceValues = prices.map(p => p.price);
    const avgPrice = priceValues.reduce((sum, price) => sum + price, 0) / priceValues.length;
    const variance = priceValues.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / priceValues.length;
    const consistencyBonus = variance < (avgPrice * 0.3) ? 15 : 0; // Low variance bonus
    
    return Math.min(Math.round(avgConfidence + sourceBonus + consistencyBonus), 100);
  }

  /**
   * Get confidence bonus based on source reliability
   */
  private getSourceConfidenceBonus(url: string): number {
    const domain = this.extractDomain(url).toLowerCase();
    
    // Nigerian marketplace bonuses
    if (domain.includes('jiji.ng')) return 25;
    if (domain.includes('cars45')) return 20;
    if (domain.includes('cheki')) return 20;
    if (domain.includes('autochek')) return 20;
    if (domain.includes('olx')) return 15;
    if (domain.includes('jumia')) return 15;
    if (domain.includes('konga')) return 15;
    
    // International marketplaces
    if (domain.includes('ebay')) return 10;
    if (domain.includes('amazon')) return 10;
    
    // Dealer/official sites
    if (domain.includes('toyota') || domain.includes('honda') || domain.includes('mercedes')) return 15;
    
    return 0;
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  }
}

// Export singleton instance
export const priceExtractor = new PriceExtractionService();