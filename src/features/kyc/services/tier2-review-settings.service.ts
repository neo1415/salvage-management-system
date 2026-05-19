import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { systemConfig, configChangeHistory } from '@/lib/db/schema/auction-deposit';

const TIER2_AUTO_REVIEW_PARAMETER = 'tier2_auto_review_enabled';

export async function getTier2AutoReviewEnabled(): Promise<boolean> {
  const [setting] = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.parameter, TIER2_AUTO_REVIEW_PARAMETER))
    .limit(1);

  return setting?.value === 'true';
}

export async function setTier2AutoReviewEnabled(input: {
  enabled: boolean;
  actorId: string;
  reason?: string;
}): Promise<void> {
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.parameter, TIER2_AUTO_REVIEW_PARAMETER))
      .limit(1);

    const oldValue = current?.value ?? 'false';
    const newValue = String(input.enabled);

    if (current) {
      await tx
        .update(systemConfig)
        .set({
          value: newValue,
          updatedAt: new Date(),
          updatedBy: input.actorId,
        })
        .where(eq(systemConfig.parameter, TIER2_AUTO_REVIEW_PARAMETER));
    } else {
      await tx.insert(systemConfig).values({
        parameter: TIER2_AUTO_REVIEW_PARAMETER,
        value: newValue,
        dataType: 'boolean',
        description: 'Automatically approve clean Tier 2 KYC submissions while routing risk signals to manual review.',
        updatedBy: input.actorId,
      });
    }

    await tx.insert(configChangeHistory).values({
      parameter: TIER2_AUTO_REVIEW_PARAMETER,
      oldValue,
      newValue,
      changedBy: input.actorId,
      reason: input.reason ?? `Tier 2 automatic review ${input.enabled ? 'enabled' : 'disabled'}`,
    });
  });
}

export function isCleanTier2Verification(input: {
  failedChecks?: string[];
  pendingChecks?: string[];
  reasonCodes?: string[];
  amlRiskLevel?: 'Low' | 'Medium' | 'High';
  fraudRiskScore?: number;
  livenessScore?: number;
  biometricMatchScore?: number;
}): boolean {
  if ((input.failedChecks?.length ?? 0) > 0) return false;
  if ((input.pendingChecks?.length ?? 0) > 0) return false;
  if ((input.reasonCodes?.length ?? 0) > 0) return false;
  if (input.amlRiskLevel && input.amlRiskLevel !== 'Low') return false;
  if (typeof input.fraudRiskScore === 'number' && input.fraudRiskScore >= 30) return false;
  if (typeof input.livenessScore === 'number' && input.livenessScore < 50) return false;
  if (typeof input.biometricMatchScore === 'number' && input.biometricMatchScore < 80) return false;
  return true;
}
