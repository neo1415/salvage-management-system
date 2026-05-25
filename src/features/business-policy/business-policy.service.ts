import { configService } from '@/features/auction-deposit/services/config.service';
import { db } from '@/lib/db/drizzle';
import { businessPolicySnapshots, businessPolicyVersions } from '@/lib/db/schema/business-policies';
import { AuditActionType, AuditEntityType, DeviceType, logAction } from '@/lib/utils/audit-logger';
import { desc, eq } from 'drizzle-orm';
import { DEFAULT_BUSINESS_POLICY } from './default-policy';
import { toPublicBusinessPolicy } from './public-policy';
import { validateBusinessPolicy } from './policy-validation';
import { sanitizeBusinessPolicy } from './policy-sanitization';
import type { BusinessPolicy, PolicyValidationResult, PublicBusinessPolicy } from './types';

export type BusinessPolicyVersionRecord = typeof businessPolicyVersions.$inferSelect;
export type BusinessPolicySnapshotRecord = typeof businessPolicySnapshots.$inferSelect;

export type SaveDraftPolicyInput = {
  policy: BusinessPolicy;
  actorId: string;
  notes?: string;
  ipAddress?: string;
  userAgent?: string;
};

export type PublishPolicyInput = {
  id: string;
  actorId: string;
  ipAddress?: string;
  userAgent?: string;
};

export type CreatePolicySnapshotInput = {
  policy: BusinessPolicy;
  entityType: 'auction' | 'case' | 'payment' | 'document' | 'vendor' | 'kyc';
  entityId: string;
  actorId?: string;
  reason: string;
};

export class BusinessPolicyService {
  async getEffectivePolicy(): Promise<BusinessPolicy> {
    const runtimePolicy = await this.getRuntimeDefaultPolicy();
    const publishedPolicy = await this.getPublishedPolicy();

    return publishedPolicy?.policy ?? runtimePolicy;
  }

