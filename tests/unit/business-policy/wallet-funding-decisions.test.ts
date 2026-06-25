import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BUSINESS_POLICY,
  formatWalletFundingLimitMessage,
  validateWalletFundingAmount,
} from '@/features/business-policy';

describe('wallet funding policy decisions', () => {
  it('accepts amounts within default limits', () => {
    const result = validateWalletFundingAmount(DEFAULT_BUSINESS_POLICY, 1_000_000);
    expect(result.allowed).toBe(true);
    expect(result.value?.minimum).toBe(50_000);
    expect(result.value?.maximum).toBe(5_000_000);
  });

  it('rejects amounts below the configured minimum', () => {
    const result = validateWalletFundingAmount(DEFAULT_BUSINESS_POLICY, 49_999);
    expect(result.allowed).toBe(false);
    expect(result.message).toBe(formatWalletFundingLimitMessage(50_000, 5_000_000));
  });

  it('rejects amounts above the configured maximum', () => {
    const result = validateWalletFundingAmount(DEFAULT_BUSINESS_POLICY, 5_000_001);
    expect(result.allowed).toBe(false);
  });

  it('uses custom limits from policy', () => {
    const policy = structuredClone(DEFAULT_BUSINESS_POLICY);
    policy.payments.walletFundingMinimum = 100_000;
    policy.payments.walletFundingMaximum = 2_000_000;

    const valid = validateWalletFundingAmount(policy, 500_000);
    const tooLow = validateWalletFundingAmount(policy, 50_000);
    const tooHigh = validateWalletFundingAmount(policy, 3_000_000);

    expect(valid.allowed).toBe(true);
    expect(tooLow.allowed).toBe(false);
    expect(tooHigh.allowed).toBe(false);
    expect(tooLow.message).toBe(formatWalletFundingLimitMessage(100_000, 2_000_000));
  });
});
