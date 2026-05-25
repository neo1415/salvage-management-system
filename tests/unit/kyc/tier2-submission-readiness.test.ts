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

  it('rejects selfie-only partial result', () => {
    const result = {
      status: 'pending',
      data: { selfie: { data: { liveness_score: 88 } } },
    } as DojahVerificationResult;

    expect(isTier2ReadyForVendorSubmission(result)).toBe(false);
  });

  it('accepts results with NIN and selfie evidence', () => {
    const result = {
      verification_status: 'Completed',
      data: {
        government_data: {
          data: {
            nin: { entity: { nin: '12345678901', firstname: 'Ada' } },
          },
        },
        selfie: { data: { liveness_score: 90 } },
      },
    } as DojahVerificationResult;

    expect(isTier2ReadyForVendorSubmission(result)).toBe(true);
  });
});