  async getRuntimeDefaultPolicy(): Promise<BusinessPolicy> {
    const policy: BusinessPolicy = structuredClone(DEFAULT_BUSINESS_POLICY);

    policy.auth.staffMfaRequired = process.env.MFA_STAFF_LOGIN_REQUIRED === 'true';
    policy.auth.vendorMfaRequired = process.env.MFA_VENDOR_LOGIN_ENFORCED === 'true';

    try {
      const legacyConfig = await configService.getConfig();
      const depositSystemEnabled = await configService.isDepositSystemEnabled();

      policy.onboarding.tier1BidLimit = legacyConfig.tier1Limit;
      policy.onboarding.registrationFeeAmount = legacyConfig.registrationFee;

      policy.payments.paymentDeadlineAfterSigningHours = legacyConfig.paymentDeadlineAfterSigning;

      policy.escrow.depositSystemEnabled = depositSystemEnabled;
      policy.escrow.depositRatePercent = legacyConfig.depositRate;
      policy.escrow.minimumDepositFloor = legacyConfig.minimumDepositFloor;
      policy.escrow.topBiddersToKeepFrozen = legacyConfig.topBiddersToKeepFrozen;
      policy.escrow.forfeiturePercentage = legacyConfig.forfeiturePercentage;

      policy.auctions.minimumBidIncrement = legacyConfig.minimumBidIncrement;
      policy.auctions.documentValidityHours = legacyConfig.documentValidityPeriod;
      policy.auctions.maxGraceExtensions = legacyConfig.maxGraceExtensions;
      policy.auctions.graceExtensionDurationHours = legacyConfig.graceExtensionDuration;
      policy.auctions.fallbackBufferHours = legacyConfig.fallbackBufferPeriod;
    } catch (error) {
      console.error('[BusinessPolicy] Failed to load legacy config; using current NEM defaults', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return policy;
  }

  async getPublishedPolicy(): Promise<BusinessPolicyVersionRecord | null> {
    try {
      const [record] = await db
        .select()
        .from(businessPolicyVersions)
        .where(eq(businessPolicyVersions.active, true))
        .orderBy(desc(businessPolicyVersions.publishedAt))
        .limit(1);

      if (!record) return null;

      const validation = validateBusinessPolicy(record.policy);
      if (!validation.valid) {
        console.error('[BusinessPolicy] Active policy is invalid; falling back to runtime default', {
          policyId: record.id,
          version: record.version,
          issues: validation.issues,
        });
        return null;
      }

      return record;
    } catch (error) {
      console.warn('[BusinessPolicy] Published policy unavailable; using runtime default', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  async listPolicyVersions(limit = 20): Promise<BusinessPolicyVersionRecord[]> {
    try {
      return await db
        .select()
        .from(businessPolicyVersions)
        .orderBy(desc(businessPolicyVersions.createdAt))
        .limit(limit);
    } catch (error) {
      console.warn('[BusinessPolicy] Policy version list unavailable', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  async saveDraftPolicy(input: SaveDraftPolicyInput): Promise<{
    success: boolean;
    record?: BusinessPolicyVersionRecord;
    validation: PolicyValidationResult;
    error?: string;
  }> {
    const policy = sanitizeBusinessPolicy(input.policy);
    const validation = validateBusinessPolicy(policy);

    if (!validation.valid) {
      return {
        success: false,
        validation,
        error: 'Business policy contains invalid or contradictory settings.',
      };
    }

    const [record] = await db
      .insert(businessPolicyVersions)
      .values({
        version: policy.version,
        status: 'draft',
        active: false,
        policy,
        validationResult: validation,
        notes: input.notes,
        createdBy: input.actorId,
        updatedAt: new Date(),
      })
      .returning();

    await logAction({
      userId: input.actorId,
      actionType: AuditActionType.BUSINESS_POLICY_DRAFT_SAVED,
      entityType: AuditEntityType.POLICY,
      entityId: record.id,
      ipAddress: input.ipAddress ?? 'unknown',
      deviceType: DeviceType.DESKTOP,
      userAgent: input.userAgent ?? 'unknown',
      afterState: {
        policyVersion: record.version,
        validation,
        notes: input.notes ?? null,
      },
    });

    return { success: true, record, validation };
  }

  async publishPolicy(input: PublishPolicyInput): Promise<{
    success: boolean;
    record?: BusinessPolicyVersionRecord;
    validation?: PolicyValidationResult;
    error?: string;
  }> {
    const [draft] = await db
      .select()
      .from(businessPolicyVersions)
      .where(eq(businessPolicyVersions.id, input.id))
      .limit(1);

    if (!draft) {
      return { success: false, error: 'Business policy draft not found.' };
    }

    const validation = validateBusinessPolicy(draft.policy);
    if (!validation.valid) {
      return {
        success: false,
        validation,
        error: 'Business policy cannot be published until validation errors are fixed.',
      };
    }

    const now = new Date();
    const [record] = await db.transaction(async (tx) => {
      await tx
        .update(businessPolicyVersions)
        .set({
          status: 'archived',
          active: false,
          updatedAt: now,
        })
        .where(eq(businessPolicyVersions.active, true));

      return await tx
        .update(businessPolicyVersions)
        .set({
          status: 'published',
          active: true,
          validationResult: validation,
          publishedBy: input.actorId,
          publishedAt: now,
          updatedAt: now,
        })
        .where(eq(businessPolicyVersions.id, input.id))
        .returning();
    });

    await logAction({
      userId: input.actorId,
      actionType: AuditActionType.BUSINESS_POLICY_PUBLISHED,
      entityType: AuditEntityType.POLICY,
      entityId: record.id,
      ipAddress: input.ipAddress ?? 'unknown',
      deviceType: DeviceType.DESKTOP,
      userAgent: input.userAgent ?? 'unknown',
      afterState: {
        policyVersion: record.version,
        validation,
        publishedAt: record.publishedAt?.toISOString?.() ?? now.toISOString(),
      },
    });

    return { success: true, record, validation };
  }

  async createPolicySnapshot(input: CreatePolicySnapshotInput): Promise<BusinessPolicySnapshotRecord | null> {
    try {
      const publishedPolicy = await this.getPublishedPolicy();

      const [record] = await db
        .insert(businessPolicySnapshots)
        .values({
          policyVersionId: publishedPolicy?.id,
          policyVersion: input.policy.version,
          entityType: input.entityType,
          entityId: input.entityId,
          policy: input.policy,
          reason: input.reason,
          createdBy: input.actorId,
        })
        .returning();

      return record;
    } catch (error) {
      console.warn('[BusinessPolicy] Policy snapshot unavailable; continuing without blocking workflow', {
        entityType: input.entityType,
        entityId: input.entityId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  toPublicPolicy(policy: BusinessPolicy): PublicBusinessPolicy {
    return toPublicBusinessPolicy(policy);
  }

  async getPublicPolicy(): Promise<PublicBusinessPolicy> {
    return this.toPublicPolicy(await this.getEffectivePolicy());
  }
}

export const businessPolicyService = new BusinessPolicyService();
