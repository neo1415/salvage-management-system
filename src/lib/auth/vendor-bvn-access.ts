/**
 * BVN onboarding gate — vendors must complete Tier 1 before using the platform.
 */

export const VENDOR_TIER1_PATH = '/vendor/kyc/tier1';

/** Page routes allowed before BVN is verified (prefix match). */
export const VENDOR_PRE_BVN_PAGE_PREFIXES = [
  VENDOR_TIER1_PATH,
  '/api/auth',
] as const;

/** API routes allowed before BVN is verified (prefix match). */
export const VENDOR_PRE_BVN_API_PREFIXES = [
  '/api/auth',
  '/api/vendors/verify-bvn',
  '/api/kyc/status',
  '/api/kyc/widget-config',
  '/api/otp/',
  '/api/webhooks/',
] as const;

export function vendorNeedsBvnVerification(role: string | undefined, bvnVerified: boolean | undefined): boolean {
  return role === 'vendor' && bvnVerified !== true;
}

export function isVendorPreBvnPage(pathname: string): boolean {
  if (pathname === VENDOR_TIER1_PATH || pathname.startsWith(`${VENDOR_TIER1_PATH}/`)) {
    return true;
  }
  return false;
}

export function isVendorPreBvnApi(pathname: string): boolean {
  return VENDOR_PRE_BVN_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
