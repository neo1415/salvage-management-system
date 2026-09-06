import type { SerperSearchResult } from '@/lib/integrations/serper-api';
import type { ItemIdentifier } from './query-builder.service';
import { getDefaultValuationPolicyConfig } from '@/features/valuations/services/valuation-policy.service';
import type { ValuationPolicyConfig } from '@/features/valuations/services/valuation-policy.service';
import { vehicleModelEstablished } from '@/features/valuations/services/vehicle-model-identity';

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

// Consume the entire amount once, including its multiplier and optional range.
// Unsupported markers are consumed too, so C$ cannot be reinterpreted as USD.
const CURRENCY_CODES = 'NGN|USD|GBP|EUR|CAD|AUD|NZD|SGD|HKD|JPY|CNY|INR|ZAR|GHS|KES|AED|CHF|SEK|NOK|DKK|BRL|MXN|RUB|SAR|KWD|PKR|BDT';
const CURRENCY_TOKEN = `(?:naira\\b|(?:${CURRENCY_CODES})\\s*[$£€¥₹₦]|[a-z]{1,3}\\$|[a-z]{3}(?![a-z])|[₦$£€¥₹]|N(?![a-z]))`;
const SUFFIX_CURRENCY = `(?:naira|${CURRENCY_CODES})\\b`;
const AMOUNT_TOKEN = '[0-9]+(?:,[0-9]+)*(?:\\.[0-9]+)?';
const MULTIPLIER_TOKEN = '(?:million|thousand|billion|[mkb])(?![a-z])';
const MONEY_PATTERN = new RegExp(
  `(?<![a-z0-9.,$+-])(?:(?<prefix>${CURRENCY_TOKEN})\\s*)?`
  + `(?<first>${AMOUNT_TOKEN})(?:\\s*(?<scale>${MULTIPLIER_TOKEN}))?`
  + `(?:\\s*(?:-|–|to\\b)\\s*(?:(?<secondCurrency>${CURRENCY_TOKEN})\\s*)?`
  + `(?<second>${AMOUNT_TOKEN})(?:\\s*(?<secondScale>${MULTIPLIER_TOKEN}))?)?`
  + `(?:\\s*(?<suffix>${SUFFIX_CURRENCY}))?(?![a-z0-9]|[.,][0-9])`,
  'gi'
);

const SOURCE_QUALITY: Record<'high' | 'medium' | 'low', string[]> = {
  high: ['jiji.ng', 'cars45', 'autochek', 'cars.ng', 'carlots.ng', 'betacar.ng', 'cheki', 'buildingsandmoreng.com'],
  medium: ['jumia', 'konga', '234drive', 'nairaland', 'facebook.com/marketplace', 'tradeford.com', 'alibaba.com'],
  low: ['tiktok.com', 'instagram.com', 'facebook.com', 'youtube.com', 'pinterest'],
};

export class PriceExtractionService {
  private readonly extractionFailures = new WeakMap<ExtractedPrice, string>();
  private readonly amountRoles = new WeakMap<ExtractedPrice, 'current' | 'old' | 'shipping'>();

