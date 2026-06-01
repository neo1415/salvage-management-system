import { DEFAULT_BUSINESS_POLICY } from '@/features/business-policy/default-policy';
import { businessPolicyService } from '@/features/business-policy/business-policy.service';
import type { AiValuationPolicy } from '@/features/business-policy/types';

export type ValuationPolicyConfig = AiValuationPolicy;

export async function getValuationPolicyConfig(): Promise<ValuationPolicyConfig> {
  try {
    const policy = await businessPolicyService.getEffectivePolicy();
    return policy.aiValuation;
  } catch (error) {
    console.warn('[ValuationPolicy] Falling back to default valuation policy', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return DEFAULT_BUSINESS_POLICY.aiValuation;
  }
}

export function getDefaultValuationPolicyConfig(): ValuationPolicyConfig {
  return DEFAULT_BUSINESS_POLICY.aiValuation;
}

export function shouldRequireManualReview(input: {
  policy: Pick<
    ValuationPolicyConfig,
    | 'lowConfidenceRequiresManualReview'
    | 'minimumOverallConfidence'
    | 'minimumMarketConfidence'
    | 'minimumDamageConfidence'
    | 'minimumMarketSourceCount'
    | 'sourceDiversityRequired'
    | 'maxAllowedPriceSpreadPercent'
  >;
  overallConfidence: number;
  marketConfidence: number;
  damageConfidence: number;
  uniqueSourceCount: number;
  priceSpreadPercent: number;
}): { required: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const { policy } = input;

  if (input.overallConfidence < policy.minimumOverallConfidence) {
    reasons.push(`Overall confidence ${input.overallConfidence}% is below ${policy.minimumOverallConfidence}%.`);
  }

  if (input.marketConfidence < policy.minimumMarketConfidence) {
    reasons.push(`Market confidence ${input.marketConfidence}% is below ${policy.minimumMarketConfidence}%.`);
  }

  if (input.damageConfidence < policy.minimumDamageConfidence) {
    reasons.push(`Damage confidence ${input.damageConfidence}% is below ${policy.minimumDamageConfidence}%.`);
  }

  if (input.uniqueSourceCount < policy.minimumMarketSourceCount) {
    reasons.push(`Only ${input.uniqueSourceCount} market source(s) met quality checks; ${policy.minimumMarketSourceCount} required.`);
  }

  if (policy.sourceDiversityRequired && input.uniqueSourceCount < 2) {
    reasons.push('Market evidence is not source-diverse.');
  }

  if (input.priceSpreadPercent > policy.maxAllowedPriceSpreadPercent) {
    reasons.push(`Accepted market prices vary by ${input.priceSpreadPercent}%, above the ${policy.maxAllowedPriceSpreadPercent}% limit.`);
  }

  return {
    required: policy.lowConfidenceRequiresManualReview && reasons.length > 0,
    reasons,
  };
}
