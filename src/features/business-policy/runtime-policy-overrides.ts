import type { BusinessPolicy } from './types';

export function applyRuntimePolicyOverrides(
  source: BusinessPolicy,
  auctionDepositsEnabled = process.env.AUCTION_DEPOSITS_ENABLED === 'true'
): BusinessPolicy {
  const policy = structuredClone(source);

  // The escrow implementation is retained, but deployment must explicitly opt
  // in before a published policy can require vendors to fund bid deposits.
  if (!auctionDepositsEnabled) {
    policy.escrow.depositSystemEnabled = false;
  }

  return policy;
}
