import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { eq } from 'drizzle-orm';
import { reconcileTier2FromDojah } from '@/features/kyc/services/dojah-reconcile.service';
import { getKYCRepository } from '@/features/kyc/repositories/kyc.repository';
import { buildDojahEvidenceSections } from '@/features/kyc/utils/provider-evidence-display';
import { getIpAddress } from '@/lib/utils/audit-logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/kyc/approvals/[id]/refresh-evidence
 * Salvage Manager / System Admin: pull latest Dojah result by stored reference.
 */
export async function POST(
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
  const body = await request.json().catch(() => ({}));
  const explicitReference =
    typeof body?.reference_id === 'string'
      ? body.reference_id
      : typeof body?.providerReference === 'string'
        ? body.providerReference
        : undefined;

  const [vendor] = await db
    .select({ id: vendors.id, userId: vendors.userId })
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);

  if (!vendor) {
    return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
  }

  const reconcileResult = await reconcileTier2FromDojah({
    vendorId,
    userId: vendor.userId,
    actorId: session.user.id,
    ipAddress: getIpAddress(request.headers),
    userAgent: request.headers.get('user-agent') ?? 'unknown',
    explicitReference,
  });

  const approval = await getKYCRepository().getPendingApprovalByVendorId(vendorId);
  const evidenceSections = approval?.providerEvidence
    ? buildDojahEvidenceSections(
        (approval.providerEvidence.normalizedResult as Record<string, unknown> | null) ?? null,
        approval.providerEvidence,
        { viewerRole: session.user.role === 'system_admin' ? 'system_admin' : 'salvage_manager' }
      )
    : null;

  return NextResponse.json({
    reconcile: reconcileResult,
    approval: approval ?? null,
    evidenceSections,
    viewerRole: session.user.role,
  });
}
