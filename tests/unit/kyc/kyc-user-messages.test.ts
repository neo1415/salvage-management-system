import { describe, expect, it } from 'vitest';
import {
  sanitizeVerificationProviderLabel,
  sanitizeWorkflowReference,
} from '@/lib/kyc/kyc-user-messages';

describe('KYC provider sanitization', () => {
  it('maps internal provider codes to generic labels', () => {
    expect(sanitizeVerificationProviderLabel('dojah')).toBe('Identity verification');
    expect(sanitizeVerificationProviderLabel('nem_hybrid')).toBe('Document review');
    expect(sanitizeVerificationProviderLabel('')).toBe('Identity verification');
  });

  it('sanitizes workflow references', () => {
    expect(sanitizeWorkflowReference('nem-hybrid-tier2')).toBe('Full verification review');
    expect(sanitizeWorkflowReference('custom-workflow')).toBe('custom-workflow');
  });
});
