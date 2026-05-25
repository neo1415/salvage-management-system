import { NextRequest, NextResponse } from 'next/server';
import { and, eq, or } from 'drizzle-orm';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { providerVerificationRecords } from '@/lib/db/schema/provider-verifications';
import { DojahVerificationLookupError, getDojahService } from '@/features/kyc/services/dojah.service';
import { reconcileTier2FromDojah } from '@/features/kyc/services/dojah-reconcile.service';
import { getKYCRepository } from '@/features/kyc/repositories/kyc.repository';
import { logAction, AuditActionType, AuditEntityType, DeviceType, getIpAddress } from '@/lib/utils/audit-logger';
import { extractVendorIdFromDojahReference } from '@/features/kyc/utils/dojah-reference';
import { assertProviderVerificationStorageReady, isProviderVerificationStorageError, PROVIDER_VERIFICATION_MIGRATION_MISSING } from '@/features/kyc/services/provider-verification-readiness';

export const dynamic = 'force-dynamic';

function stringFrom(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizePhone(value?: string): string | undefined {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, '');
  if (!digits) return undefined;
  if (digits.startsWith('234')) return `+${digits}`;
  if (digits.startsWith('0')) return `+234${digits.slice(1)}`;
  return value.startsWith('+') ? value : `+${digits}`;
}

async function resolveVendorForReference(input: {
  providerReference: string;
  requestedVendorId?: string;
  metadataVendorId?: string;
  metadataUserId?: string;
  email?: string;
  phone?: string;
}): Promise<
  | { ok: true; vendor: { id: string; userId: string }; matchSource: string }
  | { ok: false; status: number; error: string; candidates?: Array<{ id: string; businessName: string | null; email: string }> }
