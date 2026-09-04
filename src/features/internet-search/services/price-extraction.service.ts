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
  item?: ItemIdentifier;
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

const NAIRA_RANGE_PATTERN = /(?:₦|NGN|N)\s*([0-9,]+(?:\.[0-9]+)?)\s*([mk]|million|thousand)?\s*(?:-|–|to)\s*(?:₦|NGN|N)?\s*([0-9,]+(?:\.[0-9]+)?)\s*([mk]|million|thousand)?/gi;

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
    let searchableText = text;

    NAIRA_RANGE_PATTERN.lastIndex = 0;
    let rangeMatch: RegExpExecArray | null;
    while ((rangeMatch = NAIRA_RANGE_PATTERN.exec(text)) !== null) {
      const rangePrice = this.parseNairaRange(rangeMatch, url, title, snippet);
      if (rangePrice) prices.push(rangePrice);
    }
    searchableText = searchableText.replace(NAIRA_RANGE_PATTERN, ' ');

    for (const pattern of NAIRA_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(searchableText)) !== null) {
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

  private parseNairaRange(match: RegExpExecArray, url: string, title: string, snippet: string): ExtractedPrice | null {
    const firstMultiplier = match[2] || match[4];
    const secondMultiplier = match[4] || match[2];
    const first = this.applyAmountMultiplier(Number(match[1].replace(/,/g, '')), firstMultiplier);
    const second = this.applyAmountMultiplier(Number(match[3].replace(/,/g, '')), secondMultiplier);
    if (!Number.isFinite(first) || !Number.isFinite(second) || first <= 0 || second <= 0) return null;
    const midpoint = Math.round((Math.min(first, second) + Math.max(first, second)) / 2);
    const confidence = Math.min(95, 75 + this.getSourceConfidenceBonus(url));
    return this.buildPrice(midpoint, 'NGN', `${match[0]} (range midpoint)`, confidence, url, title, snippet);
  }

  private applyAmountMultiplier(value: number, multiplier?: string): number {
    const normalized = multiplier?.toLowerCase();
    if (normalized?.startsWith('m')) return value * 1_000_000;
    if (normalized?.startsWith('k') || normalized?.startsWith('t')) return value * 1_000;
    return value;
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

    const seen = new Set<string>();
    let deduplicated = validPrices.filter((price) => {
      const key = `${Math.round(price.price)}-${price.source}-${price.originalText}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (deduplicated.length >= 5) {
      deduplicated = this.removeStatisticalOutliers(deduplicated, rejectedPrices);
    }

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

    if (options.mode !== 'part' && options.item) {
      const relevanceFailure = this.getMarketListingRelevanceFailure(price, options.item);
      if (relevanceFailure) return relevanceFailure;
    }

    if (options.mode === 'part') {
      if (!this.isRelevantPartListing(price, options.partName)) return `Listing is not specific to ${options.partName || 'part'}`;
      const maxPartPrice = this.getMaximumPlausiblePartPrice(itemType, options.partName, options);
      if (price.price > maxPartPrice) return `Part price above plausible maximum of NGN ${maxPartPrice.toLocaleString()}`;
    }

    const minPrice = options.mode === 'part'
      ? this.getMinimumPlausiblePartPrice(itemType, options.partName, options)
      : this.getMinimumPlausibleMarketPrice(itemType, options);

    if (price.price < minPrice) return `Price below minimum threshold of NGN ${minPrice.toLocaleString()}`;

    if (options.mode !== 'part') {
      const maxPrice = this.getMaximumPlausibleMarketPrice(itemType);
      if (price.price > maxPrice) return `Price above maximum threshold of NGN ${maxPrice.toLocaleString()}`;
    }

    return null;
  }

  private getMaximumPlausibleMarketPrice(itemType?: ItemIdentifier['type']): number {
    const thresholds: Partial<Record<ItemIdentifier['type'], number>> = {
      vehicle: 2_000_000_000,
      electronics: 25_000_000,
      appliance: 50_000_000,
      machinery: 25_000_000_000,
      property: 2_000_000_000_000,
      jewelry: 100_000_000_000,
      furniture: 500_000_000,
      artwork: 100_000_000_000,
      stock: 100_000_000_000,
      goods_in_transit: 100_000_000_000,
      building_materials: 100_000_000_000,
      scrap: 100_000_000_000,
      agriculture: 100_000_000_000,
      equipment: 25_000_000_000,
      medical_equipment: 100_000_000_000,
      energy_equipment: 250_000_000_000,
      aviation_equipment: 500_000_000_000,
      other: 100_000_000_000,
    };
    return (itemType && thresholds[itemType]) || 100_000_000_000;
  }

  private getMarketListingRelevanceFailure(price: ExtractedPrice, item: ItemIdentifier): string | null {
    const text = this.normalizeIdentityText(`${price.title} ${price.snippet}`);
    if (!text) return 'Listing has no usable identity text';

    const electronicsAccessory = item.type === 'electronics'
      && /\b(case|cover|screen protector|charger|charging cable|housing|replacement screen|display only|box only|accessory)\b/.test(text);
    if (electronicsAccessory || /\b(replica|counterfeit|fake|copy)\b/.test(text)) {
      return 'Listing appears to be an accessory, replacement part, empty box, or replica';
    }

    if (/\b(per month|monthly payment|monthly repayment|installments?|instalments?|deposit only|down payment|pay small small)\b/.test(text)) {
      return 'Listing price appears to be a deposit, installment, or recurring payment rather than the full asset price';
    }

    if ('condition' in item && item.condition) {
      const explicitlyNew = /\b(brand new|factory sealed|sealed pack|unopened|unused|new in box)\b/.test(text);
      const explicitlyUsed = /\b(used|pre owned|preowned|tokunbo|refurbished|fairly used|second hand)\b/.test(text);
      if (explicitlyNew && explicitlyUsed) {
        return 'Listing condition is ambiguous because it advertises both new and used stock';
      }
      if (item.condition === 'Brand New' && explicitlyUsed && !explicitlyNew) {
        return 'Used listing does not match the requested brand-new condition';
      }
      if (item.condition !== 'Brand New' && explicitlyNew && !explicitlyUsed) {
        return 'Brand-new listing does not match the requested used condition';
      }
    }

    switch (item.type) {
      case 'vehicle':
        if (!this.containsIdentity(text, item.make) || !this.containsIdentity(text, item.model)) {
          return 'Vehicle listing does not match the requested make and model';
        }
        break;
      case 'electronics': {
        const modelFailure = this.getElectronicsModelFailure(text, item.model);
        if (modelFailure) return modelFailure;
        if (!this.containsBrandOrProductFamily(text, item.brand, item.model)) {
          return 'Electronics listing does not match the requested brand';
        }
        const storageFailure = this.getStorageMismatch(text, item.storageCapacity || item.storage);
        if (storageFailure) return storageFailure;
        break;
      }
      case 'appliance':
        if (!this.containsIdentity(text, item.brand) || !this.containsIdentity(text, item.model)) {
          return 'Appliance listing does not match the requested brand and model';
        }
        break;
      case 'machinery':
        if (!this.containsIdentity(text, item.brand)
          || (item.model && !this.containsIdentity(text, item.model))
          || (!item.model && !this.containsIdentity(text, item.machineryType))) {
          return 'Machinery listing does not match the requested brand, type, and model';
        }
        break;
      case 'property': {
        if (/\b(for rent|to let|lease|per annum|per year|annual rent)\b/.test(text)) {
          return 'Rental listing does not represent the property sale value';
        }
        const locationTokens = this.identityTokens(item.location).filter((token) => token.length > 3);
        if (!this.containsIdentity(text, item.propertyType)
          || (locationTokens.length > 0 && !locationTokens.some((token) => text.includes(token)))) {
          return 'Property listing does not match the requested type and location';
        }
        break;
      }
      case 'jewelry':
        if ((item.brand && !this.containsIdentity(text, item.brand)) || !this.containsIdentity(text, item.jewelryType)) {
          return 'Jewelry listing does not match the requested brand or item type';
        }
        break;
      case 'artwork':
        if ((item.artist && !this.containsIdentity(text, item.artist)) || !this.containsIdentity(text, item.artworkType)) {
          return 'Artwork listing does not match the requested artist or work type';
        }
        break;
      case 'furniture':
        if (item.brand && !this.containsIdentity(text, item.brand)) {
          return 'Furniture listing does not match the requested brand';
        }
        break;
      default: {
        const brand = 'brand' in item ? item.brand : undefined;
        const model = 'model' in item ? item.model : undefined;
        if ((brand && !this.containsIdentity(text, brand)) || (model && !this.containsIdentity(text, model))) {
          return 'Listing does not match the requested asset brand and model';
        }
        const description = 'description' in item ? item.description : undefined;
        if (!brand && !model && description && !this.hasDescriptionIdentity(text, description)) {
          return 'Listing does not match the requested asset description';
        }
        if (this.isBulkAsset(item.type)) {
          const unitFailure = this.getBulkUnitMismatch(text, 'unitOfMeasure' in item ? item.unitOfMeasure : undefined);
          if (unitFailure) return unitFailure;
        }
      }
    }

    return null;
  }

  private getElectronicsModelFailure(text: string, model: string): string | null {
    const target = this.normalizeIdentityText(model);
    const targetIphone = target.match(/\biphone\s*(\d{1,2})(?:\s+(pro))?(?:\s+(max|plus|mini))?\b/);
    if (targetIphone) {
      const listingIphone = text.match(/\biphone\s*(\d{1,2})(?:\s+(pro))?(?:\s+(max|plus|mini))?\b/);
      const targetVariant = [targetIphone[2], targetIphone[3]].filter(Boolean).join(' ');
      const listingVariant = [listingIphone?.[2], listingIphone?.[3]].filter(Boolean).join(' ');
      if (!listingIphone || listingIphone[1] !== targetIphone[1] || listingVariant !== targetVariant) {
        return 'iPhone listing does not match the requested generation and variant';
      }
      return null;
    }

    const targetGalaxy = target.match(/\bgalaxy\s*([asz]\s*\d{1,3})(?:\s+(ultra|plus|fe))?\b/);
    if (targetGalaxy) {
      const listingGalaxy = text.match(/\bgalaxy\s*([asz]\s*\d{1,3})(?:\s+(ultra|plus|fe))?\b/);
      if (!listingGalaxy
        || listingGalaxy[1].replace(/\s/g, '') !== targetGalaxy[1].replace(/\s/g, '')
        || (listingGalaxy[2] || '') !== (targetGalaxy[2] || '')) {
        return 'Galaxy listing does not match the requested generation and variant';
      }
      return null;
    }

    return this.containsIdentity(text, target)
      ? null
      : 'Electronics listing does not match the requested model';
  }

  private getStorageMismatch(text: string, requestedStorage?: string): string | null {
    if (!requestedStorage) return null;
    const target = this.storageInGb(requestedStorage);
    if (!target) return null;
    const listingStorage = Array.from(text.matchAll(/\b(\d{2,4})\s*(gb|tb)\b/g))
      .map((match) => this.storageInGb(`${match[1]}${match[2]}`))
      .filter((value): value is number => value !== null);
    if (listingStorage.length > 0 && !listingStorage.includes(target)) {
      return 'Electronics listing storage does not match the requested capacity';
    }
    return null;
  }

  private hasDescriptionIdentity(text: string, description: string): boolean {
    const ignored = new Set([
      'asset', 'item', 'goods', 'used', 'new', 'damaged', 'damage', 'salvage', 'stock',
      'batch', 'lot', 'approximately', 'warehouse', 'available', 'sale', 'nigeria',
    ]);
    const tokens = this.identityTokens(description)
      .filter((token) => token.length > 2 && !ignored.has(token))
      .slice(0, 8);
    if (tokens.length === 0) return false;
    const matches = tokens.filter((token) => (` ${text} `).includes(` ${token} `)).length;
    return matches >= Math.min(2, tokens.length);
  }

  private isBulkAsset(type: ItemIdentifier['type']): boolean {
    return ['stock', 'goods_in_transit', 'building_materials', 'scrap', 'agriculture'].includes(type);
  }

  private getBulkUnitMismatch(text: string, requestedUnit?: string): string | null {
    if (!requestedUnit?.trim()) return null;
    const unitGroups: Array<{ name: string; pattern: RegExp }> = [
      { name: 'bag', pattern: /\b(bag|bags|sack|sacks)\b/ },
      { name: 'carton', pattern: /\b(carton|cartons|box|boxes|case|cases)\b/ },
      { name: 'weight-kg', pattern: /\b(kg|kilogram|kilograms)\b/ },
      { name: 'weight-tonne', pattern: /\b(ton|tons|tonne|tonnes|metric ton)\b/ },
      { name: 'volume', pattern: /\b(litre|litres|liter|liters)\b/ },
      { name: 'pallet', pattern: /\b(pallet|pallets)\b/ },
      { name: 'unit', pattern: /\b(unit|units|piece|pieces|pcs)\b/ },
    ];
    const requested = this.normalizeIdentityText(requestedUnit);
    const requestedGroup = unitGroups.find((group) => group.pattern.test(requested));
    if (!requestedGroup) return null;
    const listingGroups = unitGroups.filter((group) => group.pattern.test(text));
    if (listingGroups.length > 0 && !listingGroups.some((group) => group.name === requestedGroup.name)) {
      return `Listing unit does not match requested ${requestedUnit} pricing`;
    }
    return null;
  }

  private storageInGb(value: string): number | null {
    const match = value.toLowerCase().match(/(\d{1,4})\s*(gb|tb)/);
    if (!match) return null;
    const amount = Number(match[1]);
    return match[2] === 'tb' ? amount * 1024 : amount;
  }

  private containsBrandOrProductFamily(text: string, brand: string, model: string): boolean {
    if (this.containsIdentity(text, brand)) return true;
    const normalizedBrand = this.normalizeIdentityText(brand);
    const normalizedModel = this.normalizeIdentityText(model);
    if (normalizedBrand === 'apple' && /\b(iphone|ipad|macbook|imac|apple watch)\b/.test(normalizedModel)) return true;
    if (normalizedBrand === 'samsung' && /\bgalaxy\b/.test(normalizedModel)) return true;
    return false;
  }

  private containsIdentity(text: string, value?: string): boolean {
    if (!value?.trim()) return true;
    const normalized = this.normalizeIdentityText(value);
    return normalized.length > 0 && (` ${text} `).includes(` ${normalized} `);
  }

  private identityTokens(value: string): string[] {
    return this.normalizeIdentityText(value).split(' ').filter(Boolean);
  }

  private normalizeIdentityText(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
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
