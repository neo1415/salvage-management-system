import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { vendors } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getKYCRepository } from '@/features/kyc/repositories/kyc.repository';
import { reconcileTier2FromDojah } from '@/features/kyc/services/dojah-reconcile.service';
import { getIpAddress } from '@/lib/utils/audit-logger';
import { isProviderVerificationStorageError, PROVIDER_VERIFICATION_MIGRATION_MISSING } from '@/features/kyc/services/provider-verification-readiness';
import {
  applyKycTestingStatusOverride,
  isKycTestingMode,
} from '@/lib/kyc/kyc-testing-mode';

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
      .select({ id: vendors.id })
      .from(vendors)
      .where(eq(vendors.userId, session.user.id))
      .limit(1);

    if (!vendorRow) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    if (!isKycTestingMode()) {
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

    return NextResponse.json(
      {
        status: payload.status,
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
