import type { BusinessPolicy, PolicyDecision } from './types';
import { createPolicyDecisionRecord } from './policy-decisions';

export function formatWalletFundingLimitMessage(minimum: number, maximum: number): string {
  return `Amount must be between ₦${minimum.toLocaleString()} and ₦${maximum.toLocaleString()}`;
}

export function resolveWalletFundingLimits(policy: BusinessPolicy): {
  minimum: number;
  maximum: number;
} {
  return {
    minimum: policy.payments.walletFundingMinimum,
    maximum: policy.payments.walletFundingMaximum,
  };
}

export function validateWalletFundingAmount(
  policy: BusinessPolicy,
  amount: number
): PolicyDecision<{ minimum: number; maximum: number }> {
  const { minimum, maximum } = resolveWalletFundingLimits(policy);
  const allowed = Number.isFinite(amount) && amount >= minimum && amount <= maximum;

  return {
    allowed,
    value: { minimum, maximum },
    message: allowed
      ? 'Wallet funding amount is within configured limits.'
      : formatWalletFundingLimitMessage(minimum, maximum),
    decision: createPolicyDecisionRecord({
      policy,
      decisionType: 'wallet_funding_amount_validated',
      rulePath: 'payments.walletFundingMinimum',
      outcome: allowed ? 'allow' : 'deny',
      entityType: 'payment',
      reason: allowed
        ? 'Funding amount is within per-transaction limits.'
        : 'Funding amount is outside configured per-transaction limits.',
      inputs: {
        amount,
        minimum,
        maximum,
      },
      resolvedValue: allowed,
    }),
  };
}
