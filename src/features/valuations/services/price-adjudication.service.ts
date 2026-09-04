import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI, type GenerateContentRequest } from '@google/generative-ai';
import type { ItemIdentifier } from '@/features/internet-search/services/query-builder.service';
import type { ExtractedPrice, PriceExtractionResult } from '@/features/internet-search/services/price-extraction.service';
import type { ValuationPolicyConfig } from './valuation-policy.service';
import { collectClaudeGrounding, collectGeminiGrounding, evidenceUrl, extractGroundedPrices } from './grounding-evidence';
import {
  isClaudePriceAdjudicationEnabled,
  isGeminiPriceAdjudicationEnabled,
  isPriceAdjudicationAiEnabled,
} from '@/lib/ai/provider-cost-controls';

type AdjudicationMode = 'market' | 'part';
type AiProvider = 'gemini_grounded' | 'claude_web_search';

export interface PriceAdjudicationInput {
  item: ItemIdentifier;
  mode: AdjudicationMode;
  priceData: PriceExtractionResult;
  policy: ValuationPolicyConfig;
  partName?: string;
  damageType?: string;
}

export interface AiPriceOpinion {
  provider: AiProvider;
  recommendedPrice?: number;
  confidence: number;
  manualReviewRequired: boolean;
  reasons: string[];
  acceptedSources?: string[];
  rejectedSources?: string[];
  rawText?: string;
  /** Extracted from native citation metadata, never from the opinion JSON. */
  researchedPrices?: ExtractedPrice[];
}

export interface PriceAdjudicationResult {
  priceData: PriceExtractionResult;
  selectedPrice?: number;
  selectedSource: 'serper' | 'gemini_grounded' | 'claude_web_search' | 'policy_guard' | 'none';
  confidence: number;
  manualReviewRequired: boolean;
  reviewReasons: string[];
  rejectedPrices: Array<ExtractedPrice & { rejectionReason: string }>;
  aiOpinions: AiPriceOpinion[];
  /** Newly discovered native-cited listings that passed extraction and deterministic guards. */
  researchedPrices?: ExtractedPrice[];
}

const AI_ADJUDICATION_TIMEOUT_MS = 30_000;
const CLAUDE_WEB_SEARCH_COST_USD = 0.01;

const LOW_TRUST_MARKETPLACE_DOMAINS = [
  'jumia',
  'konga',
  'jiji',
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
  'pinterest',
  'whatsapp',
];

const COUNTERFEIT_OR_ACCESSORY_TERMS = [
  'replica',
  'fake',
  'copy',
  'inspired',
  'look alike',
  'aftermarket',
  'strap only',
  'bracelet only',
  'case only',
  'box only',
  'accessory',
  'screen protector',
  'charger',
  'housing only',
];

const SPECIALIST_ASSET_SIGNALS = [
  'rolex',
  'cartier',
  'patek philippe',
  'audemars',
  'audemars piguet',
  'omega',
  'vacheron constantin',
  'richard mille',
  'van cleef',
  'van cleef & arpels',
  'tiffany',
  'bvlgari',
  'bulgari',
  'chopard',
  'hermes',
  'louis vuitton',
];

function textForItem(item: ItemIdentifier, partName?: string): string {
  const values: Array<string | undefined> = [];
  switch (item.type) {
    case 'vehicle':
      values.push(item.make, item.model, String(item.year || ''), item.condition);
      break;
    case 'electronics':
      values.push(item.brand, item.model, item.storageCapacity || item.storage, item.storageType, item.condition);
      break;
    case 'appliance':
      values.push(item.brand, item.model, item.size, item.condition);
      break;
    case 'property':
      values.push(item.propertyType, item.location, String(item.bedrooms || ''), item.condition);
      break;
    case 'jewelry':
      values.push(item.brand, item.jewelryType, item.material, item.weight, item.condition);
      break;
    case 'furniture':
      values.push(item.brand, item.furnitureType, item.material, item.size, item.condition);
      break;
    case 'artwork':
      values.push(item.artist, item.artworkType, item.medium, item.size, item.condition);
      break;
    case 'machinery':
      values.push(item.brand, item.machineryType, item.model, String(item.year || ''), item.condition);
      break;
    default:
      values.push(
        item.brand,
        item.model,
        item.description,
        item.quantity,
        item.unitOfMeasure,
        'packagingType' in item ? item.packagingType : undefined
      );
  }
  values.push(partName);
  return values.filter(Boolean).join(' ').toLowerCase();
}

