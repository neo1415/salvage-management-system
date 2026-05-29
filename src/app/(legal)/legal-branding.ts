import { DEFAULT_BUSINESS_POLICY } from '@/features/business-policy/default-policy';

export type LegalBranding = {
  brandName: string;
  legalName: string;
  platformName: string;
  supportEmail: string;
  privacyEmail: string;
  dpoEmail: string;
  legalEmail: string;
  supportPhone: string;
  addressLine1: string;
  addressLine2: string;
  registrationNumber: string;
  legalLastUpdated: string;
};

function normalizeLegacyEmail(email: string | null | undefined, fallback: string): string {
  if (!email) return fallback;
  return email.toLowerCase() === 'support@nemsalvage.com' ? fallback : email;
}

export async function getLegalBranding(): Promise<LegalBranding> {
  try {
    const { businessPolicyService } = await import('@/features/business-policy/business-policy.service');
    const policy = await businessPolicyService.getEffectivePolicy();
    const supportEmail = policy.branding.supportEmail || DEFAULT_BUSINESS_POLICY.branding.supportEmail;
    const supportPhone = policy.branding.supportPhone || '+234 (0) 1 234 5678';

    return {
      brandName: policy.branding.brandName,
      legalName: policy.branding.legalName,
      platformName: `${policy.branding.brandName} Salvage Auction Platform`,
      supportEmail,
      privacyEmail: normalizeLegacyEmail(policy.legal.privacyEmail, supportEmail),
      dpoEmail: normalizeLegacyEmail(policy.legal.dpoEmail, supportEmail),
      legalEmail: normalizeLegacyEmail(policy.legal.legalEmail, supportEmail),
      supportPhone,
      addressLine1: policy.legal.addressLine1,
      addressLine2: policy.legal.addressLine2,
      registrationNumber: policy.legal.registrationNumber,
      legalLastUpdated: policy.legal.legalLastUpdated,
    };
  } catch {
    const supportEmail = DEFAULT_BUSINESS_POLICY.branding.supportEmail;

    return {
      brandName: DEFAULT_BUSINESS_POLICY.branding.brandName,
      legalName: DEFAULT_BUSINESS_POLICY.branding.legalName,
      platformName: `${DEFAULT_BUSINESS_POLICY.branding.brandName} Salvage Auction Platform`,
      supportEmail,
      privacyEmail: supportEmail,
      dpoEmail: supportEmail,
      legalEmail: supportEmail,
      supportPhone: DEFAULT_BUSINESS_POLICY.branding.supportPhone || '+234 (0) 1 234 5678',
      addressLine1: 'Registered business address',
      addressLine2: 'Nigeria',
      registrationNumber: 'Configured in enterprise setup',
      legalLastUpdated: 'April 27, 2026',
    };
  }
}
