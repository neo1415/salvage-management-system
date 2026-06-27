import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ItemIdentifier } from '@/features/internet-search/services/query-builder.service';
import type { ExtractedPrice, PriceExtractionResult } from '@/features/internet-search/services/price-extraction.service';
import type { ValuationPolicyConfig } from './valuation-policy.service';
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
}

const AI_ADJUDICATION_TIMEOUT_MS = 12_000;
const MIN_AI_CONFIDENCE_TO_SELECT = 65;

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
      values.push(item.brand, item.model, item.storage, item.condition);
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

function specialistReviewThreshold(item: ItemIdentifier, policy: ValuationPolicyConfig, partName?: string): number | null {
  const brands = extractSpecialistBrands(item, partName);
  if (!brands.length) return null;
  const text = textForItem(item, partName);
  const baseMinimum = policy.pricePlausibility.marketMinimums[item.type] || policy.pricePlausibility.marketMinimums.general_asset || 1_000;
  const preciousMaterialMultiplier = /\b(18k|18ct|750|gold|diamond|platinum|sapphire)\b/.test(text) ? 100 : 40;
  const multiAssetMultiplier = /[,;&+]|\band\b/.test(text) ? 2 : 1;
  return Math.round(baseMinimum * preciousMaterialMultiplier * multiAssetMultiplier);
}

function sourceDomain(price: ExtractedPrice): string {
  return (price.source || price.url || '').toLowerCase();
}

