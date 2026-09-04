import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/market-data/services/market-data.service', () => ({ getMarketPrice: vi.fn() }));
vi.mock('@/features/internet-search/services/internet-search.service', () => ({ internetSearchService: { searchMarketPrice: vi.fn() } }));
vi.mock('@/features/valuations/services/damage-calculation.service', () => ({ damageCalculationService: {} }));
vi.mock('@/features/valuations/services/valuation-policy.service', () => ({ getValuationPolicyConfig: vi.fn(), shouldRequireManualReview: vi.fn() }));
vi.mock('@/lib/integrations/claude-damage-detection', () => ({ assessDamageWithClaude: vi.fn(), initializeClaudeService: vi.fn(), isClaudeEnabled: vi.fn() }));
vi.mock('@/lib/integrations/gemini-damage-detection', () => ({ assessDamageWithGemini: vi.fn(), initializeGeminiService: vi.fn(), isGeminiEnabled: vi.fn() }));
vi.mock('@/lib/integrations/vision-damage-detection', () => ({ assessDamageWithVision: vi.fn() }));
vi.mock('@/lib/integrations/claude-rate-limiter', () => ({ getClaudeRateLimiter: vi.fn() }));
vi.mock('@/lib/integrations/gemini-rate-limiter', () => ({ getGeminiRateLimiter: vi.fn() }));

import { getMarketPrice } from '@/features/market-data/services/market-data.service';
import { internetSearchService } from '@/features/internet-search/services/internet-search.service';
import { enrichItemInfoWithAiIdentification, getAssetIdentityReviewReasons, getUniversalMarketValue, parseQuantityValue, type UniversalItemInfo } from '@/features/cases/services/ai-assessment-enhanced.service';
import { ValuationUnavailableError } from '@/features/valuations/services/valuation-unavailable';

const categories: UniversalItemInfo['type'][] = ['vehicle', 'electronics', 'appliance', 'property', 'watch', 'jewelry', 'furniture', 'artwork', 'equipment', 'machinery', 'stock', 'goods_in_transit', 'building_materials', 'scrap', 'agriculture', 'medical_equipment', 'energy_equipment', 'aviation_equipment', 'other'];

describe('market evidence is required across all asset categories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMarketPrice).mockRejectedValue(new Error('Research unavailable'));
    vi.mocked(internetSearchService.searchMarketPrice).mockResolvedValue({ success: false, priceData: { prices: [], confidence: 0, currency: 'NGN', extractedAt: new Date() }, query: '', resultsProcessed: 0, executionTime: 0, dataSource: 'internet_search' });
  });

  it.each(categories)('%s does not manufacture a category price after research failure', async type => {
    await expect(getUniversalMarketValue({ type, condition: 'Nigerian Used', make: 'Example', brand: 'Example', model: 'Specific Model', year: 2015, description: 'Specific asset', propertyType: 'house', location: 'Lagos', quantity: '10', unitOfMeasure: 'units' })).rejects.toBeInstanceOf(ValuationUnavailableError);
  });

  it('requires the evidence-only vehicle path, including on forced refresh', async () => {
    await expect(getUniversalMarketValue({ type: 'vehicle', make: 'Jeep', model: 'Wrangler JK', year: 2015, condition: 'Nigerian Used' }, { forceRefresh: true })).rejects.toBeInstanceOf(ValuationUnavailableError);
    expect(getMarketPrice).toHaveBeenCalledWith(expect.objectContaining({ make: 'Jeep', model: 'Wrangler JK', year: 2015 }), { forceRefresh: true, requireVerifiedEvidence: true });
  });

  it('preserves exact entered identity when vision returns a generic label', () => {
    expect(enrichItemInfoWithAiIdentification({ type: 'vehicle', make: 'Jeep', model: 'Wrangler JK Rubicon', year: 2015, condition: 'Nigerian Used' }, { itemDetails: { detectedMake: 'Jeep', detectedModel: 'Wrangler' } })).toMatchObject({ make: 'Jeep', model: 'Wrangler JK Rubicon', year: 2015 });
    expect(enrichItemInfoWithAiIdentification({ type: 'electronics', brand: 'Apple', model: 'iPhone 12 Pro Max', condition: 'Nigerian Used' }, { itemDetails: { detectedModel: 'iPhone' } })).toMatchObject({ model: 'iPhone 12 Pro Max' });
  });

  it('flags conflicting identification without replacing the entered model', () => {
    const item: UniversalItemInfo = { type: 'electronics', brand: 'Apple', model: 'iPhone 12', condition: 'Nigerian Used' };
    expect(getAssetIdentityReviewReasons(item, { detectedModel: 'iPhone 13' })).toHaveLength(1);
    expect(getAssetIdentityReviewReasons(item, { detectedModel: 'iPhone' })).toEqual([]);
  });

  it('does not classify a supplied manual amount as independently verified', async () => {
    const result = await getUniversalMarketValue({ type: 'vehicle', condition: 'Nigerian Used', marketValue: 8400000, marketValueSource: 'manual' });
    expect(result).toMatchObject({ value: 8400000, source: 'user_provided', confidence: 0, uniqueSourceCount: 0 });
    expect(result.evidence?.reviewReasons).toEqual(expect.arrayContaining([expect.stringContaining('manual appraisal')]));
    expect(getMarketPrice).not.toHaveBeenCalled();
  });

  it.each(['10-20', 'approximately 20', '-5', 'NaN', '1,20', '25kg bags', '20 bags of 25kg'])('rejects ambiguous or invalid quantity %s', value => {
    expect(parseQuantityValue(value)).toBeUndefined();
  });

  it('parses thousands separators and fractional weight without magnitude loss', () => {
    expect(parseQuantityValue('1,200 bags')).toBe(1200);
    expect(parseQuantityValue('1.5 tonnes')).toBe(1.5);
  });

  it('requires an exact bulk quantity and unit before research', async () => {
    await expect(getUniversalMarketValue({ type: 'stock', description: 'rice', condition: 'Brand New', quantity: '20-30', unitOfMeasure: 'bags' })).rejects.toBeInstanceOf(ValuationUnavailableError);
    expect(internetSearchService.searchMarketPrice).not.toHaveBeenCalled();
  });
});
