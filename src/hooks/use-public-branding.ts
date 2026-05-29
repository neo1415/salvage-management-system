'use client';

import { DEFAULT_BUSINESS_POLICY } from '@/features/business-policy/default-policy';
import type { BrandingPolicy } from '@/features/business-policy/types';
import { getBrandGradient } from '@/features/branding/brand-colors';
import { usePublicBusinessPolicy } from './use-public-business-policy';

type PublicBrandingState = {
  branding: BrandingPolicy;
  policyVersion: string;
  loading: boolean;
};

export function usePublicBranding(): PublicBrandingState {
  const { policy, loading } = usePublicBusinessPolicy();
  const bootPolicy = typeof window === 'undefined' ? null : window.__PUBLIC_BUSINESS_POLICY__ ?? null;
  const resolvedPolicy = policy ?? bootPolicy;

  return {
    branding: resolvedPolicy?.branding ?? DEFAULT_BUSINESS_POLICY.branding,
    policyVersion: resolvedPolicy?.version ?? DEFAULT_BUSINESS_POLICY.version,
    loading: loading && !resolvedPolicy,
  };
}

export { getBrandGradient };
