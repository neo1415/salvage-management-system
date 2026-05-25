import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BUSINESS_POLICY,
  createPolicyDecisionRecord,
  toPublicBusinessPolicy,
  validateBusinessPolicy,
} from '@/features/business-policy';

describe('business policy foundation', () => {
  it('keeps the current NEM default policy valid', () => {
    const result = validateBusinessPolicy(DEFAULT_BUSINESS_POLICY);

    expect(result.valid).toBe(true);
    expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
  });

  it('rejects contradictory provider and auction settings', () => {
    const policy = structuredClone(DEFAULT_BUSINESS_POLICY);
    policy.payments.paystackEnabled = false;
    policy.auctions.minimumBidIncrement = 0;
    policy.onboarding.registrationFeeRequired = true;
    policy.onboarding.registrationFeeAmount = 0;
    policy.auth.emailPasswordEnabled = false;
    policy.auth.googleOAuthEnabled = false;
    policy.branding.supportEmail = 'not-an-email';
    policy.branding.logoPath = 'javascript:alert(1)';

    const result = validateBusinessPolicy(policy);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining([
        'payments.defaultProvider',
        'payments.registrationFeeProvider',
        'payments.auctionPaymentProvider',
        'auctions.minimumBidIncrement',
        'onboarding.registrationFeeAmount',
        'auth',
        'branding.supportEmail',
        'branding.logoPath',
      ])
    );
  });

  it('allows future provider choices only when enabled and warns before live routing', () => {
    const policy = structuredClone(DEFAULT_BUSINESS_POLICY);
    policy.payments.flutterwaveEnabled = true;
    policy.payments.defaultProvider = 'flutterwave';

    const result = validateBusinessPolicy(policy);

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'payments.defaultProvider',
          severity: 'warning',
        }),
      ])
    );
  });

  it('keeps public policy output intentionally narrow', () => {
    const publicPolicy = toPublicBusinessPolicy(DEFAULT_BUSINESS_POLICY);
    const serialized = JSON.stringify(publicPolicy).toLowerCase();

    expect(publicPolicy).toHaveProperty('branding');
    expect(publicPolicy).toHaveProperty('auth.googleOAuthEnabled');
    expect(publicPolicy).not.toHaveProperty('kyc');
    expect(publicPolicy).not.toHaveProperty('fraud');
    expect(publicPolicy).not.toHaveProperty('notifications.smsCategories');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('dojah');
  });

  it('creates explainable decision records with policy version and rule path', () => {
    const decision = createPolicyDecisionRecord({
      policy: DEFAULT_BUSINESS_POLICY,
      decisionType: 'vendor_bid_limit_resolved',
      rulePath: 'onboarding.tier1BidLimit',
      outcome: 'value_resolved',
      entityType: 'vendor',
      entityId: 'vendor-1',
      reason: 'Tier 1 vendors use the configured Tier 1 bid limit.',
      inputs: {
        tier: 'tier1',
      },
      resolvedValue: DEFAULT_BUSINESS_POLICY.onboarding.tier1BidLimit,
    });

    expect(decision.policyVersion).toBe(DEFAULT_BUSINESS_POLICY.version);
    expect(decision.rulePath).toBe('onboarding.tier1BidLimit');
    expect(decision.resolvedValue).toBe(500000);
    expect(decision.inputs).toEqual({ tier: 'tier1' });
    expect(decision.createdAt).toEqual(expect.any(String));
  });
});