  extractPrices(
    results: SerperSearchResult[],
    itemType?: ItemIdentifier['type'],
    targetYear?: number,
    options: PriceExtractionOptions = {}
  ): PriceExtractionResult {
    const extractedPrices: ExtractedPrice[] = [];

    for (const result of results) {
      const listingPrices = [
        ...this.extractFromText(result.snippet || '', result.link, result.title || '', result.snippet || '', options),
        ...this.extractFromText(result.title || '', result.link, result.title || '', result.snippet || '', options)
      ];

      const structuredPrice = this.createStructuredPrice(result, options);
      if (structuredPrice) listingPrices.push(structuredPrice);
      const hasCurrentPrice = listingPrices.some((price) => this.amountRoles.get(price) === 'current');
      const candidates = listingPrices.filter((price) => {
        const role = this.amountRoles.get(price);
        if (role === 'shipping' || (role === 'old' && hasCurrentPrice)) {
          this.extractionFailures.set(price, role === 'shipping' ? 'Separate shipping charge' : 'Explicit old price, not the current listing price');
          return false;
        }
        return true;
      });
      // Do this before plausibility filtering: a small deposit or another model's
      // amount must not silently disappear and make a multi-price result look exact.
      if (new Set(candidates.map((price) => price.price)).size > 1) {
        for (const price of candidates) {
          this.extractionFailures.set(price, 'Ambiguous listing contains multiple distinct amounts');
        }
      }
      extractedPrices.push(...listingPrices);
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
    for (const match of text.matchAll(MONEY_PATTERN)) {
      const { prefix, first, scale, secondCurrency, second, secondScale, suffix } = match.groups!;
      const currency = this.normalizeCurrency(prefix || suffix || '');
      if (!currency || (suffix && this.normalizeCurrency(suffix) !== currency)
        || (secondCurrency && this.normalizeCurrency(secondCurrency) !== currency)) continue;
      const validNumber = (value: string) => /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(value);
      if (!validNumber(first) || (second && !validNumber(second))) continue;

      // A trailing multiplier can qualify both bare endpoints (N8-9m), but
      // an independently currency-labelled endpoint carries its own units.
      const firstScale = scale || (!secondCurrency && secondScale ? secondScale : undefined);
      let amount = this.applyAmountMultiplier(Number(first.replace(/,/g, '')), firstScale);
      if (second) {
        const endpoint = this.applyAmountMultiplier(Number(second.replace(/,/g, '')), secondScale);
        amount = (amount + endpoint) / 2;
      }
      const rate = this.getConversionRate(currency, options);
      if (rate === null || !Number.isFinite(amount) || amount <= 0) continue;
      const confidence = currency === 'NGN'
        ? Math.min(100, 70 + (match[0].includes(',') ? 10 : 0) + this.getSourceConfidenceBonus(url))
        : Math.min(80, 40 + this.getSourceConfidenceBonus(url));
      const originalText = match[0] + (second ? ' (range midpoint)' : '')
        + (currency !== 'NGN' ? ` (converted from ${currency})` : '');
      const price = this.buildPrice(amount * rate, 'NGN', originalText, confidence, url, title, snippet);
      // Only immediately adjacent labels establish an amount's role. Never infer
      // a sale price from size, order, structured data, or an unrelated sentence.
      const before = text.slice(0, match.index).trimEnd();
      const after = text.slice(match.index! + match[0].length);
      if (/\b(?:shipping|delivery)(?:\s+(?:fee|charge|cost))?\s*[:=-]?\s*$/i.test(before)
        || /^\s*(?:for\s+)?(?:shipping|delivery)\s*(?:$|[.;,)])/i.test(after)) {
        this.amountRoles.set(price, 'shipping');
      } else if (/\b(?:was|old\s*price|original\s+price|previous\s+price|rrp)\s*[:=-]?\s*$/i.test(before)) {
        this.amountRoles.set(price, 'old');
      } else if (/\b(?:now|current\s+price|sale\s+price|discounted\s+price)\s*[:=-]?\s*$/i.test(before)) {
        this.amountRoles.set(price, 'current');
      }
      prices.push(price);
    }
    return prices;
  }

  private applyAmountMultiplier(value: number, multiplier?: string): number {
    const normalized = multiplier?.toLowerCase();
    if (normalized?.startsWith('b')) return value * 1_000_000_000;
    if (normalized?.startsWith('m')) return value * 1_000_000;
    if (normalized?.startsWith('k') || normalized?.startsWith('t')) return value * 1_000;
    return value;
  }

  private normalizeCurrency(value: string): ExtractedPrice['currency'] | null {
    const aliases: Record<string, ExtractedPrice['currency']> = {
      NGN: 'NGN', N: 'NGN', NAIRA: 'NGN', '₦': 'NGN',
      USD: 'USD', 'US$': 'USD', 'USD$': 'USD', '$': 'USD', GBP: 'GBP', 'GBP£': 'GBP', '£': 'GBP', EUR: 'EUR', 'EUR€': 'EUR', '€': 'EUR', 'NGN₦': 'NGN',
    };
    return aliases[value.replace(/\s/g, '').toUpperCase()] || null;
  }

  private getConversionRate(currency: ExtractedPrice['currency'], options: PriceExtractionOptions): number | null {
    if (currency === 'NGN') return 1;
    const rate = options.exchangeRates?.[currency] ?? getDefaultValuationPolicyConfig().exchangeRates[currency];
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  }

