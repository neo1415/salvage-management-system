import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { providerVerificationRecords } from '@/lib/db/schema/provider-verifications';
import { getDojahService } from './dojah.service';
import { normalizeDojahWorkflowResult } from './dojah-normalizer.service';
import { getProviderVerificationService } from './provider-verification.service';
import { ingestDojahMediaForVendor } from './dojah-media-ingest.service';
import { getKYCRepository } from '../repositories/kyc.repository';
import { logAction, AuditActionType, AuditEntityType, DeviceType } from '@/lib/utils/audit-logger';
import type { DojahVerificationResult } from '../schemas/dojah.schemas';
import { assertProviderVerificationStorageReady } from './provider-verification-readiness';

export interface ReconcileTier2Result {
  synced: boolean;
  providerReference?: string;
  providerStatus?: string;
  vendorPendingReview?: boolean;
  fetchError?: string;
}

function isDojahResultComplete(result: DojahVerificationResult): boolean {
  const statusText = String(result.verification_status ?? result.verificationStatus ?? result.status ?? '').toLowerCase();
  if (
    statusText.includes('complete') ||
    statusText.includes('success') ||
    statusText.includes('pass') ||
    statusText.includes('review') ||
    statusText.includes('fail') ||
    statusText.includes('pending') ||
    statusText.includes('submitted')
  ) {
    return true;
  }

  const data = result.data;
  return Boolean(
    data?.id?.status !== undefined ||
      data?.selfie?.data ||
      data?.government_data?.status !== undefined ||
      data?.business_id ||
      data?.business_data
  );
}

function collectReferences(
  vendorReference: string | null | undefined,
  records: Array<{ providerReference: string | null }>
): string[] {
  const refs = new Set<string>();
  if (vendorReference?.trim()) refs.add(vendorReference.trim());
  for (const record of records) {
    if (record.providerReference?.trim()) refs.add(record.providerReference.trim());
  }
  return [...refs];
}

/**
 * Pull latest Dojah verification by stored reference(s) and align NEM Salvage records.
 * Webhooks/callbacks remain primary; this reconciles dashboard completions that never hit our app.
 */
