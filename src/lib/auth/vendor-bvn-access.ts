/**
 * BVN onboarding gate — legacy exports; routing uses vendor-onboarding-navigation.
 */

export {
  VENDOR_TIER1_PATH,
  VENDOR_TIER2_PATH,
  CHANGE_PASSWORD_PATH,
  VENDOR_REGISTRATION_FEE_PATH,
  isVendorOnboardingPage,
  isVendorOnboardingApi,
} from '@/lib/auth/vendor-onboarding-paths';

/** @deprecated Use isVendorOnboardingPage */
export const VENDOR_PRE_BVN_PAGE_PREFIXES = ['/vendor/kyc/tier1'] as const;

/** @deprecated Use isVendorOnboardingApi */
export const VENDOR_PRE_BVN_API_PREFIXES = [
  '/api/auth',
  '/api/vendors/verify-bvn',
  '/api/kyc/status',
  '/api/kyc/widget-config',
  '/api/settings/profile',
  '/api/otp/',
  '/api/webhooks/',
] as const;

/** @deprecated Prefer vendor-onboarding-navigation */
export function vendorNeedsBvnVerification(role: string | undefined, bvnVerified: boolean | undefined): boolean {
  return role === 'vendor' && bvnVerified !== true;
}

/** @deprecated Use isVendorOnboardingPage */
export function isVendorPreBvnPage(pathname: string): boolean {
  return pathname === '/vendor/kyc/tier1' || pathname.startsWith('/vendor/kyc/tier1/');
}

/** @deprecated Use isVendorOnboardingApi */
export function isVendorPreBvnApi(pathname: string): boolean {
  return VENDOR_PRE_BVN_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
