import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { providerVerificationRecords } from '@/lib/db/schema/provider-verifications';
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

/** Close abandoned in-widget sessions so vendors can start fresh. */
export async function abandonOpenTier2Workflows(vendorId: string): Promise<void> {
  await db
    .update(providerVerificationRecords)
    .set({
      status: 'failed',
      displayMessage: 'Verification session ended before completion. Vendor may start again.',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(providerVerificationRecords.vendorId, vendorId),
        eq(providerVerificationRecords.provider, 'dojah'),
        eq(providerVerificationRecords.verificationType, 'tier2'),
        inArray(providerVerificationRecords.status, ['pending', 'provider_unavailable'])
      )
    );
}
