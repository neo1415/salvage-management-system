export const CHANGE_PASSWORD_PATH = '/change-password';
export const VENDOR_PROFILE_PHONE_PATH = '/vendor/settings/profile?focus=phone';
export const VENDOR_VERIFY_ACCOUNT_PATH = '/vendor/onboarding/verify-account';
export const VENDOR_REGISTRATION_FEE_PATH = '/vendor/registration-fee';
export const VENDOR_TIER1_PATH = '/vendor/kyc/tier1';
export const VENDOR_TIER2_PATH = '/vendor/kyc/tier2';

export const VENDOR_ONBOARDING_PAGE_PREFIXES = [
  CHANGE_PASSWORD_PATH,
  '/vendor/settings/profile',
  VENDOR_VERIFY_ACCOUNT_PATH,
  VENDOR_TIER1_PATH,
  VENDOR_TIER2_PATH,
  VENDOR_REGISTRATION_FEE_PATH,
] as const;

export const VENDOR_ONBOARDING_API_PREFIXES = [
  '/api/auth',
  '/api/vendors/verify-bvn',
  '/api/vendors/registration-fee',
  '/api/kyc/',
  '/api/settings/profile',
  '/api/otp/',
  '/api/webhooks/',
  '/api/vendor/onboarding-status',
  '/api/vendor/onboarding/verify-account',
] as const;

export function isVendorOnboardingPage(pathname: string): boolean {
  if (pathname === CHANGE_PASSWORD_PATH || pathname.startsWith(`${CHANGE_PASSWORD_PATH}/`)) {
    return true;
  }
  return VENDOR_ONBOARDING_PAGE_PREFIXES.some((prefix) => {
    if (prefix === CHANGE_PASSWORD_PATH) return false;
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}

export function isVendorOnboardingApi(pathname: string): boolean {
  return VENDOR_ONBOARDING_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