function extractSpecialistBrands(item: ItemIdentifier, partName?: string): string[] {
  const text = textForItem(item, partName);
  return SPECIALIST_ASSET_SIGNALS.filter((brand) => text.includes(brand));
}

function sourceDomain(price: ExtractedPrice): string {
  const url = evidenceUrl(price.url);
  return url ? new URL(url).hostname.toLowerCase().replace(/^www\./, '') : price.source.toLowerCase();
}

function listingText(price: ExtractedPrice): string {
  return `${price.title || ''} ${price.snippet || ''} ${price.originalText || ''}`.toLowerCase();
}

function normalizedIdentity(text: string): string {
  return text.toLowerCase().replace(/([a-z])(\d)|(\d)([a-z])/g, '$1$3 $2$4')
    .replace(/\+/g, ' plus ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function containsIdentity(text: string, identity: string): boolean {
  return ` ${normalizedIdentity(text)} `.includes(` ${normalizedIdentity(identity)} `);
}

function listingMismatch(input: PriceAdjudicationInput, price: ExtractedPrice): string | undefined {
  const { item, mode } = input;
  const text = listingText(price);
  if (!Number.isFinite(price.price) || price.price <= 0) return 'Price must be a finite positive amount.';
  if (price.currency !== 'NGN') return 'Price has not been converted to the NGN valuation currency.';

  // A search snippet can mention the requested model while advertising a different item.
  const identityText = price.title?.trim() || text;
  if (mode === 'market' && (item.type === 'vehicle' || item.type === 'electronics')) {
    const brand = item.type === 'vehicle' ? item.make : item.brand;
    if (!containsIdentity(identityText, item.model) || (item.type === 'vehicle' && !containsIdentity(identityText, brand))) {
      return 'Listing does not establish the exact requested make/model.';
    }
    const variants = item.type === 'vehicle'
      ? ['le', 'se', 'xle', 'xse', 'lx', 'ex', 'sport', 'hybrid', 'limited', 'platinum', 'prado', 'cross', 'jk', 'jl', 'tj', 'rubicon', 'sahara', 'unlimited']
      : ['pro', 'max', 'plus', 'ultra', 'mini', 'lite', 'fe', 'air'];
    if (variants.some((variant) => containsIdentity(identityText, variant) !== containsIdentity(item.model, variant))) {
      return 'Listing model/variant differs from the requested asset.';
    }
    if (item.type === 'vehicle' && item.year) {
      const years = [...identityText.matchAll(/\b(?:19|20)\d{2}\b/g)].map((match) => Number(match[0]));
      if (price.yearMatched === false || (price.extractedYear != null && price.extractedYear !== item.year)
        || years.some((year) => year !== item.year) || (!years.includes(item.year) && price.extractedYear !== item.year)) {
        return 'Listing does not establish the exact requested vehicle year.';
      }
    }
    if (item.type === 'electronics') {
      const capacity = item.storageCapacity || item.storage;
      const capacities = (value: string) => [...value.toLowerCase().matchAll(/\b(\d+(?:\.\d+)?)\s*(tb|gb)\b/g)]
        .map((match) => Number(match[1]) * (match[2] === 'tb' ? 1024 : 1));
      const expected = capacity ? capacities(capacity) : [];
      // Ignore explicitly labelled RAM; it is not the storage capacity.
      const storageText = text.replace(/\b\d+\s*gb\s*(?:of\s+)?ram\b/g, '');
      const observed = capacities(storageText);
      if (expected.length && (!observed.includes(expected[0]) || observed.some((value) => value !== expected[0]))) {
        return 'Listing does not establish the requested electronics storage capacity.';
      }
      const storageTypes: string[] = text.match(/\b(ssd|hdd|nvme|eufs)\b/g) || [];
      if (item.storageType && storageTypes.length && !storageTypes.includes(item.storageType.toLowerCase())) {
        return 'Listing storage type differs from the requested electronics variant.';
      }
    }
  }

  if (mode !== 'market') return undefined;
  if (/\b(down payment|deposit only|monthly payment|per month|per annum|annual rent|for rent)\b/.test(text)) {
    return 'Listing is a deposit, instalment, or rental rather than an outright asset price.';
  }
  const condition = 'condition' in item ? item.condition : undefined;
  const isNew = /\b(brand new|unused|factory sealed)\b/.test(text);
  const isUsed = /\b(used|pre-owned|refurbished|tokunbo|damaged|non-working|for parts)\b/.test(text);
  if (condition && ((condition === 'Brand New' && isUsed) || (condition !== 'Brand New' && isNew))) {
    return 'Listing condition differs from the requested market condition.';
  }
  if (condition === 'Foreign Used (Tokunbo)' && /\b(nigerian used|locally used|naija used)\b/.test(text)
    || condition === 'Nigerian Used' && /\b(foreign used|tokunbo|uk used|us used)\b/.test(text)) {
    return 'Listing used-condition tier differs from the requested market condition.';
  }
  if (condition && condition !== 'Heavily Used' && /\b(non-working|for parts|scrap only|not working)\b/.test(text)) {
    return 'Listing is non-working or scrap rather than the requested market condition.';
  }

  const unitAliases: Record<string, string> = {
    kg: 'kg', kilogram: 'kg', kilograms: 'kg', tonne: 'tonne', tonnes: 'tonne', ton: 'tonne', tons: 'tonne',
    bag: 'bag', bags: 'bag', piece: 'unit', pieces: 'unit', unit: 'unit', units: 'unit', each: 'unit',
    litre: 'litre', litres: 'litre', liter: 'litre', liters: 'litre', carton: 'carton', cartons: 'carton',
  };
  const unit = 'unitOfMeasure' in item ? item.unitOfMeasure?.toLowerCase().trim() : undefined;
  const declaredUnit = unit ? unitAliases[unit] || unit : undefined;
  const bulk = ['stock', 'goods_in_transit', 'building_materials', 'scrap', 'agriculture'].includes(item.type);
  if (!bulk && !declaredUnit) return undefined;
  if (/\b(?:lot|consignment)\b|\b(?:pack|bundle|set)\s+of\s+\d+\b|\b(?:grand total|total price|shipment total)\b/.test(text)) {
    return 'Listing is a lot total rather than the per-unit price required for quantity scaling.';
  }
  const rates = [...text.matchAll(/(?:\b(?:per|each)\s+|\/\s*)(kg|kilograms?|tonnes?|tons?|bags?|pieces?|units?|litres?|liters?|cartons?)\b/g)];
  if (rates.some((match) => declaredUnit && unitAliases[match[1]] !== declaredUnit)) {
    return 'Listing unit of measure differs from the declared valuation unit.';
  }
  const sizedBag = /\b\d+(?:\.\d+)?\s*kg\s*bags?\b/.test(text);
  if (sizedBag && declaredUnit !== 'bag') return 'Listing unit of measure is a bag, not the declared valuation unit.';
  const unitEach = declaredUnit === 'unit' && /\b(each|per item|single unit|one unit only)\b/.test(text);
  if (!declaredUnit || (!rates.length && !unitEach && !(declaredUnit === 'bag' && sizedBag))) {
    return 'Ambiguous pricing unit: listing does not establish a per-unit basis for quantity scaling.';
  }
  return undefined;
}

function isCounterfeitOrAccessory(input: PriceAdjudicationInput, price: ExtractedPrice): boolean {
  const text = listingText(price);
  const requested = textForItem(input.item, input.partName);
  return COUNTERFEIT_OR_ACCESSORY_TERMS.some((term) => {
    if (!containsIdentity(text, term)) return false;
    if (['replica', 'fake', 'copy', 'inspired', 'look alike'].includes(term)) return true;
    if (input.mode === 'part' || containsIdentity(requested, term)) return false;
    if (term === 'aftermarket') return /\b(aftermarket only|aftermarket replacement)\b/.test(text);
    if (term === 'charger') return /\bcharger\s+(only|for)\b|\bonly\s+charger\b/.test(text)
      || /^charger\b/.test(price.title.toLowerCase());
    return true;
  });
}

const FURNITURE_ITEM_GROUPS = [
  /\b(sofa|couch|settee)\b/,
  /\b(armchair|chair|recliner)\b/,
  /\b(coffee\s+table|table)\b/,
  /\b(cabinet|sideboard|console|shelf|shelving)\b/,
  /\b(wardrobe|bed|dresser)\b/,
];

function furnitureGroupCount(text: string): number {
  return FURNITURE_ITEM_GROUPS.filter((pattern) => pattern.test(text)).length;
}

function isIncompleteFurnitureLotListing(item: ItemIdentifier, price: ExtractedPrice): boolean {
  if (item.type !== 'furniture') return false;
  const declaredText = `${item.furnitureType} ${item.size || ''}`.toLowerCase();
  const declaredGroups = furnitureGroupCount(declaredText);
  if (declaredGroups < 2) return false;

  const resultText = listingText(price);
  return FURNITURE_ITEM_GROUPS.some((pattern) => pattern.test(declaredText) && !pattern.test(resultText));
}

function median(values: number[]): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length % 2 === 0
    ? Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
    : Math.round(sorted[Math.floor(sorted.length / 2)]);
}

