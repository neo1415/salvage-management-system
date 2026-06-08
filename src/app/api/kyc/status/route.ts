import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { vendors } from '@/lib/db/schema';
import { providerVerificationRecords } from '@/lib/db/schema/provider-verifications';
import { and, desc, eq, sql } from 'drizzle-orm';
import { getKYCRepository } from '@/features/kyc/repositories/kyc.repository';
import { reconcileTier2FromDojah } from '@/features/kyc/services/dojah-reconcile.service';
import { getIpAddress } from '@/lib/utils/audit-logger';
import { isProviderVerificationStorageError, PROVIDER_VERIFICATION_MIGRATION_MISSING } from '@/features/kyc/services/provider-verification-readiness';
import {
  applyKycTestingStatusOverride,
  isKycTestingMode,
} from '@/lib/kyc/kyc-testing-mode';
import { clearPrematureTier2Submission } from '@/features/kyc/services/clear-premature-tier2-submission';

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
      .orderBy(
        sql`CASE
          WHEN ${providerVerificationRecords.workflowReference} = 'nem-hybrid-tier2'
            OR ${providerVerificationRecords.normalizedResult}->>'verificationMode' = 'nem_hybrid_manual_review'
          THEN 0
          ELSE 1
        END`,
        desc(providerVerificationRecords.updatedAt)
      )
      .limit(1);

    const latestNormalized = (latestEvidence?.normalizedResult as Record<string, unknown> | null) ?? null;
    const isManualHybridEvidence =
      latestEvidence?.workflowReference === 'nem-hybrid-tier2' ||
      latestNormalized?.verificationMode === 'nem_hybrid_manual_review' ||
      (latestEvidence?.checksCompleted ?? []).includes('nem_documents_uploaded');

    let effectiveTier2SubmittedAt = vendorAfterCleanup?.tier2SubmittedAt ?? null;
    let effectiveTier2ApprovedAt = vendorAfterCleanup?.tier2ApprovedAt ?? null;

    // Self-heal vendors whose manual Tier 2 evidence was saved before the vendor row
    // status was reliably backfilled. Existing applicants should not have to resubmit.
    if (
      isManualHybridEvidence &&
      !effectiveTier2SubmittedAt &&
      !effectiveTier2ApprovedAt &&
      payloadStatusLooksSubmitted(latestEvidence?.status)
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
      !effectiveTier2ApprovedAt
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

    const payload = isKycTestingMode()
      ? applyKycTestingStatusOverride(kycStatus)
      : kycStatus;
    const authoritativeStatus =
      !isKycTestingMode() &&
      effectiveTier2SubmittedAt &&
      !effectiveTier2ApprovedAt &&
      payload.status !== 'approved' &&
      payload.status !== 'rejected'
        ? 'pending_review'
        : payload.status;

    return NextResponse.json(
      {
        status: authoritativeStatus,
        tier: payload.tier,
        submittedAt: kycStatus.submittedAt,
        approvedAt: kycStatus.approvedAt,
        expiresAt: kycStatus.expiresAt,
        rejectionReason: kycStatus.rejectionReason,
        rejectedSections: kycStatus.rejectedSections,
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
