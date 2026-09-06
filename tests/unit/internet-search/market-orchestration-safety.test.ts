import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtractedPrice, PriceExtractionResult } from '@/features/internet-search/services/price-extraction.service';
import type { PriceAdjudicationResult } from '@/features/valuations/services/price-adjudication.service';
import { InternetSearchService } from '@/features/internet-search/services/internet-search.service';

const mocks = vi.hoisted(() => ({
  search: vi.fn(), extract: vi.fn(), adjudicate: vi.fn(), getCache: vi.fn(), setCache: vi.fn(),
  getPartCache: vi.fn(), setPartCache: vi.fn(), record: vi.fn(),
}));
vi.mock('@/lib/integrations/serper-api', () => ({ serperApi: { search: mocks.search } }));
vi.mock('@/features/internet-search/services/price-extraction.service', () => ({ priceExtractor: { extractPrices: mocks.extract } }));
vi.mock('@/features/internet-search/services/cache-integration.service', () => ({ cacheIntegrationService: {
  getCachedMarketPrice: mocks.getCache, setCachedMarketPrice: mocks.setCache,
  getCachedPartPrice: mocks.getPartCache, setCachedPartPrice: mocks.setPartCache,
} }));
vi.mock('@/features/valuations/services/price-adjudication.service', () => ({ priceAdjudicationService: { adjudicate: mocks.adjudicate } }));
vi.mock('@/features/valuations/services/valuation-policy.service', () => ({ getValuationPolicyConfig: vi.fn(async () => ({
  minimumMarketSourceCount: 2, exchangeRates: {}, pricePlausibility: {},
})) }));
vi.mock('@/features/internet-search/services/query-builder.service', () => ({ queryBuilder: {
  buildMarketQuery: vi.fn(() => 'exact asset'), generateQueryVariations: vi.fn(() => ['exact asset']),
  buildPartPriceQuery: vi.fn(() => 'exact asset replacement screen'),
  getPartPricingContext: vi.fn(() => 'replacement part'),
} }));
vi.mock('@/features/internet-search/utils/performance-monitor', () => ({
  performanceMonitor: { recordSearch: mocks.record },
  createSearchTimer: () => ({ end: () => 1, getStartTime: () => Date.now() }),
}));

const item = { type: 'electronics' as const, brand: 'Apple', model: 'iPhone 13', storage: '128GB', condition: 'used' };
function listing(overrides: Partial<ExtractedPrice> = {}): ExtractedPrice {
  return { price: 300_000, currency: 'NGN', originalText: 'NGN 300,000', confidence: 90,
    sourceQuality: 'high', source: 'seller.example', url: 'https://seller.example/iphone-13',
    title: 'Apple iPhone 13 128GB used', snippet: 'Apple iPhone 13 128GB used NGN 300,000', ...overrides };
}
function data(prices: ExtractedPrice[] = [listing()]): PriceExtractionResult {
  return { prices, currency: 'NGN', confidence: 90, extractedAt: new Date() };
}
function decision(priceData: PriceExtractionResult, overrides: Partial<PriceAdjudicationResult> = {}): PriceAdjudicationResult {
  return { priceData, selectedPrice: 300_000, selectedSource: 'serper', confidence: 90,
    manualReviewRequired: false, reviewReasons: [], rejectedPrices: [], aiOpinions: [], ...overrides };
}
function cached(overrides = {}) {
  return { item, priceData: data(), expiresAt: new Date(Date.now() + 60_000), query: 'cached exact asset',
    resultsProcessed: 1, ...overrides };
}

