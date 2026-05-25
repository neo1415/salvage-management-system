import { describe, expect, it } from 'vitest';
import { DEFAULT_BUSINESS_POLICY, sanitizeBusinessPolicy } from '@/features/business-policy';

describe('sanitizeBusinessPolicy', () => {
  it('strips unknown and sensitive fields before policy persistence', () => {
    const sanitized = sanitizeBusinessPolicy({
      ...DEFAULT_BUSINESS_POLICY,
      dojahSecretKey: 'server-secret',
      branding: {
        ...DEFAULT_BUSINESS_POLICY.branding,
        brandName: 'Acme Salvage',
        paystackSecretKey: 'sk_test_should_not_store',
      },
      fraud: {
        ...DEFAULT_BUSINESS_POLICY.fraud,
        internalRiskFormula: 'do-not-store',
      },
      payments: {
        ...DEFAULT_BUSINESS_POLICY.payments,
        webhookSecret: 'do-not-store',
      },
      cases: {
        ...DEFAULT_BUSINESS_POLICY.cases,
        enabledAssetTypes: {
          ...DEFAULT_BUSINESS_POLICY.cases.enabledAssetTypes,
          'bad key': {
            enabled: true,
            requiresAiAnalysis: true,
            requiresMarketValue: true,
            requiresInspectionLocation: true,
          },
          boats: {
            enabled: true,
            requiresAiAnalysis: true,
            requiresMarketValue: false,
            requiresInspectionLocation: true,
            promptSecret: 'hidden',
          },
        },
      },
    });

    expect(sanitized.branding.brandName).toBe('Acme Salvage');
    expect(sanitized.cases.enabledAssetTypes.boats).toEqual({
      enabled: true,
      requiresAiAnalysis: true,
      requiresMarketValue: false,
      requiresInspectionLocation: true,
    });
    expect(sanitized.cases.enabledAssetTypes['bad key']).toBeUndefined();
    expect(JSON.stringify(sanitized)).not.toMatch(/secret|webhook|paystackSecretKey|internalRiskFormula|promptSecret/i);
  });

  it('falls back from unsupported enum values to current NEM defaults', () => {
    const sanitized = sanitizeBusinessPolicy({
      ...DEFAULT_BUSINESS_POLICY,
      onboarding: {
        ...DEFAULT_BUSINESS_POLICY.onboarding,
        mode: 'unsupported_mode',
      },
      payments: {
        ...DEFAULT_BUSINESS_POLICY.payments,
        defaultProvider: 'unknown_provider',
      },
      aiValuation: {
        ...DEFAULT_BUSINESS_POLICY.aiValuation,
        providerPriority: ['unknown_ai'],
      },
    });

    expect(sanitized.onboarding.mode).toBe(DEFAULT_BUSINESS_POLICY.onboarding.mode);
    expect(sanitized.payments.defaultProvider).toBe(DEFAULT_BUSINESS_POLICY.payments.defaultProvider);
    expect(sanitized.aiValuation.providerPriority).toEqual(DEFAULT_BUSINESS_POLICY.aiValuation.providerPriority);
  });

  it('preserves supported future payment provider choices without persisting secrets', () => {
    const sanitized = sanitizeBusinessPolicy({
      ...DEFAULT_BUSINESS_POLICY,
      payments: {
        ...DEFAULT_BUSINESS_POLICY.payments,
        defaultProvider: 'flutterwave',
        flutterwaveEnabled: true,
        secretKey: 'should-not-persist',
      },
    });

    expect(sanitized.payments.defaultProvider).toBe('flutterwave');
    expect(sanitized.payments.flutterwaveEnabled).toBe(true);
    expect(JSON.stringify(sanitized.payments)).not.toContain('should-not-persist');
  });
});