function average(values: number[]): number | undefined {
  if (!values.length) return undefined;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function spreadPercent(values: number[], center: number): number {
  if (values.length < 2 || center <= 0) return 0;
  return Math.round(((Math.max(...values) - Math.min(...values)) / center) * 100);
}

function confidenceFromPrices(prices: ExtractedPrice[], spread: number): number {
  if (!prices.length) return 0;
  const averageConfidence = average(prices.map((price) => price.confidence)) || 0;
  const uniqueSourceCount = new Set(prices.map(sourceDomain)).size;
  const highQualityCount = prices.filter((price) => price.sourceQuality === 'high').length;
  return Math.max(0, Math.min(100, Math.round(
    averageConfidence +
    Math.min(uniqueSourceCount * 5, 18) +
    Math.min(highQualityCount * 4, 12) -
    Math.min(spread / 3, 30)
  )));
}

function isLowTrustSource(price: ExtractedPrice): boolean {
  const source = sourceDomain(price);
  return LOW_TRUST_MARKETPLACE_DOMAINS.some((domain) => source.includes(domain));
}

function isHighQualitySource(price: ExtractedPrice): boolean {
  return price.sourceQuality === 'high' || price.confidence >= 85;
}

function rebuildPriceData(source: PriceExtractionResult, prices: ExtractedPrice[]): PriceExtractionResult {
  const values = prices.map((price) => price.price);
  const medianPrice = median(values);
  const averagePrice = average(values);
  const spread = medianPrice ? spreadPercent(values, medianPrice) : 0;

  return {
    ...source,
    prices,
    averagePrice,
    medianPrice,
    priceRange: values.length
      ? {
          min: Math.min(...values),
          max: Math.max(...values),
        }
      : undefined,
    confidence: confidenceFromPrices(prices, spread),
    evidenceSummary: {
      uniqueSourceCount: new Set(prices.map(sourceDomain)).size,
      priceSpreadPercent: spread,
      highQualitySourceCount: prices.filter((price) => price.sourceQuality === 'high').length,
      noYearPriceCount: prices.filter((price) => price.extractedYear == null).length,
    },
  };
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

function coerceAiOpinion(provider: AiProvider, text: string): AiPriceOpinion {
  const parsed = parseJsonObject(text);
  if (!parsed) {
    return {
      provider,
      confidence: 0,
      manualReviewRequired: true,
      reasons: ['AI price adjudication did not return parseable JSON.'],
      rawText: text.slice(0, 2000),
    };
  }

  const recommendedPrice = Number(parsed.recommendedPrice);
  const confidence = Number(parsed.confidence);
  return {
    provider,
    recommendedPrice: Number.isFinite(recommendedPrice) && recommendedPrice > 0 ? Math.round(recommendedPrice) : undefined,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(100, Math.round(confidence))) : 0,
    manualReviewRequired: parsed.manualReviewRequired === true,
    reasons: Array.isArray(parsed.reasons) ? parsed.reasons.filter((reason): reason is string => typeof reason === 'string') : [],
    acceptedSources: Array.isArray(parsed.acceptedSources) ? parsed.acceptedSources.filter((source): source is string => typeof source === 'string') : [],
    rejectedSources: Array.isArray(parsed.rejectedSources) ? parsed.rejectedSources.filter((source): source is string => typeof source === 'string') : [],
    rawText: text.slice(0, 2000),
  };
}

function promptForAdjudication(input: PriceAdjudicationInput, filteredPrices: ExtractedPrice[], rejectedPrices: Array<ExtractedPrice & { rejectionReason: string }>): string {
  const itemText = textForItem(input.item, input.partName);
  const noSerperEvidence = filteredPrices.length === 0;
  return JSON.stringify({
    instruction: [
      'You are an insurance salvage valuation adjudicator.',
      'Use live web search where available. Do not rely on training data alone.',
      noSerperEvidence
        ? 'No usable Serper listings were supplied. Search the web directly for current Nigeria/Naira prices for the exact item, year, and condition.'
        : 'Compare the supplied Serper evidence with current web evidence.',
      'Reject counterfeit, replica, accessory-only, irrelevant, stale, low-trust, or implausible prices.',
      'For specialist/luxury assets, prefer appraisal/authorized dealer/auction-house evidence and require manual review when evidence is not definitive.',
      'Do not estimate without accepted listings. Leave recommendedPrice null when exact comparable evidence is unavailable.',
      'Find new comparable listings. Write one native-cited statement per listing with exact item/model, year, condition, unit or requested part, currency and advertised amount. Cite each statement to exactly one search result.',
      'Do not invent amounts or treat a recommendation as listing evidence. Include the complete listing identity in each cited statement.',
      'After the cited statements, optionally return a JSON summary with keys: recommendedPrice, confidence, manualReviewRequired, reasons, acceptedSources, rejectedSources.',
    ],
    mode: input.mode,
    item: input.item,
    partName: input.partName,
    damageType: input.damageType,
    normalizedItemText: itemText,
    policy: {
      minimumMarketSourceCount: input.policy.minimumMarketSourceCount,
      maxAllowedPriceSpreadPercent: input.policy.maxAllowedPriceSpreadPercent,
      marketMinimums: input.policy.pricePlausibility.marketMinimums,
      partMinimums: input.policy.pricePlausibility.partMinimums,
      partMaximums: input.policy.pricePlausibility.partMaximums,
    },
    acceptedSerperPrices: filteredPrices.slice(0, 12).map((price) => ({
      price: price.price,
      source: price.source,
      title: price.title,
      snippet: price.snippet,
      confidence: price.confidence,
      sourceQuality: price.sourceQuality,
      originalText: price.originalText,
      url: price.url,
    })),
    rejectedSerperPrices: rejectedPrices.slice(0, 8).map((price) => ({
      price: price.price,
      source: price.source,
      title: price.title,
      reason: price.rejectionReason,
    })),
  });
}

export function shouldEscalatePriceAdjudication(input: {
  mode: AdjudicationMode;
  acceptedPriceCount: number;
  uniqueSourceCount: number;
  spreadPercent: number;
  specialistReviewRequired: boolean;
  minimumMarketSourceCount: number;
  sourceDiversityRequired: boolean;
  maxAllowedPriceSpreadPercent: number;
}): boolean {
  if (input.acceptedPriceCount === 0) return true;
  if (input.mode === 'part') return false;
  if (input.specialistReviewRequired) return true;
  if (input.acceptedPriceCount < input.minimumMarketSourceCount) return true;
  if (input.sourceDiversityRequired && input.uniqueSourceCount < 2) return true;
  return input.spreadPercent > input.maxAllowedPriceSpreadPercent;
}

export function shouldUseClaudeWebFallback(mode: AdjudicationMode, geminiOpinion: AiPriceOpinion | null): boolean {
  void mode;
  return !geminiOpinion?.researchedPrices?.length;
}

function logClaudeAdjudicationUsage(response: Anthropic.Message, input: PriceAdjudicationInput): void {
  const usage = response.usage as Anthropic.Message['usage'] & {
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    server_tool_use?: { web_search_requests?: number };
  };
  const inputTokens = usage.input_tokens || 0;
  const outputTokens = usage.output_tokens || 0;
  const cacheWriteTokens = usage.cache_creation_input_tokens || 0;
  const cacheReadTokens = usage.cache_read_input_tokens || 0;
  const webSearchRequests = usage.server_tool_use?.web_search_requests || 0;
  const tokenCostUsd = (
    (inputTokens * 3) +
    (outputTokens * 15) +
    (cacheWriteTokens * 3.75) +
    (cacheReadTokens * 0.3)
  ) / 1_000_000;
  const estimatedCostUsd = tokenCostUsd + (webSearchRequests * CLAUDE_WEB_SEARCH_COST_USD);

  console.info('[Price Adjudication] Claude usage', {
    mode: input.mode,
    itemType: input.item.type,
    partName: input.partName,
    inputTokens,
    outputTokens,
    cacheWriteTokens,
    cacheReadTokens,
    webSearchRequests,
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(6)),
  });
}

