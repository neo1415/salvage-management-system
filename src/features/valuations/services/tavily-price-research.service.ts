import { tavilyApi } from '@/lib/integrations/tavily-api';
import type { PriceAdjudicationInput } from './price-adjudication.service';
import { evidenceUrl, type GroundedPriceStatement } from './grounding-evidence';

export type PricingContext = Record<string, string | number | undefined>;
const fields = ['make', 'brand', 'model', 'year', 'condition', 'declaredCondition', 'mileage', 'storage', 'storageCapacity', 'storageType', 'batteryHealth', 'propertyType', 'location', 'bedrooms', 'machineryType', 'material', 'size', 'movementType', 'quantity', 'unitOfMeasure', 'packagingType', 'description'];
export function selectPricingContext(value: object): PricingContext {
  return Object.fromEntries(fields.flatMap(key => {
    const entry = (value as Record<string, unknown>)[key];
    return typeof entry === 'string' || typeof entry === 'number' ? [[key, entry]] : [];
  }));
}
export function buildTavilyPricingQueries(requests: Array<{ key: string; input: PriceAdjudicationInput }>): string[] {
  if (!requests.length) return [];
  const first = requests[0].input;
  const data = { ...selectPricingContext(first.item), ...first.context };
  const identity = [first.item.type, data.make || data.brand, data.model, data.year, data.propertyType || data.machineryType,
    data.storageCapacity || data.storage, data.storageType, data.material, data.size, data.location, data.bedrooms && `${data.bedrooms} bedrooms`, data.mileage !== undefined && `${data.mileage} km`, data.batteryHealth !== undefined && `${data.batteryHealth}% battery`, data.movementType, data.quantity && `${data.quantity} ${data.unitOfMeasure || ''}`, data.packagingType].filter(value => value !== undefined && value !== '' && value !== false).join(' ');
  const condition = data.condition || data.declaredCondition || '';
  const terms = condition === 'Foreign Used (Tokunbo)' ? 'tokunbo foreign used' : condition === 'Nigerian Used' ? 'Nigerian used fairly used' : condition === 'Brand New' ? 'brand new unused' : String(condition);
  // Identity always leads; descriptions supplement it rather than replace it.
  const base = `${identity} ${!data.model ? String(data.description || '').slice(0, 150) : ''}`.trim().slice(0, 240);
  const queries: string[] = [];
  if (requests.some(request => request.input.mode === 'market')) queries.push(`${base} ${terms} price NGN Nigeria`.slice(0, 400));
  const operations = requests.filter(request => request.input.mode === 'part').map(({ input }) =>
    `${input.partName} ${input.action === 'replace' ? 'replacement part' : `${input.action} service labour materials`}`);
  // A bounded search batch; Gemini/Claude still see every component in one prompt.
  for (let index = 0; index < operations.length && queries.length < 4; index += 3) {
    queries.push(`${base} ${operations.slice(index, index + 3).join(' OR ')} price NGN Nigeria`.slice(0, 400));
  }
  return [...new Set(queries)];
}
export async function researchTavilyEvidence(requests: Array<{ key: string; input: PriceAdjudicationInput }>): Promise<GroundedPriceStatement[]> {
  if (process.env.TAVILY_PRICE_RESEARCH_ENABLED?.trim().toLowerCase() === 'false') return [];
  const queries = buildTavilyPricingQueries(requests);
  const outcomes = await Promise.allSettled(queries.map(query => tavilyApi.search(query)));
  const results = outcomes.flatMap(outcome => outcome.status === 'fulfilled' ? outcome.value : []);
  const unique = [...new Map(results.filter(result => evidenceUrl(result.url)).map(result => [result.url, result])).values()];
  // Extract actual page passages; synthesized search answers never establish a price.
  const urls = unique.filter(result => (result.score ?? 1) >= 0.5).slice(0, 6).map(result => result.url);
  const extracted = urls.length ? await tavilyApi.extract(urls, `${queries[0]} current asking price currency item identity`).catch(() => []) : [];
  return unique.map(result => ({ url: result.url, text: `${result.title || ''} ${extracted.find(page => page.url === result.url)?.raw_content || result.content || ''}`.trim() })).filter(statement => statement.text);
}