export async function reconcileTier2FromDojah(input: {
  vendorId: string;
  userId: string;
  actorId: string;
  ipAddress?: string;
  userAgent?: string;
  explicitReference?: string;
}): Promise<ReconcileTier2Result> {
  await assertProviderVerificationStorageReady();

  const [vendor] = await db
    .select({
      id: vendors.id,
      tier2SubmittedAt: vendors.tier2SubmittedAt,
      tier2ApprovedAt: vendors.tier2ApprovedAt,
      tier2RejectionReason: vendors.tier2RejectionReason,
      tier2DojahReferenceId: vendors.tier2DojahReferenceId,
    })
    .from(vendors)
    .where(eq(vendors.id, input.vendorId))
    .limit(1);

  if (!vendor) {
    return { synced: false, fetchError: 'vendor_not_found' };
  }

  if (vendor.tier2ApprovedAt || vendor.tier2RejectionReason) {
    return { synced: false, fetchError: 'vendor_already_decided' };
  }

  const records = await db
    .select({
      providerReference: providerVerificationRecords.providerReference,
      status: providerVerificationRecords.status,
    })
    .from(providerVerificationRecords)
    .where(
      and(
        eq(providerVerificationRecords.vendorId, input.vendorId),
        eq(providerVerificationRecords.provider, 'dojah'),
        eq(providerVerificationRecords.verificationType, 'tier2')
      )
    )
    .orderBy(desc(providerVerificationRecords.updatedAt));

  const references = collectReferences(
    input.explicitReference ?? vendor.tier2DojahReferenceId,
    records
  );

  if (!references.length) {
    return { synced: false, fetchError: 'no_provider_reference' };
  }

  const dojah = getDojahService();
  const providerService = getProviderVerificationService();
  const repo = getKYCRepository();
  let lastError: string | undefined;

  for (const providerReference of references) {
    try {
      const verificationResult = await dojah.getVerificationResult(providerReference);
      if (!isDojahResultComplete(verificationResult)) {
        continue;
      }

      const normalized = normalizeDojahWorkflowResult(verificationResult);
      normalized.providerReference = normalized.providerReference || providerReference;
      normalized.workflowReference = normalized.workflowReference || providerReference;
      const media = await ingestDojahMediaForVendor({
        vendorId: input.vendorId,
        userId: input.userId,
        providerReference: normalized.providerReference || providerReference,
        verificationResult,
      }).catch((error) => {
        console.warn('[DojahReconcile] media ingest failed', {
          providerReference,
          message: error instanceof Error ? error.message : 'Unknown media ingest error',
        });
        return null;
      });
      normalized.normalizedResult = {
        ...normalized.normalizedResult,
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
        userId: input.userId,
        vendorId: input.vendorId,
        actorId: input.actorId,
        result: normalized,
        rawPayload: { source: 'reconcile_fetch', verificationResult },
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });

      const shouldMarkPending =
        !vendor.tier2SubmittedAt ||
        ['pending', 'review_required', 'passed', 'failed', 'provider_unavailable'].includes(normalized.status);

      if (shouldMarkPending) {
        await repo.upsertVerificationData(input.vendorId, {
          dojahReferenceId: normalized.providerReference || providerReference,
          tier2SubmittedAt: vendor.tier2SubmittedAt ?? new Date(),
          ...(media?.verificationData ?? {}),
        });
      }

      await logAction({
        userId: input.actorId,
        actionType: AuditActionType.DOJAH_PROVIDER_EVIDENCE_FETCHED,
        entityType: AuditEntityType.KYC,
        entityId: input.vendorId,
        ipAddress: input.ipAddress ?? 'system',
        deviceType: DeviceType.DESKTOP,
        userAgent: input.userAgent ?? 'system',
        afterState: {
          provider: 'dojah',
          providerReference: normalized.providerReference || providerReference,
          providerStatus: normalized.status,
          source: 'reconcile_fetch',
        },
      });
      await logAction({
        userId: input.actorId,
        actionType: AuditActionType.DOJAH_PROVIDER_EVIDENCE_REFRESHED,
        entityType: AuditEntityType.KYC,
        entityId: input.vendorId,
        ipAddress: input.ipAddress ?? 'system',
        deviceType: DeviceType.DESKTOP,
        userAgent: input.userAgent ?? 'system',
        afterState: {
          provider: 'dojah',
          providerReference: normalized.providerReference || providerReference,
          providerStatus: normalized.status,
          source: 'reconcile_fetch',
        },
      });
      await logAction({
        userId: input.actorId,
        actionType: AuditActionType.PROVIDER_EVIDENCE_REFRESHED,
        entityType: AuditEntityType.KYC,
        entityId: input.vendorId,
        ipAddress: input.ipAddress ?? 'system',
        deviceType: DeviceType.DESKTOP,
        userAgent: input.userAgent ?? 'system',
        afterState: {
          provider: 'dojah',
          providerReference: normalized.providerReference || providerReference,
          providerStatus: normalized.status,
          source: 'reconcile_fetch',
        },
      });

      if (!vendor.tier2SubmittedAt && shouldMarkPending) {
        await logAction({
          userId: input.actorId,
          actionType: AuditActionType.VENDOR_TIER2_PENDING_REVIEW,
          entityType: AuditEntityType.KYC,
          entityId: input.vendorId,
          ipAddress: input.ipAddress ?? 'system',
          deviceType: DeviceType.DESKTOP,
          userAgent: input.userAgent ?? 'system',
          afterState: {
            provider: 'dojah',
            providerReference: normalized.providerReference || providerReference,
            source: 'reconcile_fetch',
          },
        });
      }

      return {
        synced: true,
        providerReference: normalized.providerReference || providerReference,
        providerStatus: normalized.status,
        vendorPendingReview: shouldMarkPending,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'dojah_fetch_failed';
    }
  }

  return { synced: false, fetchError: lastError ?? 'dojah_fetch_failed' };
}

/** Provider-only pending: Dojah evidence exists but legacy tier2SubmittedAt was never set. */
export const DOJAH_PENDING_PROVIDER_STATUSES = [
  'pending',
  'review_required',
  'passed',
  'failed',
  'provider_unavailable',
  'completed',
  'submitted',
  'pending_review',
  'under_review',
  'manual_review',
] as const;

export function isDojahPendingProviderStatus(status: string): boolean {
  return (DOJAH_PENDING_PROVIDER_STATUSES as readonly string[]).includes(status);
}
