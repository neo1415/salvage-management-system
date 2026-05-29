import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BUSINESS_POLICY,
  resolveAuctionPaymentMethodAccess,
  resolveDepositAmountRequired,
} from '@/features/business-policy';

describe('auction payment policy decisions', () => {
  it('allows default NEM Paystack, wallet, and hybrid payment methods', () => {
    expect(resolveAuctionPaymentMethodAccess(DEFAULT_BUSINESS_POLICY, 'paystack').allowed).toBe(true);
    expect(resolveAuctionPaymentMethodAccess(DEFAULT_BUSINESS_POLICY, 'wallet').allowed).toBe(true);
    expect(resolveAuctionPaymentMethodAccess(DEFAULT_BUSINESS_POLICY, 'hybrid').allowed).toBe(true);
    expect(resolveAuctionPaymentMethodAccess(DEFAULT_BUSINESS_POLICY, 'wallet_funding').allowed).toBe(true);
  });

  it('denies payment methods disabled by policy', () => {
    const policy = structuredClone(DEFAULT_BUSINESS_POLICY);
    policy.payments.walletEnabled = false;
    policy.payments.hybridPaymentEnabled = false;

    const wallet = resolveAuctionPaymentMethodAccess(policy, 'wallet');
    const hybrid = resolveAuctionPaymentMethodAccess(policy, 'hybrid');

    expect(wallet.allowed).toBe(false);
    expect(wallet.decision.decisionType).toBe('payment_method_denied');
    expect(hybrid.allowed).toBe(false);
  });

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
