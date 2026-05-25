import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  providerVerificationRecords,
  providerWebhookEvents,
  type VerificationRiskLevel,
  type VerificationStatus,
} from '@/lib/db/schema/provider-verifications';
import { fraudAlerts } from '@/lib/db/schema/intelligence';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { createRoleNotifications } from '@/features/notifications/services/notification.service';
import { getEncryptionService } from './encryption.service';
import { assertProviderVerificationStorageReady } from './provider-verification-readiness';
import { logAction, AuditActionType, AuditEntityType, DeviceType } from '@/lib/utils/audit-logger';
import type { NormalizedVerificationResult } from '../types/provider-verification.types';
import { buildDojahReference } from '../utils/dojah-reference';
import { isKycTestingMode } from '@/lib/kyc/kyc-testing-mode';

interface PersistVerificationInput {
  userId?: string;
  vendorId?: string;
  result: NormalizedVerificationResult;
  rawPayload?: unknown;
  actorId?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface StartWorkflowInput {
  userId: string;
  vendorId: string;
  actorId: string;
  workflowSlug?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface WebhookEventInput {
  provider: 'dojah';
  eventId: string;
  eventType: string;
  providerReference?: string;
  workflowReference?: string;
  signatureValid: boolean;
  rawPayload: unknown;
}

function encryptPayload(payload: unknown): string | null {
  try {
    return getEncryptionService().encrypt(JSON.stringify(payload ?? {}));
  } catch (error) {
    console.error('[ProviderVerification] Failed to encrypt provider payload', error);
    return null;
  }
}

function riskScoreForLevel(riskLevel: VerificationRiskLevel): number {
  switch (riskLevel) {
    case 'critical':
      return 95;
    case 'high':
      return 80;
    case 'medium':
      return 55;
    default:
      return 20;
  }
}

function actionForStatus(status: VerificationStatus): AuditActionType {
  if (status === 'passed') return AuditActionType.DOJAH_KYC_PASSED;
  if (status === 'failed') return AuditActionType.DOJAH_KYC_FAILED;
  if (status === 'provider_unavailable') return AuditActionType.PROVIDER_UNAVAILABLE;
  return AuditActionType.DOJAH_KYC_REVIEW_REQUIRED;
}

export class ProviderVerificationService {
  async getOrCreatePendingWorkflow(input: StartWorkflowInput): Promise<{ providerReference: string; created: boolean }> {
    await assertProviderVerificationStorageReady();

    if (!isKycTestingMode()) {
      const existing = await db.query.providerVerificationRecords.findFirst({
        where: and(
          eq(providerVerificationRecords.provider, 'dojah'),
          eq(providerVerificationRecords.vendorId, input.vendorId),
          eq(providerVerificationRecords.verificationType, 'tier2'),
          inArray(providerVerificationRecords.status, ['pending', 'provider_unavailable'])
        ),
        orderBy: [desc(providerVerificationRecords.updatedAt)],
      });

      if (existing?.providerReference) {
        return { providerReference: existing.providerReference, created: false };
      }
    }

    const [vendorState] = await db
      .select({ tier2RejectionReason: vendors.tier2RejectionReason })
      .from(vendors)
      .where(eq(vendors.id, input.vendorId))
      .limit(1);

    const providerReference = buildDojahReference(input.vendorId);
    const now = new Date();
    const isResubmission = Boolean(vendorState?.tier2RejectionReason);
    const pendingChecks = [
      'business_data',
      'business_id',
      'digital_address',
      'government_id',
      'liveness',
      'government_data',
      'aml_screening',
      'duplicate_id_face',
      'ip_device_screening',
    ];

    await db.insert(providerVerificationRecords).values({
      provider: 'dojah',
      providerReference,
      workflowReference: input.workflowSlug || 'salvage',
      userId: input.userId,
      vendorId: input.vendorId,
      verificationType: 'tier2',
      status: 'pending',
      riskLevel: 'low',
      checksCompleted: [],
      pendingChecks,
      failedChecks: [],
      reasonCodes: [],
      displayMessage: isResubmission
        ? 'Dojah Tier 2 verification has been resubmitted.'
        : 'Dojah Tier 2 verification workflow has been started.',
      normalizedResult: {
        workflowSlug: input.workflowSlug || 'salvage',
        startedAt: now.toISOString(),
        ...(isResubmission ? { resubmittedAt: now.toISOString() } : {}),
      },
      createdAt: now,
      updatedAt: now,
    });

    if (isResubmission) {
      await db
        .update(vendors)
        .set({
          tier2RejectionReason: null,
          tier2SubmittedAt: now,
          updatedAt: now,
        })
        .where(eq(vendors.id, input.vendorId));

      await logAction({
        userId: input.actorId,
        actionType: AuditActionType.VENDOR_TIER2_RESUBMITTED,
        entityType: AuditEntityType.KYC,
        entityId: input.vendorId,
        ipAddress: input.ipAddress ?? 'system',
        deviceType: DeviceType.DESKTOP,
        userAgent: input.userAgent ?? 'system',
        afterState: {
          provider: 'dojah',
          providerReference,
          rejectedReasonCleared: true,
          timestamp: now.toISOString(),
        },
      });
    }

    await logAction({
      userId: input.actorId,
      actionType: AuditActionType.DOJAH_WORKFLOW_STARTED,
      entityType: AuditEntityType.KYC,
      entityId: input.vendorId,
      ipAddress: input.ipAddress ?? 'system',
      deviceType: DeviceType.DESKTOP,
      userAgent: input.userAgent ?? 'system',
      afterState: {
        provider: 'dojah',
        providerReference,
        workflowSlug: input.workflowSlug || 'salvage',
        verificationType: 'tier2',
      },
    });

    await logAction({
      userId: input.actorId,
      actionType: AuditActionType.DOJAH_REFERENCE_CREATED,
      entityType: AuditEntityType.KYC,
      entityId: input.vendorId,
      ipAddress: input.ipAddress ?? 'system',
      deviceType: DeviceType.DESKTOP,
      userAgent: input.userAgent ?? 'system',
      afterState: {
        provider: 'dojah',
        providerReference,
        workflowSlug: input.workflowSlug || 'salvage',
        verificationType: 'tier2',
      },
    });

    await logAction({
      userId: input.actorId,
      actionType: AuditActionType.DOJAH_VERIFICATION_STARTED,
      entityType: AuditEntityType.KYC,
      entityId: input.vendorId,
      ipAddress: input.ipAddress ?? 'system',
      deviceType: DeviceType.DESKTOP,
      userAgent: input.userAgent ?? 'system',
      afterState: {
        provider: 'dojah',
        providerReference,
        verificationType: 'tier2',
      },
    });

    return { providerReference, created: true };
  }

  async recordWebhookEvent(input: WebhookEventInput): Promise<{ duplicate: boolean }> {
    await assertProviderVerificationStorageReady();

    const encrypted = encryptPayload(input.rawPayload);
    const existing = await db.query.providerWebhookEvents.findFirst({
      where: and(
        eq(providerWebhookEvents.provider, input.provider),
        eq(providerWebhookEvents.eventId, input.eventId)
      ),
    });

    if (existing) {
      return { duplicate: true };
    }

    await db.insert(providerWebhookEvents).values({
      provider: input.provider,
      eventId: input.eventId,
      eventType: input.eventType,
      providerReference: input.providerReference,
      workflowReference: input.workflowReference,
      signatureValid: input.signatureValid,
      processingStatus: 'received',
      rawPayloadEncrypted: encrypted,
    });

    return { duplicate: false };
  }

  async markWebhookProcessed(provider: 'dojah', eventId: string): Promise<void> {
    await db
      .update(providerWebhookEvents)
      .set({ processingStatus: 'processed', processedAt: new Date() })
      .where(and(eq(providerWebhookEvents.provider, provider), eq(providerWebhookEvents.eventId, eventId)));
  }

  async markWebhookFailed(provider: 'dojah', eventId: string, errorMessage: string): Promise<void> {
    await db
      .update(providerWebhookEvents)
      .set({
        processingStatus: 'failed',
        errorMessage: errorMessage.slice(0, 1000),
        processedAt: new Date(),
      })
      .where(and(eq(providerWebhookEvents.provider, provider), eq(providerWebhookEvents.eventId, eventId)));
  }

  async persistVerification(input: PersistVerificationInput): Promise<void> {
    await assertProviderVerificationStorageReady();

    const encrypted = input.rawPayload ? encryptPayload(input.rawPayload) : null;
    const now = new Date();
    const actorId = input.actorId || input.userId;
    const entityId = input.vendorId || input.userId || input.result.providerReference || 'unknown';

    const values = {
      provider: input.result.provider,
      providerReference: input.result.providerReference,
      workflowReference: input.result.workflowReference,
      userId: input.userId,
      vendorId: input.vendorId,
      verificationType: input.result.verificationType,
      status: input.result.status,
      riskLevel: input.result.riskLevel,
      checksCompleted: input.result.checksCompleted,
      pendingChecks: input.result.pendingChecks,
      failedChecks: input.result.failedChecks,
      reasonCodes: input.result.reasonCodes,
      displayMessage: input.result.displayMessage,
      normalizedResult: input.result.normalizedResult,
      rawPayloadEncrypted: encrypted ?? undefined,
      updatedAt: now,
    };

    if (input.result.providerReference) {
      await db
        .insert(providerVerificationRecords)
        .values(values)
        .onConflictDoUpdate({
          target: [
            providerVerificationRecords.provider,
            providerVerificationRecords.providerReference,
            providerVerificationRecords.verificationType,
          ],
          set: {
            workflowReference: values.workflowReference,
            userId: values.userId,
            vendorId: values.vendorId,
            status: values.status,
            riskLevel: values.riskLevel,
            checksCompleted: values.checksCompleted,
            pendingChecks: values.pendingChecks,
            failedChecks: values.failedChecks,
            reasonCodes: values.reasonCodes,
            displayMessage: values.displayMessage,
            normalizedResult: values.normalizedResult,
            rawPayloadEncrypted: values.rawPayloadEncrypted,
            updatedAt: now,
          },
        });
    } else {
      await db.insert(providerVerificationRecords).values(values);
    }

    if (actorId) {
      await logAction({
        userId: actorId,
        actionType: AuditActionType.PROVIDER_VERIFICATION_STORED,
        entityType: AuditEntityType.KYC,
        entityId,
        ipAddress: input.ipAddress ?? 'system',
        deviceType: DeviceType.DESKTOP,
        userAgent: input.userAgent ?? 'system',
        afterState: {
          provider: input.result.provider,
          providerReference: input.result.providerReference,
          verificationType: input.result.verificationType,
          status: input.result.status,
          riskLevel: input.result.riskLevel,
        },
      });

      await logAction({
        userId: actorId,
        actionType: actionForStatus(input.result.status),
        entityType: AuditEntityType.KYC,
        entityId,
        ipAddress: input.ipAddress ?? 'system',
        deviceType: DeviceType.DESKTOP,
        userAgent: input.userAgent ?? 'system',
        afterState: {
          provider: input.result.provider,
          providerReference: input.result.providerReference,
          verificationType: input.result.verificationType,
          status: input.result.status,
          riskLevel: input.result.riskLevel,
          checksCompleted: input.result.checksCompleted,
          failedChecks: input.result.failedChecks,
          reasonCodes: input.result.reasonCodes,
        },
      });
    }

    await this.createFraudAlertIfNeeded(input);
  }

  private async createFraudAlertIfNeeded(input: PersistVerificationInput): Promise<void> {
    const risky =
      input.result.status === 'failed' ||
      input.result.status === 'review_required' ||
      input.result.riskLevel === 'high' ||
      input.result.riskLevel === 'critical';

    if (!risky || !input.vendorId) return;

    const existing = await db.query.fraudAlerts.findFirst({
      where: and(eq(fraudAlerts.entityType, 'vendor'), eq(fraudAlerts.entityId, input.vendorId)),
    });

    const metadata = {
      source: 'dojah',
      providerReference: input.result.providerReference,
      workflowReference: input.result.workflowReference,
      verificationType: input.result.verificationType,
      riskLevel: input.result.riskLevel,
      checksCompleted: input.result.checksCompleted,
      failedChecks: input.result.failedChecks,
      reasonCodes: input.result.reasonCodes,
    };

    if (existing) {
      await db
        .update(fraudAlerts)
        .set({
          riskScore: Math.max(existing.riskScore, riskScoreForLevel(input.result.riskLevel)),
          flagReasons: [...new Set([...existing.flagReasons, ...input.result.reasonCodes])],
          metadata: {
            ...((existing.metadata as Record<string, unknown> | null) ?? {}),
            ...metadata,
          },
        })
        .where(eq(fraudAlerts.id, existing.id));
    } else {
      await db.insert(fraudAlerts).values({
        entityType: 'vendor',
        entityId: input.vendorId,
        riskScore: riskScoreForLevel(input.result.riskLevel),
        flagReasons: input.result.reasonCodes.length
          ? input.result.reasonCodes
          : [`Dojah ${input.result.status}`],
        status: 'pending',
        metadata,
      });
    }

    const adminUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'system_admin'));

    if (adminUsers.length > 0) {
      await createRoleNotifications(['system_admin'], {
        type: 'system_alert',
        title: 'Verification alert',
        message: 'A vendor verification returned a risk signal and needs review.',
        data: {
          vendorId: input.vendorId,
          providerReference: input.result.providerReference,
          url: '/admin/fraud',
        },
      }).catch((error) => {
        console.error('[ProviderVerification] Failed to notify admins', error);
      });
    }

    if (input.actorId || input.userId) {
      await logAction({
        userId: input.actorId || input.userId!,
        actionType: existing
          ? AuditActionType.FRAUD_ALERT_UPDATED_FROM_DOJAH
          : AuditActionType.FRAUD_ALERT_CREATED_FROM_DOJAH,
        entityType: AuditEntityType.FRAUD_FLAG,
        entityId: input.vendorId,
        ipAddress: input.ipAddress ?? 'system',
        deviceType: DeviceType.DESKTOP,
        userAgent: input.userAgent ?? 'system',
        afterState: metadata,
      });
    }
  }
}

let _instance: ProviderVerificationService | null = null;

export function getProviderVerificationService(): ProviderVerificationService {
  if (!_instance) _instance = new ProviderVerificationService();
  return _instance;
}
