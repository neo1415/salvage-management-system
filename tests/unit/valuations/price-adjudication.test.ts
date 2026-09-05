import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PriceAdjudicationService,
  getPriceResearchTimeoutMs,
  shouldEscalatePriceAdjudication,
  shouldUseClaudeWebFallback,
  type AiPriceOpinion,
} from '@/features/valuations/services/price-adjudication.service';
import { getDefaultValuationPolicyConfig } from '@/features/valuations/services/valuation-policy.service';
import type { ExtractedPrice, PriceExtractionResult } from '@/features/internet-search/services/price-extraction.service';
import type { ItemIdentifier } from '@/features/internet-search/services/query-builder.service';

function price(overrides: Partial<ExtractedPrice>): ExtractedPrice {
  return {
    price: 1_000_000,
    currency: 'NGN',
    originalText: 'NGN1,000,000',
    confidence: 80,
    sourceQuality: 'medium',
    source: 'example.com',
    url: 'https://example.com/listing',
    title: 'Listing',
    snippet: 'Price NGN1,000,000',
    ...overrides,
  };
}

function priceData(prices: ExtractedPrice[]): PriceExtractionResult {
  return {
    prices,
    confidence: 80,
    currency: 'NGN',
    extractedAt: new Date(),
  };
}

describe('price research timeout', () => {
  it('uses a production-safe default and clamps invalid extremes', () => {
    expect(getPriceResearchTimeoutMs(undefined)).toBe(60_000);
    expect(getPriceResearchTimeoutMs('not-a-number')).toBe(60_000);
    expect(getPriceResearchTimeoutMs('100')).toBe(15_000);
    expect(getPriceResearchTimeoutMs('999999')).toBe(120_000);
  });
});

describe('vehicle generation aliases', () => {
  beforeEach(() => vi.stubEnv('PRICE_ADJUDICATION_AI_ENABLED', 'false'));
  afterEach(() => vi.unstubAllEnvs());
  it('accepts a Wrangler listing that omits JK when the exact year establishes the generation', async () => {
    const service = new PriceAdjudicationService();
    const policy = getDefaultValuationPolicyConfig();
    const result = await service.adjudicate({
      item: { type: 'vehicle', make: 'Jeep', model: 'Wrangler JK', year: 2015, condition: 'Foreign Used (Tokunbo)' },
      mode: 'market',
      policy,
      priceData: priceData([price({
        price: 20_500_000,
        title: '2015 Jeep Wrangler foreign used tokunbo NGN 20,500,000',
        snippet: '2015 Jeep Wrangler foreign used tokunbo NGN 20,500,000',
        extractedYear: 2015,
        yearMatched: true,
      })]),
    });
    expect(result.priceData.prices).toHaveLength(1);
    expect(result.selectedPrice).toBe(20_500_000);
  });
});

