'use client';

import { DEFAULT_BUSINESS_POLICY } from '@/features/business-policy/default-policy';
import type { BrandingPolicy } from '@/features/business-policy/types';
import { usePublicBusinessPolicy } from './use-public-business-policy';

type PublicBrandingState = {
  branding: BrandingPolicy;
  policyVersion: string;
  loading: boolean;
};

function clampColorChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function shadeHexColor(hex: string, factor: number): string {
  const normalized = /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex.slice(1) : '800020';
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);

  return `#${[red, green, blue]
    .map((channel) => clampColorChannel(channel * factor).toString(16).padStart(2, '0'))
    .join('')}`;
}

export function getBrandGradient(branding: BrandingPolicy): string {
  return `linear-gradient(135deg, ${branding.primaryColor}, ${shadeHexColor(branding.primaryColor, 0.75)})`;
}

export function usePublicBranding(): PublicBrandingState {
  const { policy, loading } = usePublicBusinessPolicy();

  return {
    branding: policy?.branding ?? DEFAULT_BUSINESS_POLICY.branding,
    policyVersion: policy?.version ?? DEFAULT_BUSINESS_POLICY.version,
    loading,
  };
}
