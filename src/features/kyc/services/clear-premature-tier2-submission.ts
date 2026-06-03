import { desc, eq } from 'drizzle-orm';
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
      ninVerified: vendors.ninVerified,
      livenessScore: vendors.livenessScore,
      biometricMatchScore: vendors.biometricMatchScore,
    })
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);

  if (!vendor?.tier2SubmittedAt || vendor.tier2ApprovedAt) {
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
  const hasManualHybridEvidence =
    latestEvidence?.workflowReference === 'nem-hybrid-tier2' ||
    verificationMode === 'nem_hybrid_manual_review' ||
    (latestEvidence?.checksCompleted ?? []).includes('nem_documents_uploaded');

  if (hasManualHybridEvidence) {
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
