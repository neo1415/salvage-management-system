import { describe, expect, it } from 'vitest';
import { DEFAULT_BUSINESS_POLICY, resolveReservePrice } from '@/features/business-policy';

describe('auction reserve price policy decisions', () => {
  it('matches the current NEM reserve price behavior', () => {
    const result = resolveReservePrice(DEFAULT_BUSINESS_POLICY, 1_000_000);

    expect(result.value).toBe(700000);
    expect(result.decision.decisionType).toBe('reserve_price_rule_applied');
    expect(result.decision.rulePath).toBe('auctions.reserveValuePercentage');
    expect(result.decision.resolvedValue).toBe(700000);
  });

  it('uses changed reserve percentages for future white-label policies', () => {
    const policy = structuredClone(DEFAULT_BUSINESS_POLICY);
    policy.auctions.reserveValuePercentage = 60;

    const result = resolveReservePrice(policy, 1_000_000);

    expect(result.value).toBe(600000);
    expect(result.decision.inputs).toEqual({ salvageValue: 1000000 });
  });
});
