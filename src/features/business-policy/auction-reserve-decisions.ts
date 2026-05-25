import type { BusinessPolicy, PolicyDecision } from './types';
import { createPolicyDecisionRecord } from './policy-decisions';

export function resolveReservePrice(
  policy: BusinessPolicy,
  salvageValue: number
): PolicyDecision<number> {
  const reservePrice = Math.round(salvageValue * (policy.auctions.reserveValuePercentage / 100));

  return {
    allowed: true,
    value: reservePrice,
    message: 'Reserve price resolved from configured salvage value percentage.',
    decision: createPolicyDecisionRecord({
      policy,
      decisionType: 'reserve_price_rule_applied',
      rulePath: 'auctions.reserveValuePercentage',
      outcome: 'value_resolved',
      entityType: 'case',
      reason: 'Auction reserve price uses the configured percentage of salvage value.',
      inputs: { salvageValue },
      resolvedValue: reservePrice,
    }),
  };
}
