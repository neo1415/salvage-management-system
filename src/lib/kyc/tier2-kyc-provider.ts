import { VENDOR_TIER2_MANUAL_PATH, VENDOR_TIER2_PATH } from '@/lib/auth/vendor-onboarding-paths';

export type Tier2KycProvider = 'dojah_widget' | 'manual';

/**
 * Tier 2 flow selection. Defaults to manual review until widget mode is explicitly enabled.
 * Set NEXT_PUBLIC_TIER2_KYC_PROVIDER=dojah_widget to use the embedded identity widget.
 */
export function resolveTier2KycProvider(): Tier2KycProvider {
  const raw = process.env.NEXT_PUBLIC_TIER2_KYC_PROVIDER?.trim().toLowerCase();
  if (raw === 'dojah_widget') {
    return 'dojah_widget';
  }
  return 'manual';
}

export function resolveVendorTier2Path(): string {
  return resolveTier2KycProvider() === 'dojah_widget' ? VENDOR_TIER2_PATH : VENDOR_TIER2_MANUAL_PATH;
}