> {
  const existingRecords = await db
    .select({
      vendorId: providerVerificationRecords.vendorId,
      userId: providerVerificationRecords.userId,
    })
    .from(providerVerificationRecords)
    .where(
      and(
        eq(providerVerificationRecords.provider, 'dojah'),
        eq(providerVerificationRecords.providerReference, input.providerReference)
      )
    );

  const existingVendorIds = [...new Set(existingRecords.map((record) => record.vendorId).filter(Boolean))] as string[];
  if (existingVendorIds.length === 1) {
    const [vendor] = await db
      .select({ id: vendors.id, userId: vendors.userId })
      .from(vendors)
      .where(eq(vendors.id, existingVendorIds[0]))
      .limit(1);
    if (vendor) return { ok: true, vendor, matchSource: 'stored_provider_reference' };
  }
  if (existingVendorIds.length > 1) {
    return { ok: false, status: 409, error: 'Stored provider reference is linked to multiple vendors; manual cleanup required.' };
  }

  const targetVendorId =
    input.requestedVendorId ||
    input.metadataVendorId ||
    extractVendorIdFromDojahReference(input.providerReference);
  if (targetVendorId) {
    const [vendor] = await db
      .select({ id: vendors.id, userId: vendors.userId })
      .from(vendors)
      .where(eq(vendors.id, targetVendorId))
      .limit(1);
    if (vendor) return { ok: true, vendor, matchSource: input.requestedVendorId ? 'manual_vendor_selection' : 'dojah_metadata_vendor_id' };
  }

  if (input.metadataUserId) {
    const [vendor] = await db
      .select({ id: vendors.id, userId: vendors.userId })
      .from(vendors)
      .where(eq(vendors.userId, input.metadataUserId))
      .limit(1);
    if (vendor) return { ok: true, vendor, matchSource: 'dojah_metadata_user_id' };
  }

  const normalizedPhone = normalizePhone(input.phone);
  const profileConditions = [
    input.email ? eq(users.email, input.email) : undefined,
    normalizedPhone ? eq(users.phone, normalizedPhone) : undefined,
  ].filter(Boolean);
  const profileMatches = profileConditions.length
    ? await db
        .select({ id: vendors.id, userId: vendors.userId, businessName: vendors.businessName, email: users.email })
        .from(vendors)
        .innerJoin(users, eq(vendors.userId, users.id))
        .where(or(...profileConditions))
    : [];

  if (profileMatches.length === 1) {
    const match = profileMatches[0];
    return { ok: true, vendor: { id: match.id, userId: match.userId }, matchSource: input.email ? 'dojah_email_exact' : 'dojah_phone_exact' };
  }

  if (profileMatches.length > 1) {
    return {
      ok: false,
      status: 409,
      error: 'Dojah reference matched multiple vendor profiles. Choose the vendor manually and retry with vendorId.',
      candidates: profileMatches.map((match) => ({ id: match.id, businessName: match.businessName, email: match.email })),
    };
  }

  return {
    ok: false,
    status: 409,
    error: 'Could not safely match this Dojah reference to a vendor. Retry with vendorId from NEM Salvage.',
  };
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.role !== 'salvage_manager' && session.user.role !== 'system_admin') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const providerReference = stringFrom(body.reference_id) || stringFrom(body.referenceId) || stringFrom(body.providerReference);
  const requestedVendorId = stringFrom(body.vendorId);

  if (!providerReference) {
    return NextResponse.json({ error: 'reference_id is required' }, { status: 400 });
  }

  try {
    await assertProviderVerificationStorageReady();
  } catch (error) {
    if (isProviderVerificationStorageError(error)) {
      return NextResponse.json({ error: PROVIDER_VERIFICATION_MIGRATION_MISSING }, { status: 503 });
    }
    throw error;
  }

  let verificationResult;
  try {
    verificationResult = await getDojahService().getVerificationResult(providerReference);
  } catch (error) {
    if (error instanceof DojahVerificationLookupError) {
      return NextResponse.json(
        {
          error:
            error.reason === 'not_found_or_invalid_reference'
              ? 'Verification details were not found for this reference. Check the reference ID, environment, product access, and credentials.'
              : 'The verification response shape could not be normalized yet.',
          reference_id: providerReference,
          reason: error.reason,
          diagnostic: error.diagnostic,
        },
        { status: error.reason === 'not_found_or_invalid_reference' ? 404 : 502 }
      );
    }
    throw error;
  }
  const metadata = (verificationResult.metadata ?? {}) as Record<string, unknown>;
  const userData = (verificationResult.data?.user_data?.data ?? {}) as Record<string, unknown>;
  const phoneData = (verificationResult.data?.phone_number?.data ?? {}) as Record<string, unknown>;

  const resolved = await resolveVendorForReference({
    providerReference,
    requestedVendorId,
    metadataVendorId: stringFrom(metadata.vendor_id) || stringFrom(metadata.vendorId),
    metadataUserId: stringFrom(metadata.user_id) || stringFrom(metadata.userId),
    email: stringFrom(userData.email),
    phone: stringFrom(phoneData.phone),
  });

  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error, candidates: resolved.candidates ?? [] },
      { status: resolved.status }
    );
  }

  const reconcile = await reconcileTier2FromDojah({
    vendorId: resolved.vendor.id,
    userId: resolved.vendor.userId,
    actorId: session.user.id,
    ipAddress: getIpAddress(request.headers),
    userAgent: request.headers.get('user-agent') ?? 'unknown',
    explicitReference: providerReference,
  });

  const approval = await getKYCRepository().getPendingApprovalByVendorId(resolved.vendor.id);

  await logAction({
    userId: session.user.id,
    actionType: AuditActionType.MANUAL_DOJAH_REFERENCE_SYNC,
    entityType: AuditEntityType.KYC,
    entityId: resolved.vendor.id,
    ipAddress: getIpAddress(request.headers),
    deviceType: DeviceType.DESKTOP,
    userAgent: request.headers.get('user-agent') ?? 'unknown',
    afterState: {
      provider: 'dojah',
      providerReference,
      matchSource: resolved.matchSource,
      synced: reconcile.synced,
      providerStatus: reconcile.providerStatus,
    },
  });

  return NextResponse.json({
    success: reconcile.synced,
    vendorId: resolved.vendor.id,
    matchSource: resolved.matchSource,
    reconcile,
    approval,
  });
}
