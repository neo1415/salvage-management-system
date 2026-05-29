import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { eq } from 'drizzle-orm';
import { redis } from '@/lib/redis/client';
import { getDojahService } from '@/features/kyc/services/dojah.service';
import { getEncryptionService } from '@/features/kyc/services/encryption.service';
import { getFraudService } from '@/features/kyc/services/fraud.service';
import { getKYCRepository } from '@/features/kyc/repositories/kyc.repository';
import { getKYCAuditService } from '@/features/kyc/services/audit.service';
import { getKYCNotificationService } from '@/features/kyc/services/notification.service';
import { getIpAddress } from '@/lib/utils/audit-logger';
import type { KYCVerificationData } from '@/features/kyc/types/kyc.types';
import { normalizeDojahWorkflowResult } from '@/features/kyc/services/dojah-normalizer.service';
import { getProviderVerificationService } from '@/features/kyc/services/provider-verification.service';
import { assertProviderVerificationStorageReady, isProviderVerificationStorageError, PROVIDER_VERIFICATION_MIGRATION_MISSING } from '@/features/kyc/services/provider-verification-readiness';
import { ingestDojahMediaForVendor } from '@/features/kyc/services/dojah-media-ingest.service';
import { createRoleNotifications } from '@/features/notifications/services/notification.service';
import { logAction, AuditActionType, AuditEntityType, DeviceType } from '@/lib/utils/audit-logger';
import {
  getTier2AutoReviewEnabled,
  isCleanTier2Verification,
} from '@/features/kyc/services/tier2-review-settings.service';
import { appPath } from '@/features/notifications/templates/email-urls';
import { isTier2ReadyForVendorSubmission } from '@/features/kyc/services/tier2-submission-readiness';
import { businessPolicyService } from '@/features/business-policy';

const LOCK_TTL_SECONDS = 300; // 5 minutes