function listingText(price: ExtractedPrice): string {
  return `${price.title || ''} ${price.snippet || ''} ${price.originalText || ''}`.toLowerCase();
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
  const uniqueSourceCount = new Set(prices.map((price) => price.source)).size;
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
      uniqueSourceCount: new Set(prices.map((price) => price.source)).size,
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
      'When estimating without listings, provide a conservative market price grounded in current web evidence.',
      'Return JSON only with keys: recommendedPrice, confidence, manualReviewRequired, reasons, acceptedSources, rejectedSources.',
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
    acceptedSerperPrices: filteredPrices.map((price) => ({
      price: price.price,
      source: price.source,
      title: price.title,
      snippet: price.snippet,
      confidence: price.confidence,
      sourceQuality: price.sourceQuality,
      originalText: price.originalText,
      url: price.url,
    })),
    rejectedSerperPrices: rejectedPrices.slice(0, 20).map((price) => ({
      price: price.price,
      source: price.source,
      title: price.title,
      reason: price.rejectionReason,
    })),
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs)),
  ]);
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
    const specialist = specialistReviewThreshold(input.item, input.policy, input.partName);
    const itemType = input.item.type;
    const minPrice = input.mode === 'part'
      ? input.policy.pricePlausibility.partMinimums[itemType] || input.policy.pricePlausibility.partMinimums.general_asset || 3_000
      : input.policy.pricePlausibility.marketMinimums[itemType] || input.policy.pricePlausibility.marketMinimums.general_asset || 1_000;
    const maxPartPrice = input.mode === 'part'
      ? input.policy.pricePlausibility.partMaximums[itemType] || input.policy.pricePlausibility.partMaximums.general_asset || 5_000_000
      : null;

    const filteredPrices = input.priceData.prices.filter((price) => {
      const text = listingText(price);
      const lowTrust = isLowTrustSource(price);
      const highQuality = isHighQualitySource(price);

      if (price.price < minPrice && lowTrust) {
        rejectedPrices.push({ ...price, rejectionReason: `Price below policy minimum of NGN ${minPrice.toLocaleString()}` });
        return false;
      }
      if (COUNTERFEIT_OR_ACCESSORY_TERMS.some((term) => text.includes(term))) {
        rejectedPrices.push({ ...price, rejectionReason: 'Listing appears to be counterfeit, accessory-only, replica, or otherwise not the insured asset.' });
        return false;
      }
      if (specialist && input.mode === 'market' && lowTrust && price.price < specialist) {
        rejectedPrices.push({ ...price, rejectionReason: `Low-trust specialist listing below dynamic review threshold of NGN ${specialist.toLocaleString()}` });
        return false;
      }
      if (price.price < minPrice && highQuality) {
        reviewReasons.push(`Accepted high-quality source ${price.source} is below policy minimum; verify item match, condition, quantity, and currency before relying on it.`);
      }
      if (maxPartPrice && price.price > maxPartPrice) {
        reviewReasons.push(`Accepted ${input.mode} evidence from ${price.source} is above the configured part attention threshold of NGN ${maxPartPrice.toLocaleString()}; verify OEM, specialist, aviation, medical, or imported-part context.`);
      }
      if (specialist && input.mode === 'market' && price.price < specialist) {
        reviewReasons.push(`Specialist asset evidence from ${price.source} is below the dynamic review threshold of NGN ${specialist.toLocaleString()}; require proof of authenticity, exact model, serial/hallmark, quantity, and condition.`);
      }
      return true;
    });

    const uniqueSources = new Set(filteredPrices.map((price) => price.source)).size;
    const medianPrice = median(filteredPrices.map((price) => price.price));
    const spread = medianPrice ? spreadPercent(filteredPrices.map((price) => price.price), medianPrice) : 0;

    if (filteredPrices.length === 0) {
      reviewReasons.push('No accepted market evidence survived policy and relevance checks.');
    }
    if (uniqueSources < input.policy.minimumMarketSourceCount && input.mode === 'market') {
      reviewReasons.push(`Only ${uniqueSources} accepted market source(s); ${input.policy.minimumMarketSourceCount} required.`);
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
      } as any);
      const result = await withTimeout(model.generateContent({
        contents: [{ role: 'user', parts: [{ text: promptForAdjudication(input, filteredPrices, rejectedPrices) }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      } as any), AI_ADJUDICATION_TIMEOUT_MS);
      const text = result.response.text();
      return coerceAiOpinion('gemini_grounded', text);
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
      const client = new Anthropic({ apiKey });
      const response = await withTimeout(client.messages.create({
        model: process.env.CLAUDE_PRICE_ADJUDICATION_MODEL || process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        max_tokens: 1600,
        temperature: 0.1,
        tools: [{
          type: 'web_search_20260318',
          name: 'web_search',
          response_inclusion: 'excluded',
        } as any],
        messages: [{
          role: 'user',
          content: promptForAdjudication(input, filteredPrices, rejectedPrices),
        }],
      } as any), AI_ADJUDICATION_TIMEOUT_MS);
      const text = response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as { text?: string }).text || '')
        .join('\n');
      return coerceAiOpinion('claude_web_search', text);
    } catch (error) {
      return {
        provider: 'claude_web_search',
        confidence: 0,
        manualReviewRequired: true,
        reasons: [`Claude web price adjudication unavailable: ${error instanceof Error ? error.message : 'unknown error'}`],
      };
    }
  }

  private selectAiOpinion(aiOpinions: AiPriceOpinion[], filteredPrices: ExtractedPrice[]): AiPriceOpinion | null {
    const values = filteredPrices.map((price) => price.price);
    const center = median(values) || average(values);
    const credible = aiOpinions
      .filter((opinion) => opinion.recommendedPrice && opinion.confidence >= MIN_AI_CONFIDENCE_TO_SELECT)
      .filter((opinion) => {
        if (!center) return true;
        const deviation = Math.abs((opinion.recommendedPrice! - center) / center) * 100;
        return deviation <= 120 || opinion.manualReviewRequired;
      })
      .sort((a, b) => b.confidence - a.confidence);
    return credible[0] || null;
  }

  async adjudicate(input: PriceAdjudicationInput): Promise<PriceAdjudicationResult> {
    const deterministic = this.applyDeterministicGuards(input);
    const guardedPriceData = rebuildPriceData(input.priceData, deterministic.filteredPrices);

    const shouldAskAi = isPriceAdjudicationAiEnabled();
    const aiOpinions = shouldAskAi
      ? (await Promise.all([
          this.getGeminiGroundedOpinion(input, deterministic.filteredPrices, deterministic.rejectedPrices),
          this.getClaudeWebOpinion(input, deterministic.filteredPrices, deterministic.rejectedPrices),
        ])).filter((opinion): opinion is AiPriceOpinion => Boolean(opinion))
      : [];

    const selectedAiOpinion = this.selectAiOpinion(aiOpinions, deterministic.filteredPrices);
    const serperCount = deterministic.filteredPrices.length;
    const minSerperSources = input.mode === 'market'
      ? input.policy.minimumMarketSourceCount
      : 1;
    const preferAi = serperCount === 0 || serperCount < minSerperSources;
    const selectedPrice = preferAi && selectedAiOpinion?.recommendedPrice
      ? selectedAiOpinion.recommendedPrice
      : (selectedAiOpinion?.recommendedPrice || guardedPriceData.medianPrice || guardedPriceData.averagePrice);
    const selectedSource = selectedAiOpinion?.provider || (selectedPrice ? 'serper' : 'none');
    const aiReviewReasons = aiOpinions.flatMap((opinion) => opinion.manualReviewRequired ? opinion.reasons : []);
    const reviewReasons = Array.from(new Set([
      ...deterministic.reviewReasons,
      ...aiReviewReasons,
      ...(selectedAiOpinion?.manualReviewRequired ? selectedAiOpinion.reasons : []),
    ].filter(Boolean)));

    const finalPriceData: PriceExtractionResult = {
      ...guardedPriceData,
      averagePrice: selectedPrice || guardedPriceData.averagePrice,
      medianPrice: selectedPrice || guardedPriceData.medianPrice,
      confidence: selectedAiOpinion
        ? Math.min(selectedAiOpinion.confidence, guardedPriceData.confidence || selectedAiOpinion.confidence)
        : guardedPriceData.confidence,
      rejectedPrices: deterministic.rejectedPrices,
    };

    return {
      priceData: finalPriceData,
      selectedPrice,
      selectedSource,
      confidence: finalPriceData.confidence,
      manualReviewRequired: reviewReasons.length > 0 || aiOpinions.some((opinion) => opinion.manualReviewRequired),
      reviewReasons,
      rejectedPrices: deterministic.rejectedPrices,
      aiOpinions,
    };
  }
}

export const priceAdjudicationService = new PriceAdjudicationService();
