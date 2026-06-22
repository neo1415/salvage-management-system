import type { SerperSearchResult } from '@/lib/integrations/serper-api';
import type { ItemIdentifier } from './query-builder.service';
import { getDefaultValuationPolicyConfig } from '@/features/valuations/services/valuation-policy.service';
import type { ValuationPolicyConfig } from '@/features/valuations/services/valuation-policy.service';

export interface ExtractedPrice {
  price: number;
  currency: 'NGN' | 'USD' | 'GBP' | 'EUR';
  originalText: string;
  confidence: number;
  sourceQuality: 'high' | 'medium' | 'low';
  source: string;
  url: string;
  title: string;
  snippet: string;
  extractedYear?: number | null;
  yearMatched?: boolean;
  matchEvidence?: string[];
}

export interface PriceExtractionResult {
  prices: ExtractedPrice[];
  rejectedPrices?: Array<ExtractedPrice & { rejectionReason: string }>;
  averagePrice?: number;
  medianPrice?: number;
  priceRange?: {
    min: number;
    max: number;
  };
  confidence: number;
  currency: 'NGN';
  evidenceSummary?: {
    uniqueSourceCount: number;
    priceSpreadPercent: number;
    highQualitySourceCount: number;
    noYearPriceCount: number;
  };
  extractedAt: Date;
}

interface PriceExtractionOptions {
  mode?: 'market' | 'part';
  partName?: string;
  exchangeRates?: Partial<Record<'USD' | 'GBP' | 'EUR', number>>;
  pricePlausibility?: ValuationPolicyConfig['pricePlausibility'];
}

const NAIRA_PATTERNS = [
  /₦\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi,
  /₦\s*([0-9]+(?:\.[0-9]+)?)\s*([mk]|million|thousand)/gi,
  /₦\s*([0-9]+(?:\.[0-9]+)?)\s*([mk]|million|thousand)\s*(?:-|to|and)\s*₦?\s*([0-9]+(?:\.[0-9]+)?)\s*([mk]|million|thousand)?/gi,
  /(?:₦|N)\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi,
  /NGN\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi,
  /([0-9,]+(?:\.[0-9]{1,2})?)\s*naira/gi,
  /(?:₦|N)\s*([0-9]+(?:\.[0-9]+)?)\s*([mk]|million|thousand)/gi,
  /([0-9]+(?:\.[0-9]+)?)\s*(million|thousand)\s*naira/gi,
  /(?:₦|N)\s*([0-9]+(?:\.[0-9]+)?)\s*([mk]|million|thousand)\s*(?:-|to|and)\s*(?:₦|N)?\s*([0-9]+(?:\.[0-9]+)?)\s*([mk]|million|thousand)?/gi,
];

const CURRENCY_PATTERNS = {
  USD: [/\$\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi, /USD\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi],
  GBP: [/£\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi, /GBP\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi],
  EUR: [/€\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi, /EUR\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi],
};

const SOURCE_QUALITY: Record<'high' | 'medium' | 'low', string[]> = {
  high: ['jiji.ng', 'cars45', 'autochek', 'cars.ng', 'carlots.ng', 'betacar.ng', 'cheki', 'buildingsandmoreng.com'],
  medium: ['jumia', 'konga', '234drive', 'nairaland', 'facebook.com/marketplace', 'tradeford.com', 'alibaba.com'],
  low: ['tiktok.com', 'instagram.com', 'facebook.com', 'youtube.com', 'pinterest'],
};

