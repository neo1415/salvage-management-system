// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MarketPriceResult } from '@/features/internet-search/services/internet-search.service';
import type { PropertyIdentifier } from '@/features/market-data/types';

const mocks = vi.hoisted(() => ({
  search: vi.fn(), query: vi.fn(), cache: vi.fn(), store: vi.fn(), scrape: vi.fn(), enqueue: vi.fn(),
}));
vi.mock('@/features/internet-search/services/internet-search.service', () => ({ internetSearchService: { searchMarketPrice: mocks.search } }));
vi.mock('@/features/valuations/services/valuation-query.service', () => ({
  ValuationQueryService: class { queryValuation = mocks.query; },
}));
vi.mock('@/features/market-data/services/cache.service', () => ({
  getCachedPrice: mocks.cache, setCachedPrice: mocks.store, getCacheAge: () => 1, isStale: () => false,
}));
vi.mock('@/features/market-data/services/scraper.service', () => ({ scrapeAllSources: mocks.scrape }));
vi.mock('@/features/market-data/services/background-job.service', () => ({ enqueueScrapingJob: mocks.enqueue }));
vi.mock('@/features/market-data/services/scraping-logger.service', () => ({
  logScrapingStart: vi.fn(), logScrapingSuccess: vi.fn(), logScrapingFailure: vi.fn(),
  logCacheHit: vi.fn(), logStaleFallback: vi.fn(), logDatabaseHit: vi.fn(),
}));

import { getMarketPrice } from '@/features/market-data/services/market-data.service';

const vehicle: PropertyIdentifier = { type: 'vehicle', make: 'Test', model: 'Asset', year: 2020, condition: 'Nigerian Used' };

function result(): MarketPriceResult {
  const priceData: MarketPriceResult['priceData'] = {
    prices: ['https://www.seller.example/one', 'https://seller.example/two', 'https://second.example/three'].map((url, index) => ({
      price: 100 + index * 10, currency: 'NGN', originalText: 'Synthetic fixture', confidence: 80,
      sourceQuality: 'high', source: `label-${index}`, url, title: 'Test Asset 2020', snippet: 'Fixture evidence',
      extractedYear: 2020, yearMatched: true, matchEvidence: ['Identity matched'],
    })),
    averagePrice: 110, medianPrice: 110, confidence: 80, currency: 'NGN', extractedAt: new Date(),
    evidenceSummary: { uniqueSourceCount: 3, priceSpreadPercent: 18, highQualitySourceCount: 3, noYearPriceCount: 0 },
  };
  return {
    success: true, priceData, query: 'fixture', resultsProcessed: 3, executionTime: 1, dataSource: 'internet_search',
    adjudication: {
      priceData, selectedPrice: 110, selectedSource: 'serper', confidence: 80,
      manualReviewRequired: true, reviewReasons: ['Review fixture'], rejectedPrices: [], aiOpinions: [],
    },
  };
}

function expectNoLegacyAccess() {
  for (const mock of [mocks.query, mocks.cache, mocks.store, mocks.scrape, mocks.enqueue]) {
    expect(mock).not.toHaveBeenCalled();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.search.mockResolvedValue(result());
  mocks.query.mockResolvedValue({ found: true, valuation: { averagePrice: 90, lowPrice: 80, highPrice: 100 } });
  mocks.cache.mockResolvedValue({ medianPrice: 90, prices: [{ price: 90 }], scrapedAt: new Date() });
});

describe('strict market evidence', () => {
  it.each<PropertyIdentifier>([
    vehicle,
    { type: 'electronics', brand: 'Test', productModel: 'Asset' },
    { type: 'building', propertyType: 'Warehouse', location: 'Lagos' },
  ])('preserves adjudicated listing evidence for $type', async property => {
    const expected = result();
    mocks.search.mockResolvedValue(expected);
    const actual = await getMarketPrice(property, { requireVerifiedEvidence: true, forceRefresh: true });
    expect(actual.sources).toEqual(expected.priceData.prices);
    expect(actual.count).toBe(3);
    expect(actual.evidenceSummary).toEqual({ ...expected.priceData.evidenceSummary, uniqueSourceCount: 2 });
    expect(actual.adjudication).toMatchObject({ manualReviewRequired: true, reviewReasons: ['Review fixture'] });
    expect(mocks.search).toHaveBeenCalledWith(expect.objectContaining({ forceRefresh: true }));
    expectNoLegacyAccess();
  });

  it.each(['failure', 'empty', 'exception', 'unadjudicated', 'ai', 'invalid-url', 'invalid-price', 'different-selection'])(
    'rejects %s without accessing even the emergency cache', async failure => {
      const response = result();
      if (failure === 'failure') response.success = false;
      if (failure === 'empty') response.priceData.prices = [];
      if (failure === 'unadjudicated') response.adjudication = undefined;
      if (failure === 'ai') response.adjudication!.selectedSource = 'gemini_grounded';
      if (failure === 'invalid-url') response.priceData.prices[0].url = 'internal';
      if (failure === 'invalid-price') response.priceData.prices[0].price = NaN;
      if (failure === 'different-selection') response.adjudication!.selectedPrice = 999;
      if (failure === 'exception') mocks.search.mockRejectedValue(new Error('Provider unavailable'));
      else mocks.search.mockResolvedValue(response);
      await expect(getMarketPrice(vehicle, { requireVerifiedEvidence: true })).rejects.toThrow('Verified market evidence is required');
      expectNoLegacyAccess();
    }
  );

  it('does not search or fall back when identity is incomplete', async () => {
    await expect(getMarketPrice({ type: 'vehicle', make: 'Test' }, { requireVerifiedEvidence: true })).rejects.toThrow('Verified market evidence');
    expect(mocks.search).not.toHaveBeenCalled();
    expectNoLegacyAccess();
  });

  it.each(['accepted', 'uncited', 'rejected'])('requires exact cited listing evidence for an AI selection: %s', async state => {
    const response = result();
    const url = response.priceData.prices[1].url;
    response.adjudication!.selectedSource = 'gemini_grounded';
    response.adjudication!.aiOpinions = [{
      provider: 'gemini_grounded', recommendedPrice: 110, confidence: 80,
      manualReviewRequired: false, reasons: [],
      acceptedSources: state === 'uncited' ? [] : [url],
      rejectedSources: state === 'rejected' ? [url] : [],
    }];
    mocks.search.mockResolvedValue(response);
    const request = getMarketPrice(vehicle, { requireVerifiedEvidence: true });
    if (state === 'accepted') await expect(request).resolves.toMatchObject({ median: 110 });
    else await expect(request).rejects.toThrow('Verified market evidence');
    expectNoLegacyAccess();
  });

  it('derives evidence metrics when the search summary is absent', async () => {
    const response = result();
    response.priceData.evidenceSummary = undefined;
    mocks.search.mockResolvedValue(response);
    const actual = await getMarketPrice(vehicle, { requireVerifiedEvidence: true });
    expect(actual.evidenceSummary).toEqual({ uniqueSourceCount: 2, priceSpreadPercent: 18, highQualitySourceCount: 3, noYearPriceCount: 0 });
  });

  it('keeps the database fallback for callers that do not opt in', async () => {
    mocks.search.mockRejectedValue(new Error('Provider unavailable'));
    expect((await getMarketPrice(vehicle)).dataSource).toBe('database');
    expect(mocks.query).toHaveBeenCalledOnce();
  });
});
