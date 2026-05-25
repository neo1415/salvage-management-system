import { describe, expect, it } from 'vitest';
import { DEFAULT_BUSINESS_POLICY, resolveDepositAmountRequired } from '@/features/business-policy';

describe('auction payment policy decisions', () => {
  it('matches the default NEM deposit formula', () => {
    const result = resolveDepositAmountRequired(DEFAULT_BUSINESS_POLICY, 1_000_000);

    expect(result.value).toEqual({
      totalDeposit: 100000,
      incrementalDeposit: 100000,
    });
    expect(result.decision.policyVersion).toBe(DEFAULT_BUSINESS_POLICY.version);
    expect(result.decision.rulePath).toBe('escrow.depositRatePercent + escrow.minimumDepositFloor');
  });

  it('resolves incremental deposit when the vendor already has a bid', () => {
    const result = resolveDepositAmountRequired(DEFAULT_BUSINESS_POLICY, 1_500_000, 1_000_000);

    expect(result.value).toEqual({
      totalDeposit: 150000,
      incrementalDeposit: 50000,
    });
  });

  it('returns zero when deposits are disabled by policy', () => {
    const policy = structuredClone(DEFAULT_BUSINESS_POLICY);
    policy.escrow.depositSystemEnabled = false;

    const result = resolveDepositAmountRequired(policy, 1_500_000);

    expect(result.value).toEqual({
      totalDeposit: 0,
      incrementalDeposit: 0,
    });
    expect(result.decision.outcome).toBe('not_applicable');
    expect(result.decision.rulePath).toBe('escrow.depositSystemEnabled');
  });
});
