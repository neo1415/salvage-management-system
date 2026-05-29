import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BUSINESS_POLICY,
  createPolicyDecisionRecord,
  resolveAuthProviderAccess,
  resolveCaseAssetTypeAllowed,
  resolveEmailDomainAccess,
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
    policy.branding.homepageCopy.heroTitle = '';
    policy.onboarding.mode = 'no_registration_fee';
    policy.onboarding.registrationFeeRequired = true;

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
        'branding.homepageCopy.heroTitle',
        'onboarding.registrationFeeRequired',
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

  it('rejects enabled case asset types before the live case API supports them', () => {
    const policy = structuredClone(DEFAULT_BUSINESS_POLICY);
    policy.cases.enabledAssetTypes.jewelry.enabled = true;

    const result = validateBusinessPolicy(policy);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'cases.enabledAssetTypes.jewelry.enabled',
          severity: 'error',
        }),
      ])
    );
  });

  it('keeps public policy output intentionally narrow', () => {
    const publicPolicy = toPublicBusinessPolicy(DEFAULT_BUSINESS_POLICY);
    const serialized = JSON.stringify(publicPolicy).toLowerCase();

    expect(publicPolicy).toHaveProperty('branding');
    expect(publicPolicy.branding.homepageCopy.heroTitle).toBe(DEFAULT_BUSINESS_POLICY.branding.homepageCopy.heroTitle);
    expect(publicPolicy.cases.enabledAssetTypes.machinery.label).toBe('Machinery & Equipment');
    expect(publicPolicy.cases.enabledAssetTypes.machinery.requiredFields).toEqual(['machineryBrand', 'machineryType']);
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

  it('resolves case asset type access with a versioned policy decision', () => {
    const allowed = resolveCaseAssetTypeAllowed(DEFAULT_BUSINESS_POLICY, 'machinery');
    const denied = resolveCaseAssetTypeAllowed(DEFAULT_BUSINESS_POLICY, 'jewelry');

    expect(allowed.allowed).toBe(true);
    expect(allowed.decision.decisionType).toBe('case_asset_type_allowed');
    expect(allowed.decision.rulePath).toBe('cases.enabledAssetTypes.machinery.enabled');
    expect(allowed.decision.policyVersion).toBe(DEFAULT_BUSINESS_POLICY.version);

    expect(denied.allowed).toBe(false);
    expect(denied.decision.decisionType).toBe('case_asset_type_denied');
    expect(denied.decision.rulePath).toBe('cases.enabledAssetTypes.jewelry.enabled');
  });

  it('resolves auth provider and business email access from policy', () => {
    const policy = structuredClone(DEFAULT_BUSINESS_POLICY);
    policy.auth.emailPasswordEnabled = false;
    policy.auth.businessEmailOnly = true;
    policy.auth.allowedEmailDomains = ['nemsalvage.com'];

    const credentials = resolveAuthProviderAccess(policy, 'credentials');
    const google = resolveAuthProviderAccess(policy, 'google');
    const personalEmail = resolveEmailDomainAccess(policy, 'buyer@gmail.com');
    const allowlistedEmail = resolveEmailDomainAccess(policy, 'buyer@nemsalvage.com');

    expect(credentials.allowed).toBe(false);
    expect(credentials.decision.rulePath).toBe('auth.emailPasswordEnabled');
    expect(google.allowed).toBe(false);
    expect(personalEmail.allowed).toBe(false);
    expect(personalEmail.decision.decisionType).toBe('auth_email_domain_denied');
    expect(allowlistedEmail.allowed).toBe(true);
  });
});
