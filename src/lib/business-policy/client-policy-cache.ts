import type { PublicBusinessPolicy } from '@/features/business-policy/types';

const PUBLIC_POLICY_CACHE_KEY = 'salvage-public-business-policy-v1';

export function readCachedPublicBusinessPolicy(): PublicBusinessPolicy | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(PUBLIC_POLICY_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PublicBusinessPolicy;
  } catch {
    return null;
  }
}

export function writeCachedPublicBusinessPolicy(policy: PublicBusinessPolicy): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(PUBLIC_POLICY_CACHE_KEY, JSON.stringify(policy));
  } catch {
    // Ignore quota or private-mode storage errors.
  }
}
