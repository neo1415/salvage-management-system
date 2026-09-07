import type { ItemIdentifier } from '@/features/internet-search/services/query-builder.service';
import type { DamageInput } from '../types';
import { priceAdjudicationService, type PriceAdjudicationInput } from './price-adjudication.service';
import { selectPricingContext } from './tavily-price-research.service';
import type { ValuationPolicyConfig } from './valuation-policy.service';

export interface ResearchedComponentPrice {
  component: string;
  searchedPrice?: number;
  action?: DamageInput['recommendedAction'];
  confidence?: number;
  source: 'internet_search' | 'ai_estimate' | 'not_found';
  evidence?: Record<string, unknown>;
}

/** Uses provider-native search; neither Serper nor a per-component model call is needed. */
export async function researchAssessmentPrices(item: ItemIdentifier, damages: DamageInput[], policy: ValuationPolicyConfig, includeMarket = true, formContext: object = item) {
  const context = selectPricingContext(formContext);
  if (['Brand New', 'Foreign Used (Tokunbo)', 'Nigerian Used', 'Heavily Used'].includes(String(context.declaredCondition || context.condition))) {
    item = { ...item, condition: (context.declaredCondition || context.condition) as 'Brand New' | 'Foreign Used (Tokunbo)' | 'Nigerian Used' | 'Heavily Used' };
  }
  if (context.declaredCondition && ['excellent', 'good', 'fair', 'poor'].includes(String(context.declaredCondition).toLowerCase())) {
    context.condition = undefined; // Quality is not proof of newness or import history.
    item = { ...item, condition: undefined };
  }
  const empty = () => ({ prices: [], currency: 'NGN' as const, confidence: 0, extractedAt: new Date() });
  const requests: Array<{ key: string; input: PriceAdjudicationInput }> = [];
  if (includeMarket) requests.push({ key: 'market', input: { item, context, mode: 'market', policy, priceData: empty() } });
  const unique = new Map<string, DamageInput>();
  const rank = { minor: 1, moderate: 2, severe: 3 };
  for (const damage of damages) {
    const key = damage.component.trim().toLowerCase();
    const previous = unique.get(key);
    if (key && (!previous || rank[damage.damageLevel] > rank[previous.damageLevel])) unique.set(key, { ...damage, component: key });
  }
  for (const [key, damage] of unique) {
    if (!damage.recommendedAction || damage.recommendedAction === 'dispose') continue;
    requests.push({ key: `part:${key}`, input: { item, context, mode: 'part', policy, priceData: empty(), partName: damage.component, action: damage.recommendedAction, damageType: damage.damageType } });
  }
  const results = await priceAdjudicationService.researchBatch(requests);
  const partPrices: ResearchedComponentPrice[] = [...unique].map(([key, damage]) => {
    const result = results.get(`part:${key}`);
    return { component: key, action: damage.recommendedAction, searchedPrice: result?.selectedPrice,
      confidence: result?.confidence, source: result?.selectedPrice ? result.selectedSource === 'ai_estimate' ? 'ai_estimate' : 'internet_search' : 'not_found',
      evidence: { provider: result?.selectedSource, priceData: result?.priceData, adjudication: result,
        reason: result?.selectedPrice ? undefined : damage.recommendedAction === 'dispose' ? 'disposal_not_repair_priced'
          : !damage.recommendedAction || damage.recommendedAction === 'specialist_review' ? 'specialist_review_required' : 'No native-cited repair price found in batch research' } };
  });
  return { market: results.get('market'), partPrices };
}
