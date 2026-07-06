import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { providerVerificationRecords } from '@/lib/db/schema/provider-verifications';
import { getDojahService } from '@/features/kyc/services/dojah.service';
import { normalizeDojahWorkflowResult } from '@/features/kyc/services/dojah-normalizer.service';
import { getProviderVerificationService } from '@/features/kyc/services/provider-verification.service';
import { getKYCRepository } from '@/features/kyc/repositories/kyc.repository';
import { getKYCNotificationService } from '@/features/kyc/services/notification.service';
import { createRoleNotifications } from '@/features/notifications/services/notification.service';
import { logAction, AuditActionType, AuditEntityType, DeviceType, getIpAddress } from '@/lib/utils/audit-logger';
import type { NormalizedVerificationResult } from '@/features/kyc/types/provider-verification.types';
import { extractVendorIdFromDojahReference } from '@/features/kyc/utils/dojah-reference';
import { isProviderVerificationStorageError, PROVIDER_VERIFICATION_MIGRATION_MISSING } from '@/features/kyc/services/provider-verification-readiness';
import { appPath } from '@/features/notifications/templates/email-urls';
import { getTier2SubmissionReadiness } from '@/features/kyc/services/tier2-submission-readiness';
import { businessPolicyService } from '@/features/business-policy';

export const dynamic = 'force-dynamic';

