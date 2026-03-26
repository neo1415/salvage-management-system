import { eq, lte, and, isNotNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { verificationCosts } from '@/lib/db/schema/verification-costs';
import type {
  KYCStatus,
  KYCVerificationData,
  ManagerDecision,
  VerificationCost,
  PendingApproval,
} from '../types/kyc.types';

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
      submittedAt: v.tier2SubmittedAt ?? undefined,
      approvedAt: v.tier2ApprovedAt ?? undefined,
      expiresAt: v.tier2ExpiresAt ?? undefined,
      rejectionReason: v.tier2RejectionReason ?? undefined,
      amlRiskLevel: (v.amlRiskLevel as KYCStatus['amlRiskLevel']) ?? undefined,
      fraudRiskScore: v.fraudRiskScore ? Number(v.fraudRiskScore) : undefined,
      dojahReferenceId: v.tier2DojahReferenceId ?? undefined,
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
   */
  async getPendingApprovals(): Promise<PendingApproval[]> {
    const rows = await db
      .select({
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
        ninVerificationData: vendors.ninVerificationData,
        livenessScore: vendors.livenessScore,
        biometricMatchScore: vendors.biometricMatchScore,
        amlScreeningData: vendors.amlScreeningData,
      })
      .from(vendors)
      .where(
        and(
          isNotNull(vendors.tier2SubmittedAt),
          sql`${vendors.tier2ApprovedAt} IS NULL`,
          sql`${vendors.tier2RejectionReason} IS NULL`
        )
      )
      .orderBy(vendors.tier2SubmittedAt);

    return rows.map((r) => {
      const flags = (r.fraudFlags as Array<{ description: string }> | null) ?? [];
      const flaggedReasons = flags.map((f) => f.description);
      if (r.amlRiskLevel === 'High') flaggedReasons.unshift('High AML risk');
      if (r.amlRiskLevel === 'Medium') flaggedReasons.unshift('Medium AML risk');

      return {
        vendorId: r.id,
        vendorName: r.businessName ?? 'Unknown',
        vendorEmail: '',
        submittedAt: r.tier2SubmittedAt!,
        amlRiskLevel: (r.amlRiskLevel as PendingApproval['amlRiskLevel']) ?? undefined,
        fraudRiskScore: r.fraudRiskScore ? Number(r.fraudRiskScore) : undefined,
        flaggedReasons,
        selfieUrl: r.selfieUrl ?? undefined,
        photoIdUrl: r.photoIdUrl ?? undefined,
        photoIdType: r.photoIdType ?? undefined,
        addressProofUrl: r.addressProofUrl ?? undefined,
        ninVerificationData: (r.ninVerificationData as Record<string, unknown>) ?? undefined,
        livenessScore: r.livenessScore ? Number(r.livenessScore) : undefined,
        biometricMatchScore: r.biometricMatchScore ? Number(r.biometricMatchScore) : undefined,
        amlScreeningData: (r.amlScreeningData as Record<string, unknown>) ?? undefined,
      };
    });
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
            updatedAt: new Date(),
          })
          .where(eq(vendors.id, vendorId));
      } else {
        await tx
          .update(vendors)
          .set({
            tier2RejectionReason: decision.reason ?? 'Application rejected',
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

let _instance: KYCRepository | null = null;

export function getKYCRepository(): KYCRepository {
  if (!_instance) _instance = new KYCRepository();
  return _instance;
}
