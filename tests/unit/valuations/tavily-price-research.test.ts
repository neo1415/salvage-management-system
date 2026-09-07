import { afterEach, describe, expect, it, vi } from 'vitest';
import { TavilyApiClient } from '@/lib/integrations/tavily-api';
import { buildTavilyPricingQueries, selectPricingContext, researchTavilyEvidence } from '@/features/valuations/services/tavily-price-research.service';
import { getDefaultValuationPolicyConfig } from '@/features/valuations/services/valuation-policy.service';
import type { PriceAdjudicationInput } from '@/features/valuations/services/price-adjudication.service';
const policy = getDefaultValuationPolicyConfig();
const input: PriceAdjudicationInput = { item: { type: 'vehicle', make: 'Jeep', model: 'Wrangler', year: 2015, condition: 'Foreign Used (Tokunbo)' }, policy, mode: 'market', priceData: { prices: [], currency: 'NGN', confidence: 0, extractedAt: new Date() } };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe('Tavily Nigeria pricing', () => {
  it.each(['Brand New', 'Foreign Used (Tokunbo)', 'Nigerian Used'] as const)('preserves the entered %s condition and vehicle identity', condition => {
    const queries = buildTavilyPricingQueries([{ key: 'market', input: { ...input, context: { condition, mileage: 120000 } } }]);
    expect(queries[0]).toContain('Jeep Wrangler 2015'); expect(queries[0]).toContain('NGN Nigeria');
    expect(queries[0]).toContain(condition === 'Brand New' ? 'brand new' : condition === 'Nigerian Used' ? 'Nigerian used' : 'tokunbo');
    expect(queries[0].length).toBeLessThanOrEqual(400);
  });
  it('keeps specifications and quantity but excludes account identifiers', () => {
    const context = selectPricingContext({ brand: 'Apple', model: 'iPhone 13', storageCapacity: '256GB', quantity: 12, unitOfMeasure: 'units', policyNumber: 'SECRET', supportEmail: 'private@example.com' });
    expect(context).not.toHaveProperty('policyNumber'); expect(context).not.toHaveProperty('supportEmail');
    const queries = buildTavilyPricingQueries([{ key: 'market', input: { ...input, item: { type: 'electronics', brand: 'Apple', model: 'iPhone 13', storage: '256GB' }, context } }]);
    expect(queries[0]).toContain('256GB'); expect(queries[0]).toContain('12 units');
  });
  it('uses explicit Nigeria parameters and keyless access without an API key', async () => {
    vi.stubEnv('TAVILY_API_KEY', ''); const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) }); vi.stubGlobal('fetch', fetcher);
    await new TavilyApiClient().search('Jeep Wrangler 2015 Nigeria');
    const options = fetcher.mock.calls[0][1];
    expect(options.headers['X-Tavily-Access-Mode']).toBe('keyless');
    expect(JSON.parse(options.body)).toMatchObject({ country: 'nigeria', topic: 'general', search_depth: 'advanced', include_answer: false, auto_parameters: false });
  });
  it('uses the server credential in headers only', async () => {
    vi.stubEnv('TAVILY_API_KEY', 'test-secret'); const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) }); vi.stubGlobal('fetch', fetcher);
    await new TavilyApiClient().search('Jeep Wrangler 2015 Nigeria');
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer test-secret');
    expect(fetcher.mock.calls[0][1].body).not.toContain('test-secret');
  });
  it('allows model fallback when Tavily is unavailable', async () => {
    vi.stubEnv('TAVILY_PRICE_RESEARCH_ENABLED', 'true'); vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    expect(await researchTavilyEvidence([{ key: 'market', input }])).toEqual([]);
  });
  it('extracts price passages and ignores generated answers', async () => {
    vi.stubEnv('TAVILY_PRICE_RESEARCH_ENABLED', 'true');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ answer: 'Invented NGN 99,000,000', results: [{ url: 'https://seller.example/jeep', title: 'Jeep Wrangler 2015', content: 'Search snippet', score: .9 }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [{ url: 'https://seller.example/jeep', raw_content: 'Jeep Wrangler 2015 tokunbo NGN 27,000,000' }] }) }));
    const result = await researchTavilyEvidence([{ key: 'market', input }]);
    expect(result[0].text).toContain('27,000,000'); expect(JSON.stringify(result)).not.toContain('99,000,000');
  });
});
