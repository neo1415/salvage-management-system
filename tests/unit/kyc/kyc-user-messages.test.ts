import { describe, expect, it } from 'vitest';
import {
  sanitizeVerificationProviderLabel,
  sanitizeWorkflowReference,
} from '@/lib/kyc/kyc-user-messages';

describe('KYC provider sanitization', () => {
  it('maps internal provider codes to generic labels', () => {
    expect(sanitizeVerificationProviderLabel('dojah')).toBe('Identity verification');
    expect(sanitizeVerificationProviderLabel('nem_hybrid')).toBe('Platform verification');
    expect(sanitizeVerificationProviderLabel('')).toBe('Verification service');
  });

  it('sanitizes workflow references', () => {
    expect(sanitizeWorkflowReference('nem-hybrid-tier2')).toBe('Tier 2 manual review workflow');
    expect(sanitizeWorkflowReference('custom-workflow')).toBe('custom-workflow');
  });
});
