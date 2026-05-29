import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PublicBusinessPolicyProvider,
  usePublicBusinessPolicyContext,
} from '@/hooks/public-business-policy-context';
import type { PublicBusinessPolicy } from '@/features/business-policy/types';

function Consumer() {
  const { policy, loading } = usePublicBusinessPolicyContext();

  return (
    <div>
      <span data-testid="brand">{policy?.branding.brandName ?? 'none'}</span>
      <span data-testid="loading">{loading ? 'loading' : 'ready'}</span>
    </div>
  );
}

function makePublicPolicy(brandName: string): PublicBusinessPolicy {
  return {
    version: 'test-policy',
    branding: {
      brandName,
      legalName: `${brandName} Limited`,
      logoUrl: null,
      faviconUrl: null,
      primaryColor: '#123456',
      secondaryColor: '#FFFFFF',
      accentColor: '#D97706',
      homepageTemplate: 'reclaim_editorial',
      homepageTheme: 'day',
      splashEnabled: true,
      homepageHeroTitle: `${brandName} hero`,
      homepageHeroSubtitle: 'Public-safe subtitle',
      homepagePrimaryCta: 'Start',
      homepageSecondaryCta: 'Sign in',
    },
    modules: {
      homepageEnabled: true,
      publicAuctionBrowseEnabled: true,
      vendorWalletEnabled: true,
      escrowWalletEnabled: true,
      paystackEnabled: true,
      flutterwaveEnabled: false,
      manualPaymentEnabled: true,
      aiValuationEnabled: true,
      fraudDetectionEnabled: true,
      dojahKycEnabled: true,
      notificationsEnabled: true,
      smsNotificationsEnabled: true,
      emailNotificationsEnabled: true,
      pushNotificationsEnabled: true,
    },
    onboarding: {
      registrationMode: 'open',
      allowedEmailDomains: [],
      requireBusinessEmail: false,
      requireTier1BeforeBidding: true,
      requireTier2BeforeBidding: false,
      requireRegistrationFee: true,
      registrationFeeStage: 'before_tier2',
      tier1BidCap: 500000,
      tier2BidCap: null,
      tier1Capabilities: [],
      tier2Capabilities: [],
      kycProvider: 'dojah',
      enableGoogleAuth: false,
      enableFacebookAuth: false,
      staffMfaRequired: false,
      vendorMfaRequired: false,
    },
    assetTypes: [],
    publicLabels: {
      caseLabel: 'Case',
      auctionLabel: 'Auction',
      vendorLabel: 'Vendor',
      salvageLabel: 'Salvage',
    },
  };
}

describe('PublicBusinessPolicyProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses server-provided public policy without refetching and repainting after hydration', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <PublicBusinessPolicyProvider initialPolicy={makePublicPolicy('Blue Salvage')}>
        <Consumer />
      </PublicBusinessPolicyProvider>
    );

    expect(screen.getByTestId('brand').textContent).toBe('Blue Salvage');
    expect(screen.getByTestId('loading').textContent).toBe('ready');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
