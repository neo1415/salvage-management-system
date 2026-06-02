import { describe, expect, it } from 'vitest';
import {
  getTier2SubmissionReadiness,
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

  it('rejects completed results missing business evidence', () => {
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

    const readiness = getTier2SubmissionReadiness(result);
    expect(isTier2ReadyForVendorSubmission(result)).toBe(false);
    expect(readiness.reason).toBe('missing_core_evidence');
    expect(readiness.missingBlockingEvidence).toContain('business_data_or_id');
  });

  it('accepts completed results with identity, liveness, and business evidence', () => {
    const result = {
      verification_status: 'Completed',
      data: {
        government_data: {
          data: {
            nin: { entity: { nin: '12345678901', firstname: 'Ada' } },
          },
        },
        selfie: { data: { liveness_score: 90 } },
        business_id: { business_name: 'Ada Parts Ventures', business_number: 'BN12345' },
      },
    } as DojahVerificationResult;

    const readiness = getTier2SubmissionReadiness(result);
    expect(isTier2ReadyForVendorSubmission(result)).toBe(true);
    expect(readiness.reason).toBe('ready');
  });
});
