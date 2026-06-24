/**
 * Configuration History API Route
 * Returns audit trail of configuration changes
 * 
 * Requirements:
 * - Requirement 20: Configuration Change Audit Trail
 * 
 * SECURITY: Role-based access control (System Admin only)
 * PERFORMANCE: Supports filtering and pagination
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { configChangeHistory } from '@/lib/db/schema/auction-deposit';
import { businessPolicyVersions } from '@/lib/db/schema/business-policies';
import { users } from '@/lib/db/schema/users';
import { policyToLegacyAuctionConfig } from '@/features/business-policy/legacy-auction-config-bridge';
import { DEFAULT_BUSINESS_POLICY } from '@/features/business-policy/default-policy';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import type { BusinessPolicy } from '@/features/business-policy/types';

type ConfigHistoryEntry = {
  id: string;
  parameter: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedByName?: string;
  reason?: string;
  createdAt: Date;
  source: 'auction_config' | 'enterprise_setup';
};

/**
 * GET /api/admin/config/history
 * Get configuration change history
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // RBAC: Verify user is System Admin or Manager
    const authorizedRoles = ['system_admin', 'salvage_manager'];
    if (!authorizedRoles.includes(session.user.role || '')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Forbidden - System Admin role required' 
        },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const parameter = searchParams.get('parameter') || undefined;
    const startDate = searchParams.get('startDate') 
      ? new Date(searchParams.get('startDate')!) 
      : undefined;
    const endDate = searchParams.get('endDate') 
      ? new Date(searchParams.get('endDate')!) 
      : undefined;
    const changedBy = searchParams.get('changedBy') || undefined;
    const limit = parseInt(searchParams.get('limit') || '100');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));

    const history = await getCombinedConfigHistory({
      parameter,
      startDate,
      endDate,
      changedBy,
    });

    const offset = (page - 1) * limit;
    const pageHistory = history.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      history: pageHistory,
      count: history.length,
    });
  } catch (error) {
    console.error('Get config history error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve configuration history. Please try again.'
      },
      { status: 500 }
    );
  }
}

async function getCombinedConfigHistory(filters: {
  parameter?: string;
  startDate?: Date;
  endDate?: Date;
  changedBy?: string;
}): Promise<ConfigHistoryEntry[]> {
  const legacyHistory = await getLegacyConfigHistory(filters);
  const enterpriseHistory = await getEnterprisePolicyHistory(filters);

  return [...legacyHistory, ...enterpriseHistory].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
}

async function getLegacyConfigHistory(filters: {
  parameter?: string;
  startDate?: Date;
  endDate?: Date;
  changedBy?: string;
}): Promise<ConfigHistoryEntry[]> {
  const conditions = [];
  if (filters.parameter) conditions.push(eq(configChangeHistory.parameter, filters.parameter));
  if (filters.startDate) conditions.push(gte(configChangeHistory.createdAt, filters.startDate));
  if (filters.endDate) conditions.push(lte(configChangeHistory.createdAt, filters.endDate));
  if (filters.changedBy) conditions.push(eq(configChangeHistory.changedBy, filters.changedBy));

  const rows = await db
    .select({
      id: configChangeHistory.id,
      parameter: configChangeHistory.parameter,
      oldValue: configChangeHistory.oldValue,
      newValue: configChangeHistory.newValue,
      changedBy: configChangeHistory.changedBy,
      reason: configChangeHistory.reason,
      createdAt: configChangeHistory.createdAt,
      changedByName: users.fullName,
      changedByEmail: users.email,
    })
    .from(configChangeHistory)
    .leftJoin(users, eq(configChangeHistory.changedBy, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(configChangeHistory.createdAt))
    .limit(500);

  return rows.map((row) => ({
    id: row.id,
    parameter: row.parameter,
    oldValue: row.oldValue,
    newValue: row.newValue,
    changedBy: row.changedBy,
    changedByName: row.changedByName || row.changedByEmail || undefined,
    reason: row.reason || undefined,
    createdAt: row.createdAt,
    source: 'auction_config',
  }));
}

async function getEnterprisePolicyHistory(filters: {
  parameter?: string;
  startDate?: Date;
  endDate?: Date;
  changedBy?: string;
}): Promise<ConfigHistoryEntry[]> {
  const rows = await db
    .select({
      id: businessPolicyVersions.id,
      version: businessPolicyVersions.version,
      policy: businessPolicyVersions.policy,
      notes: businessPolicyVersions.notes,
      publishedAt: businessPolicyVersions.publishedAt,
      createdAt: businessPolicyVersions.createdAt,
      publishedBy: businessPolicyVersions.publishedBy,
      createdBy: businessPolicyVersions.createdBy,
      actorName: users.fullName,
      actorEmail: users.email,
    })
    .from(businessPolicyVersions)
    .leftJoin(users, eq(businessPolicyVersions.publishedBy, users.id))
    .orderBy(desc(businessPolicyVersions.publishedAt))
    .limit(100);

  const publishedRows = rows
    .filter((row) => row.publishedAt)
    .sort((a, b) => (a.publishedAt?.getTime() ?? 0) - (b.publishedAt?.getTime() ?? 0));

  const baselinePolicy = structuredClone(DEFAULT_BUSINESS_POLICY);
  const entries: ConfigHistoryEntry[] = [];
  for (let index = 0; index < publishedRows.length; index += 1) {
    const row = publishedRows[index];
    const previous = publishedRows[index - 1];

    if (row.notes?.startsWith('Auction Config updated')) continue;
    if (row.notes?.startsWith('Deposit system ')) continue;

    const createdAt = row.publishedAt ?? row.createdAt;
    if (filters.startDate && createdAt < filters.startDate) continue;
    if (filters.endDate && createdAt > filters.endDate) continue;

    const actorId = row.publishedBy || row.createdBy || 'unknown';
    if (filters.changedBy && actorId !== filters.changedBy) continue;

    const previousPolicy = previous?.policy ?? baselinePolicy;
    const oldConfig = policyToHistoryConfig(previousPolicy);
    const newConfig = policyToHistoryConfig(row.policy);
    let changedFields = 0;

    for (const [parameter, newValue] of Object.entries(newConfig)) {
      const oldValue = oldConfig[parameter];
      if (oldValue === newValue) continue;
      if (filters.parameter && parameter !== filters.parameter) continue;

      changedFields += 1;
      entries.push({
        id: `${row.id}:${parameter}`,
        parameter,
        oldValue,
        newValue,
        changedBy: actorId,
        changedByName: row.actorName || row.actorEmail || undefined,
        reason: row.notes || `Enterprise Setup published ${row.version}`,
        createdAt,
        source: 'enterprise_setup',
      });
    }

    if (changedFields === 0 && !filters.parameter) {
      entries.push({
        id: `${row.id}:policy_publish`,
        parameter: 'policy_publish',
        oldValue: previous?.version ?? baselinePolicy.version,
        newValue: row.version,
        changedBy: actorId,
        changedByName: row.actorName || row.actorEmail || undefined,
        reason: row.notes || `Enterprise Setup published ${row.version}`,
        createdAt,
        source: 'enterprise_setup',
      });
    }
  }

  return entries;
}

const ONBOARDING_MODE_LABELS: Record<string, string> = {
  tiered_bvn_fee_tier2: 'Tiered (BVN → fee → Tier 2)',
  single_full_kyc: 'Single full KYC',
  full_kyc_before_bidding: 'Full KYC before bidding',
  fee_before_tier1: 'Fee before Tier 1',
};

function policyToHistoryConfig(policy: BusinessPolicy): Record<string, string> {
  const config = policyToLegacyAuctionConfig(policy);

  const auctionFields: Record<string, string> = {
    registration_fee: formatNaira(config.registrationFee),
    deposit_rate: `${config.depositRate}%`,
    minimum_deposit_floor: formatNaira(config.minimumDepositFloor),
    tier_1_limit: formatNaira(config.tier1Limit),
    minimum_bid_increment: formatNaira(config.minimumBidIncrement),
    document_validity_period: `${config.documentValidityPeriod} hours`,
    max_grace_extensions: String(config.maxGraceExtensions),
    grace_extension_duration: `${config.graceExtensionDuration} hours`,
    fallback_buffer_period: `${config.fallbackBufferPeriod} hours`,
    top_bidders_to_keep_frozen: String(config.topBiddersToKeepFrozen),
    forfeiture_percentage: `${config.forfeiturePercentage}%`,
    payment_deadline_after_signing: `${config.paymentDeadlineAfterSigning} hours`,
    deposit_system_enabled: policy.escrow.depositSystemEnabled ? 'Enabled' : 'Disabled',
  };

  const enterpriseFields: Record<string, string> = {
    onboarding_mode:
      ONBOARDING_MODE_LABELS[policy.onboarding.mode] ?? policy.onboarding.mode,
    registration_fee_required: policy.onboarding.registrationFeeRequired ? 'Yes' : 'No',
    allow_bid_after_tier1: policy.onboarding.allowBidAfterTier1 ? 'Yes' : 'No',
    staff_mfa_required: policy.auth.staffMfaRequired ? 'Yes' : 'No',
    vendor_mfa_required: policy.auth.vendorMfaRequired ? 'Yes' : 'No',
    user_managed_mfa_allowed: policy.auth.userManagedMfaAllowed ? 'Yes' : 'No',
  };

  return { ...auctionFields, ...enterpriseFields };
}

function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString('en-NG')}`;
}
