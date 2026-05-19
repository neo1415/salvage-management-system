import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, or } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { providerVerificationRecords } from '@/lib/db/schema/provider-verifications';
import { getDojahService } from '@/features/kyc/services/dojah.service';
import { normalizeDojahWorkflowResult } from '@/features/kyc/services/dojah-normalizer.service';
import { getProviderVerificationService } from '@/features/kyc/services/provider-verification.service';
import { logAction, AuditActionType, AuditEntityType, DeviceType, getIpAddress } from '@/lib/utils/audit-logger';

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
  status: z.union([z.string(), z.boolean()]).optional(),
  data: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
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
  } catch (error) {
    console.error('[Dojah Webhook] Invalid payload shape');
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const eventType = payload.event || payload.event_type || payload.type || 'unknown';
  const providerReference =
    payload.reference_id ||
    payload.reference ||
    payload.verification_reference ||
    stringFrom(payload.data?.reference_id) ||
    stringFrom(payload.data?.reference);
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

  const { duplicate } = await providerService.recordWebhookEvent({
    provider: 'dojah',
    eventId,
    eventType,
    providerReference,
    workflowReference,
    signatureValid,
    rawPayload: payload,
  });

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
      await providerService.markWebhookProcessed('dojah', eventId);
      return NextResponse.json({ ok: true, ignored: 'vendor_not_found' });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, vendor.userId),
    });

    const verificationResult = providerReference
      ? await getDojahService().getVerificationResult(providerReference)
      : null;

    const normalized = normalizeDojahWorkflowResult(
      verificationResult ?? (payload as unknown as Parameters<typeof normalizeDojahWorkflowResult>[0])
    );
    await providerService.persistVerification({
      userId: vendor.userId,
      vendorId: vendor.id,
      actorId: systemActorId,
      result: normalized,
      rawPayload: { webhook: payload, verificationResult },
      ipAddress,
      userAgent,
    });

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
