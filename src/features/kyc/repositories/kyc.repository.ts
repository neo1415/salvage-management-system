import { eq, lte, and, isNotNull, isNull, sql, inArray, desc } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { verificationCosts } from '@/lib/db/schema/verification-costs';
import { providerVerificationRecords } from '@/lib/db/schema/provider-verifications';
import { hasProviderVerificationStorage, ProviderVerificationStorageError } from '../services/provider-verification-readiness';
import type {
  KYCStatus,
  KYCVerificationData,
  ManagerDecision,
  VerificationCost,
  PendingApproval,
} from '../types/kyc.types';

async function hasProviderVerificationTable(): Promise<boolean> {
  return hasProviderVerificationStorage();
}

/**
 * KYCRepository
 *
 * Database access layer for all KYC-related vendor fields.
 * All multi-step writes are wrapped in transactions.
 */
export class KYCRepository {
  /**
   * Upsert KYC verification data for a vendor.
   * Wrapped in a transaction — rolls back on any failure.
   */
  async upsertVerificationData(vendorId: string, data: KYCVerificationData): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(vendors)
        .set({
          tier2DojahReferenceId: data.dojahReferenceId,
          // NIN
          ...(data.ninEncrypted !== undefined && { ninEncrypted: data.ninEncrypted }),
          ...(data.ninVerificationData !== undefined && {
            ninVerificationData: data.ninVerificationData,
          }),
          ...(data.ninVerifiedAt !== undefined && { ninVerified: data.ninVerifiedAt }),
          // Photo ID
          ...(data.photoIdUrl !== undefined && { photoIdUrl: data.photoIdUrl }),
          ...(data.ninCardUrl !== undefined && { ninCardUrl: data.ninCardUrl }),
          ...(data.cacCertificateUrl !== undefined && { cacCertificateUrl: data.cacCertificateUrl }),
          ...(data.bankStatementUrl !== undefined && { bankStatementUrl: data.bankStatementUrl }),
          ...(data.photoIdType !== undefined && { photoIdType: data.photoIdType }),
          ...(data.photoIdVerifiedAt !== undefined && {
            photoIdVerifiedAt: data.photoIdVerifiedAt,
          }),
          // Biometrics
          ...(data.selfieUrl !== undefined && { selfieUrl: data.selfieUrl }),
          ...(data.livenessScore !== undefined && {
            livenessScore: String(data.livenessScore),
          }),
          ...(data.biometricMatchScore !== undefined && {
            biometricMatchScore: String(data.biometricMatchScore),
          }),
          ...(data.biometricVerifiedAt !== undefined && {
            biometricVerifiedAt: data.biometricVerifiedAt,
          }),
          // Address
          ...(data.addressProofUrl !== undefined && { addressProofUrl: data.addressProofUrl }),
          ...(data.addressVerifiedAt !== undefined && {
            addressVerifiedAt: data.addressVerifiedAt,
          }),
          // AML
          ...(data.amlScreeningData !== undefined && {
            amlScreeningData: data.amlScreeningData,
          }),
          ...(data.amlRiskLevel !== undefined && { amlRiskLevel: data.amlRiskLevel }),
          ...(data.amlScreenedAt !== undefined && { amlScreenedAt: data.amlScreenedAt }),
          // Fraud
          ...(data.fraudRiskScore !== undefined && {
            fraudRiskScore: String(data.fraudRiskScore),
          }),
          ...(data.fraudFlags !== undefined && { fraudFlags: data.fraudFlags }),
          // Workflow
          ...(data.tier2SubmittedAt !== undefined && {
            tier2SubmittedAt: data.tier2SubmittedAt,
          }),
          updatedAt: new Date(),
        })
        .where(eq(vendors.id, vendorId));
    });
  }

  /**
   * Get current KYC status for a vendor.
   */
  async getVerificationStatus(vendorId: string): Promise<KYCStatus | null> {
    const rows = await db
      .select({
        tier: vendors.tier,
        tier2SubmittedAt: vendors.tier2SubmittedAt,
        tier2ApprovedAt: vendors.tier2ApprovedAt,
        tier2ExpiresAt: vendors.tier2ExpiresAt,
        tier2RejectionReason: vendors.tier2RejectionReason,
        amlRiskLevel: vendors.amlRiskLevel,
        fraudRiskScore: vendors.fraudRiskScore,
        tier2DojahReferenceId: vendors.tier2DojahReferenceId,
        ninVerified: vendors.ninVerified,
        livenessScore: vendors.livenessScore,
        biometricMatchScore: vendors.biometricMatchScore,
        photoIdVerifiedAt: vendors.photoIdVerifiedAt,
        amlScreenedAt: vendors.amlScreenedAt,
      })
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (!rows.length) return null;
    const v = rows[0];
    const providerTableExists = await hasProviderVerificationTable();
    const [latestTier2Provider] = providerTableExists
      ? await db
          .select({
            status: providerVerificationRecords.status,
            providerReference: providerVerificationRecords.providerReference,
            normalizedResult: providerVerificationRecords.normalizedResult,
            updatedAt: providerVerificationRecords.updatedAt,
          })
          .from(providerVerificationRecords)
          .where(
            and(
              eq(providerVerificationRecords.vendorId, vendorId),
              eq(providerVerificationRecords.provider, 'dojah'),
              eq(providerVerificationRecords.verificationType, 'tier2')
            )
          )
          .orderBy(desc(providerVerificationRecords.updatedAt))
          .limit(1)
      : [];

    // Determine status
    let status: KYCStatus['status'] = 'not_started';
    if (v.tier === 'tier2_full') {
      const now = new Date();
      status = v.tier2ExpiresAt && v.tier2ExpiresAt < now ? 'expired' : 'approved';
    } else if (v.tier2RejectionReason) {
      status = 'rejected';
    } else if (v.tier2SubmittedAt && !v.tier2ApprovedAt) {
      status = 'pending_review';
    } else if (v.tier2SubmittedAt) {
      status = 'in_progress';
    }

    return {
      status,
      tier: v.tier,
      submittedAt: v.tier2SubmittedAt ?? latestTier2Provider?.updatedAt ?? undefined,
      approvedAt: v.tier2ApprovedAt ?? undefined,
      expiresAt: v.tier2ExpiresAt ?? undefined,
      rejectionReason: v.tier2RejectionReason ?? undefined,
      rejectedSections: extractRejectedSections(
        (latestTier2Provider?.normalizedResult as Record<string, unknown> | null) ?? null
      ),
      amlRiskLevel: (v.amlRiskLevel as KYCStatus['amlRiskLevel']) ?? undefined,
      fraudRiskScore: v.fraudRiskScore ? Number(v.fraudRiskScore) : undefined,
      dojahReferenceId: v.tier2DojahReferenceId ?? latestTier2Provider?.providerReference ?? undefined,
      steps: {
        nin: !!v.ninVerified,
        liveness: !!v.livenessScore,
        biometric: !!v.biometricMatchScore,
        document: !!v.photoIdVerifiedAt,
        aml: !!v.amlScreenedAt,
      },
    };
  }

  /**
   * Get all pending Tier 2 KYC applications for manager review.
   * Includes legacy submissions and Dojah provider records awaiting manual review.
   */
  async getPendingApprovals(): Promise<PendingApproval[]> {
    const providerTableExists = await hasProviderVerificationTable();
    if (!providerTableExists) {
      throw new ProviderVerificationStorageError();
    }

    const baseSelection = {
      id: vendors.id,
      businessName: vendors.businessName,
      tier2SubmittedAt: vendors.tier2SubmittedAt,
      amlRiskLevel: vendors.amlRiskLevel,
      fraudRiskScore: vendors.fraudRiskScore,
      fraudFlags: vendors.fraudFlags,
      selfieUrl: vendors.selfieUrl,
      photoIdUrl: vendors.photoIdUrl,
      photoIdType: vendors.photoIdType,
      addressProofUrl: vendors.addressProofUrl,
      ninCardUrl: vendors.ninCardUrl,
      bankStatementUrl: vendors.bankStatementUrl,
      cacCertificateUrl: vendors.cacCertificateUrl,
      ninVerificationData: vendors.ninVerificationData,
      livenessScore: vendors.livenessScore,
      biometricMatchScore: vendors.biometricMatchScore,
      amlScreeningData: vendors.amlScreeningData,
      userEmail: users.email,
      userPhone: users.phone,
      userFullName: users.fullName,
    };

    const rows = await db
          .select({
            ...baseSelection,
            providerUpdatedAt: providerVerificationRecords.updatedAt,
          })
          .from(vendors)
          .innerJoin(users, eq(vendors.userId, users.id))
          .leftJoin(
            providerVerificationRecords,
            and(
              eq(providerVerificationRecords.vendorId, vendors.id),
              eq(providerVerificationRecords.provider, 'dojah'),
              eq(providerVerificationRecords.verificationType, 'tier2')
            )
          )
          .where(
            and(
              isNull(vendors.tier2ApprovedAt),
              isNull(vendors.tier2RejectionReason),
              isNotNull(vendors.tier2SubmittedAt)
            )
          )
          .orderBy(sql`COALESCE(${vendors.tier2SubmittedAt}, ${providerVerificationRecords.updatedAt}) DESC NULLS LAST`);

    const uniqueRows = [...rows.reduce((map, row) => {
      const existing = map.get(row.id);
      if (!existing) {
        map.set(row.id, row);
        return map;
      }
      const existingTs = existing.providerUpdatedAt?.getTime() ?? existing.tier2SubmittedAt?.getTime() ?? 0;
      const rowTs = row.providerUpdatedAt?.getTime() ?? row.tier2SubmittedAt?.getTime() ?? 0;
      if (rowTs >= existingTs) map.set(row.id, row);
      return map;
    }, new Map<string, (typeof rows)[number]>()).values()];

    const vendorIds = uniqueRows.map((r) => r.id);
    const evidenceRows = providerTableExists && vendorIds.length
      ? await db
          .select()
          .from(providerVerificationRecords)
          .where(inArray(providerVerificationRecords.vendorId, vendorIds))
          .orderBy(desc(providerVerificationRecords.updatedAt))
      : [];

    return uniqueRows.map((r) => {
      const flags = (r.fraudFlags as Array<{ description: string }> | null) ?? [];
      const flaggedReasons = flags.map((f) => f.description);
      if (r.amlRiskLevel === 'High') flaggedReasons.unshift('High AML risk');
      if (r.amlRiskLevel === 'Medium') flaggedReasons.unshift('Medium AML risk');
      const providerEvidence = evidenceRows.find((record) => record.vendorId === r.id);

      const submittedAt = r.tier2SubmittedAt ?? providerEvidence?.updatedAt ?? new Date();

      const normalizedResult = (providerEvidence?.normalizedResult as Record<string, unknown> | null) ?? null;

      return {
        vendorId: r.id,
        vendorName: resolveVendorDisplayName(r.businessName, r.userFullName, r.userEmail, normalizedResult),
        vendorEmail: r.userEmail,
        submittedAt,
        amlRiskLevel: (r.amlRiskLevel as PendingApproval['amlRiskLevel']) ?? undefined,
        fraudRiskScore: r.fraudRiskScore ? Number(r.fraudRiskScore) : undefined,
        flaggedReasons,
        selfieUrl: r.selfieUrl ?? undefined,
        photoIdUrl: r.photoIdUrl ?? undefined,
        photoIdType: r.photoIdType ?? undefined,
        addressProofUrl: r.addressProofUrl ?? undefined,
        ninCardUrl: r.ninCardUrl ?? undefined,
        bankStatementUrl: r.bankStatementUrl ?? undefined,
        cacCertificateUrl: r.cacCertificateUrl ?? undefined,
        providerDocuments: extractProviderDocuments(normalizedResult),
        ninVerificationData: (r.ninVerificationData as Record<string, unknown>) ?? undefined,
        livenessScore: r.livenessScore ? Number(r.livenessScore) : undefined,
        biometricMatchScore: r.biometricMatchScore ? Number(r.biometricMatchScore) : undefined,
        amlScreeningData: (r.amlScreeningData as Record<string, unknown>) ?? undefined,
        providerEvidence: providerEvidence
          ? {
              provider: providerEvidence.provider,
              providerReference: providerEvidence.providerReference,
              workflowReference: providerEvidence.workflowReference,
              status: providerEvidence.status,
              riskLevel: providerEvidence.riskLevel,
              checksCompleted: providerEvidence.checksCompleted,
              pendingChecks: providerEvidence.pendingChecks,
              failedChecks: providerEvidence.failedChecks,
              reasonCodes: providerEvidence.reasonCodes,
              displayMessage: providerEvidence.displayMessage,
              normalizedResult: providerEvidence.normalizedResult,
              updatedAt: providerEvidence.updatedAt,
            }
          : undefined,
      };
    });
  }

  /**
   * Get a single pending approval with latest provider evidence.
   */
  async getPendingApprovalByVendorId(vendorId: string): Promise<PendingApproval | null> {
    const approvals = await this.getPendingApprovals();
    return approvals.find((approval) => approval.vendorId === vendorId) ?? null;
  }

  /**
   * Load Tier 2 review payload for a vendor (pending, approved, or rejected).
   */
  async getApprovalDetailByVendorId(vendorId: string): Promise<{
    approval: PendingApproval;
    reviewStatus: 'pending' | 'approved' | 'rejected';
    rejectionReason?: string;
  } | null> {
    const pending = await this.getPendingApprovalByVendorId(vendorId);
    if (pending) {
      return { approval: pending, reviewStatus: 'pending' };
    }

    const providerTableExists = await hasProviderVerificationTable();
    if (!providerTableExists) {
      throw new ProviderVerificationStorageError();
    }

    const [row] = await db
      .select({
        id: vendors.id,
        businessName: vendors.businessName,
        tier2SubmittedAt: vendors.tier2SubmittedAt,
        tier2ApprovedAt: vendors.tier2ApprovedAt,
        tier2RejectionReason: vendors.tier2RejectionReason,
        amlRiskLevel: vendors.amlRiskLevel,
        fraudRiskScore: vendors.fraudRiskScore,
        fraudFlags: vendors.fraudFlags,
        selfieUrl: vendors.selfieUrl,
        photoIdUrl: vendors.photoIdUrl,
        photoIdType: vendors.photoIdType,
        addressProofUrl: vendors.addressProofUrl,
        ninCardUrl: vendors.ninCardUrl,
        bankStatementUrl: vendors.bankStatementUrl,
        cacCertificateUrl: vendors.cacCertificateUrl,
        ninVerificationData: vendors.ninVerificationData,
        livenessScore: vendors.livenessScore,
        biometricMatchScore: vendors.biometricMatchScore,
        amlScreeningData: vendors.amlScreeningData,
        userEmail: users.email,
        userPhone: users.phone,
        userFullName: users.fullName,
        providerUpdatedAt: providerVerificationRecords.updatedAt,
      })
      .from(vendors)
      .innerJoin(users, eq(vendors.userId, users.id))
      .leftJoin(
        providerVerificationRecords,
        and(
          eq(providerVerificationRecords.vendorId, vendors.id),
          eq(providerVerificationRecords.provider, 'dojah'),
          eq(providerVerificationRecords.verificationType, 'tier2')
        )
      )
      .where(eq(vendors.id, vendorId))
      .orderBy(desc(providerVerificationRecords.updatedAt))
      .limit(1);

    if (!row) return null;

    const hasTier2History = Boolean(
      row.tier2SubmittedAt ||
        row.tier2ApprovedAt ||
        row.tier2RejectionReason ||
        row.providerUpdatedAt ||
        row.ninVerificationData
    );
    if (!hasTier2History) return null;

    const [providerEvidence] = await db
      .select()
      .from(providerVerificationRecords)
      .where(
        and(
          eq(providerVerificationRecords.vendorId, vendorId),
          eq(providerVerificationRecords.provider, 'dojah'),
          eq(providerVerificationRecords.verificationType, 'tier2')
        )
      )
      .orderBy(desc(providerVerificationRecords.updatedAt))
      .limit(1);

    const approval = this.mapVendorRowToPendingApproval(row, providerEvidence ?? null);
    const reviewStatus = row.tier2ApprovedAt
      ? 'approved'
      : row.tier2RejectionReason
        ? 'rejected'
        : 'pending';

    return {
      approval,
      reviewStatus,
      rejectionReason: row.tier2RejectionReason ?? undefined,
    };
  }

  private mapVendorRowToPendingApproval(
    r: {
      id: string;
      businessName: string | null;
      tier2SubmittedAt: Date | null;
      amlRiskLevel: string | null;
      fraudRiskScore: string | null;
      fraudFlags: unknown;
      selfieUrl: string | null;
      photoIdUrl: string | null;
      photoIdType: string | null;
      addressProofUrl: string | null;
      ninCardUrl: string | null;
      bankStatementUrl: string | null;
      cacCertificateUrl: string | null;
      ninVerificationData: unknown;
      livenessScore: string | null;
      biometricMatchScore: string | null;
      amlScreeningData: unknown;
      userEmail: string | null;
      userPhone: string | null;
      userFullName: string | null;
      providerUpdatedAt?: Date | null;
    },
    providerEvidence: (typeof providerVerificationRecords.$inferSelect) | null
  ): PendingApproval {
    const flags = (r.fraudFlags as Array<{ description: string }> | null) ?? [];
    const flaggedReasons = flags.map((f) => f.description);
    if (r.amlRiskLevel === 'High') flaggedReasons.unshift('High AML risk');
    if (r.amlRiskLevel === 'Medium') flaggedReasons.unshift('Medium AML risk');

    const submittedAt = r.tier2SubmittedAt ?? providerEvidence?.updatedAt ?? new Date();
    const normalizedResult = (providerEvidence?.normalizedResult as Record<string, unknown> | null) ?? null;

    return {
      vendorId: r.id,
      vendorName: resolveVendorDisplayName(r.businessName, r.userFullName, r.userEmail, normalizedResult),
      vendorEmail: r.userEmail ?? '',
      submittedAt,
      amlRiskLevel: (r.amlRiskLevel as PendingApproval['amlRiskLevel']) ?? undefined,
      fraudRiskScore: r.fraudRiskScore ? Number(r.fraudRiskScore) : undefined,
      flaggedReasons,
      selfieUrl: r.selfieUrl ?? undefined,
      photoIdUrl: r.photoIdUrl ?? undefined,
      photoIdType: r.photoIdType ?? undefined,
      addressProofUrl: r.addressProofUrl ?? undefined,
      ninCardUrl: r.ninCardUrl ?? undefined,
      bankStatementUrl: r.bankStatementUrl ?? undefined,
      cacCertificateUrl: r.cacCertificateUrl ?? undefined,
      providerDocuments: extractProviderDocuments(normalizedResult),
      ninVerificationData: (r.ninVerificationData as Record<string, unknown>) ?? undefined,
      livenessScore: r.livenessScore ? Number(r.livenessScore) : undefined,
      biometricMatchScore: r.biometricMatchScore ? Number(r.biometricMatchScore) : undefined,
      amlScreeningData: (r.amlScreeningData as Record<string, unknown>) ?? undefined,
      providerEvidence: providerEvidence
        ? {
            provider: providerEvidence.provider,
            providerReference: providerEvidence.providerReference,
            workflowReference: providerEvidence.workflowReference,
            status: providerEvidence.status,
            riskLevel: providerEvidence.riskLevel,
            checksCompleted: providerEvidence.checksCompleted,
            pendingChecks: providerEvidence.pendingChecks,
            failedChecks: providerEvidence.failedChecks,
            reasonCodes: providerEvidence.reasonCodes,
            displayMessage: providerEvidence.displayMessage,
            normalizedResult: providerEvidence.normalizedResult,
            updatedAt: providerEvidence.updatedAt,
          }
        : undefined,
    };
  }

  /**
   * Record a manager's approve/reject decision.
   */
  async recordDecision(vendorId: string, decision: ManagerDecision): Promise<void> {
    await db.transaction(async (tx) => {
      if (decision.decision === 'approve') {
        const expiresAt = new Date(decision.decidedAt);
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);

        await tx
          .update(vendors)
          .set({
            tier: 'tier2_full',
            tier2ApprovedAt: decision.decidedAt,
            tier2ApprovedBy: decision.managerId,
            tier2ExpiresAt: expiresAt,
            tier2RejectionReason: null,
            tier2SubmittedAt: decision.decidedAt,
            updatedAt: new Date(),
          })
          .where(eq(vendors.id, vendorId));
      } else {
        await tx
          .update(vendors)
          .set({
            tier2RejectionReason: decision.reason ?? 'Application rejected',
            tier2SubmittedAt: null,
            tier2DojahReferenceId: null,
            updatedAt: new Date(),
          })
          .where(eq(vendors.id, vendorId));
      }
    });
  }

  /**
   * Record the cost of a Dojah API verification call.
   */
  async recordVerificationCost(vendorId: string, cost: VerificationCost): Promise<void> {
    await db.insert(verificationCosts).values({
      vendorId,
      verificationType: cost.verificationType,
      costAmount: cost.costAmount,
      currency: cost.currency,
      dojahReferenceId: cost.dojahReferenceId,
    });
  }

  /**
   * Get vendors whose Tier 2 has expired (for cron job).
   */
  async getExpiredTier2Vendors(): Promise<Array<{ id: string; tier2ExpiresAt: Date }>> {
    const now = new Date();
    const rows = await db
      .select({ id: vendors.id, tier2ExpiresAt: vendors.tier2ExpiresAt })
      .from(vendors)
      .where(
        and(
          eq(vendors.tier, 'tier2_full'),
          isNotNull(vendors.tier2ExpiresAt),
          lte(vendors.tier2ExpiresAt, now)
        )
      );
    return rows.filter((r) => r.tier2ExpiresAt !== null) as Array<{
      id: string;
      tier2ExpiresAt: Date;
    }>;
  }

  /**
   * Get vendors whose Tier 2 expires in approximately N days (for reminders).
   */
  async getVendorsExpiringInDays(days: number): Promise<Array<{ id: string; tier2ExpiresAt: Date }>> {
    const from = new Date();
    from.setDate(from.getDate() + days - 1);
    const to = new Date();
    to.setDate(to.getDate() + days + 1);

    const rows = await db
      .select({ id: vendors.id, tier2ExpiresAt: vendors.tier2ExpiresAt })
      .from(vendors)
      .where(
        and(
          eq(vendors.tier, 'tier2_full'),
          isNotNull(vendors.tier2ExpiresAt),
          sql`${vendors.tier2ExpiresAt} BETWEEN ${from} AND ${to}`
        )
      );
    return rows.filter((r) => r.tier2ExpiresAt !== null) as Array<{
      id: string;
      tier2ExpiresAt: Date;
    }>;
  }

  /**
   * Downgrade a vendor from Tier 2 to Tier 1 (expiry or suspension).
   */
  async downgradeTier(vendorId: string): Promise<void> {
    await db
      .update(vendors)
      .set({ tier: 'tier1_bvn', updatedAt: new Date() })
      .where(eq(vendors.id, vendorId));
  }

  /**
   * Auto-approve a vendor (Low AML risk, all scores pass).
   */
  async autoApprove(vendorId: string): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    await db
      .update(vendors)
      .set({
        tier: 'tier2_full',
        tier2ApprovedAt: now,
        tier2ExpiresAt: expiresAt,
        updatedAt: now,
      })
      .where(eq(vendors.id, vendorId));
  }
}

