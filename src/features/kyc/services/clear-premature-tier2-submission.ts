import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { providerVerificationRecords } from '@/lib/db/schema/provider-verifications';
import { abandonOpenTier2Workflows } from './kyc-testing-reset.service';
import {
  isBareOpenTier2Workflow,
  isManualHybridTier2Evidence,
  providerEvidenceCountsAsTier2Submission,
  vendorHasRealTier2SubmissionFootprint,
} from '../utils/tier2-submission-footprint';

/**
 * Clears Tier 2 queue/session state that was created without a real vendor submission
 * (e.g. widget config prefetch, permission prompts, or abandoned widget sessions).
 */
export async function clearPrematureTier2Submission(vendorId: string): Promise<boolean> {
  const [vendor] = await db
    .select({
      tier2SubmittedAt: vendors.tier2SubmittedAt,
      tier2ApprovedAt: vendors.tier2ApprovedAt,
      tier2DojahReferenceId: vendors.tier2DojahReferenceId,
      ninVerified: vendors.ninVerified,
      livenessScore: vendors.livenessScore,
      biometricMatchScore: vendors.biometricMatchScore,
      photoIdUrl: vendors.photoIdUrl,
      addressProofUrl: vendors.addressProofUrl,
      cacCertificateUrl: vendors.cacCertificateUrl,
    })
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);

  if (!vendor || vendor.tier2ApprovedAt) {
    return false;
  }

  const [latestEvidence] = await db
    .select({
      workflowReference: providerVerificationRecords.workflowReference,
      status: providerVerificationRecords.status,
      checksCompleted: providerVerificationRecords.checksCompleted,
      normalizedResult: providerVerificationRecords.normalizedResult,
    })
    .from(providerVerificationRecords)
    .where(
      and(
        eq(providerVerificationRecords.vendorId, vendorId),
        eq(providerVerificationRecords.verificationType, 'tier2')
      )
    )
    .orderBy(desc(providerVerificationRecords.updatedAt))
    .limit(1);

  const hasRealSubmission =
    vendorHasRealTier2SubmissionFootprint(vendor) ||
    isManualHybridTier2Evidence(latestEvidence) ||
    providerEvidenceCountsAsTier2Submission(latestEvidence, vendor);

  if (hasRealSubmission) {
    return false;
  }

  const hadStaleState = Boolean(vendor.tier2SubmittedAt || isBareOpenTier2Workflow(latestEvidence));

  if (vendor.tier2SubmittedAt || vendor.tier2DojahReferenceId) {
    await db
      .update(vendors)
      .set({
        tier2SubmittedAt: null,
        tier2DojahReferenceId: null,
        updatedAt: new Date(),
      })
      .where(eq(vendors.id, vendorId));
  }

  await abandonOpenTier2Workflows(vendorId);
  return hadStaleState;
}
