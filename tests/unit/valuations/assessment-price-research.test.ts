import { afterEach, describe, expect, it, vi } from 'vitest';
import { PriceAdjudicationService, priceAdjudicationService, type AiPriceOpinion, type PriceAdjudicationInput } from '@/features/valuations/services/price-adjudication.service';
import { researchAssessmentPrices } from '@/features/valuations/services/assessment-price-research.service';
import { getDefaultValuationPolicyConfig } from '@/features/valuations/services/valuation-policy.service';
import * as tavilyResearch from '@/features/valuations/services/tavily-price-research.service';
import type { ItemIdentifier } from '@/features/internet-search/services/query-builder.service';

const policy = getDefaultValuationPolicyConfig();
const item: ItemIdentifier = { type: 'vehicle', make: 'Jeep', model: 'Wrangler', year: 2015, condition: 'Nigerian Used' };
const marketStatement = { url: 'https://seller.example/wrangler-2015', text: 'Jeep Wrangler 2015 Nigerian used SUV NGN 27,000,000' };
const bumperStatement = { url: 'https://parts.example/bumper', text: 'Jeep Wrangler 2015 front bumper replacement part NGN 900,000' };
function requests() {
  const input: PriceAdjudicationInput = { item, policy, mode: 'market', priceData: { prices: [], currency: 'NGN', confidence: 0, extractedAt: new Date() } };
  return [{ key: 'market', input }, { key: 'part:front bumper', input: { ...input, mode: 'part' as const, partName: 'front bumper', action: 'replace' as const } }];
}
function providers(service: PriceAdjudicationService) {
  const internal = service as unknown as {
    getGeminiGroundedOpinion: (input: PriceAdjudicationInput, prices: unknown[], rejected: unknown[], prompt: string) => Promise<AiPriceOpinion | null>;
    getClaudeWebOpinion: (input: PriceAdjudicationInput, prices: unknown[], rejected: unknown[], prompt: string) => Promise<AiPriceOpinion | null>;
  };
  return { gemini: vi.spyOn(internal, 'getGeminiGroundedOpinion'), claude: vi.spyOn(internal, 'getClaudeWebOpinion') };
}
const opinion = (groundedStatements: AiPriceOpinion['groundedStatements'], provider: AiPriceOpinion['provider'] = 'gemini_grounded'): AiPriceOpinion => ({ provider, confidence: 90, manualReviewRequired: false, reasons: [], groundedStatements });
afterEach(() => vi.restoreAllMocks());

