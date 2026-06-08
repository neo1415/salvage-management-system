import { and, desc, eq, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { providerVerificationRecords } from '@/lib/db/schema/provider-verifications';
import { abandonOpenTier2Workflows } from './kyc-testing-reset.service';

/**
 * Clears a Tier 2 queue entry that was created without real verification evidence
 * (e.g. user left for browser permissions and reconcile marked submitted).
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

  if (!vendor?.tier2SubmittedAt || vendor.tier2ApprovedAt) {
    return false;
  }

  const hasManualSubmissionFootprint = Boolean(
    vendor.tier2DojahReferenceId?.startsWith('nem-') ||
      vendor.photoIdUrl ||
      vendor.addressProofUrl ||
      vendor.cacCertificateUrl
  );
  if (hasManualSubmissionFootprint) {
    return false;
  }

  const [manualHybridEvidence] = await db
    .select({ id: providerVerificationRecords.id })
    .from(providerVerificationRecords)
    .where(
      and(
        eq(providerVerificationRecords.vendorId, vendorId),
        eq(providerVerificationRecords.verificationType, 'tier2'),
        or(
          eq(providerVerificationRecords.workflowReference, 'nem-hybrid-tier2'),
          sql`${providerVerificationRecords.normalizedResult}->>'verificationMode' = 'nem_hybrid_manual_review'`,
          sql`${providerVerificationRecords.checksCompleted} ? 'nem_documents_uploaded'`,
          sql`${providerVerificationRecords.checksCompleted} ? 'documents_uploaded'`
        )
      )
    )
    .limit(1);

  if (manualHybridEvidence) {
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
    .where(eq(providerVerificationRecords.vendorId, vendorId))
    .orderBy(desc(providerVerificationRecords.updatedAt))
    .limit(1);

  const normalized = latestEvidence?.normalizedResult as Record<string, unknown> | null | undefined;
  const verificationMode = String(normalized?.verificationMode ?? '');
  const latestIsManualHybrid =
    latestEvidence?.workflowReference === 'nem-hybrid-tier2' ||
    verificationMode === 'nem_hybrid_manual_review' ||
    (latestEvidence?.checksCompleted ?? []).includes('nem_documents_uploaded') ||
    (latestEvidence?.checksCompleted ?? []).includes('documents_uploaded');

  if (latestIsManualHybrid) {
    return false;
  }

  const hasEvidence = Boolean(
    vendor.ninVerified || vendor.livenessScore || vendor.biometricMatchScore
  );
  if (hasEvidence) {
    return false;
  }

  await db
    .update(vendors)
    .set({
      tier2SubmittedAt: null,
      tier2DojahReferenceId: null,
      updatedAt: new Date(),
    })
    .where(eq(vendors.id, vendorId));

  await abandonOpenTier2Workflows(vendorId);
  return true;
}