function recordFrom(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const text = value.trim();
    if (text && text !== ',' && text !== ',  ') return text;
  }
  return undefined;
}

function resolveVendorDisplayName(
  businessName: string | null,
  userFullName: string | null,
  userEmail: string | null,
  normalizedResult: Record<string, unknown> | null
): string {
  const firstName = firstString(normalizedResult?.firstName);
  const lastName = firstString(normalizedResult?.lastName);
  const verifiedFullName = firstString(
    normalizedResult?.fullName,
    [firstName, lastName].filter(Boolean).join(' ')
  );

  return firstString(businessName, verifiedFullName, userFullName, userEmail) ?? 'Unknown vendor';
}

function documentLabel(type: string, sourceKey?: string): string {
  if (type === 'selfie') return 'Selfie / liveness image';
  if (type === 'photo_id') return sourceKey?.includes('back_url') ? 'Government ID back' : 'Government ID document';
  if (type === 'address_proof') return 'Address proof';
  if (type === 'cac_certificate') return 'Business registration document';
  if (type === 'bank_statement') return 'Bank statement';
  return sourceKey ? sourceKey.replace(/[._-]+/g, ' ') : 'Dojah document';
}

function extractProviderDocuments(
  normalizedResult: Record<string, unknown> | null
): PendingApproval['providerDocuments'] {
  const media = recordFrom(normalizedResult?.dojahMedia);
  const assets = Array.isArray(media?.assets) ? media.assets : [];
  return assets
    .map((asset) => {
      const record = recordFrom(asset);
      const url = firstString(record?.storedUrl);
      const type = firstString(record?.type) ?? 'document';
      const sourceKey = firstString(record?.sourceKey);
      return url
        ? {
            label: documentLabel(type, sourceKey),
            type,
            url,
            ...(sourceKey ? { sourceKey } : {}),
          }
        : null;
    })
    .filter((asset): asset is NonNullable<PendingApproval['providerDocuments']>[number] => Boolean(asset));
}

function extractRejectedSections(normalizedResult: Record<string, unknown> | null): string[] | undefined {
  const managerDecision = recordFrom(normalizedResult?.managerDecision);
  const rejectedSections = Array.isArray(managerDecision?.rejectedSections)
    ? managerDecision.rejectedSections.filter((section): section is string => typeof section === 'string' && section.trim().length > 0)
    : [];
  return rejectedSections.length ? rejectedSections : undefined;
}

let _instance: KYCRepository | null = null;

export function getKYCRepository(): KYCRepository {
  if (!_instance) _instance = new KYCRepository();
  return _instance;
}