  private createStructuredPrice(result: SerperSearchResult, options: PriceExtractionOptions): ExtractedPrice | null {
    if (!result.price || !Number.isFinite(result.price) || result.price <= 0 || !result.currency) return null;
    const currency = this.normalizeCurrency(result.currency);
    if (!currency) return null;
    const rate = this.getConversionRate(currency, options);
    if (rate === null) return null;
    const price = result.price * rate;
    const confidence = currency === 'NGN' ? 90 : 70;

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
        if (options.mode === 'part') {
          const text = `${price.title} ${price.snippet}`;
          const ranges = [...text.matchAll(/\b((?:19|20)\d{2})\s*(?:-|\u2013|\u2014|to)\s*((?:19|20)\d{2})\b/gi)];
          const compatible = ranges.length > 0
            ? ranges.every((range) => Number(range[1]) <= targetYear && targetYear <= Number(range[2]))
            : price.extractedYear === targetYear;
          price.yearMatched = compatible;
          if (!compatible) rejectedPrices.push({ ...price, rejectionReason: 'Part listing does not establish compatible model year' });
          return compatible;
        }
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
    let deduplicated = validPrices.sort((a, b) => b.confidence - a.confidence).filter((price) => {
      const key = this.listingUrlKey(price.url);
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
    const extractionFailure = this.extractionFailures.get(price);
    if (extractionFailure) return extractionFailure;
    if (price.confidence < 30) return 'Extraction confidence below 30%';

    if (/\b(deposits?|down[ -]?payment|per month|monthly|installments?|instalments?|pay small small)\b|\/\s*(month|mo)\b/i.test(`${price.title} ${price.snippet}`)) {
      return 'Listing price appears to be a deposit, installment, or recurring payment rather than the full asset price';
    }

    if (options.mode !== 'part' && options.item) {
      const relevanceFailure = this.getMarketListingRelevanceFailure(price, options.item);
      if (relevanceFailure) return relevanceFailure;
    }

    if (options.mode === 'part') {
      if (!this.isRelevantPartListing(price, options.partName)) return `Listing is not specific to ${options.partName || 'part'}`;
      if (options.item) {
        const text = this.normalizeIdentityText(`${price.title} ${price.snippet}`);
        const item = options.item;
        const brand = item.type === 'vehicle' ? item.make : 'brand' in item ? item.brand : undefined;
        const model = 'model' in item ? item.model : undefined;
        if (!this.containsIdentity(text, brand) || !this.containsIdentity(text, model)
          || (item.type === 'electronics' && this.getElectronicsModelFailure(text, item.model))) {
          return 'Part listing does not match the requested asset brand and model';
        }
      }
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
        if (!this.containsIdentity(text, item.make) || !vehicleModelEstablished(item, text)) {
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
        const locationTokens = this.identityTokens(item.location);
        if (!this.containsIdentity(text, item.propertyType)
          || locationTokens.length === 0 || !locationTokens.every((token) => this.containsIdentity(text, token))) {
          return 'Property listing does not match the requested type and location';
        }
        const bedrooms = [...text.matchAll(/\b(\d+)\s*(?:bedrooms?|beds?)\b/g)].map((match) => Number(match[1]));
        if (item.bedrooms !== undefined && bedrooms.some((count) => count !== item.bedrooms)) {
          return 'Property listing does not match the requested bedroom count';
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
          const unitFailure = this.getBulkUnitMismatch(`${price.title} ${price.snippet}`, 'unitOfMeasure' in item ? item.unitOfMeasure : undefined);
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
    // Packaging quantities (e.g. a 50 kg bag) do not establish the price unit.
    const unitMatches = Array.from(text.toLowerCase().matchAll(/(?:\bper\s+|\/\s*)(?:(\d+(?:\.\d+)?)\s*)?([a-z]+(?:\s+ton)?)/g));
    if (unitMatches.some((match) => match[1] && Number(match[1]) !== 1)) {
      return `Listing unit price covers a different quantity than one ${requestedUnit}`;
    }
    const denominators = unitMatches.map((match) => match[2]).join(' ');
    const listingGroups = unitGroups.filter((group) => group.pattern.test(denominators || this.normalizeIdentityText(text)));
    if (denominators && (listingGroups.length === 0 || listingGroups.some((group) => group.name !== requestedGroup.name))) {
      return `Listing unit is incompatible or ambiguous for requested ${requestedUnit} pricing`;
    }
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
    const text = this.normalizeIdentityText(`${price.title} ${price.snippet}`);
    const tokens = this.getPartTokens(part);
    const hasPartToken = tokens.some((token) => this.containsIdentity(text, token));
    if (!hasPartToken) return false;

    const wholeAssetSignals = [
      'cars for sale',
      'car for sale',
      'vehicles for sale',
      'vehicle for sale',
      'market range',
    ];

    return !wholeAssetSignals.some((signal) => text.includes(signal));
  }

  private getPartTokens(partName: string): string[] {
    const synonyms: Record<string, string[]> = {
      bumper: ['bumper', 'front bumper', 'rear bumper'],
      'body panel': ['body panel', 'panel', 'quarter panel', 'fender', 'bonnet', 'hood'],
      hood: ['hood', 'bonnet'],
      bonnet: ['bonnet', 'hood'],
      'engine parts': ['engine', 'alternator', 'compressor', 'radiator', 'starter'],
      headlight: ['headlight', 'head lamp', 'headlamp'],
      windshield: ['windshield', 'windscreen'],
    };
    return synonyms[partName] || [this.normalizeIdentityText(partName)];
  }

  private listingUrlKey(url: string): string {
    try {
      const parsed = new URL(url);
      parsed.hash = '';
      for (const key of [...parsed.searchParams.keys()]) {
        if (/^(utm_.+|gclid|fbclid)$/i.test(key)) parsed.searchParams.delete(key);
      }
      parsed.searchParams.sort();
      return parsed.toString();
    } catch {
      return url;
    }
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
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }
}

export const priceExtractor = new PriceExtractionService();
