import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { eq } from 'drizzle-orm';
import { getKYCRepository } from '@/features/kyc/repositories/kyc.repository';
import { reconcileTier2FromDojah } from '@/features/kyc/services/dojah-reconcile.service';
import { buildDojahEvidenceSections } from '@/features/kyc/utils/provider-evidence-display';
import { getIpAddress } from '@/lib/utils/audit-logger';

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

  if (shouldRefresh) {
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

  const approval = await getKYCRepository().getPendingApprovalByVendorId(vendorId);

  if (!approval) {
    return NextResponse.json(
      { error: 'Application not found or already reviewed' },
      { status: 404 }
    );
  }

  const evidenceSections = approval.providerEvidence
    ? buildDojahEvidenceSections(
        (approval.providerEvidence.normalizedResult as Record<string, unknown> | null) ?? null,
        approval.providerEvidence
      )
    : null;

  const verificationSource = approval.providerEvidence
    ? 'dojah'
    : approval.ninVerificationData
      ? 'legacy_manual'
      : 'unknown';

  return NextResponse.json(
    {
      approval,
      verificationSource,
      evidenceSections,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
