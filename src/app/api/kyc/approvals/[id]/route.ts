import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { and, desc, eq } from 'drizzle-orm';
import { getKYCRepository } from '@/features/kyc/repositories/kyc.repository';
import { reconcileTier2FromDojah } from '@/features/kyc/services/dojah-reconcile.service';
import { buildDojahEvidenceSections } from '@/features/kyc/utils/provider-evidence-display';
import { getIpAddress } from '@/lib/utils/audit-logger';
import { isProviderVerificationStorageError, PROVIDER_VERIFICATION_MIGRATION_MISSING } from '@/features/kyc/services/provider-verification-readiness';
import { providerVerificationRecords } from '@/lib/db/schema/provider-verifications';

export const dynamic = 'force-dynamic';

/**
 * GET /api/kyc/approvals/[id]
 * Single vendor KYC review payload (legacy + Dojah provider evidence).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.role !== 'salvage_manager' && session.user.role !== 'system_admin') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const { id: vendorId } = await params;
  const shouldRefresh = request.nextUrl.searchParams.get('refresh') === '1';

  const [vendor] = await db
    .select({ id: vendors.id, userId: vendors.userId })
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);

  if (!vendor) {
    return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
  }

  let isManualHybrid = false;

  if (shouldRefresh) {
    const [latestProviderRecord] = await db
      .select({
        workflowReference: providerVerificationRecords.workflowReference,
        normalizedResult: providerVerificationRecords.normalizedResult,
      })
      .from(providerVerificationRecords)
      .where(
        and(
          eq(providerVerificationRecords.vendorId, vendorId),
          eq(providerVerificationRecords.provider, 'dojah'),
          eq(providerVerificationRecords.verificationType, 'tier2')
        )
      )
      .orderBy(desc(providerVerificationRecords.updatedAt))
      .limit(1);

    const normalized = (latestProviderRecord?.normalizedResult as Record<string, unknown> | null) ?? null;
    isManualHybrid =
      latestProviderRecord?.workflowReference === 'nem-hybrid-tier2' ||
      normalized?.verificationMode === 'nem_hybrid_manual_review';
  }

  if (shouldRefresh && !isManualHybrid) {
    await reconcileTier2FromDojah({
      vendorId,
      userId: vendor.userId,
      actorId: session.user.id,
      ipAddress: getIpAddress(request.headers),
      userAgent: request.headers.get('user-agent') ?? 'unknown',
    }).catch((error) => {
      console.error('[KYC Approval Detail] reconcile failed', {
        vendorId,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    });
  }

  let detail;
  try {
    detail = await getKYCRepository().getApprovalDetailByVendorId(vendorId);
  } catch (error) {
    if (isProviderVerificationStorageError(error)) {
      return NextResponse.json({ error: PROVIDER_VERIFICATION_MIGRATION_MISSING }, { status: 503 });
    }
    throw error;
  }

  if (!detail) {
    return NextResponse.json(
      { error: 'Application not found' },
      { status: 404 }
    );
  }

  const { approval, reviewStatus, rejectionReason } = detail;

  const evidenceSections = approval.providerEvidence
    ? buildDojahEvidenceSections(
        (approval.providerEvidence.normalizedResult as Record<string, unknown> | null) ?? null,
        approval.providerEvidence,
        { viewerRole: session.user.role === 'system_admin' ? 'system_admin' : 'salvage_manager' }
      )
    : null;

  const normalizedResult = (approval.providerEvidence?.normalizedResult as Record<string, unknown> | null) ?? null;
  const verificationSource = normalizedResult?.verificationMode === 'nem_hybrid_manual_review'
    ? 'manual_hybrid'
    : approval.providerEvidence
      ? 'dojah'
      : approval.ninVerificationData
        ? 'legacy_manual'
        : 'unknown';

  return NextResponse.json(
    {
      approval,
      reviewStatus,
      rejectionReason,
      verificationSource,
      evidenceSections,
      viewerRole: session.user.role,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