async function withTimeout<T>(factory: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      factory(controller.signal),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error(`Timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export class PriceAdjudicationService {
  private applyDeterministicGuards(input: PriceAdjudicationInput): {
    filteredPrices: ExtractedPrice[];
    rejectedPrices: Array<ExtractedPrice & { rejectionReason: string }>;
    reviewReasons: string[];
  } {
    const rejectedPrices: Array<ExtractedPrice & { rejectionReason: string }> = [
      ...(input.priceData.rejectedPrices || []),
    ];
    const reviewReasons: string[] = [];
    const specialist = extractSpecialistBrands(input.item, input.partName).length > 0;
    const itemType = input.item.type;
    const minPrice = input.mode === 'part'
      ? input.policy.pricePlausibility.partMinimums[itemType] || input.policy.pricePlausibility.partMinimums.general_asset || 3_000
      : input.policy.pricePlausibility.marketMinimums[itemType] || input.policy.pricePlausibility.marketMinimums.general_asset || 1_000;
    const maxPartPrice = input.mode === 'part'
      ? input.policy.pricePlausibility.partMaximums[itemType] || input.policy.pricePlausibility.partMaximums.general_asset || 5_000_000
      : null;

    const filteredPrices = input.priceData.prices.filter((price) => {
      const lowTrust = isLowTrustSource(price);
      const highQuality = isHighQualitySource(price);

      const mismatch = listingMismatch(input, price);
      if (mismatch) {
        rejectedPrices.push({ ...price, rejectionReason: mismatch });
        if (mismatch.startsWith('Ambiguous pricing unit')) reviewReasons.push(mismatch);
        return false;
      }

      if (price.price < minPrice && lowTrust) {
        rejectedPrices.push({ ...price, rejectionReason: `Price below policy minimum of NGN ${minPrice.toLocaleString()}` });
        return false;
      }
      if (isCounterfeitOrAccessory(input, price)) {
        rejectedPrices.push({ ...price, rejectionReason: 'Listing appears to be counterfeit, accessory-only, replica, or otherwise not the insured asset.' });
        return false;
      }
      if (input.mode === 'market' && isIncompleteFurnitureLotListing(input.item, price)) {
        rejectedPrices.push({
          ...price,
          rejectionReason: 'Listing does not represent the declared multi-item furniture set.',
        });
        return false;
      }
      if (price.price < minPrice && highQuality) {
        reviewReasons.push(`Accepted high-quality source ${price.source} is below policy minimum; verify item match, condition, quantity, and currency before relying on it.`);
      }
      if (maxPartPrice && price.price > maxPartPrice) {
        reviewReasons.push(`Accepted ${input.mode} evidence from ${price.source} is above the configured part attention threshold of NGN ${maxPartPrice.toLocaleString()}; verify OEM, specialist, aviation, medical, or imported-part context.`);
      }
      return true;
    });

    const uniqueSources = new Set(filteredPrices.map(sourceDomain)).size;
    const listingCount = new Set(filteredPrices.map(price => evidenceUrl(price.url) || `${price.source}:${price.title}`)).size;
    const medianPrice = median(filteredPrices.map((price) => price.price));
    const spread = medianPrice ? spreadPercent(filteredPrices.map((price) => price.price), medianPrice) : 0;

    if (filteredPrices.length === 0) {
      reviewReasons.push('No accepted market evidence survived policy and relevance checks.');
    }
    if (listingCount < input.policy.minimumMarketSourceCount && input.mode === 'market') {
      reviewReasons.push(`Only ${listingCount} accepted market listing(s); ${input.policy.minimumMarketSourceCount} required.`);
    }
    if (input.policy.sourceDiversityRequired && uniqueSources < 2 && input.mode === 'market') {
      reviewReasons.push('Accepted market evidence is not source-diverse.');
    }
    if (spread > input.policy.maxAllowedPriceSpreadPercent) {
      reviewReasons.push(`Accepted prices vary by ${spread}%, above the ${input.policy.maxAllowedPriceSpreadPercent}% limit.`);
    }
    if (specialist) {
      reviewReasons.push('Specialist/luxury asset requires receipt, serial/hallmark verification, and manager/appraiser review.');
    }

    return { filteredPrices, rejectedPrices, reviewReasons };
  }

  private async getGeminiGroundedOpinion(input: PriceAdjudicationInput, filteredPrices: ExtractedPrice[], rejectedPrices: Array<ExtractedPrice & { rejectionReason: string }>): Promise<AiPriceOpinion | null> {
    if (!isGeminiPriceAdjudicationEnabled()) return null;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your-gemini-api-key') return null;

    try {
      const client = new GoogleGenerativeAI(apiKey);
      const model = client.getGenerativeModel({
        model: process.env.GEMINI_PRICE_ADJUDICATION_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      });
      const request = {
        contents: [{ role: 'user', parts: [{ text: promptForAdjudication(input, filteredPrices, rejectedPrices) }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 900,
        },
      } as unknown as GenerateContentRequest;
      const result = await withTimeout(
        signal => model.generateContent(request, { signal } as Parameters<typeof model.generateContent>[1]),
        AI_ADJUDICATION_TIMEOUT_MS
      );
      console.info('[Price Adjudication] Gemini usage', {
        mode: input.mode,
        itemType: input.item.type,
        partName: input.partName,
        usage: result.response.usageMetadata,
      });
      const text = result.response.text();
      return { ...coerceAiOpinion('gemini_grounded', text), researchedPrices: extractGroundedPrices(collectGeminiGrounding(result.response), input) };
    } catch (error) {
      return {
        provider: 'gemini_grounded',
        confidence: 0,
        manualReviewRequired: true,
        reasons: [`Gemini grounded price adjudication unavailable: ${error instanceof Error ? error.message : 'unknown error'}`],
      };
    }
  }

  private async getClaudeWebOpinion(input: PriceAdjudicationInput, filteredPrices: ExtractedPrice[], rejectedPrices: Array<ExtractedPrice & { rejectionReason: string }>): Promise<AiPriceOpinion | null> {
    if (!isClaudePriceAdjudicationEnabled()) return null;
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey || !apiKey.startsWith('sk-ant-')) return null;

    try {
      const client = new Anthropic({ apiKey, timeout: AI_ADJUDICATION_TIMEOUT_MS, maxRetries: 0 });
      const request = {
        model: process.env.CLAUDE_PRICE_ADJUDICATION_MODEL || process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        max_tokens: 800,
        temperature: 0.1,
        tools: [{
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 3,
        }],
        messages: [{
          role: 'user',
          content: promptForAdjudication(input, filteredPrices, rejectedPrices),
        }],
      } as unknown as Anthropic.Messages.MessageCreateParamsNonStreaming;
      const response = await withTimeout(
        signal => client.messages.create(request, { signal }),
        AI_ADJUDICATION_TIMEOUT_MS
      );
      logClaudeAdjudicationUsage(response, input);
      const text = response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as { text?: string }).text || '')
        .join('\n');
      return { ...coerceAiOpinion('claude_web_search', text), researchedPrices: extractGroundedPrices(collectClaudeGrounding(response), input) };
    } catch (error) {
      return {
        provider: 'claude_web_search',
        confidence: 0,
        manualReviewRequired: true,
        reasons: [`Claude web price adjudication unavailable: ${error instanceof Error ? error.message : 'unknown error'}`],
      };
    }
  }

  async adjudicate(input: PriceAdjudicationInput): Promise<PriceAdjudicationResult> {
    const deterministic = this.applyDeterministicGuards(input);

    const uniqueSourceCount = new Set(deterministic.filteredPrices.map((price) => price.source)).size;
    const center = median(deterministic.filteredPrices.map((price) => price.price));
    const spread = center
      ? spreadPercent(deterministic.filteredPrices.map((price) => price.price), center)
      : 0;
    const specialistReviewRequired = extractSpecialistBrands(input.item, input.partName).length > 0;
    const shouldAskAi = isPriceAdjudicationAiEnabled() && shouldEscalatePriceAdjudication({
      mode: input.mode,
      acceptedPriceCount: deterministic.filteredPrices.length,
      uniqueSourceCount,
      spreadPercent: spread,
      specialistReviewRequired,
      minimumMarketSourceCount: input.policy.minimumMarketSourceCount,
      sourceDiversityRequired: input.policy.sourceDiversityRequired,
      maxAllowedPriceSpreadPercent: input.policy.maxAllowedPriceSpreadPercent,
    });

    console.info('[Price Adjudication] Provider plan', {
      mode: input.mode,
      itemType: input.item.type,
      partName: input.partName,
      acceptedPriceCount: deterministic.filteredPrices.length,
      uniqueSourceCount,
      spreadPercent: spread,
      aiEscalationRequired: shouldAskAi,
      sequence: shouldAskAi
        ? ['gemini_grounded', 'claude_web_search_fallback']
        : ['serper'],
    });

    const aiOpinions: AiPriceOpinion[] = [];
    if (shouldAskAi) {
      const geminiOpinion = await this.getGeminiGroundedOpinion(
        input,
        deterministic.filteredPrices,
        deterministic.rejectedPrices
      );
      if (geminiOpinion) aiOpinions.push(geminiOpinion);

      if (shouldUseClaudeWebFallback(input.mode, geminiOpinion)) {
        const claudeOpinion = await this.getClaudeWebOpinion(
          input,
          deterministic.filteredPrices,
          deterministic.rejectedPrices
        );
        if (claudeOpinion) aiOpinions.push(claudeOpinion);
      }
    }

    const groundedCandidates = aiOpinions.flatMap(opinion => opinion.researchedPrices || []);
    const combinedInput: PriceAdjudicationInput = {
      ...input,
      priceData: {
        ...input.priceData,
        prices: [...input.priceData.prices, ...groundedCandidates],
      },
    };
    const finalDeterministic = this.applyDeterministicGuards(combinedInput);
    const finalPriceData = rebuildPriceData(combinedInput.priceData, finalDeterministic.filteredPrices);
    const selectedPrice = finalPriceData.medianPrice || finalPriceData.averagePrice;
    const acceptedOriginalEvidence = finalDeterministic.filteredPrices.some(price =>
      input.priceData.prices.some(original => original.url === price.url && original.price === price.price)
    );
    const groundedProvider = aiOpinions.find(opinion => opinion.researchedPrices?.some(candidate =>
      finalDeterministic.filteredPrices.some(price => price.url === candidate.url && price.price === candidate.price)
    ))?.provider;
    const selectedSource = selectedPrice
      ? (acceptedOriginalEvidence ? 'serper' : groundedProvider || 'none')
      : 'none';
    const aiReviewReasons = aiOpinions.flatMap((opinion) => opinion.manualReviewRequired ? opinion.reasons : []);
    const reviewReasons = Array.from(new Set([
      ...finalDeterministic.reviewReasons,
      ...aiReviewReasons,
      ...(aiOpinions.some((opinion) => opinion.recommendedPrice) && groundedCandidates.length === 0
        ? ['AI recommendation had no native-cited comparable listing and was not used.'] : []),
    ].filter(Boolean)));
    finalPriceData.rejectedPrices = finalDeterministic.rejectedPrices;

    return {
      priceData: finalPriceData,
      selectedPrice,
      selectedSource,
      confidence: finalPriceData.confidence,
      manualReviewRequired: reviewReasons.length > 0 || aiOpinions.some((opinion) => opinion.manualReviewRequired),
      reviewReasons,
      rejectedPrices: finalDeterministic.rejectedPrices,
      aiOpinions,
      researchedPrices: finalDeterministic.filteredPrices.filter(price => groundedCandidates.some(candidate => candidate.url === price.url && candidate.price === price.price)),
    };
  }
}

export const priceAdjudicationService = new PriceAdjudicationService();
