import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, vendors } from '@/lib/db/schema';
import { providerVerificationRecords } from '@/lib/db/schema/provider-verifications';
import { and, desc, eq } from 'drizzle-orm';
import { getKYCRepository } from '@/features/kyc/repositories/kyc.repository';
import { reconcileTier2FromDojah } from '@/features/kyc/services/dojah-reconcile.service';
import { getIpAddress } from '@/lib/utils/audit-logger';
import { isProviderVerificationStorageError, PROVIDER_VERIFICATION_MIGRATION_MISSING } from '@/features/kyc/services/provider-verification-readiness';
import {
  applyKycTestingStatusOverride,
  isKycTestingMode,
} from '@/lib/kyc/kyc-testing-mode';
import { clearPrematureTier2Submission } from '@/features/kyc/services/clear-premature-tier2-submission';
import {
  isManualHybridTier2Evidence,
  providerEvidenceCountsAsTier2Submission,
  vendorHasRealTier2SubmissionFootprint,
} from '@/features/kyc/utils/tier2-submission-footprint';

export const dynamic = 'force-dynamic';

/**
 * GET /api/kyc/status
 * Returns the current KYC status for the authenticated vendor.
 * Reconciles stored Dojah references when the dashboard shows completion but NEM Salvage lags.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [vendorRow] = await db
      .select({
        id: vendors.id,
        tier2SubmittedAt: vendors.tier2SubmittedAt,
        tier2ApprovedAt: vendors.tier2ApprovedAt,
        tier2RejectionReason: vendors.tier2RejectionReason,
      })
      .from(vendors)
      .where(eq(vendors.userId, session.user.id))
      .limit(1);

    if (!vendorRow) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    if (!isKycTestingMode()) {
      await clearPrematureTier2Submission(vendorRow.id);
    }

    const [vendorAfterCleanup] = await db
      .select({
        tier2SubmittedAt: vendors.tier2SubmittedAt,
        tier2ApprovedAt: vendors.tier2ApprovedAt,
        tier2RejectionReason: vendors.tier2RejectionReason,
        tier2DojahReferenceId: vendors.tier2DojahReferenceId,
        ninVerified: vendors.ninVerified,
        livenessScore: vendors.livenessScore,
        biometricMatchScore: vendors.biometricMatchScore,
        photoIdUrl: vendors.photoIdUrl,
        addressProofUrl: vendors.addressProofUrl,
        cacCertificateUrl: vendors.cacCertificateUrl,
      })
      .from(vendors)
      .where(eq(vendors.id, vendorRow.id))
      .limit(1);

    // Only sync provider results after a real submission — never on first widget load.
    const [latestEvidence] = await db
      .select({
        workflowReference: providerVerificationRecords.workflowReference,
        providerReference: providerVerificationRecords.providerReference,
        status: providerVerificationRecords.status,
        finalDecision: providerVerificationRecords.finalDecision,
        decisionReason: providerVerificationRecords.decisionReason,
        reviewedAt: providerVerificationRecords.reviewedAt,
        reviewedBy: providerVerificationRecords.reviewedBy,
        checksCompleted: providerVerificationRecords.checksCompleted,
        normalizedResult: providerVerificationRecords.normalizedResult,
        updatedAt: providerVerificationRecords.updatedAt,
      })
      .from(providerVerificationRecords)
      .where(
        and(
          eq(providerVerificationRecords.vendorId, vendorRow.id),
          eq(providerVerificationRecords.verificationType, 'tier2')
        )
      )
      .orderBy(desc(providerVerificationRecords.updatedAt))
      .limit(1);

    const isManualHybridEvidence = isManualHybridTier2Evidence(latestEvidence);

    let effectiveTier2SubmittedAt = vendorAfterCleanup?.tier2SubmittedAt ?? null;
    let effectiveTier2ApprovedAt = vendorAfterCleanup?.tier2ApprovedAt ?? null;
    let effectiveTier2RejectionReason = vendorAfterCleanup?.tier2RejectionReason ?? null;
    const latestProviderDecision = resolveLatestProviderDecision(latestEvidence);

    if (
      !isKycTestingMode() &&
      latestProviderDecision?.decision === 'reject' &&
      !effectiveTier2ApprovedAt &&
      !effectiveTier2RejectionReason
    ) {
      const rejectionReason =
        latestProviderDecision.reason ||
        latestEvidence?.decisionReason ||
        'Application rejected';

      await db
        .update(vendors)
        .set({
          tier2RejectionReason: rejectionReason,
          tier2SubmittedAt: null,
          tier2DojahReferenceId: null,
          updatedAt: new Date(),
        })
        .where(eq(vendors.id, vendorRow.id));

      effectiveTier2SubmittedAt = null;
      effectiveTier2RejectionReason = rejectionReason;
    }

    if (
      !isKycTestingMode() &&
      latestProviderDecision?.decision === 'approve' &&
      !effectiveTier2ApprovedAt &&
      !effectiveTier2RejectionReason
    ) {
      const approvedAt = latestEvidence?.reviewedAt ?? latestEvidence?.updatedAt ?? new Date();
      const expiresAt = new Date(approvedAt);
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      await db
        .update(vendors)
        .set({
          tier: 'tier2_full',
          tier2ApprovedAt: approvedAt,
          tier2ApprovedBy: latestEvidence?.reviewedBy ?? null,
          tier2ExpiresAt: expiresAt,
          tier2RejectionReason: null,
          tier2SubmittedAt: approvedAt,
          updatedAt: new Date(),
        })
        .where(eq(vendors.id, vendorRow.id));

      await db
        .update(users)
        .set({
          status: 'verified_tier_2',
          updatedAt: new Date(),
        })
        .where(eq(users.id, session.user.id));

      effectiveTier2SubmittedAt = approvedAt;
      effectiveTier2ApprovedAt = approvedAt;
      effectiveTier2RejectionReason = null;
    }

    // Self-heal vendors whose manual Tier 2 evidence was saved before the vendor row
    // status was reliably backfilled. Existing applicants should not have to resubmit.
    if (
      isManualHybridEvidence &&
      !effectiveTier2SubmittedAt &&
      !effectiveTier2ApprovedAt &&
      !effectiveTier2RejectionReason
    ) {
      const submittedAt = latestEvidence?.updatedAt ?? new Date();
      await db
        .update(vendors)
        .set({
          tier2SubmittedAt: submittedAt,
          ...(latestEvidence?.providerReference
            ? { tier2DojahReferenceId: latestEvidence.providerReference }
            : {}),
          tier2RejectionReason: null,
          updatedAt: new Date(),
        })
        .where(eq(vendors.id, vendorRow.id));
      effectiveTier2SubmittedAt = submittedAt;
    }

    if (
      !isKycTestingMode() &&
      !isManualHybridEvidence &&
      effectiveTier2SubmittedAt &&
      !effectiveTier2ApprovedAt &&
      !effectiveTier2RejectionReason
    ) {
      await reconcileTier2FromDojah({
        vendorId: vendorRow.id,
        userId: session.user.id,
        actorId: session.user.id,
        ipAddress: getIpAddress(request.headers),
        userAgent: request.headers.get('user-agent') ?? 'unknown',
      }).catch((error) => {
        if (isProviderVerificationStorageError(error)) {
          throw error;
        }
        console.error('[KYC Status] reconcile skipped', {
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    }

    const kycStatus = await getKYCRepository().getVerificationStatus(vendorRow.id);
    if (!kycStatus) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    if (
      !isKycTestingMode() &&
      kycStatus.status === 'rejected' &&
      !effectiveTier2ApprovedAt &&
      !effectiveTier2RejectionReason
    ) {
      const rejectionReason = kycStatus.rejectionReason || 'Application rejected';
      await db
        .update(vendors)
        .set({
          tier2RejectionReason: rejectionReason,
          tier2SubmittedAt: null,
          tier2DojahReferenceId: null,
          updatedAt: new Date(),
        })
        .where(eq(vendors.id, vendorRow.id));

      effectiveTier2SubmittedAt = null;
      effectiveTier2RejectionReason = rejectionReason;
    }

    if (
      !isKycTestingMode() &&
      kycStatus.status === 'approved' &&
      !effectiveTier2ApprovedAt &&
      !effectiveTier2RejectionReason
    ) {
      const approvedAt = kycStatus.approvedAt ?? new Date();
      const expiresAt = kycStatus.expiresAt ?? new Date(approvedAt);
      if (!kycStatus.expiresAt) {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      }

      await db
        .update(vendors)
        .set({
          tier: 'tier2_full',
          tier2ApprovedAt: approvedAt,
          tier2ExpiresAt: expiresAt,
          tier2RejectionReason: null,
          tier2SubmittedAt: approvedAt,
          updatedAt: new Date(),
        })
        .where(eq(vendors.id, vendorRow.id));

      await db
        .update(users)
        .set({
          status: 'verified_tier_2',
          updatedAt: new Date(),
        })
        .where(eq(users.id, session.user.id));

      effectiveTier2SubmittedAt = approvedAt;
      effectiveTier2ApprovedAt = approvedAt;
      effectiveTier2RejectionReason = null;
    }

    const payload = isKycTestingMode()
      ? applyKycTestingStatusOverride(kycStatus)
      : kycStatus;
    const hasRealPendingSubmission =
      Boolean(
        effectiveTier2SubmittedAt &&
          vendorAfterCleanup &&
          vendorHasRealTier2SubmissionFootprint(vendorAfterCleanup)
      ) ||
      isManualHybridEvidence ||
      providerEvidenceCountsAsTier2Submission(latestEvidence, vendorAfterCleanup);

    const responseSubmittedAt =
      hasRealPendingSubmission && payload.status !== 'not_started'
        ? kycStatus.submittedAt
        : undefined;
    const normalizedPayloadStatus =
      payload.status === 'pending_review' && !hasRealPendingSubmission ? 'not_started' : payload.status;
    const authoritativeStatus =
      !isKycTestingMode() &&
      hasRealPendingSubmission &&
      !effectiveTier2ApprovedAt &&
      !effectiveTier2RejectionReason &&
      normalizedPayloadStatus !== 'approved' &&
      normalizedPayloadStatus !== 'rejected'
        ? 'pending_review'
        : normalizedPayloadStatus;

    console.info('[KYC Status] resolved', {
      vendorId: vendorRow.id,
      repositoryStatus: kycStatus.status,
      responseStatus: authoritativeStatus,
      hasSubmittedAt: Boolean(effectiveTier2SubmittedAt),
      hasApprovedAt: Boolean(effectiveTier2ApprovedAt),
      hasRejectionReason: Boolean(effectiveTier2RejectionReason),
      latestProviderStatus: latestEvidence?.status ?? null,
      latestProviderDecision: latestProviderDecision?.decision ?? null,
      latestProviderMode:
        (latestEvidence?.normalizedResult as Record<string, unknown> | null)?.verificationMode ??
        latestEvidence?.workflowReference ??
        null,
      testingMode: isKycTestingMode(),
    });

    return NextResponse.json(
      {
        status: authoritativeStatus,
        tier: payload.tier,
        submittedAt: responseSubmittedAt,
        approvedAt: kycStatus.approvedAt,
        expiresAt: kycStatus.expiresAt,
        rejectionReason: authoritativeStatus === 'rejected' ? kycStatus.rejectionReason : undefined,
        rejectedSections: authoritativeStatus === 'rejected' ? kycStatus.rejectedSections : undefined,
        dojahReferenceId: kycStatus.dojahReferenceId,
        steps: kycStatus.steps,
        ...(isKycTestingMode() ? { kycTestingMode: true as const } : {}),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    if (isProviderVerificationStorageError(error)) {
      return NextResponse.json(
        { error: PROVIDER_VERIFICATION_MIGRATION_MISSING },
        { status: 503 }
      );
    }
    console.error('[KYC Status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch KYC status' },
      { status: 500 }
    );
  }
}

function payloadStatusLooksSubmitted(status: string | null | undefined): boolean {
  const normalized = String(status ?? '').toLowerCase();
  return [
    'review_required',
    'pending',
    'pending_review',
    'submitted',
    'submitted_for_review',
    'manual_review',
  ].includes(normalized);
}

function recordFrom(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const text = value.trim();
    if (text) return text;
  }
  return undefined;
}

function resolveLatestProviderDecision(evidence: {
  finalDecision?: string | null;
  decisionReason?: string | null;
  normalizedResult?: unknown;
} | null | undefined): { decision: 'approve' | 'reject'; reason?: string } | null {
  const normalized = recordFrom(evidence?.normalizedResult);
  const managerDecision = recordFrom(normalized?.managerDecision);
  const decision = firstString(evidence?.finalDecision, managerDecision?.decision)?.toLowerCase();

  if (decision === 'approve' || decision === 'approved') {
    return { decision: 'approve', reason: firstString(evidence?.decisionReason, managerDecision?.reason) };
  }

  if (decision === 'reject' || decision === 'rejected') {
    return { decision: 'reject', reason: firstString(evidence?.decisionReason, managerDecision?.reason) };
  }

  return null;
}