const DojahWebhookSchema = z.object({
  event: z.string().optional(),
  event_type: z.string().optional(),
  type: z.string().optional(),
  id: z.string().optional(),
  event_id: z.string().optional(),
  reference_id: z.string().optional(),
  reference: z.string().optional(),
  verification_reference: z.string().optional(),
  workflow_reference: z.string().optional(),
  referenceId: z.string().optional(),
  customer_reference: z.string().optional(),
  status: z.union([z.string(), z.boolean()]).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

export async function GET() {
  return NextResponse.json({ ok: true, provider: 'dojah' });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

function timingSafeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function verifyWebhookSecret(request: NextRequest, rawBody: string): boolean {
  const secret = process.env.DOJAH_WEBHOOK_SECRET;
  if (!secret) {
    // Local sandbox/dev webhooks can be tested without a secret, but production must fail closed.
    return process.env.NODE_ENV !== 'production';
  }

  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const tokenHeader = request.headers.get('x-dojah-webhook-secret');
  const tokenQuery = request.nextUrl.searchParams.get('secret');

  if (bearer && timingSafeEqual(bearer, secret)) return true;
  if (tokenHeader && timingSafeEqual(tokenHeader, secret)) return true;
  if (tokenQuery && timingSafeEqual(tokenQuery, secret)) return true;

  const signature = request.headers.get('x-dojah-signature') || request.headers.get('x-signature');
  if (signature) {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const normalized = signature.replace(/^sha256=/i, '');
    return timingSafeEqual(normalized, expected);
  }

  return false;
}

function stringFrom(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isCompletionLikeWebhook(payload: z.infer<typeof DojahWebhookSchema>, eventType: string): boolean {
  const status = String(payload.status ?? payload.data?.status ?? payload.data?.verification_status ?? '').toLowerCase();
  const event = eventType.toLowerCase();
  return [
    event,
    status,
  ].some((value) =>
    value.includes('complete') ||
    value.includes('completed') ||
    value.includes('success') ||
    value.includes('pass') ||
    value.includes('fail') ||
    value.includes('pending') ||
    value.includes('review') ||
    value.includes('manual') ||
    value.includes('submitted')
  );
}

function withProviderReference(
  result: NormalizedVerificationResult,
  providerReference?: string,
  workflowReference?: string
): NormalizedVerificationResult {
  return {
    ...result,
    providerReference: result.providerReference || providerReference,
    workflowReference: result.workflowReference || workflowReference || providerReference,
  };
}

async function resolveVendor(payload: z.infer<typeof DojahWebhookSchema>, providerReference?: string) {
  const metadata = payload.metadata ?? (payload.data?.metadata as Record<string, unknown> | undefined) ?? {};
  const userId = stringFrom(metadata.user_id) || stringFrom(metadata.userId);
  const vendorId = stringFrom(metadata.vendor_id) || stringFrom(metadata.vendorId);

  if (vendorId) {
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (vendor) return vendor;
  }

  if (userId) {
    const [vendor] = await db.select().from(vendors).where(eq(vendors.userId, userId)).limit(1);
    if (vendor) return vendor;
  }

  if (providerReference) {
    const vendorIdFromReference = extractVendorIdFromDojahReference(providerReference);
    if (vendorIdFromReference) {
      const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorIdFromReference)).limit(1);
      if (vendor) return vendor;
    }

    const [record] = await db
      .select({ vendorId: providerVerificationRecords.vendorId, userId: providerVerificationRecords.userId })
      .from(providerVerificationRecords)
      .where(eq(providerVerificationRecords.providerReference, providerReference))
      .limit(1);

    if (record?.vendorId) {
      const [vendor] = await db.select().from(vendors).where(eq(vendors.id, record.vendorId)).limit(1);
      if (vendor) return vendor;
    }

    if (record?.userId) {
      const [vendor] = await db.select().from(vendors).where(eq(vendors.userId, record.userId)).limit(1);
      if (vendor) return vendor;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const providerService = getProviderVerificationService();
  const ipAddress = getIpAddress(request.headers);
  const userAgent = request.headers.get('user-agent') ?? 'unknown';

  let payload: z.infer<typeof DojahWebhookSchema>;
  try {
    payload = DojahWebhookSchema.parse(JSON.parse(rawBody));
  } catch {
    console.error('[Dojah Webhook] Invalid payload shape');
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const eventType = payload.event || payload.event_type || payload.type || 'unknown';
  const providerReference =
    payload.reference_id ||
    payload.referenceId ||
    payload.reference ||
    payload.customer_reference ||
    payload.verification_reference ||
    stringFrom(payload.metadata?.reference_id) ||
    stringFrom(payload.metadata?.referenceId) ||
    stringFrom(payload.metadata?.customer_reference) ||
    stringFrom(payload.data?.reference_id) ||
    stringFrom(payload.data?.referenceId) ||
    stringFrom(payload.data?.reference) ||
    stringFrom(payload.data?.customer_reference);
  const workflowReference = payload.workflow_reference || providerReference;
  const eventId =
    payload.event_id ||
    payload.id ||
    `${eventType}:${providerReference || crypto.createHash('sha256').update(rawBody).digest('hex')}`;

  const signatureValid = verifyWebhookSecret(request, rawBody);
  if (!signatureValid) {
    await logAction({
      userId: await getSystemActorId(),
      actionType: AuditActionType.DOJAH_WEBHOOK_SIGNATURE_FAILED,
      entityType: AuditEntityType.KYC,
      entityId: providerReference || eventId,
      ipAddress,
      deviceType: DeviceType.DESKTOP,
      userAgent,
      afterState: { provider: 'dojah', eventType, providerReference },
    });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let duplicate = false;
  try {
    ({ duplicate } = await providerService.recordWebhookEvent({
      provider: 'dojah',
      eventId,
      eventType,
      providerReference,
      workflowReference,
      signatureValid,
      rawPayload: payload,
    }));
  } catch (error) {
    if (isProviderVerificationStorageError(error)) {
      console.error('[Dojah Webhook] Provider verification migration missing', { providerReference, eventType });
      return NextResponse.json({ error: PROVIDER_VERIFICATION_MIGRATION_MISSING }, { status: 503 });
    }
    throw error;
  }

  const systemActorId = await getSystemActorId();

  if (duplicate) {
    await logAction({
      userId: systemActorId,
      actionType: AuditActionType.DOJAH_WEBHOOK_DUPLICATE_IGNORED,
      entityType: AuditEntityType.KYC,
      entityId: providerReference || eventId,
      ipAddress,
      deviceType: DeviceType.DESKTOP,
      userAgent,
      afterState: { provider: 'dojah', eventType, providerReference },
    });
    return NextResponse.json({ ok: true, duplicate: true });
  }

  await logAction({
    userId: systemActorId,
    actionType: AuditActionType.DOJAH_WEBHOOK_RECEIVED,
    entityType: AuditEntityType.KYC,
    entityId: providerReference || eventId,
    ipAddress,
    deviceType: DeviceType.DESKTOP,
    userAgent,
    afterState: { provider: 'dojah', eventType, providerReference },
  });

  try {
    const vendor = await resolveVendor(payload, providerReference);
    if (!vendor) {
      await logAction({
        userId: systemActorId,
        actionType: AuditActionType.DOJAH_WEBHOOK_UNMATCHED,
        entityType: AuditEntityType.KYC,
        entityId: providerReference || eventId,
        ipAddress,
        deviceType: DeviceType.DESKTOP,
        userAgent,
        afterState: { provider: 'dojah', eventType, providerReference },
      });
      await providerService.markWebhookProcessed('dojah', eventId);
      return NextResponse.json({ ok: true, ignored: 'vendor_not_found' });
    }

    await logAction({
      userId: systemActorId,
      actionType: AuditActionType.DOJAH_WEBHOOK_MATCHED,
      entityType: AuditEntityType.KYC,
      entityId: vendor.id,
      ipAddress,
      deviceType: DeviceType.DESKTOP,
      userAgent,
      afterState: { provider: 'dojah', eventType, providerReference, vendorId: vendor.id },
    });

    const user = await db.query.users.findFirst({
      where: eq(users.id, vendor.userId),
    });

    let verificationResult = null;
    if (providerReference) {
      try {
        verificationResult = await getDojahService().getVerificationResult(providerReference);
      } catch (error) {
        console.error('[Dojah Webhook] Provider result fetch failed; storing webhook payload for review', {
          providerReference,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const normalized = withProviderReference(
      normalizeDojahWorkflowResult(
        verificationResult ?? (payload as unknown as Parameters<typeof normalizeDojahWorkflowResult>[0])
      ),
      providerReference,
      workflowReference
    );
    normalized.normalizedResult = {
      ...normalized.normalizedResult,
      nemSubmittedProfile: {
        fullName: user?.fullName ?? null,
        email: user?.email ?? null,
        phone: user?.phone ? maskPhone(user.phone) : null,
        businessName: vendor.businessName ?? null,
        businessType: vendor.businessType ?? null,
        businessRegistrationNumber: maskIdentifier(vendor.cacNumber),
        bvnAlreadyVerified: Boolean(vendor.bvnVerifiedAt),
        registrationFeePaid: Boolean(vendor.registrationFeePaid),
      },
    };
    await providerService.persistVerification({
      userId: vendor.userId,
      vendorId: vendor.id,
      actorId: systemActorId,
      result: normalized,
      rawPayload: { webhook: payload, verificationResult },
      ipAddress,
      userAgent,
    });

    const policy = await businessPolicyService.getEffectivePolicy();
    const readiness = verificationResult
      ? getTier2SubmissionReadiness(verificationResult, normalized, {
          businessData: policy.kyc.tier2RequiresBusinessData,
          governmentId: policy.kyc.tier2RequiresGovernmentId,
          liveness: policy.kyc.tier2RequiresLiveness,
          address: policy.kyc.tier2RequiresAddress,
        })
      : {
          ready: false,
          providerStatus: normalized.status,
          reason: 'provider_not_completed',
          missingBlockingEvidence: [],
          missingReviewEvidence: normalized.pendingChecks,
        };

    if (isCompletionLikeWebhook(payload, eventType) && readiness.ready) {
      await getKYCRepository().upsertVerificationData(vendor.id, {
        dojahReferenceId: normalized.providerReference || providerReference || eventId,
        tier2SubmittedAt: new Date(),
      });

      await logAction({
        userId: systemActorId,
        actionType: AuditActionType.VENDOR_TIER2_PENDING_REVIEW,
        entityType: AuditEntityType.KYC,
        entityId: vendor.id,
        ipAddress,
        deviceType: DeviceType.DESKTOP,
        userAgent,
        afterState: {
          provider: 'dojah',
          providerReference: normalized.providerReference || providerReference,
          source: 'webhook',
        },
      });

      await createRoleNotifications(['salvage_manager', 'system_admin'], {
        type: 'tier2_pending_review',
        title: 'Tier 2 KYC Ready for Review',
        message: 'A vendor completed identity verification and is ready for manual review.',
        data: { vendorId: vendor.id, providerReference: normalized.providerReference || providerReference, url: `/manager/kyc-approvals/${vendor.id}` },
      }).catch((error) => console.error('[Dojah Webhook] manager notification failed', error));
      await getKYCNotificationService().sendTier2SubmissionManagerEmails({
        vendorName: user?.fullName ?? 'Vendor',
        businessName: vendor.businessName,
        riskLevel: normalized.riskLevel,
        reviewUrl: appPath(`/manager/kyc-approvals/${vendor.id}`),
        outcome: 'pending_review',
      });
    } else if (isCompletionLikeWebhook(payload, eventType)) {
      await logAction({
        userId: systemActorId,
        actionType: AuditActionType.DOJAH_KYC_FAILED,
        entityType: AuditEntityType.KYC,
        entityId: vendor.id,
        ipAddress,
        deviceType: DeviceType.DESKTOP,
        userAgent,
        afterState: {
          provider: 'dojah',
          providerReference: normalized.providerReference || providerReference,
          source: 'webhook',
          providerStatus: readiness.providerStatus,
          reason: readiness.reason,
          missingBlockingEvidence: readiness.missingBlockingEvidence,
          missingReviewEvidence: readiness.missingReviewEvidence,
          evidenceStored: true,
        },
      });
    }

    await providerService.markWebhookProcessed('dojah', eventId);
    return NextResponse.json({ ok: true, userId: user?.id ?? vendor.userId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown webhook processing error';
    await providerService.markWebhookFailed('dojah', eventId, message);
    await logAction({
      userId: systemActorId,
      actionType: AuditActionType.DOJAH_WEBHOOK_PROCESSING_FAILED,
      entityType: AuditEntityType.KYC,
      entityId: providerReference || eventId,
      ipAddress,
      deviceType: DeviceType.DESKTOP,
      userAgent,
      afterState: { provider: 'dojah', eventType, providerReference, error: message },
    });
    console.error('[Dojah Webhook] Processing failed', { message, providerReference });
    return NextResponse.json({ ok: false }, { status: 202 });
  }
}

async function getSystemActorId(): Promise<string> {
  const [systemAdmin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'system_admin'))
    .limit(1);

  return systemAdmin?.id ?? '00000000-0000-0000-0000-000000000000';
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
