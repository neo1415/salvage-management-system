import type { BusinessPolicy, PolicyDecision } from './types';
import { createPolicyDecisionRecord } from './policy-decisions';

export type AuctionPaymentMethod = 'paystack' | 'wallet' | 'hybrid' | 'wallet_funding';

export function resolveAuctionPaymentMethodAccess(
  policy: BusinessPolicy,
  method: AuctionPaymentMethod
): PolicyDecision<AuctionPaymentMethod> {
  const enabled =
    method === 'paystack'
      ? policy.payments.paystackEnabled && policy.payments.auctionPaymentProvider === 'paystack'
      : method === 'wallet'
        ? policy.payments.walletEnabled
        : method === 'hybrid'
          ? policy.payments.walletEnabled && policy.payments.paystackEnabled && policy.payments.hybridPaymentEnabled
          : policy.payments.walletEnabled && policy.payments.paystackEnabled;

  const rulePath =
    method === 'paystack'
      ? 'payments.paystackEnabled + payments.auctionPaymentProvider'
      : method === 'wallet'
        ? 'payments.walletEnabled'
        : method === 'hybrid'
          ? 'payments.hybridPaymentEnabled + payments.walletEnabled + payments.paystackEnabled'
          : 'payments.walletEnabled + payments.paystackEnabled';

  return {
    allowed: enabled,
    value: method,
    message: enabled
      ? `${method} payment is enabled by policy.`
      : `${method} payment is not enabled for this workspace.`,
    decision: createPolicyDecisionRecord({
      policy,
      decisionType: enabled ? 'payment_method_allowed' : 'payment_method_denied',
      rulePath,
      outcome: enabled ? 'allow' : 'deny',
      entityType: 'payment',
      reason: enabled
        ? 'Payment method satisfies the active payment policy.'
        : 'Payment method is disabled or not selected by the active payment policy.',
      inputs: {
        method,
        auctionPaymentProvider: policy.payments.auctionPaymentProvider,
        walletEnabled: policy.payments.walletEnabled,
        paystackEnabled: policy.payments.paystackEnabled,
        hybridPaymentEnabled: policy.payments.hybridPaymentEnabled,
      },
      resolvedValue: enabled,
    }),
  };
}

export function resolveDepositAmountRequired(
  policy: BusinessPolicy,
  bidAmount: number,
  previousBidAmount: number | null = null
): PolicyDecision<{ totalDeposit: number; incrementalDeposit: number }> {
  if (!policy.escrow.depositSystemEnabled) {
    return {
      allowed: true,
      value: { totalDeposit: 0, incrementalDeposit: 0 },
      message: 'Deposit system is disabled by policy.',
      decision: createPolicyDecisionRecord({
        policy,
        decisionType: 'deposit_amount_required',
        rulePath: 'escrow.depositSystemEnabled',
        outcome: 'not_applicable',
        entityType: 'payment',
        reason: 'No deposit is required because deposit system is disabled.',
        inputs: { bidAmount, previousBidAmount },
        resolvedValue: 0,
      }),
    };
  }

  const depositRate = policy.escrow.depositRatePercent / 100;
  const totalDeposit = Math.max(
    Math.ceil(bidAmount * depositRate),
    policy.escrow.minimumDepositFloor
  );
  const previousDeposit = previousBidAmount === null
    ? 0
    : Math.max(
        Math.ceil(previousBidAmount * depositRate),
        policy.escrow.minimumDepositFloor
      );
  const incrementalDeposit = Math.max(0, totalDeposit - previousDeposit);

  return {
    allowed: true,
    value: { totalDeposit, incrementalDeposit },
    message: 'Deposit amount resolved from escrow policy.',
    decision: createPolicyDecisionRecord({
      policy,
      decisionType: 'deposit_amount_required',
      rulePath: 'escrow.depositRatePercent + escrow.minimumDepositFloor',
      outcome: 'value_resolved',
      entityType: 'payment',
      reason: 'Deposit uses max(bid amount multiplied by deposit rate, minimum deposit floor).',
      inputs: {
        bidAmount,
        previousBidAmount,
        depositRatePercent: policy.escrow.depositRatePercent,
        minimumDepositFloor: policy.escrow.minimumDepositFloor,
      },
      resolvedValue: incrementalDeposit,
    }),
  };
}
