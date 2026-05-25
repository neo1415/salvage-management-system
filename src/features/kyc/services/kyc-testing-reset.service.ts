import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { isKycTestingMode } from '@/lib/kyc/kyc-testing-mode';

/**
 * Clears Tier 2 submission/approval state so the Dojah widget can run again.
 * No-op when KYC_TESTING_MODE is not enabled.
 */
export async function resetVendorTier2ForTesting(vendorId: string): Promise<boolean> {
  if (!isKycTestingMode()) {
    return false;
  }

  await db
    .update(vendors)
    .set({
      tier: 'tier1_bvn',
      tier2SubmittedAt: null,
      tier2ApprovedAt: null,
      tier2ApprovedBy: null,
      tier2RejectionReason: null,
      tier2ExpiresAt: null,
      tier2DojahReferenceId: null,
      ninVerified: null,
      ninEncrypted: null,
      ninVerificationData: null,
      photoIdVerifiedAt: null,
      livenessScore: null,
      biometricMatchScore: null,
      biometricVerifiedAt: null,
      amlScreenedAt: null,
      amlRiskLevel: null,
      amlScreeningData: null,
      fraudRiskScore: null,
      fraudFlags: null,
      updatedAt: new Date(),
    })
    .where(eq(vendors.id, vendorId));

  return true;
}