describe('PriceAdjudicationService', () => {
  const service = new PriceAdjudicationService();
  const policy = getDefaultValuationPolicyConfig();

  beforeEach(() => {
    vi.stubEnv('PRICE_ADJUDICATION_AI_ENABLED', 'false');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('requires specialist review without inventing luxury price floors', async () => {
    const item: ItemIdentifier = {
      type: 'jewelry',
      jewelryType: 'Watch, Bracelet',
      brand: 'Rolex, Cartier',
      material: 'Gold',
      condition: 'Brand New',
    };

    const result = await service.adjudicate({
      item,
      mode: 'market',
      policy,
      priceData: priceData([
        price({ price: 52_005, source: 'www.jumia.com.ng', url: 'https://www.jumia.com.ng/item', title: 'Rolex Cartier watch bracelet' }),
        price({ price: 15_000_000, source: 'pololuxury.com', url: 'https://pololuxury.com/item', title: 'Rolex Submariner Cartier Love Bracelet' }),
      ]),
    });

    expect(result.priceData.prices).toHaveLength(2);
    expect(result.rejectedPrices).toHaveLength(0);
    expect(result.manualReviewRequired).toBe(true);
  });

  it('keeps low specialist prices from high-quality sources but requires review', async () => {
    const item: ItemIdentifier = {
      type: 'jewelry',
      jewelryType: 'Watch',
      brand: 'Rolex',
      material: 'Gold',
      condition: 'Heavily Used',
    };

    const result = await service.adjudicate({
      item,
      mode: 'market',
      policy,
      priceData: priceData([
        price({
          price: 750_000,
          source: 'authorized-appraiser.example',
          sourceQuality: 'high',
          confidence: 92,
          title: 'Damaged Rolex appraised salvage value',
        }),
      ]),
    });

    expect(result.selectedPrice).toBe(750_000);
    expect(result.priceData.prices).toHaveLength(1);
    expect(result.manualReviewRequired).toBe(true);
  });

  it('rejects replica and accessory-only listings even when the numeric price is plausible', async () => {
    const item: ItemIdentifier = {
      type: 'electronics',
      brand: 'Apple',
      model: 'iPhone 15 Pro',
      condition: 'Foreign Used (Tokunbo)',
    };

    const result = await service.adjudicate({
      item,
      mode: 'market',
      policy,
      priceData: priceData([
        price({ price: 950_000, title: 'iPhone 15 Pro replica', snippet: 'copy phone' }),
        price({ price: 1_100_000, source: 'store.example.com', title: 'Apple iPhone 15 Pro 256GB' }),
      ]),
    });

    expect(result.priceData.prices).toHaveLength(1);
    expect(result.priceData.prices[0].price).toBe(1_100_000);
    expect(result.rejectedPrices[0].rejectionReason).toContain('counterfeit');
  });

  it('requires review when accepted market evidence is not source-diverse', async () => {
    const item: ItemIdentifier = {
      type: 'furniture',
      furnitureType: '3-seater sofa',
      material: 'leather',
      condition: 'Nigerian Used',
    };

    const result = await service.adjudicate({
      item,
      mode: 'market',
      policy,
      priceData: priceData([
        price({ price: 250_000, source: 'same-source.ng', url: 'https://same-source.ng/a' }),
        price({ price: 270_000, source: 'same-source.ng', url: 'https://same-source.ng/b' }),
      ]),
    });

    expect(result.manualReviewRequired).toBe(true);
    expect(result.reviewReasons.join(' ')).toContain('source-diverse');
  });

  it('rejects single-item prices for a declared multi-item furniture set', async () => {
    const item: ItemIdentifier = {
      type: 'furniture',
      furnitureType: '3-seater sofa armchair coffee table side cabinet',
      material: 'leather wood',
      size: '3 seater, 1 seater',
      condition: 'Brand New',
    };

    const result = await service.adjudicate({
      item,
      mode: 'market',
      policy,
      priceData: priceData([
        price({ price: 77_100, title: 'Single leather armchair', snippet: 'One chair only' }),
        price({ price: 410_000, source: 'store.example.ng', title: 'Complete living room sofa and coffee table set', snippet: 'Sofa, armchair, table and cabinet' }),
      ]),
    });

    expect(result.selectedPrice).toBe(410_000);
    expect(result.rejectedPrices).toEqual(expect.arrayContaining([
      expect.objectContaining({ price: 77_100, rejectionReason: expect.stringContaining('multi-item') }),
    ]));
  });

  it('requires review for excessive price spread', async () => {
    const item: ItemIdentifier = {
      type: 'machinery',
      brand: 'CAT',
      machineryType: 'Generator',
      model: '100kVA',
      condition: 'Foreign Used (Tokunbo)',
    };

    const result = await service.adjudicate({
      item,
      mode: 'market',
      policy,
      priceData: priceData([
        price({ price: 1_000_000, source: 'source-a.ng' }),
        price({ price: 4_500_000, source: 'source-b.ng' }),
        price({ price: 8_000_000, source: 'source-c.ng' }),
      ]),
    });

    expect(result.manualReviewRequired).toBe(true);
    expect(result.reviewReasons.join(' ')).toContain('Accepted prices vary');
  });

  it('keeps part prices above configured attention thresholds but requires review', async () => {
    const item: ItemIdentifier = {
      type: 'vehicle',
      make: 'Toyota',
      model: 'Camry',
      year: 2018,
    };

    const result = await service.adjudicate({
      item,
      mode: 'part',
      partName: 'headlight',
      policy,
      priceData: priceData([
        price({ price: 80_000_000, source: 'parts.example.com', title: 'Toyota Camry headlight' }),
        price({ price: 450_000, source: 'parts2.example.com', title: 'Toyota Camry headlight replacement' }),
      ]),
    });

    expect(result.priceData.prices).toHaveLength(2);
    expect(result.manualReviewRequired).toBe(true);
    expect(result.reviewReasons.join(' ')).toContain('part attention threshold');
  });

  it('returns no selected price when every candidate fails relevance checks', async () => {
    const item: ItemIdentifier = {
      type: 'jewelry',
      jewelryType: 'Rolex Submariner',
      brand: 'Rolex',
      material: 'steel',
      condition: 'Heavily Used',
    };

    const result = await service.adjudicate({
      item,
      mode: 'market',
      policy,
      priceData: priceData([
        price({ price: 65_000, source: 'jiji.ng', title: 'Rolex inspired watch replica' }),
      ]),
    });

    expect(result.selectedPrice).toBeUndefined();
    expect(result.manualReviewRequired).toBe(true);
    expect(result.reviewReasons.join(' ')).toContain('No accepted market evidence');
  });

  it('does not spend AI search calls when Serper market evidence is sufficient', () => {
    expect(shouldEscalatePriceAdjudication({
      mode: 'market',
      acceptedPriceCount: 5,
      uniqueSourceCount: 3,
      spreadPercent: 20,
      specialistReviewRequired: false,
      minimumMarketSourceCount: 3,
      sourceDiversityRequired: true,
      maxAllowedPriceSpreadPercent: 80,
    })).toBe(false);
  });

  it('escalates unresolved market evidence but not an accepted part price', () => {
    const shared = {
      uniqueSourceCount: 0,
      spreadPercent: 0,
      specialistReviewRequired: false,
      minimumMarketSourceCount: 3,
      sourceDiversityRequired: true,
      maxAllowedPriceSpreadPercent: 80,
    };

    expect(shouldEscalatePriceAdjudication({ ...shared, mode: 'market', acceptedPriceCount: 0 })).toBe(true);
    expect(shouldEscalatePriceAdjudication({ ...shared, mode: 'part', acceptedPriceCount: 1 })).toBe(false);
  });

  it('uses Claude when Gemini did not return native-cited listing evidence', () => {
    expect(shouldUseClaudeWebFallback('part', null)).toBe(true);
    expect(shouldUseClaudeWebFallback('market', null)).toBe(true);
    expect(shouldUseClaudeWebFallback('market', {
      provider: 'gemini_grounded',
      recommendedPrice: 1_000_000,
      confidence: 85,
      manualReviewRequired: false,
      reasons: [],
    })).toBe(true);
    expect(shouldUseClaudeWebFallback('part', {
      provider: 'gemini_grounded', confidence: 80, manualReviewRequired: false, reasons: [],
      researchedPrices: [price({ price: 10_000 })],
    })).toBe(false);
  });

  it.each([
    ['Toyota Corolla SE 2018', {}, 'make/model'],
    ['Toyota Camry XSE 2018', {}, 'make/model'],
    ['Toyota Camry SE 2017', {}, 'year'],
    ['Toyota Camry SE', {}, 'year'],
    ['Toyota Camry SE 2018', { extractedYear: 2017, yearMatched: true }, 'year'],
    ['Toyota Camry SE 2018-2020', {}, 'year'],
  ] as Array<[string, Partial<ExtractedPrice>, string]>)('rejects vehicle identity mismatch: %s', async (title, metadata, reason) => {
    const result = await service.adjudicate({
      item: { type: 'vehicle', make: 'Toyota', model: 'Camry SE', year: 2018 }, mode: 'market', policy,
      priceData: priceData([price({ title, snippet: 'Compare Toyota Camry SE 2018', ...metadata })]),
    });
    expect(result.selectedPrice).toBeUndefined();
    expect(result.rejectedPrices[0].rejectionReason).toContain(reason);
  });

  it('keeps exact vehicle evidence and recomputes statistics without mismatches', async () => {
    const result = await service.adjudicate({
      item: { type: 'vehicle', make: 'Toyota', model: 'Camry SE', year: 2018 }, mode: 'market', policy,
      priceData: priceData([
        price({ title: '2018 Toyota Camry SE', price: 12_000_000 }),
        price({ title: '2017 Toyota Camry SE', price: 6_000_000 }),
      ]),
    });
    expect(result.selectedPrice).toBe(12_000_000);
    expect(result.priceData.priceRange).toEqual({ min: 12_000_000, max: 12_000_000 });
    expect(result.priceData.rejectedPrices).toHaveLength(1);
  });

  it.each(['iPhone 15 Pro Max 256GB', 'iPhone 15 256GB', 'iPhone 14 Pro 256GB', 'iPhone 15 Pro 128GB', 'iPhone 15 Pro'])('rejects electronics mismatch: %s', async (title) => {
    const result = await service.adjudicate({
      item: { type: 'electronics', brand: 'Apple', model: 'iPhone 15 Pro', storageCapacity: '256GB' },
      mode: 'market', policy, priceData: priceData([price({ title })]),
    });
    expect(result.selectedPrice).toBeUndefined();
    expect(result.rejectedPrices).toHaveLength(1);
  });

  it('honors current storageCapacity over legacy storage and accepts included chargers', async () => {
    const result = await service.adjudicate({
      item: { type: 'electronics', brand: 'Apple', model: 'iPhone 15 Pro', storageCapacity: '256 GB', storage: '128GB' },
      mode: 'market', policy,
      priceData: priceData([price({ title: 'Apple iPhone15 Pro 256GB', snippet: 'Complete phone with charger' })]),
    });
    expect(result.priceData.prices).toHaveLength(1);
  });

  it.each(['Samsung Galaxy S24 Ultra', 'Samsung Galaxy S24+'])('rejects a larger variant for a base model: %s', async (title) => {
    const result = await service.adjudicate({
      item: { type: 'electronics', brand: 'Samsung', model: 'Galaxy S24' }, mode: 'market', policy,
      priceData: priceData([price({ title })]),
    });
    expect(result.rejectedPrices[0].rejectionReason).toContain('variant');
  });

  it('rejects a partial furniture set even when two item groups match', async () => {
    const result = await service.adjudicate({
      item: { type: 'furniture', furnitureType: 'sofa armchair coffee table cabinet' }, mode: 'market', policy,
      priceData: priceData([price({ title: 'Complete sofa and coffee table set' })]),
    });
    expect(result.rejectedPrices[0].rejectionReason).toContain('multi-item');
  });

  it('does not treat an unconverted foreign amount as NGN', async () => {
    const result = await service.adjudicate({
      item: { type: 'equipment', description: 'Pump' }, mode: 'market', policy,
      priceData: priceData([price({ currency: 'USD' })]),
    });
    expect(result.selectedPrice).toBeUndefined();
    expect(result.rejectedPrices[0].rejectionReason).toContain('currency');
  });

  it.each([
    [{ type: 'appliance', brand: 'LG', model: 'Washer', condition: 'Brand New' }, 'LG Washer refurbished', 'condition'],
    [{ type: 'equipment', description: 'Compressor', condition: 'Nigerian Used' }, 'Brand new compressor', 'condition'],
    [{ type: 'vehicle', make: 'Toyota', model: 'Camry', year: 2018, condition: 'Foreign Used (Tokunbo)' }, '2018 Toyota Camry Nigerian used', 'condition'],
    [{ type: 'scrap', description: 'Steel', quantity: '1', unitOfMeasure: 'tonnes' }, 'Steel NGN 1000 per kg', 'unit of measure'],
    [{ type: 'goods_in_transit', description: 'Pumps', quantity: '5', unitOfMeasure: 'units' }, 'Lot of 3 pumps', 'lot total'],
    [{ type: 'goods_in_transit', description: 'Pumps', quantity: '5', unitOfMeasure: 'units' }, 'Pump for sale', 'Ambiguous pricing unit'],
    [{ type: 'stock', description: 'Rice', quantity: '100', unitOfMeasure: 'bags' }, 'Complete lot of 100 bags', 'lot total'],
    [{ type: 'scrap', description: 'Steel', quantity: '1', unitOfMeasure: 'kg' }, 'Steel per tonne', 'unit of measure'],
    [{ type: 'property', propertyType: 'House', location: 'Lagos' }, 'House for rent Lagos', 'rental'],
    [{ type: 'machinery', brand: 'CAT', machineryType: 'Generator' }, 'Generator deposit only', 'deposit'],
  ] as Array<[ItemIdentifier, string, string]>)('rejects incompatible basis for %j', async (item, title, reason) => {
    const result = await service.adjudicate({ item, mode: 'market', policy, priceData: priceData([price({ title })]) });
    expect(result.selectedPrice).toBeUndefined();
    expect(result.rejectedPrices[0].rejectionReason).toContain(reason);
  });

  it.each(['Rice price per bag', 'Rice price each bag', 'Rice 50kg bag'])('keeps only the per-unit amount for the caller to scale: %s', async (title) => {
    const result = await service.adjudicate({
      item: { type: 'stock', description: 'Rice', quantity: '100', unitOfMeasure: 'bags' }, mode: 'market', policy,
      priceData: priceData([price({ title })]),
    });
    expect(result.selectedPrice).toBe(1_000_000);
  });

  it('flags ambiguous bulk units even when other accepted evidence is sufficient', async () => {
    const result = await service.adjudicate({
      item: { type: 'agriculture', description: 'Rice', quantity: '100', unitOfMeasure: 'bags' }, mode: 'market',
      policy: { ...policy, minimumMarketSourceCount: 1, sourceDiversityRequired: false },
      priceData: priceData([price({ title: 'Rice per bag' }), price({ title: 'Rice price' })]),
    });
    expect(result.priceData.prices).toHaveLength(1);
    expect(result.manualReviewRequired).toBe(true);
    expect(result.reviewReasons.join(' ')).toContain('Ambiguous pricing unit');
  });

  it('does not apply whole-asset identity or condition rules to replacement parts', async () => {
    const result = await service.adjudicate({
      item: { type: 'vehicle', make: 'Toyota', model: 'Camry', year: 2018, condition: 'Nigerian Used' },
      mode: 'part', partName: 'headlight', policy,
      priceData: priceData([price({ title: 'Brand new aftermarket Toyota Camry 2017-2020 headlight' })]),
    });
    expect(result.priceData.prices).toHaveLength(1);
  });

  it.each([NaN, Infinity, 0, -100])('rejects invalid numeric evidence: %s', async (amount) => {
    const result = await service.adjudicate({
      item: { type: 'other', description: 'Asset' }, mode: 'market', policy,
      priceData: priceData([price({ price: amount })]),
    });
    expect(result.selectedPrice).toBeUndefined();
    expect(result.confidence).toBe(0);
  });

  it.each([
    [[], 9_000_000, ['https://unverified.example/item'], undefined, 'none'],
    [[price({ title: 'Pump' })], 9_000_000, ['https://example.com/listing'], 1_000_000, 'serper'],
    [[price({ title: 'Pump' })], 1_000_000, [], 1_000_000, 'serper'],
    [[price({ title: 'Pump' })], 1_000_000, ['https://example.com/listing'], 1_000_000, 'gemini_grounded'],
  ] as Array<[ExtractedPrice[], number, string[], number | undefined, string]>)('selects AI amounts only with matching accepted listing evidence (%j)', async (prices, recommendedPrice, acceptedSources, expected, selectedSource) => {
    vi.stubEnv('PRICE_ADJUDICATION_AI_ENABLED', 'true');
    const providers = service as unknown as {
      getGeminiGroundedOpinion: () => Promise<AiPriceOpinion | null>;
      getClaudeWebOpinion: () => Promise<AiPriceOpinion | null>;
    };
    vi.spyOn(providers, 'getGeminiGroundedOpinion').mockResolvedValue({
      provider: 'gemini_grounded', confidence: 95, manualReviewRequired: false,
      recommendedPrice, acceptedSources, reasons: [],
    });
    vi.spyOn(providers, 'getClaudeWebOpinion').mockResolvedValue(null);
    const result = await service.adjudicate({
      item: { type: 'equipment', description: 'Pump' }, mode: 'market', policy, priceData: priceData(prices),
    });
    expect(result.selectedPrice).toBe(expected);
    expect(result.selectedSource).toBe(expected ? 'serper' : selectedSource);
    expect(result.priceData.medianPrice).toBe(expected);
  });
});
