import { describe, expect, it } from 'vitest';
import {
  hasTier2VerificationEvidence,
  isTier2ReadyForVendorSubmission,
} from '@/features/kyc/services/tier2-submission-readiness';
import type { DojahVerificationResult } from '@/features/kyc/schemas/dojah.schemas';

describe('tier2-submission-readiness', () => {
  it('rejects bare pending workflow with no evidence', () => {
    const result = {
      status: 'pending',
      data: {},
    } as DojahVerificationResult;

    expect(hasTier2VerificationEvidence(result)).toBe(false);
    expect(isTier2ReadyForVendorSubmission(result)).toBe(false);
  });

  it('accepts results with NIN evidence', () => {
    const result = {
      status: 'pending',
      data: {
        government_data: {
          data: {
            nin: { entity: { nin: '12345678901', firstname: 'Ada' } },
          },
        },
      },
    } as DojahVerificationResult;

    expect(isTier2ReadyForVendorSubmission(result)).toBe(true);
  });
});
