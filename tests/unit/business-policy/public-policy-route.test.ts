import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/business-policy/public/route';
import { businessPolicyService } from '@/features/business-policy';

vi.mock('@/features/business-policy', async () => {
  const actual = await vi.importActual<typeof import('@/features/business-policy')>('@/features/business-policy');

  return {
    ...actual,
    businessPolicyService: {
      getPublicPolicy: vi.fn(actual.businessPolicyService.getPublicPolicy.bind(actual.businessPolicyService)),
    },
  };
});

describe('/api/business-policy/public', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns only public-safe business policy fields', async () => {
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-business-policy-version')).toBe('nem-default-2026-05-23');
    expect(payload.success).toBe(true);
    expect(payload.policy.branding.brandName).toBe('NEM Salvage');
    expect(payload.policy.onboarding.tier1BidLimit).toBe(500000);
    expect(payload.policy.payments).toEqual({
      walletEnabled: true,
      paystackEnabled: true,
      flutterwaveEnabled: false,
      hybridPaymentEnabled: true,
      manualPaymentEnabled: false,
    });
    expect(payload.policy.fraud).toBeUndefined();
    expect(JSON.stringify(payload)).not.toMatch(/secret|apiKey|webhook|dojah/i);
  });

  it('fails safely without exposing internal errors', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(businessPolicyService.getPublicPolicy).mockRejectedValueOnce(new Error('provider secret failure'));

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Failed to fetch public business policy');
    expect(JSON.stringify(payload)).not.toContain('provider secret failure');
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
