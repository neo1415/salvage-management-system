import type { SystemConfiguration } from '@/features/auction-deposit/services/config.service';
import type { BusinessPolicy } from './types';

type LegacyAuctionConfigKey = keyof SystemConfiguration | 'depositSystemEnabled';

type LegacyAuctionConfigMapping = {
  canonicalParameter: string;
  key: LegacyAuctionConfigKey;
  read: (policy: BusinessPolicy) => number | boolean;
  write: (policy: BusinessPolicy, value: number | boolean) => void;
};

const mappings: LegacyAuctionConfigMapping[] = [
  {
    canonicalParameter: 'registration_fee',
    key: 'registrationFee',
    read: (policy) => policy.onboarding.registrationFeeAmount,
    write: (policy, value) => {
      policy.onboarding.registrationFeeAmount = Number(value);
    },
  },
  {
    canonicalParameter: 'deposit_rate',
    key: 'depositRate',
    read: (policy) => policy.escrow.depositRatePercent,
    write: (policy, value) => {
      policy.escrow.depositRatePercent = Number(value);
    },
  },
  {
    canonicalParameter: 'minimum_deposit_floor',
    key: 'minimumDepositFloor',
    read: (policy) => policy.escrow.minimumDepositFloor,
    write: (policy, value) => {
      policy.escrow.minimumDepositFloor = Number(value);
    },
  },
  {
    canonicalParameter: 'tier_1_limit',
    key: 'tier1Limit',
    read: (policy) => policy.onboarding.tier1BidLimit,
    write: (policy, value) => {
      policy.onboarding.tier1BidLimit = Number(value);
    },
  },
  {
    canonicalParameter: 'minimum_bid_increment',
    key: 'minimumBidIncrement',
    read: (policy) => policy.auctions.minimumBidIncrement,
    write: (policy, value) => {
      policy.auctions.minimumBidIncrement = Number(value);
    },
  },
  {
    canonicalParameter: 'document_validity_period',
    key: 'documentValidityPeriod',
    read: (policy) => policy.auctions.documentValidityHours,
    write: (policy, value) => {
      policy.auctions.documentValidityHours = Number(value);
    },
  },
  {
    canonicalParameter: 'max_grace_extensions',
    key: 'maxGraceExtensions',
    read: (policy) => policy.auctions.maxGraceExtensions,
    write: (policy, value) => {
      policy.auctions.maxGraceExtensions = Number(value);
    },
  },
  {
    canonicalParameter: 'grace_extension_duration',
    key: 'graceExtensionDuration',
    read: (policy) => policy.auctions.graceExtensionDurationHours,
    write: (policy, value) => {
      policy.auctions.graceExtensionDurationHours = Number(value);
    },
  },
  {
    canonicalParameter: 'fallback_buffer_period',
    key: 'fallbackBufferPeriod',
    read: (policy) => policy.auctions.fallbackBufferHours,
    write: (policy, value) => {
      policy.auctions.fallbackBufferHours = Number(value);
    },
  },
  {
    canonicalParameter: 'top_bidders_to_keep_frozen',
    key: 'topBiddersToKeepFrozen',
    read: (policy) => policy.escrow.topBiddersToKeepFrozen,
    write: (policy, value) => {
      policy.escrow.topBiddersToKeepFrozen = Number(value);
    },
  },
  {
    canonicalParameter: 'forfeiture_percentage',
    key: 'forfeiturePercentage',
    read: (policy) => policy.escrow.forfeiturePercentage,
    write: (policy, value) => {
      policy.escrow.forfeiturePercentage = Number(value);
    },
  },
  {
    canonicalParameter: 'payment_deadline_after_signing',
    key: 'paymentDeadlineAfterSigning',
    read: (policy) => policy.payments.paymentDeadlineAfterSigningHours,
    write: (policy, value) => {
      policy.payments.paymentDeadlineAfterSigningHours = Number(value);
    },
  },
  {
    canonicalParameter: 'deposit_system_enabled',
    key: 'depositSystemEnabled',
    read: (policy) => policy.escrow.depositSystemEnabled,
    write: (policy, value) => {
      policy.escrow.depositSystemEnabled = Boolean(value);
    },
  },
];

const aliases: Record<string, string> = {
  tier1_limit: 'tier_1_limit',
};

const mappingByParameter = new Map(
  mappings.flatMap((mapping) => [
    [mapping.canonicalParameter, mapping],
    [mapping.key, mapping],
  ])
);

export function normalizeLegacyAuctionConfigParameter(parameter: string): string | null {
  const trimmed = parameter.trim();
  const normalized = aliases[trimmed] ?? trimmed;
  const mapping = mappingByParameter.get(normalized);
  return mapping?.canonicalParameter ?? null;
}

export function policyToLegacyAuctionConfig(policy: BusinessPolicy): SystemConfiguration {
  return {
    registrationFee: policy.onboarding.registrationFeeAmount,
    depositRate: policy.escrow.depositRatePercent,
    minimumDepositFloor: policy.escrow.minimumDepositFloor,
    tier1Limit: policy.onboarding.tier1BidLimit,
    minimumBidIncrement: policy.auctions.minimumBidIncrement,
    documentValidityPeriod: policy.auctions.documentValidityHours,
    maxGraceExtensions: policy.auctions.maxGraceExtensions,
    graceExtensionDuration: policy.auctions.graceExtensionDurationHours,
    fallbackBufferPeriod: policy.auctions.fallbackBufferHours,
    topBiddersToKeepFrozen: policy.escrow.topBiddersToKeepFrozen,
    forfeiturePercentage: policy.escrow.forfeiturePercentage,
    paymentDeadlineAfterSigning: policy.payments.paymentDeadlineAfterSigningHours,
  };
}

export function patchLegacyAuctionConfigPolicy(
  policy: BusinessPolicy,
  parameter: string,
  value: number | boolean
): { policy: BusinessPolicy; canonicalParameter: string; key: LegacyAuctionConfigKey } {
  const canonicalParameter = normalizeLegacyAuctionConfigParameter(parameter);
  if (!canonicalParameter) {
    throw new Error(`Invalid parameter: ${parameter}`);
  }

  const mapping = mappingByParameter.get(canonicalParameter);
  if (!mapping) {
    throw new Error(`Invalid parameter: ${parameter}`);
  }

  const nextPolicy = structuredClone(policy);
  mapping.write(nextPolicy, value);
  nextPolicy.updatedAt = new Date().toISOString();
  nextPolicy.version = nextAuctionConfigPolicyVersion(policy.version);

  return {
    policy: nextPolicy,
    canonicalParameter,
    key: mapping.key,
  };
}

export function getLegacyAuctionConfigValue(
  policy: BusinessPolicy,
  parameter: string
): number | boolean {
  const canonicalParameter = normalizeLegacyAuctionConfigParameter(parameter);
  if (!canonicalParameter) {
    throw new Error(`Invalid parameter: ${parameter}`);
  }

  const mapping = mappingByParameter.get(canonicalParameter);
  if (!mapping) {
    throw new Error(`Invalid parameter: ${parameter}`);
  }

  return mapping.read(policy);
}

function nextAuctionConfigPolicyVersion(currentVersion: string): string {
  const base = currentVersion.replace(/-auction-config-\d+$/, '');
  return `${base}-auction-config-${Date.now()}`;
}