/**
 * POST /api/kyc/complete
 * Called by the Tier 2 KYC page after the Dojah widget onSuccess callback.
 * Accepts { reference_id }, fetches full result from Dojah, processes and stores it.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const ipAddress = getIpAddress(request.headers);

  // Get vendor record
  const [vendor] = await db
    .select({
      id: vendors.id,
      businessName: vendors.businessName,
      cacNumber: vendors.cacNumber,
      businessType: vendors.businessType,
      bvnVerifiedAt: vendors.bvnVerifiedAt,
      registrationFeePaid: vendors.registrationFeePaid,
    })
    .from(vendors)
    .where(eq(vendors.userId, userId))
    .limit(1);

  if (!vendor) {
    return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 });
  }

  const vendorId = vendor.id;
  const lockKey = `kyc:lock:${vendorId}`;
  try {
    await assertProviderVerificationStorageReady();
  } catch (error) {
    if (isProviderVerificationStorageError(error)) {
      return NextResponse.json({ error: PROVIDER_VERIFICATION_MIGRATION_MISSING }, { status: 503 });
    }
    throw error;
  }

  // Acquire Redis lock — prevent concurrent submissions
  const locked = await redis.set(lockKey, '1', { nx: true, ex: LOCK_TTL_SECONDS });
  if (!locked) {
    return NextResponse.json(
      { error: 'Verification already in progress. Please wait and try again.' },
      { status: 409 }
    );
  }

  try {
    const body = await request.json();
    const referenceId: string = body?.reference_id || body?.referenceId || body?.reference || body?.verification_reference;
    const widgetCompleted = body?.widget_completed === true;

    if (!referenceId || typeof referenceId !== 'string') {
      return NextResponse.json({ error: 'reference_id is required' }, { status: 400 });
    }

    if (!widgetCompleted) {
      return NextResponse.json(
        {
          error: 'verification_incomplete',
          message:
            'Verification was not completed in the identity window. Finish all steps or close and use Start Verification again.',
          errorSource: 'app',
        },
        { status: 409 }
      );
    }

    const dojah = getDojahService();
    const enc = getEncryptionService();
    const fraud = getFraudService();
    const repo = getKYCRepository();
    const audit = getKYCAuditService();
    const notify = getKYCNotificationService();
    const providerService = getProviderVerificationService();
    const policy = await businessPolicyService.getEffectivePolicy();

    // Log widget completion
    await audit.logWidgetLaunch(vendorId, userId, ipAddress);
    await audit.log({
      vendorId,
      actorId: userId,
      action: AuditActionType.DOJAH_KYC_COMPLETED,
      ipAddress,
      userAgent: request.headers.get('user-agent') ?? 'unknown',
      afterState: { provider: 'dojah', providerReference: referenceId, source: 'frontend_callback' },
    });

    // Fetch full verification result from Dojah
    let verificationResult;
    try {
      verificationResult = await dojah.getVerificationResult(referenceId);
    } catch (err) {
      console.error('[KYC Complete] Dojah fetch failed', {
        message: err instanceof Error ? err.message : 'Unknown Dojah fetch error',
        providerReference: referenceId,
      });

      return NextResponse.json(
        {
          error: 'verification_pending',
          message:
            'We could not load your verification result yet. Continue in the identity window if it is still open, or wait a minute and try again.',
          errorSource: 'identity_provider',
        },
        { status: 503 }
      );
    }

    const normalizedPreview = normalizeDojahWorkflowResult(verificationResult);
    if (!isTier2ReadyForVendorSubmission(verificationResult, normalizedPreview)) {
      return NextResponse.json(
        {
          error: 'verification_incomplete',
          message:
            'Identity verification is not finished yet. Complete every step in the verification window before leaving the page.',
          errorSource: 'app',
        },
        { status: 409 }
      );
    }

    // Extract NIN entity
    const ninEntity = verificationResult.data?.government_data?.data?.nin?.entity;
    const selfieData = verificationResult.data?.selfie?.data;
    const idData = verificationResult.data?.id?.data?.id_data;

    // Encrypt NIN if present
    let ninEncrypted: string | undefined;
    if (ninEntity?.nin) {
      try {
        ninEncrypted = enc.encrypt(ninEntity.nin);
      } catch {
        console.warn('[KYC Complete] NIN encryption failed');
      }
    }

    const livenessScore = selfieData?.liveness_score ?? undefined;
    const biometricMatchScore = selfieData?.match_score ?? undefined;
    const now = new Date();

    // Run AML screening
    let amlResult;
    let amlRiskLevel: 'Low' | 'Medium' | 'High' = 'Low';
    const fullName = ninEntity
      ? `${ninEntity.firstname ?? ''} ${ninEntity.surname ?? ''}`.trim()
      : session.user.name ?? '';
    const dob = ninEntity?.birthdate ?? '';

    try {
      amlResult = await dojah.screenAML(fullName, dob);
      amlRiskLevel = fraud.classifyAMLRisk(amlResult);
    } catch (err) {
      console.error('[KYC Complete] AML screening failed', err);
      // Non-fatal — continue with Low risk but flag for review
    }

    // Calculate fraud score and flags
    const fraudSignals = {
      livenessScore,
      biometricMatchScore,
      amlRiskLevel,
    };
    const fraudRiskScore = fraud.calculateFraudScore(fraudSignals);
    const fraudFlags = fraud.detectFraudFlags(fraudSignals);
    const normalizedResult = normalizeDojahWorkflowResult(verificationResult, amlResult ?? null);
    const media = await ingestDojahMediaForVendor({
      vendorId,
      userId,
      providerReference: normalizedResult.providerReference || referenceId,
      verificationResult,
    }).catch((error) => {
      console.warn('[KYC Complete] Dojah media ingest failed', {
        providerReference: referenceId,
        message: error instanceof Error ? error.message : 'Unknown media ingest error',
      });
      return null;
    });
    normalizedResult.normalizedResult = {
      ...normalizedResult.normalizedResult,
      nemSubmittedProfile: {
        fullName: session.user.name ?? null,
        email: session.user.email ?? null,
        phone: session.user.phone ? maskPhone(session.user.phone) : null,
        businessName: vendor.businessName ?? null,
        businessType: vendor.businessType ?? null,
        businessRegistrationNumber: maskIdentifier(vendor.cacNumber),
        bvnAlreadyVerified: Boolean(vendor.bvnVerifiedAt),
        registrationFeePaid: Boolean(vendor.registrationFeePaid),
      },
      dojahMedia: media
        ? {
            assets: media.assets.map((asset) => ({
              type: asset.type,
              sourceKey: asset.sourceKey,
              storedUrl: asset.storedUrl,
            })),
            diagnostics: media.diagnostics,
            profilePictureImported: Boolean(media.profilePictureUrl),
          }
        : null,
    };
    await providerService.persistVerification({
      userId,
      vendorId,
      actorId: userId,
      result: normalizedResult,
      rawPayload: { verificationResult, amlResult },
      ipAddress,
      userAgent: request.headers.get('user-agent') ?? 'unknown',
    });
    await logAction({
      userId,
      actionType: AuditActionType.PROVIDER_VERIFICATION_STORED,
      entityType: AuditEntityType.KYC,
      entityId: vendorId,
      ipAddress,
      deviceType: DeviceType.DESKTOP,
      userAgent: request.headers.get('user-agent') ?? 'unknown',
      afterState: {
        provider: 'dojah',
        providerReference: normalizedResult.providerReference || referenceId,
        event: 'evidence_stored',
      },
    });
    void dojah.sendEasyDetectOnboardingEvent({
      userId,
      email: session.user.email ?? undefined,
      name: session.user.name ?? undefined,
      mobile: session.user.phone ?? undefined,
      registrationTime: new Date().toISOString(),
      tier: 'tier1_bvn',
      ipAddress,
      deviceType: request.headers.get('user-agent')?.includes('Mobile') ? 'mobile' : 'desktop',
    }).catch((error) => {
      console.error('[KYC Complete] EasyDetect onboarding event failed', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    });

    // Build verification data
    const verificationData: KYCVerificationData = {
      dojahReferenceId: referenceId,
      ninEncrypted,
      ninVerificationData: ninEntity ? (ninEntity as unknown as Record<string, unknown>) : undefined,
      ninVerifiedAt: ninEntity ? now : undefined,
      selfieUrl: selfieData?.selfie_url ?? verificationResult.selfie_url ?? undefined,
      livenessScore,
      biometricMatchScore,
      biometricVerifiedAt: biometricMatchScore !== undefined ? now : undefined,
      photoIdUrl: verificationResult.id_url ?? undefined,
      photoIdType: idData?.document_type ?? undefined,
      photoIdVerifiedAt: idData ? now : undefined,
      amlScreeningData: amlResult ? (amlResult as unknown as Record<string, unknown>) : undefined,
      amlRiskLevel,
      amlScreenedAt: amlResult ? now : undefined,
      fraudRiskScore,
      fraudFlags,
      tier2SubmittedAt: now,
      ...(media?.verificationData ?? {}),
    };

    // Persist to DB
    await repo.upsertVerificationData(vendorId, verificationData);
    await audit.log({
      vendorId,
      actorId: userId,
      action: AuditActionType.VENDOR_TIER2_PENDING_REVIEW,
      ipAddress,
      userAgent: request.headers.get('user-agent') ?? 'unknown',
      afterState: { provider: 'dojah', providerReference: referenceId },
    });

    // Record cost
    await repo.recordVerificationCost(vendorId, {
      verificationType: 'tier2_full_verification',
      costAmount: '510.00',
      currency: 'NGN',
      dojahReferenceId: referenceId,
    });

    // Log verification result
    await audit.logVerificationResult(vendorId, userId, referenceId, {
      livenessScore,
      biometricMatchScore,
      amlRiskLevel,
    });

    // Identity verification is evidence. NEM Salvage remains the final review authority.
    const sanctionsMatch = (amlResult?.entity?.sanctions?.length ?? 0) > 0;

    const vendorTarget = {
      vendorId,
      userId,
      phone: session.user.phone ?? '',
      email: session.user.email ?? '',
      fullName: session.user.name ?? '',
    };

    if (sanctionsMatch) {
      // Auto-reject — sanctions match
      await repo.upsertVerificationData(vendorId, {
        ...verificationData,
        // Keep as pending — manager must confirm rejection
      });
      await notify.sendKYCUnderReviewNotification(vendorTarget);
      await createRoleNotifications(['salvage_manager', 'system_admin'], {
        type: 'tier2_pending_review',
        title: 'High-risk KYC review required',
        message: `${session.user.name || 'A vendor'} submitted KYC with an AML/sanctions signal.`,
        data: { vendorId, providerReference: referenceId, url: `/manager/kyc-approvals/${vendorId}` },
      }).catch((error) => console.error('[KYC Complete] manager notification failed', error));
      await notify.sendTier2SubmissionManagerEmails({
        vendorName: session.user.name ?? 'Vendor',
        businessName: vendor.businessName,
        riskLevel: 'High',
        reviewUrl: appPath(`/manager/kyc-approvals/${vendorId}`),
        outcome: 'pending_review',
        reason: 'AML/sanctions signal',
      });
      return NextResponse.json({
        status: 'pending_review',
        message: 'Your application requires manual review.',
      });
    }

    const automaticReviewEnabled = await getTier2AutoReviewEnabled();
    const policyAllowsAutoApproval =
      policy.onboarding.finalTier2Decision === 'manual_review'
        ? !policy.kyc.providerPassRequiresInternalReview
        : false;
    const canAutoApprove = automaticReviewEnabled && isCleanTier2Verification({
      failedChecks: normalizedResult.failedChecks,
      pendingChecks: normalizedResult.pendingChecks,
      reasonCodes: normalizedResult.reasonCodes,
      amlRiskLevel,
      fraudRiskScore,
      livenessScore,
      biometricMatchScore,
    }) && policyAllowsAutoApproval;

    if (canAutoApprove) {
      await repo.autoApprove(vendorId);
      const emailResult = await notify.sendKYCApprovalNotification(vendorTarget);
      await createRoleNotifications(['salvage_manager', 'system_admin'], {
        type: 'system_alert',
        title: 'Tier 2 KYC Auto-Approved',
        message: `${session.user.name || 'A vendor'} completed a clean Tier 2 verification and was automatically approved.`,
        data: { vendorId, providerReference: referenceId, url: `/manager/kyc-approvals/${vendorId}` },
      }).catch((error) => console.error('[KYC Complete] manager notification failed', error));
      await notify.sendTier2SubmissionManagerEmails({
        vendorName: session.user.name ?? 'Vendor',
        businessName: vendor.businessName,
        riskLevel: amlRiskLevel,
        reviewUrl: appPath(`/manager/kyc-approvals/${vendorId}`),
        outcome: 'auto_approved',
      });
      await audit.log({
        vendorId,
        actorId: userId,
        action: AuditActionType.VENDOR_TIER2_APPROVED,
        ipAddress,
        userAgent: request.headers.get('user-agent') ?? 'unknown',
        afterState: {
          provider: 'dojah',
          providerReference: referenceId,
          reviewMode: 'automatic',
          emailSent: emailResult.emailSent,
          emailError: emailResult.emailError,
        },
      });

      return NextResponse.json({
        status: 'approved',
        message: 'Your Tier 2 verification has been approved.',
      });
    }

    await notify.sendKYCUnderReviewNotification(vendorTarget);
    await createRoleNotifications(['salvage_manager', 'system_admin'], {
      type: 'tier2_pending_review',
      title: 'Tier 2 KYC Ready for Review',
      message: `${session.user.name || 'A vendor'} completed identity verification and is ready for review.`,
      data: { vendorId, providerReference: referenceId, url: `/manager/kyc-approvals/${vendorId}` },
    }).catch((error) => console.error('[KYC Complete] manager notification failed', error));
    await notify.sendTier2SubmissionManagerEmails({
      vendorName: session.user.name ?? 'Vendor',
      businessName: vendor.businessName,
      riskLevel: amlRiskLevel,
      reviewUrl: appPath(`/manager/kyc-approvals/${vendorId}`),
      outcome: 'pending_review',
    });

    return NextResponse.json({
      status: 'pending_review',
      message: 'Your application is under review. You will be notified once review is complete.',
    });
  } finally {
    // Always release the lock
    await redis.del(lockKey);
  }
}

function maskIdentifier(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  if (text.length <= 4) return '*'.repeat(text.length);
  return `${'*'.repeat(Math.max(0, text.length - 4))}${text.slice(-4)}`;
}

function maskPhone(value: string): string {
  const text = value.trim();
  if (text.length <= 4) return '*'.repeat(text.length);
  return `${text.slice(0, 4)}${'*'.repeat(Math.max(0, text.length - 7))}${text.slice(-3)}`;
}
