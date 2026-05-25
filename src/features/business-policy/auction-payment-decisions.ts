import type { BusinessPolicy, PolicyDecision } from './types';
import { createPolicyDecisionRecord } from './policy-decisions';

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
