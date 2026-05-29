import { businessPolicyService } from '@/features/business-policy';
import { DEFAULT_BUSINESS_POLICY } from '@/features/business-policy/default-policy';
import type { BrandingPolicy } from '@/features/business-policy/types';

export type EmailBranding = BrandingPolicy;

export async function getEmailBranding(): Promise<EmailBranding> {
  try {
    const policy = await businessPolicyService.getPublicPolicy();
    return policy.branding;
  } catch {
    return DEFAULT_BUSINESS_POLICY.branding;
  }
}

export function getSupportPhone(branding: EmailBranding): string {
  return branding.supportPhone || '234-02-014489560';
}

export function getSupportEmail(branding: EmailBranding): string {
  return branding.supportEmail || DEFAULT_BUSINESS_POLICY.branding.supportEmail;
}

export function brandTeamName(branding: EmailBranding): string {
  return `${branding.brandName} Team`;
}

export function brandLegalName(branding: EmailBranding): string {
  return branding.legalName || branding.brandName;
}
