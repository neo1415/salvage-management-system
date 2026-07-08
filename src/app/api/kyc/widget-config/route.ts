import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { getProviderVerificationService } from '@/features/kyc/services/provider-verification.service';
import { AuditEntityType, getDeviceTypeFromUserAgent, getIpAddress } from '@/lib/utils/audit-logger';
import { isProviderVerificationStorageError, PROVIDER_VERIFICATION_MIGRATION_MISSING } from '@/features/kyc/services/provider-verification-readiness';
import { isKycTestingMode } from '@/lib/kyc/kyc-testing-mode';
import { resetVendorTier2ForTesting } from '@/features/kyc/services/kyc-testing-reset.service';
import { clearPrematureTier2Submission } from '@/features/kyc/services/clear-premature-tier2-submission';
import { buildDojahReference } from '@/features/kyc/utils/dojah-reference';
import {
  businessPolicyService,
  getBusinessPolicyRuntimeMode,
  isBusinessPolicyEnforcementEnabled,
  isOnboardingPolicyEnforced,
  logPolicyDecision,
  resolveTier2Access,
} from '@/features/business-policy';

/**
 * GET /api/kyc/widget-config
 * Returns Dojah widget configuration for the authenticated vendor.
 * Returns only safe browser-side widget configuration and non-secret profile prefill data.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const appId = process.env.DOJAH_APP_ID;
  const publicKey = process.env.DOJAH_PUBLIC_KEY;
  const widgetId = process.env.DOJAH_WIDGET_ID || process.env.DOJAH_EASYONBOARD_FLOW_ID;
  const workflowSlug = process.env.DOJAH_WORKFLOW_SLUG || 'salvage';
  const requestUrl = request.nextUrl ?? new URL(request.url);
  const mode = requestUrl.searchParams.get('mode');
  const livenessWidgetId =
    process.env.DOJAH_LIVENESS_WIDGET_ID ||
    process.env.DOJAH_LIVENESS_FLOW_ID ||
    process.env.DOJAH_WIDGET_ID ||
    process.env.DOJAH_EASYONBOARD_FLOW_ID;

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
      vendorTier: vendors.tier,
      businessName: vendors.businessName,
      cacNumber: vendors.cacNumber,
      businessType: vendors.businessType,
      bvnVerifiedAt: vendors.bvnVerifiedAt,
      registrationFeePaid: vendors.registrationFeePaid,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
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

  const policy = await businessPolicyService.getEffectivePolicy();
  const tier2AccessDecision = resolveTier2Access(policy, {
    tier: result.vendorTier === 'tier2_full' ? 'tier2_full' : result.vendorTier === 'tier1_bvn' ? 'tier1_bvn' : 'tier0',
    bvnVerified: Boolean(result.bvnVerifiedAt),
    registrationFeePaid: Boolean(result.registrationFeePaid),
  });
  await logPolicyDecision({
    userId: session.user.id,
    entityType: AuditEntityType.KYC,
    entityId: result.vendorId,
    ipAddress: getIpAddress(request.headers),
    userAgent: request.headers.get('user-agent') ?? 'unknown',
    deviceType: getDeviceTypeFromUserAgent(request.headers.get('user-agent') ?? 'unknown'),
    decision: tier2AccessDecision.decision,
    context: {
      source: 'api/kyc/widget-config',
      runtimeMode: getBusinessPolicyRuntimeMode(),
    },
  }).catch((error) => {
    console.warn('[BusinessPolicy] Failed to audit Tier 2 widget access decision', {
      vendorId: result.vendorId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  });

  if (!tier2AccessDecision.allowed && (isOnboardingPolicyEnforced() || isBusinessPolicyEnforcementEnabled())) {
    return NextResponse.json(
      {
        error: 'tier2_not_available',
        message: tier2AccessDecision.message,
        reason: tier2AccessDecision.value,
      },
      { status: 403 }
    );
  }

  if (mode === 'liveness') {
    if (!livenessWidgetId) {
      console.error('[KYC] Liveness widget is not configured', {
        hasDedicatedLivenessWidget: Boolean(process.env.DOJAH_LIVENESS_WIDGET_ID || process.env.DOJAH_LIVENESS_FLOW_ID),
        hasDefaultWidget: Boolean(process.env.DOJAH_WIDGET_ID || process.env.DOJAH_EASYONBOARD_FLOW_ID),
      });
      return NextResponse.json(
        {
          error: 'liveness_widget_not_configured',
          message: 'Liveness verification is not configured. Please contact support.',
        },
        { status: 503 }
      );
    }
    if (!process.env.DOJAH_LIVENESS_WIDGET_ID && !process.env.DOJAH_LIVENESS_FLOW_ID) {
      console.warn('[KYC] Using default Dojah widget for liveness mode. Set DOJAH_LIVENESS_WIDGET_ID for an explicit liveness-only workflow.');
    }

    const nameParts = parseName(result.fullName);
    const livenessReference = `${buildDojahReference(result.vendorId)}-live`;
    return NextResponse.json({
      appId,
      publicKey,
      widgetId: livenessWidgetId,
      phone: result.phone ?? session.user.phone ?? undefined,
      dob: dob ?? undefined,
      vendorId: result.vendorId,
      workflowSlug: 'nem-hybrid-liveness',
      verificationReference: livenessReference,
      livenessOnly: true,
      profile: {
        fullName: result.fullName,
        firstName: nameParts.firstName,
        middleName: nameParts.middleName,
        lastName: nameParts.lastName,
        email: result.email ?? session.user.email ?? undefined,
        phone: result.phone ?? session.user.phone ?? undefined,
        dateOfBirth: dob ?? undefined,
        businessName: result.businessName ?? undefined,
        businessType: result.businessType ?? undefined,
        businessRegistrationNumberMasked: maskIdentifier(result.cacNumber),
        hasBusinessRegistrationNumber: Boolean(result.cacNumber),
        bvnAlreadyVerified: Boolean(result.bvnVerifiedAt),
        registrationFeePaid: Boolean(result.registrationFeePaid),
      },
      requirements: {
        bvnRequiredInThisFlow: false,
        businessData: false,
        governmentId: false,
        liveness: true,
        address: false,
        amlScreening: false,
        duplicateIdentityCheck: false,
        manualReview: true,
      },
      ...(isKycTestingMode() ? { kycTestingMode: true as const } : {}),
    });
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

  const nameParts = parseName(result.fullName);
  const requirements = {
    bvnRequiredInThisFlow: policy.onboarding.mode === 'single_full_kyc' && policy.kyc.tier1RequiresBvn,
    businessData: policy.kyc.tier2RequiresBusinessData,
    governmentId: policy.kyc.tier2RequiresGovernmentId,
    liveness: policy.kyc.tier2RequiresLiveness,
    address: policy.kyc.tier2RequiresAddress,
    amlScreening: policy.kyc.tier2RequiresAmlScreening,
    duplicateIdentityCheck: policy.kyc.tier2RequiresDuplicateIdentityCheck,
    manualReview: policy.kyc.providerPassRequiresInternalReview || policy.onboarding.finalTier2Decision === 'manual_review',
  };

  return NextResponse.json({
    appId,
    publicKey,
    widgetId: widgetId ?? null,
    phone: result.phone ?? session.user.phone ?? undefined,
    dob: dob ?? undefined,
    vendorId: result?.vendorId,
    workflowSlug,
    verificationReference: workflow.providerReference,
    profile: {
      fullName: result.fullName,
      firstName: nameParts.firstName,
      middleName: nameParts.middleName,
      lastName: nameParts.lastName,
      email: result.email ?? session.user.email ?? undefined,
      phone: result.phone ?? session.user.phone ?? undefined,
      dateOfBirth: dob ?? undefined,
      businessName: result.businessName ?? undefined,
      businessType: result.businessType ?? undefined,
      businessRegistrationNumberMasked: maskIdentifier(result.cacNumber),
      hasBusinessRegistrationNumber: Boolean(result.cacNumber),
      bvnAlreadyVerified: Boolean(result.bvnVerifiedAt),
      registrationFeePaid: Boolean(result.registrationFeePaid),
    },
    requirements,
    ...(isKycTestingMode() ? { kycTestingMode: true as const } : {}),
  });
}

function parseName(fullName: string | null): { firstName?: string; middleName?: string; lastName?: string } {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return {};
  if (parts.length === 1) return { firstName: parts[0] };
  if (parts.length === 2) return { firstName: parts[0], lastName: parts[1] };
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
}

function maskIdentifier(value: string | null | undefined): string | undefined {
  const text = value?.trim();
  if (!text) return undefined;
  if (text.length <= 4) return '*'.repeat(text.length);
  return `${'*'.repeat(Math.max(0, text.length - 4))}${text.slice(-4)}`;
}
