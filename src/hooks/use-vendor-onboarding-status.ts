'use client';

import { useCallback, useEffect, useState } from 'react';

export type VendorOnboardingStatus = {
  redirectPath: string | null;
  canBid: boolean;
  bidBlockedMessage: string | null;
  onboardingMode: string;
  usesTierLanguage: boolean;
  fullVerificationLabel: string;
  registrationFeeRequired: boolean;
  registrationFeeAmount: number;
  tier1BidLimit: number;
  bannerTitle: string;
  bannerBody: string;
  tier: string;
  registrationFeePaid: boolean;
  bvnVerified: boolean;
  bidOtpRequired: boolean;
  bidOtpMode: string;
};

export function useVendorOnboardingStatus() {
  const [status, setStatus] = useState<VendorOnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/vendor/onboarding-status', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to load account policy status');
      }
      const payload = await response.json();
      setStatus(payload.data as VendorOnboardingStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load account policy status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { status, loading, error, refresh };
}
