import type { BusinessPolicy, PolicyDecision } from './types';
import { createPolicyDecisionRecord } from './policy-decisions';

export function resolveDocumentDeadlineHours(policy: BusinessPolicy): PolicyDecision<number> {
  return {
    allowed: true,
    value: policy.auctions.documentValidityHours,
    message: 'Document signing deadline resolved from auction policy.',
    decision: createPolicyDecisionRecord({
      policy,
      decisionType: 'document_deadline_resolved',
      rulePath: 'auctions.documentValidityHours',
      outcome: 'value_resolved',
      entityType: 'document',
      reason: 'Auction document signing deadline uses configured validity hours.',
      inputs: {},
      resolvedValue: policy.auctions.documentValidityHours,
    }),
  };
}

export function resolvePaymentDeadlineHours(policy: BusinessPolicy): PolicyDecision<number> {
  return {
    allowed: true,
    value: policy.payments.paymentDeadlineAfterSigningHours,
    message: 'Payment deadline after signing resolved from payment policy.',
    decision: createPolicyDecisionRecord({
      policy,
      decisionType: 'payment_deadline_resolved',
      rulePath: 'payments.paymentDeadlineAfterSigningHours',
      outcome: 'value_resolved',
      entityType: 'payment',
      reason: 'Winner payment deadline uses configured hours after documents are signed.',
      inputs: {},
      resolvedValue: policy.payments.paymentDeadlineAfterSigningHours,
    }),
  };
}

export function resolveFallbackBufferHours(policy: BusinessPolicy): PolicyDecision<number> {
  return {
    allowed: true,
    value: policy.auctions.fallbackBufferHours,
    message: 'Fallback buffer resolved from auction policy.',
    decision: createPolicyDecisionRecord({
      policy,
      decisionType: 'fallback_buffer_resolved',
      rulePath: 'auctions.fallbackBufferHours',
      outcome: 'value_resolved',
      entityType: 'auction',
      reason: 'Fallback chain waits the configured buffer after winner deadline expiry.',
      inputs: {},
      resolvedValue: policy.auctions.fallbackBufferHours,
    }),
  };
}

export function resolveForfeiturePercentage(policy: BusinessPolicy): PolicyDecision<number> {
  return {
    allowed: true,
    value: policy.escrow.forfeiturePercentage,
    message: 'Deposit forfeiture percentage resolved from escrow policy.',
    decision: createPolicyDecisionRecord({
      policy,
      decisionType: 'forfeiture_percentage_resolved',
      rulePath: 'escrow.forfeiturePercentage',
      outcome: 'value_resolved',
      entityType: 'payment',
      reason: 'Failed winner deposit forfeiture uses configured escrow percentage.',
      inputs: {},
      resolvedValue: policy.escrow.forfeiturePercentage,
    }),
  };
}

export function resolveGraceExtensionLimit(
  policy: BusinessPolicy,
  currentExtensionCount: number
): PolicyDecision<number> {
  const maxExtensions = policy.auctions.maxGraceExtensions;
  const allowed = currentExtensionCount < maxExtensions;

  return {
    allowed,
    value: maxExtensions,
    message: allowed
      ? 'Grace extension remains within the configured maximum.'
      : 'Maximum configured grace extensions reached.',
    decision: createPolicyDecisionRecord({
      policy,
      decisionType: 'grace_extension_limit_resolved',
      rulePath: 'auctions.maxGraceExtensions',
      outcome: allowed ? 'allow' : 'deny',
      entityType: 'auction',
      reason: allowed
        ? 'Current extension count is below the configured maximum.'
        : 'Current extension count has reached the configured maximum.',
      inputs: { currentExtensionCount },
      resolvedValue: maxExtensions,
    }),
  };
}

export function resolveGraceExtensionDurationHours(policy: BusinessPolicy): PolicyDecision<number> {
  return {
    allowed: true,
    value: policy.auctions.graceExtensionDurationHours,
    message: 'Grace extension duration resolved from auction policy.',
    decision: createPolicyDecisionRecord({
      policy,
      decisionType: 'grace_extension_duration_resolved',
      rulePath: 'auctions.graceExtensionDurationHours',
      outcome: 'value_resolved',
      entityType: 'auction',
      reason: 'Finance-granted grace periods use the configured extension duration.',
      inputs: {},
      resolvedValue: policy.auctions.graceExtensionDurationHours,
    }),
  };
}