export class PriceExtractionService {
  extractPrices(
    results: SerperSearchResult[],
    itemType?: ItemIdentifier['type'],
    targetYear?: number,
    options: PriceExtractionOptions = {}
  ): PriceExtractionResult {
    const extractedPrices: ExtractedPrice[] = [];

    for (const result of results) {
      extractedPrices.push(
        ...this.extractFromText(result.snippet || '', result.link, result.title || '', result.snippet || '', options),
        ...this.extractFromText(result.title || '', result.link, result.title || '', result.snippet || '', options)
      );

      const structuredPrice = this.createStructuredPrice(result, options);
      if (structuredPrice) extractedPrices.push(structuredPrice);
    }

    this.extractYearsFromPrices(extractedPrices);

    const { validPrices, rejectedPrices } = this.validateAndDeduplicatePrices(
      extractedPrices,
      itemType,
      targetYear,
      options
    );

    const statistics = this.calculatePriceStatistics(validPrices);

    return {
      prices: validPrices,
      rejectedPrices,
      ...statistics,
      confidence: this.calculateOverallConfidence(validPrices),
      currency: 'NGN',
      evidenceSummary: this.calculateEvidenceSummary(validPrices),
      extractedAt: new Date(),
    };
  }

  private extractFromText(
    text: string,
    url: string,
    title: string,
    snippet: string,
    options: PriceExtractionOptions
  ): ExtractedPrice[] {
    const prices: ExtractedPrice[] = [];

    for (const pattern of NAIRA_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const price = this.parseNairaPrice(match, url, title, snippet);
        if (price) prices.push(price);
      }
    }

