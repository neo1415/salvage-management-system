import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { getProviderVerificationService } from '@/features/kyc/services/provider-verification.service';
import { getIpAddress } from '@/lib/utils/audit-logger';
import { isProviderVerificationStorageError, PROVIDER_VERIFICATION_MIGRATION_MISSING } from '@/features/kyc/services/provider-verification-readiness';
import { isKycTestingMode } from '@/lib/kyc/kyc-testing-mode';
import { resetVendorTier2ForTesting } from '@/features/kyc/services/kyc-testing-reset.service';
import { clearPrematureTier2Submission } from '@/features/kyc/services/clear-premature-tier2-submission';

/**
 * GET /api/kyc/widget-config
 * Returns Dojah widget configuration for the authenticated vendor.
 * Returns only safe browser-side widget configuration and non-secret profile prefill data.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const appId = process.env.DOJAH_APP_ID;
  const publicKey = process.env.DOJAH_PUBLIC_KEY;
  const widgetId = process.env.DOJAH_WIDGET_ID || process.env.DOJAH_EASYONBOARD_FLOW_ID;
  const workflowSlug = process.env.DOJAH_WORKFLOW_SLUG || 'salvage';

  if (!appId || !publicKey) {
    console.error('[KYC] Dojah credentials not configured');
    return NextResponse.json(
      { error: 'KYC service is not configured. Please contact support.' },
      { status: 503 }
    );
  }

  // Fetch vendor/user data needed for non-sensitive widget metadata and prefill.
  const [result] = await db
    .select({ 
      vendorId: vendors.id,
      dateOfBirth: users.dateOfBirth,
    })
    .from(vendors)
    .innerJoin(users, eq(vendors.userId, users.id))
    .where(eq(vendors.userId, session.user.id))
    .limit(1);

  // Format DOB as YYYY-MM-DD for Dojah
  let dob: string | undefined;
  if (result?.dateOfBirth) {
    const date = new Date(result.dateOfBirth);
    dob = date.toISOString().slice(0, 10);
  }

  if (!result?.vendorId) {
    return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 });
  }

  if (isKycTestingMode()) {
    await resetVendorTier2ForTesting(result.vendorId);
  } else {
    await clearPrematureTier2Submission(result.vendorId);
  }

  let workflow: { providerReference: string; created: boolean };
  try {
    workflow = await getProviderVerificationService().getOrCreatePendingWorkflow({
      userId: session.user.id,
      vendorId: result.vendorId,
      actorId: session.user.id,
      workflowSlug,
      ipAddress: getIpAddress(request.headers),
      userAgent: request.headers.get('user-agent') ?? 'unknown',
    });
  } catch (error) {
    if (isProviderVerificationStorageError(error)) {
      return NextResponse.json({ error: PROVIDER_VERIFICATION_MIGRATION_MISSING }, { status: 503 });
    }
    throw error;
  }

  console.info('[KYC] Dojah widget config loaded', {
    hasAppId: Boolean(appId),
    publicKeyMode: publicKey.startsWith('prod_') ? 'production' : publicKey.startsWith('test_') ? 'test' : 'unknown',
    hasWidgetId: Boolean(widgetId),
    hasVendorId: Boolean(result?.vendorId),
    hasPhone: Boolean(session.user.phone),
    hasDob: Boolean(dob),
    workflowSlug,
    hasVerificationReference: Boolean(workflow.providerReference),
    referenceCreated: workflow.created,
  });

  return NextResponse.json({
    appId,
    publicKey,
    widgetId: widgetId ?? null,
    phone: session.user.phone ?? undefined,
    dob: dob ?? undefined,
    vendorId: result?.vendorId,
    workflowSlug,
    verificationReference: workflow.providerReference,
    ...(isKycTestingMode() ? { kycTestingMode: true as const } : {}),
  });
}
