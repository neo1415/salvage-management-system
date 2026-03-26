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
    .select({ id: vendors.id, businessName: vendors.businessName })
    .from(vendors)
    .where(eq(vendors.userId, userId))
    .limit(1);

  if (!vendor) {
    return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 });
  }

  const vendorId = vendor.id;
  const lockKey = `kyc:lock:${vendorId}`;

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
    const referenceId: string = body?.reference_id;

    if (!referenceId || typeof referenceId !== 'string') {
      return NextResponse.json({ error: 'reference_id is required' }, { status: 400 });
    }

    const dojah = getDojahService();
    const enc = getEncryptionService();
    const fraud = getFraudService();
    const repo = getKYCRepository();
    const audit = getKYCAuditService();
    const notify = getKYCNotificationService();

    // Log widget completion
    await audit.logWidgetLaunch(vendorId, userId, ipAddress);

    // Fetch full verification result from Dojah
    let verificationResult;
    try {
      verificationResult = await dojah.getVerificationResult(referenceId);
    } catch (err) {
      console.error('[KYC Complete] Dojah fetch failed', err);
      return NextResponse.json(
        { error: 'Verification service is temporarily unavailable. Please try again.' },
        { status: 503 }
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
    };

    // Persist to DB
    await repo.upsertVerificationData(vendorId, verificationData);

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

    // Determine auto-approve vs pending review
    const sanctionsMatch = (amlResult?.entity?.sanctions?.length ?? 0) > 0;
    const livenessPass = livenessScore === undefined || livenessScore >= 50;
    const biometricPass = biometricMatchScore === undefined || biometricMatchScore >= 80;
    const autoApprove = amlRiskLevel === 'Low' && livenessPass && biometricPass && !sanctionsMatch;

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
      return NextResponse.json({
        status: 'pending_review',
        message: 'Your application requires manual review.',
      });
    }

    if (autoApprove) {
      await repo.autoApprove(vendorId);
      await audit.logTierChange(vendorId, userId, 'tier1_bvn', 'tier2_full', 'auto_approved');
      await notify.sendKYCApprovalNotification(vendorTarget);
      return NextResponse.json({ status: 'approved', message: 'Tier 2 verification approved.' });
    }

    // Flagged for manual review
    await notify.sendKYCUnderReviewNotification(vendorTarget);
    return NextResponse.json({
      status: 'pending_review',
      message: 'Your application is under review. You will be notified within 24-48 hours.',
    });
  } finally {
    // Always release the lock
    await redis.del(lockKey);
  }
}