    for (const [currency, patterns] of Object.entries(CURRENCY_PATTERNS)) {
      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(text)) !== null) {
          const price = this.parseOtherCurrency(
            match,
            currency as keyof typeof CURRENCY_PATTERNS,
            url,
            title,
            snippet,
            options
          );
          if (price) prices.push(price);
        }
      }
    }

    return prices;
  }

  private parseNairaPrice(match: RegExpExecArray, url: string, title: string, snippet: string): ExtractedPrice | null {
    const amount = this.parseAmount(match);
    if (!amount) return null;

    const confidence = Math.min(100, 70 + (match[0].includes(',') ? 10 : 0) + this.getSourceConfidenceBonus(url));
    return this.buildPrice(amount, 'NGN', match[0], confidence, url, title, snippet);
  }

  private parseOtherCurrency(
    match: RegExpExecArray,
    currency: keyof typeof CURRENCY_PATTERNS,
    url: string,
    title: string,
    snippet: string,
    options: PriceExtractionOptions
  ): ExtractedPrice | null {
    const foreignPrice = parseFloat(match[1].replace(/,/g, ''));
    if (!Number.isFinite(foreignPrice)) return null;

    const defaultRates = getDefaultValuationPolicyConfig().exchangeRates;
    const conversionRate = options.exchangeRates?.[currency] || defaultRates[currency];
    const confidence = Math.min(80, 40 + this.getSourceConfidenceBonus(url));

    return this.buildPrice(
      foreignPrice * conversionRate,
      'NGN',
      `${match[0]} (converted from ${currency})`,
      confidence,
      url,
      title,
      snippet
    );
  }

  private parseAmount(match: RegExpExecArray): number | null {
    const number = parseFloat(match[1].replace(/,/g, ''));
    if (!Number.isFinite(number)) return null;

    const multiplier = match[2]?.toLowerCase();
    if (!multiplier) return number;
    if (multiplier.startsWith('m')) return number * 1_000_000;
    if (multiplier.startsWith('k') || multiplier.startsWith('t')) return number * 1_000;
    return number;
  }

  private createStructuredPrice(result: SerperSearchResult, options: PriceExtractionOptions): ExtractedPrice | null {
    if (!result.price || !result.currency) return null;

    let price = result.price;
    let confidence = 90;
    const currency = result.currency as 'NGN' | 'USD' | 'GBP' | 'EUR';

    if (currency !== 'NGN' && ['USD', 'GBP', 'EUR'].includes(currency)) {
      const defaultRates = getDefaultValuationPolicyConfig().exchangeRates;
      price = result.price * (options.exchangeRates?.[currency] || defaultRates[currency]);
      confidence = 70;
    }

    return this.buildPrice(price, 'NGN', `${result.currency} ${result.price} (structured data)`, confidence, result.link, result.title, result.snippet);
  }

  private buildPrice(
    price: number,
    currency: ExtractedPrice['currency'],
    originalText: string,
    confidence: number,
    url: string,
    title: string,
    snippet: string
  ): ExtractedPrice {
    return {
      price,
      currency,
      originalText,
      confidence,
      sourceQuality: this.getSourceQuality(url),
      source: this.extractDomain(url),
      url,
      title,
      snippet,
    };
  }

  private extractYearsFromPrices(prices: ExtractedPrice[]): void {
    for (const price of prices) {
      const detected = this.detectRelevantYear(price);
      price.extractedYear = detected.year;
      price.matchEvidence = detected.evidence;
    }
  }

  private detectRelevantYear(price: ExtractedPrice): { year?: number; evidence: string[] } {
    const evidence: string[] = [];
    const texts = [
      { label: 'title', text: price.title },
      { label: 'price context', text: price.originalText },
      { label: 'snippet', text: price.snippet },
    ];

    for (const item of texts) {
      const years = (item.text.match(/\b(?:19|20)\d{2}\b/g) || [])
        .map(Number)
        .filter((year) => this.isPlausibleItemYear(year))
        .filter((year) => !this.isLikelyPublicationYear(item.text, year));

      if (years.length > 0) {
        evidence.push(`${item.label}:${years[0]}`);
        return { year: years[0], evidence };
      }
    }

    return { evidence };
  }

  private isPlausibleItemYear(year: number): boolean {
    return year >= 1990 && year <= new Date().getFullYear() + 1;
  }

  private isLikelyPublicationYear(text: string, year: number): boolean {
    const lower = text.toLowerCase();
    const index = lower.indexOf(String(year));
    if (index < 0) return false;
    const context = lower.slice(Math.max(0, index - 28), index + 32);
    return /\b(updated|as of|current|price in|posted|published|january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(context);
  }

  private validateAndDeduplicatePrices(
    prices: ExtractedPrice[],
    itemType?: ItemIdentifier['type'],
    targetYear?: number,
    options: PriceExtractionOptions = {}
  ): { validPrices: ExtractedPrice[]; rejectedPrices: Array<ExtractedPrice & { rejectionReason: string }> } {
    const rejectedPrices: Array<ExtractedPrice & { rejectionReason: string }> = [];

    let validPrices = prices.filter((price) => {
      const reason = this.getPriceValidationFailure(price, itemType, options);
      if (reason) {
        rejectedPrices.push({ ...price, rejectionReason: reason });
        return false;
      }
      return true;
    });

    if (itemType === 'vehicle' && targetYear) {
      const tolerance = 2;
      validPrices = validPrices.filter((price) => {
        if (!price.extractedYear) {
          if (price.sourceQuality === 'high' && price.confidence >= 90) {
            price.yearMatched = false;
            price.confidence = Math.max(60, price.confidence - 25);
            price.matchEvidence = [...(price.matchEvidence || []), 'No model year; high-quality source retained at reduced confidence'];
            return true;
          }
          rejectedPrices.push({ ...price, rejectionReason: 'No relevant vehicle model year found' });
          return false;
        }

        const matched = Math.abs(price.extractedYear - targetYear) <= tolerance;
        price.yearMatched = matched;
        if (!matched) {
          rejectedPrices.push({ ...price, rejectionReason: `Model year ${price.extractedYear} outside ${targetYear} +/- ${tolerance}` });
        }
        return matched;
      });
    }

    if (validPrices.length >= 5) {
      validPrices = this.removeStatisticalOutliers(validPrices, rejectedPrices);
    }

    const seen = new Set<string>();
    const deduplicated = validPrices.filter((price) => {
      const key = `${Math.round(price.price)}-${price.source}-${price.originalText}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return {
      validPrices: deduplicated.sort((a, b) => b.confidence - a.confidence),
      rejectedPrices,
    };
  }

  private getPriceValidationFailure(
    price: ExtractedPrice,
    itemType?: ItemIdentifier['type'],
    options: PriceExtractionOptions = {}
  ): string | null {
    if (!price.price || price.price <= 0 || !Number.isFinite(price.price)) return 'Invalid numeric price';
    if (price.confidence < 30) return 'Extraction confidence below 30%';

    if (options.mode === 'part') {
      if (!this.isRelevantPartListing(price, options.partName)) return `Listing is not specific to ${options.partName || 'part'}`;
      const maxPartPrice = this.getMaximumPlausiblePartPrice(itemType, options.partName, options);
      if (price.price > maxPartPrice) return `Part price above plausible maximum of NGN ${maxPartPrice.toLocaleString()}`;
    }

    const minPrice = options.mode === 'part'
      ? this.getMinimumPlausiblePartPrice(itemType, options.partName, options)
      : this.getMinimumPlausibleMarketPrice(itemType, options);

    if (price.price < minPrice) return `Price below minimum threshold of NGN ${minPrice.toLocaleString()}`;

    return null;
  }

  private removeStatisticalOutliers(
    prices: ExtractedPrice[],
    rejectedPrices: Array<ExtractedPrice & { rejectionReason: string }>
  ): ExtractedPrice[] {
    const values = prices.map((p) => p.price).sort((a, b) => a - b);
    const q1 = values[Math.floor(values.length * 0.25)];
    const q3 = values[Math.floor(values.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    return prices.filter((price) => {
      const outlier = price.price < lowerBound || price.price > upperBound;
      if (outlier) rejectedPrices.push({ ...price, rejectionReason: 'Statistical outlier' });
      return !outlier;
    });
  }

  private calculatePriceStatistics(prices: ExtractedPrice[]) {
    if (prices.length === 0) return {};
    const values = prices.map((p) => p.price);
    const sorted = [...values].sort((a, b) => a - b);
    const averagePrice = values.reduce((sum, price) => sum + price, 0) / values.length;
    const medianPrice = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

    return {
      averagePrice: Math.round(averagePrice),
      medianPrice: Math.round(medianPrice),
      priceRange: {
        min: Math.min(...values),
        max: Math.max(...values),
      },
    };
  }

  private calculateOverallConfidence(prices: ExtractedPrice[]): number {
    if (prices.length === 0) return 0;
    const avgConfidence = prices.reduce((sum, price) => sum + price.confidence, 0) / prices.length;
    const uniqueSources = new Set(prices.map((p) => p.source)).size;
    const sourceBonus = Math.min(uniqueSources * 8, 24);
    const highQualityBonus = Math.min(prices.filter((p) => p.sourceQuality === 'high').length * 4, 16);
    const spreadPenalty = Math.min(this.calculatePriceSpreadPercent(prices) / 4, 25);

    return Math.max(0, Math.min(100, Math.round(avgConfidence + sourceBonus + highQualityBonus - spreadPenalty)));
  }

  private calculateEvidenceSummary(prices: ExtractedPrice[]): PriceExtractionResult['evidenceSummary'] {
    return {
      uniqueSourceCount: new Set(prices.map((p) => p.source)).size,
      priceSpreadPercent: this.calculatePriceSpreadPercent(prices),
      highQualitySourceCount: prices.filter((p) => p.sourceQuality === 'high').length,
      noYearPriceCount: prices.filter((p) => p.extractedYear == null).length,
    };
  }

  private calculatePriceSpreadPercent(prices: ExtractedPrice[]): number {
    if (prices.length < 2) return 0;
    const values = prices.map((p) => p.price);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const median = this.calculatePriceStatistics(prices).medianPrice || min;
    if (median <= 0) return 0;
    return Math.round(((max - min) / median) * 100);
  }

  private getMinimumPlausibleMarketPrice(itemType?: ItemIdentifier['type'], options: PriceExtractionOptions = {}): number {
    const thresholds = options.pricePlausibility?.marketMinimums || getDefaultValuationPolicyConfig().pricePlausibility.marketMinimums;
    return itemType ? thresholds[itemType] || 1_000 : 1_000;
  }

  private getMinimumPlausiblePartPrice(itemType?: ItemIdentifier['type'], partName?: string, options: PriceExtractionOptions = {}): number {
    const thresholds = options.pricePlausibility?.partMinimums || getDefaultValuationPolicyConfig().pricePlausibility.partMinimums;
    const part = partName?.toLowerCase() || '';
    if (itemType === 'vehicle') {
      if (/(engine|transmission|gearbox)/.test(part)) return thresholds.vehicle_powertrain || thresholds.vehicle || 3_000;
      if (/(bumper|hood|door|fender|windshield|headlight|taillight|mirror|wheel|tire|tyre)/.test(part)) return thresholds.vehicle_body || thresholds.vehicle || 3_000;
      return thresholds.vehicle || thresholds.general_asset || 3_000;
    }
    return (itemType && thresholds[itemType]) || thresholds.general_asset || 3_000;
  }

  private getMaximumPlausiblePartPrice(itemType?: ItemIdentifier['type'], partName?: string, options: PriceExtractionOptions = {}): number {
    const thresholds = options.pricePlausibility?.partMaximums || getDefaultValuationPolicyConfig().pricePlausibility.partMaximums;
    const part = partName?.toLowerCase() || '';
    if (itemType === 'vehicle') {
      if (/(engine|transmission|gearbox)/.test(part)) return thresholds.vehicle_powertrain || thresholds.vehicle || 5_000_000;
      if (/(body panel|quarter panel|panel|hood|bonnet|door|fender|bumper|windshield)/.test(part)) return thresholds.vehicle_body || thresholds.vehicle || 5_000_000;
      return thresholds.vehicle || thresholds.general_asset || 5_000_000;
    }
    return (itemType && thresholds[itemType]) || thresholds.general_asset || 5_000_000;
  }

  private isRelevantPartListing(price: ExtractedPrice, partName?: string): boolean {
    const part = (partName || '').toLowerCase().trim();
    const text = `${price.title} ${price.snippet}`.toLowerCase();
    const tokens = this.getPartTokens(part);
    const hasPartToken = tokens.some((token) => text.includes(token));
    if (!hasPartToken) return false;

    const wholeAssetSignals = [
      'cars for sale',
      'car for sale',
      'vehicles for sale',
      'vehicle for sale',
      'market range',
      'foreign used',
      'tokunbo',
    ];

    if (!wholeAssetSignals.some((signal) => text.includes(signal))) return true;
    return tokens.some((token) => text.includes(`${token} for`) || text.includes(`${token} available`));
  }

  private getPartTokens(partName: string): string[] {
    const baseTokens = partName.split(/[^a-z0-9]+/).filter((token) => token.length > 2);
    const synonyms: Record<string, string[]> = {
      bumper: ['bumper', 'front bumper', 'rear bumper'],
      'body panel': ['body panel', 'panel', 'quarter panel', 'fender', 'bonnet', 'hood'],
      hood: ['hood', 'bonnet'],
      bonnet: ['bonnet', 'hood'],
      'engine parts': ['engine', 'alternator', 'compressor', 'radiator', 'starter'],
      headlight: ['headlight', 'head lamp', 'lamp'],
      windshield: ['windshield', 'windscreen', 'glass'],
    };
    return Array.from(new Set([...baseTokens, ...(synonyms[partName] || [])]));
  }

  private getSourceConfidenceBonus(url: string): number {
    const quality = this.getSourceQuality(url);
    if (quality === 'high') return 24;
    if (quality === 'medium') return 12;
    return 0;
  }

  private getSourceQuality(url: string): ExtractedPrice['sourceQuality'] {
    const domain = this.extractDomain(url).toLowerCase();
    if (SOURCE_QUALITY.high.some((source) => domain.includes(source))) return 'high';
    if (SOURCE_QUALITY.medium.some((source) => domain.includes(source))) return 'medium';
    if (SOURCE_QUALITY.low.some((source) => domain.includes(source))) return 'low';
    return 'medium';
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }
}

export const priceExtractor = new PriceExtractionService();