describe('market orchestration evidence safety', () => {
  let service: InternetSearchService;
  beforeEach(() => {
    vi.resetAllMocks();
    service = new InternetSearchService();
    mocks.getCache.mockResolvedValue(null);
    mocks.getPartCache.mockResolvedValue(null);
    mocks.search.mockResolvedValue({ organic: [{ link: listing().url, title: listing().title, snippet: listing().snippet }] });
    mocks.extract.mockReturnValue(data());
    mocks.adjudicate.mockImplementation(async ({ priceData }) => decision(priceData));
  });

  it('does not expose source-free AI prices when search has no results', async () => {
    mocks.search.mockResolvedValue({ organic: [] });
    mocks.extract.mockReturnValue(data([]));
    mocks.adjudicate.mockResolvedValue(decision({ ...data([]), averagePrice: 9_000_000, medianPrice: 9_000_000 }, {
      selectedPrice: 9_000_000, selectedSource: 'gemini_grounded',
    }));
    const result = await service.getAggregatedMarketPrice(item);
    expect(result.marketPrice.success).toBe(false);
    expect(result.marketPrice.priceData.averagePrice).toBeUndefined();
    expect(result.marketPrice.priceData.medianPrice).toBeUndefined();
    expect(result.marketPrice.adjudication?.selectedPrice).toBeUndefined();
    expect(result.recommendedPrice).toBeUndefined();
    expect(mocks.adjudicate).toHaveBeenCalledTimes(1);
    expect(mocks.setCache).not.toHaveBeenCalled();
  });

  it('never turns an AI quote into a comparable listing', async () => {
    const synthetic = listing({ price: 9_000_000, source: 'gemini_grounded', url: 'https://ai.example/estimate' });
    mocks.adjudicate.mockResolvedValue(decision(data([synthetic])));
    const result = await service.searchMarketPrice({ item });
    expect(result.success).toBe(false);
    expect(result.priceData.prices).toEqual([]);
    expect(result.priceData.rejectedPrices).toEqual(expect.arrayContaining([expect.objectContaining({ price: 9_000_000 })]));
  });

  it('continues to grounded research when Serper times out', async () => {
    mocks.search.mockImplementation(() => new Promise(() => {}));
    mocks.extract.mockReturnValue(data([]));
    mocks.adjudicate.mockResolvedValue(decision(data([]), { selectedPrice: undefined }));
    await service.searchMarketPrice({ item, timeout: 1 });
    expect(mocks.adjudicate).toHaveBeenCalledOnce();
  });

  it('does not repeat paid research when no part evidence is available', async () => {
    mocks.search.mockResolvedValue({ organic: [] });
    mocks.adjudicate.mockResolvedValue(decision(data([]), { selectedPrice: undefined }));
    const result = await service.searchPartPrice({ item, partName: 'screen' });
    expect(result.success).toBe(false);
    expect(mocks.adjudicate).toHaveBeenCalledOnce();
  });

  it.each(['repair', 'replace'] as const)('preserves %s context in Serper-free part research', async action => {
    mocks.search.mockResolvedValue({ organic: [] });
    mocks.adjudicate.mockResolvedValue(decision(data([]), { selectedPrice: undefined }));
    await service.searchPartPrice({ item, partName: 'screen', damageType: 'cracked', action });
    expect(mocks.adjudicate).toHaveBeenCalledOnce();
    expect(mocks.adjudicate).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'part', partName: 'screen', damageType: 'cracked', action,
    }));
  });

  it('derives public aggregates from accepted evidence, not an AI point estimate', async () => {
    mocks.adjudicate.mockResolvedValue(decision({ ...data(), averagePrice: 9_000_000, medianPrice: 9_000_000 }, {
      selectedPrice: 9_000_000, selectedSource: 'gemini_grounded',
    }));
    const result = await service.searchMarketPrice({ item });
    expect(result.success).toBe(true);
    expect(result.priceData.averagePrice).toBe(300_000);
    expect(result.adjudication?.selectedPrice).toBe(300_000);
    expect(result.adjudication?.priceData).toBe(result.priceData);
    expect(mocks.setCache).toHaveBeenCalledOnce();
  });

  it.each([false, true])('honors manual review for cached=%s', async fromCache => {
    if (fromCache) mocks.getCache.mockResolvedValue(cached());
    mocks.adjudicate.mockImplementation(async ({ priceData }) => decision(priceData, {
      manualReviewRequired: true, reviewReasons: ['Identity requires review.'],
    }));
    const result = await service.getAggregatedMarketPrice(item);
    expect(result.marketPrice.success).toBe(true);
    expect(result.marketPrice.priceData.prices).toHaveLength(1);
    expect(result.recommendedPrice).toBe(300_000);
    expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ success: true, fromCache }));
    expect(mocks.setCache).not.toHaveBeenCalled();
  });

  it('preserves extraction rejection evidence when no usable prices remain', async () => {
    const rejected = { ...listing(), rejectionReason: 'Wrong storage.' };
    mocks.extract.mockReturnValue({ ...data([]), rejectedPrices: [rejected] });
    const result = await service.searchMarketPrice({ item });
    expect(mocks.adjudicate).toHaveBeenCalledWith(expect.objectContaining({ priceData: expect.objectContaining({ rejectedPrices: [rejected] }) }));
    expect(result.priceData.rejectedPrices).toEqual([rejected]);
    expect(result.success).toBe(false);
  });

  it('preserves evidence for review if adjudication throws', async () => {
    const rejected = { ...listing({ price: 100 }), rejectionReason: 'Wrong model.' };
    mocks.extract.mockReturnValue({ ...data(), rejectedPrices: [rejected] });
    mocks.adjudicate.mockRejectedValue(new Error('Adjudication unavailable'));
    const result = await service.searchMarketPrice({ item });
    expect(result.success).toBe(false);
    expect(result.priceData.prices).toEqual([]);
    expect(result.priceData.rejectedPrices).toHaveLength(2);
    expect(result.priceData.rejectedPrices).toContainEqual(rejected);
    expect(result.adjudication?.manualReviewRequired).toBe(true);
  });

  it.each([
    { item: { ...item, storage: '256GB' } },
    { expiresAt: new Date(Date.now() - 60_000) },
    { expiresAt: 'invalid' },
  ])('does not reuse a stale or mismatched cache: %j', async overrides => {
    mocks.getCache.mockResolvedValue(cached(overrides));
    await service.searchMarketPrice({ item });
    expect(mocks.search).toHaveBeenCalledOnce();
  });

  it('re-extracts cache with the current full identity and preserves invalidated evidence', async () => {
    mocks.getCache.mockResolvedValue(cached());
    mocks.extract.mockReturnValueOnce(data([])).mockReturnValueOnce(data([]));
    const result = await service.searchMarketPrice({ item });
    expect(mocks.extract).toHaveBeenNthCalledWith(1, [{ link: listing().url, title: listing().title, snippet: listing().snippet, position: 1 }],
      item.type, undefined, expect.objectContaining({ mode: 'market', item }));
    expect(mocks.search).toHaveBeenCalledOnce();
    expect(result.priceData.rejectedPrices).toEqual(expect.arrayContaining([expect.objectContaining({ rejectionReason: expect.stringContaining('Cached listing') })]));
    expect(result.success).toBe(false);
  });

  it('forceRefresh bypasses cached data', async () => {
    await service.searchMarketPrice({ item, forceRefresh: true });
    expect(mocks.getCache).not.toHaveBeenCalled();
    expect(mocks.search).toHaveBeenCalledOnce();
  });

  it('does not impose a cached price floor on accepted evidence', async () => {
    const cheap = listing({ price: 500, originalText: 'NGN 500', snippet: 'Apple iPhone 13 used NGN 500' });
    mocks.getCache.mockResolvedValue(cached({ priceData: data([cheap]) }));
    mocks.extract.mockReturnValue(data([cheap]));
    const result = await service.searchMarketPrice({ item });
    expect(result.priceData.medianPrice).toBe(500);
    expect(mocks.search).not.toHaveBeenCalled();
  });

  it('does not apply arbitrary specialist floors before adjudication', async () => {
    mocks.extract.mockReturnValue(data([listing({ price: 500 })]));
    const result = await service.searchMarketPrice({ item: { type: 'jewelry', brand: 'Rolex', jewelryType: 'watch', condition: 'used' } });
    expect(result.priceData.medianPrice).toBe(500);
  });

  it.each(['', 'javascript:alert(1)'])('rejects non-listing URLs: %s', async url => {
    mocks.extract.mockReturnValue(data([listing({ url })]));
    const result = await service.searchMarketPrice({ item });
    expect(result.success).toBe(false);
    expect(result.priceData.prices).toEqual([]);
    expect(result.priceData.rejectedPrices).toHaveLength(1);
  });

  it('cache write failures do not erase accepted evidence', async () => {
    mocks.setCache.mockRejectedValue(new Error('cache unavailable'));
    const result = await service.searchMarketPrice({ item });
    expect(result.success).toBe(true);
    expect(result.priceData.medianPrice).toBe(300_000);
  });

  it('does not report a successful part valuation without accepted evidence', async () => {
    mocks.extract.mockReturnValue(data([]));
    mocks.adjudicate.mockResolvedValue(decision(data([]), {
      selectedPrice: undefined,
      selectedSource: 'none',
      confidence: 0,
      manualReviewRequired: true,
      reviewReasons: ['No accepted comparable listing evidence.'],
    }));

    const result = await service.searchPartPrice({ item, partName: 'replacement screen' });

    expect(result.success).toBe(false);
    expect(result.priceData.prices).toEqual([]);
    expect(mocks.setPartCache).not.toHaveBeenCalled();
  });

  it('returns cited part evidence for review without caching it as verified', async () => {
    const partListing = listing({
      price: 85_000,
      title: 'Apple iPhone 13 replacement screen',
      snippet: 'Apple iPhone 13 replacement screen NGN 85,000',
    });
    const partData = { ...data([partListing]), averagePrice: 85_000, medianPrice: 85_000 };
    mocks.extract.mockReturnValue(partData);
    mocks.adjudicate.mockResolvedValue(decision(partData, {
      selectedPrice: 85_000,
      manualReviewRequired: true,
      reviewReasons: ['Only one comparable part listing was found.'],
    }));

    const result = await service.searchPartPrice({ item, partName: 'replacement screen' });

    expect(result.success).toBe(true);
    expect(result.priceData.medianPrice).toBe(85_000);
    expect(result.error).toContain('Only one comparable part listing');
    expect(mocks.setPartCache).not.toHaveBeenCalled();
  });
});
