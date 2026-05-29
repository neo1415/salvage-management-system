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
import { businessPolicyService } from '@/features/business-policy/business-policy.service';
import { policyToLegacyAuctionConfig } from '@/features/business-policy/legacy-auction-config-bridge';
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

  const runtimePolicy = await businessPolicyService.getRuntimeDefaultPolicy();
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

    const previousPolicy = previous?.policy ?? runtimePolicy;
    const oldConfig = policyToHistoryConfig(previousPolicy);
    const newConfig = policyToHistoryConfig(row.policy);
    let changedAuctionConfigFields = 0;

    for (const [parameter, newValue] of Object.entries(newConfig)) {
      const oldValue = oldConfig[parameter];
      if (oldValue === newValue) continue;
      if (filters.parameter && parameter !== filters.parameter) continue;

      changedAuctionConfigFields += 1;
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

    if (changedAuctionConfigFields === 0 && (!filters.parameter || filters.parameter === 'enterprise_setup')) {
      entries.push({
        id: `${row.id}:enterprise_setup`,
        parameter: 'enterprise_setup',
        oldValue: previous?.version ?? runtimePolicy.version,
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

function policyToHistoryConfig(policy: BusinessPolicy): Record<string, string> {
  const config = policyToLegacyAuctionConfig(policy);

  return {
    registration_fee: String(config.registrationFee),
    deposit_rate: String(config.depositRate),
    minimum_deposit_floor: String(config.minimumDepositFloor),
    tier_1_limit: String(config.tier1Limit),
    minimum_bid_increment: String(config.minimumBidIncrement),
    document_validity_period: String(config.documentValidityPeriod),
    max_grace_extensions: String(config.maxGraceExtensions),
    grace_extension_duration: String(config.graceExtensionDuration),
    fallback_buffer_period: String(config.fallbackBufferPeriod),
    top_bidders_to_keep_frozen: String(config.topBiddersToKeepFrozen),
    forfeiture_percentage: String(config.forfeiturePercentage),
    payment_deadline_after_signing: String(config.paymentDeadlineAfterSigning),
    deposit_system_enabled: String(policy.escrow.depositSystemEnabled),
  };
}