describe('one research request per provider for an assessment', () => {
  it.each(['vehicle', 'electronics', 'machinery', 'property', 'furniture', 'stock', 'agriculture', 'equipment', 'other'])('uses labelled fallback estimates for %s without inventing listing evidence', async type => {
    const service = new PriceAdjudicationService(); const mocks = providers(service);
    mocks.gemini.mockResolvedValue({ ...opinion([]), repairEstimates: [{key: 'part:front bumper', action: 'replace', low: 800_000, high: 1_200_000, confidence: 85, assumptions: 'Compatible replacement, part only; fitting excluded.'}] });
    mocks.claude.mockResolvedValue(opinion([], 'claude_web_search'));
    const request = requests()[1]; request.input.item = { ...item, type } as ItemIdentifier;
    const result = (await service.researchBatch([request])).get(request.key)!;
    expect(result.selectedPrice).toBe(1_000_000);
    expect(result.selectedSource).toBe('ai_estimate');
    expect(result.confidence).toBe(60);
    expect(result.priceData.prices).toEqual([]);
    expect(result.manualReviewRequired).toBe(true);
    expect(result.estimateRange?.assumptions).toContain('part only');
    expect(mocks.claude).toHaveBeenCalledOnce();
  });
  it('prefers a later sourced quote over an earlier model estimate', async () => {
    const service = new PriceAdjudicationService(); const mocks = providers(service);
    mocks.gemini.mockResolvedValue({ ...opinion([]), repairEstimates: [{key: 'part:front bumper', action: 'replace', low: 1_000_000, high: 2_000_000, confidence: 40, assumptions: 'Provisional part'}] });
    mocks.claude.mockResolvedValue(opinion([bumperStatement], 'claude_web_search'));
    const result = (await service.researchBatch([requests()[1]])).get('part:front bumper');
    expect(result?.selectedPrice).toBe(900_000);
    expect(result?.selectedSource).toBe('claude_web_search');
  });
  it.each([{low: -1, high: 10}, {low: 20, high: 10}, {low: NaN, high: 10}, {low: 10, high: Infinity}])('rejects invalid estimate ranges %j', async range => {
    const service = new PriceAdjudicationService(); const mocks = providers(service);
    mocks.gemini.mockResolvedValue({ ...opinion([]), repairEstimates: [{key: 'part:front bumper', action: 'replace', ...range, confidence: 40, assumptions: 'Provisional part'}] });
    mocks.claude.mockResolvedValue(null);
    expect((await service.researchBatch([requests()[1]])).get('part:front bumper')?.selectedPrice).toBeUndefined();
  });
  it('accepts attributable Tavily evidence even when both models are unavailable', async () => {
    vi.spyOn(tavilyResearch, 'researchTavilyEvidence').mockResolvedValue([marketStatement, bumperStatement]);
    const service = new PriceAdjudicationService(); const mocks = providers(service);
    mocks.gemini.mockResolvedValue(null); mocks.claude.mockResolvedValue(null);
    const result = await service.researchBatch(requests());
    expect(result.get('market')?.selectedPrice).toBe(27_000_000);
    expect(result.get('market')?.selectedSource).toBe('tavily');
    expect(result.get('part:front bumper')?.selectedPrice).toBe(900_000);
  });
  it('preserves declared usage instead of replacing it with an age-based search assumption', async () => {
    const spy = vi.spyOn(priceAdjudicationService, 'researchBatch').mockResolvedValue(new Map());
    await researchAssessmentPrices(item, [], policy, true, { condition: 'Brand New', year: 2015 });
    expect(spy.mock.calls[0][0][0].input.item).toMatchObject({ condition: 'Brand New', year: 2015 });
  });
  it('does not convert a quality grade into import history', async () => {
    const spy = vi.spyOn(priceAdjudicationService, 'researchBatch').mockResolvedValue(new Map());
    await researchAssessmentPrices(item, [], policy, true, { condition: 'Brand New', declaredCondition: 'excellent' });
    expect(spy.mock.calls[0][0][0].input.item).toMatchObject({ condition: undefined });
    expect(spy.mock.calls[0][0][0].input.context?.declaredCondition).toBe('excellent');
  });
  it('gets market and component prices in one Gemini call without Claude or Serper', async () => {
    const service = new PriceAdjudicationService(); const mocks = providers(service);
    mocks.gemini.mockResolvedValue(opinion([marketStatement, bumperStatement]));
    mocks.claude.mockResolvedValue(null);
    const result = await service.researchBatch(requests());
    expect(mocks.gemini).toHaveBeenCalledOnce(); expect(mocks.claude).not.toHaveBeenCalled();
    expect(mocks.gemini.mock.calls[0][3]).toContain('front bumper');
    expect(result.get('market')?.selectedPrice).toBe(27_000_000);
    expect(result.get('part:front bumper')?.selectedPrice).toBe(900_000);
  });
  it('sends only remaining gaps to Claude once and preserves the market result', async () => {
    const service = new PriceAdjudicationService(); const mocks = providers(service);
    mocks.gemini.mockResolvedValue(opinion([marketStatement]));
    mocks.claude.mockResolvedValue(opinion([bumperStatement], 'claude_web_search'));
    const result = await service.researchBatch(requests());
    expect(mocks.gemini).toHaveBeenCalledOnce(); expect(mocks.claude).toHaveBeenCalledOnce();
    expect(JSON.parse(mocks.claude.mock.calls[0][3]).requests).toHaveLength(1);
    expect(result.get('market')?.selectedPrice).toBe(27_000_000);
    expect(result.get('part:front bumper')?.selectedSource).toBe('claude_web_search');
  });
  it('falls back once for the entire request when Gemini is unavailable', async () => {
    const service = new PriceAdjudicationService(); const mocks = providers(service);
    mocks.gemini.mockResolvedValue(null); mocks.claude.mockResolvedValue(opinion([marketStatement, bumperStatement], 'claude_web_search'));
    const result = await service.researchBatch(requests());
    expect(mocks.claude).toHaveBeenCalledOnce();
    expect(JSON.parse(mocks.claude.mock.calls[0][3]).requests).toHaveLength(2);
    expect(result.get('market')?.selectedPrice).toBe(27_000_000);
  });
  it('never accepts an uncited model quote or copies market value into a component', async () => {
    const service = new PriceAdjudicationService(); const mocks = providers(service);
    mocks.gemini.mockResolvedValue({ ...opinion([marketStatement]), recommendedPrice: 123_456 });
    mocks.claude.mockResolvedValue({ ...opinion([]), recommendedPrice: 500_000 });
    const result = await service.researchBatch(requests());
    expect(result.get('part:front bumper')?.selectedPrice).toBeUndefined();
    expect(result.get('market')?.selectedPrice).toBe(27_000_000);
  });
  it('does not price a bumper using a bumper guard or front-and-rear bundle', async () => {
    const service = new PriceAdjudicationService(); const mocks = providers(service);
    mocks.gemini.mockResolvedValue(opinion([marketStatement, { ...bumperStatement, text: 'Jeep Wrangler 2015 front bumper guard NGN 1,800,000' }]));
    mocks.claude.mockResolvedValue(opinion([{ ...bumperStatement, text: 'Jeep Wrangler 2015 front and rear bumper bundle NGN 1,400,000' }]));
    const result = await service.researchBatch(requests());
    expect(result.get('part:front bumper')?.selectedPrice).toBeUndefined();
    expect(result.get('market')?.selectedPrice).toBe(27_000_000);
  });
  it.each(['repair', 'clean_or_restore', 'sort_or_recover'] as const)('keeps %s quotes separate from replacement part prices', async action => {
    const service = new PriceAdjudicationService(); const mocks = providers(service);
    const input = requests()[1].input;
    mocks.gemini.mockResolvedValue(opinion([bumperStatement]));
    mocks.claude.mockResolvedValue(opinion([{ url: 'https://workshop.example/quote', text: 'Jeep Wrangler 2015 front bumper repair cleaning restoration sorting recovery service including labour and materials NGN 120,000' }], 'claude_web_search'));
    const result = await service.researchBatch([{ key: 'repair', input: { ...input, action } }]);
    expect(result.get('repair')?.selectedPrice).toBe(120_000);
    expect(mocks.claude).toHaveBeenCalledOnce();
  });
  it('does not call providers when there are no pricing requests', async () => {
    const service = new PriceAdjudicationService(); const mocks = providers(service);
    expect((await service.researchBatch([])).size).toBe(0);
    expect(mocks.gemini).not.toHaveBeenCalled(); expect(mocks.claude).not.toHaveBeenCalled();
  });
  it('deduplicates components and requests provisional specialist operation estimates', async () => {
    const spy = vi.spyOn(priceAdjudicationService, 'researchBatch').mockResolvedValue(new Map());
    const result = await researchAssessmentPrices(item, [
      { component: 'front bumper', damageLevel: 'minor', recommendedAction: 'repair' },
      { component: ' FRONT BUMPER ', damageLevel: 'severe', recommendedAction: 'replace' },
      { component: 'chassis', damageLevel: 'severe', recommendedAction: 'specialist_review' },
    ], policy);
    expect(spy).toHaveBeenCalledOnce(); expect(spy.mock.calls[0][0]).toHaveLength(3);
    expect(spy.mock.calls[0][0][1].input.action).toBe('replace');
    expect(result.partPrices).toHaveLength(2);
    expect(result.partPrices[1].evidence?.reason).toBe('specialist_review_required');
  });
  it.each(['electronics', 'appliance', 'machinery', 'property', 'furniture', 'equipment', 'medical_equipment', 'energy_equipment', 'aviation_equipment', 'stock', 'goods_in_transit', 'building_materials', 'scrap', 'agriculture', 'other'])('uses the same batching for %s', type => {
    const spy = vi.spyOn(priceAdjudicationService, 'researchBatch').mockResolvedValue(new Map());
    return researchAssessmentPrices({ type, brand: 'Example', model: 'Model A', description: 'Exact asset' } as ItemIdentifier,
      [{ component: 'panel', damageLevel: 'moderate', recommendedAction: 'repair' }], policy).then(() => {
      expect(spy).toHaveBeenCalledOnce(); expect(spy.mock.calls[0][0]).toHaveLength(2);
      expect(spy.mock.calls[0][0][0].input.item.type).toBe(type);
    });
  });
});
