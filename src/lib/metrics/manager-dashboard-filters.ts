import { sql, and, eq, type SQL } from 'drizzle-orm';
import { assetTypeEnum } from '@/lib/db/schema/vendors';
import { salvageCases } from '@/lib/db/schema/cases';

export type AssetTypeValue = typeof assetTypeEnum.enumValues[number];

export type ManagerDashboardFilters = {
  assetType: AssetTypeValue | null;
  branchName: string | null;
  brokerQuery: string | null;
  startDate: Date | null;
  endDate: Date | null;
};

const ASSET_TYPE_SET = new Set<string>(assetTypeEnum.enumValues);

function parseDateInput(value: string | null): Date | null {
  if (!value?.trim()) return null;
  const parsed = new Date(`${value.trim()}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function endOfDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function parseManagerDashboardFilters(searchParams: URLSearchParams): ManagerDashboardFilters {
  const rawAssetType = searchParams.get('assetType')?.trim() || null;
  const assetType =
    rawAssetType && ASSET_TYPE_SET.has(rawAssetType) ? (rawAssetType as AssetTypeValue) : null;

  const branchName = searchParams.get('branchName')?.trim() || null;
  const brokerQuery = searchParams.get('brokerQuery')?.trim() || null;

  const dateRange = searchParams.get('dateRange') || '30';

  if (dateRange === 'all') {
    return { assetType, branchName, brokerQuery, startDate: null, endDate: null };
  }

  if (dateRange === 'custom') {
    const start = parseDateInput(searchParams.get('startDate'));
    const endRaw = parseDateInput(searchParams.get('endDate'));
    const endDate = endRaw ? endOfDay(endRaw) : null;
    return { assetType, branchName, brokerQuery, startDate: start, endDate };
  }

  const days = Number.parseInt(dateRange, 10);
  const safeDays = Number.isFinite(days) && days > 0 ? days : 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - safeDays);
  startDate.setHours(0, 0, 0, 0);

  return { assetType, branchName, brokerQuery, startDate, endDate: null };
}

export function buildManagerDashboardCacheKey(filters: ManagerDashboardFilters, dateRange: string): string {
  const start = filters.startDate?.toISOString() ?? 'none';
  const end = filters.endDate?.toISOString() ?? 'none';
  return [
    'dashboard:manager:v4',
    dateRange,
    filters.assetType ?? 'all',
    filters.branchName ?? 'all-branches',
    filters.brokerQuery ?? 'all-brokers',
    start,
    end,
  ].join(':');
}

/** SQL conditions for salvage_cases alias (e.g. sc). */
export function caseScopeConditions(alias: string, filters: ManagerDashboardFilters): SQL {
  const col = (name: string) => sql.raw(`${alias}.${name}`);

  const parts: SQL[] = [];

  if (filters.assetType) {
    parts.push(sql`${col('asset_type')} = ${filters.assetType}`);
  }
  if (filters.branchName) {
    parts.push(sql`COALESCE(NULLIF(TRIM(${col('branch_name')}), ''), 'Unassigned') = ${filters.branchName}`);
  }
  if (filters.brokerQuery) {
    const pattern = `%${filters.brokerQuery.toLowerCase()}%`;
    parts.push(sql`LOWER(COALESCE(${col('broker_name')}, '')) LIKE ${pattern}`);
  }
  if (filters.startDate) {
    parts.push(sql`${col('created_at')} >= ${filters.startDate.toISOString()}::timestamptz`);
  }
  if (filters.endDate) {
    parts.push(sql`${col('created_at')} <= ${filters.endDate.toISOString()}::timestamptz`);
  }

  if (parts.length === 0) {
    return sql`TRUE`;
  }

  return sql.join(parts, sql` AND `);
}

/** Case scope for operational queues (pickups) — ignores date range so current work is always visible. */
export function pickupQueueScopeConditions(alias: string, filters: ManagerDashboardFilters): SQL {
  const col = (name: string) => sql.raw(`${alias}.${name}`);
  const parts: SQL[] = [];

  if (filters.assetType) {
    parts.push(sql`${col('asset_type')} = ${filters.assetType}`);
  }
  if (filters.branchName) {
    parts.push(sql`COALESCE(NULLIF(TRIM(${col('branch_name')}), ''), 'Unassigned') = ${filters.branchName}`);
  }
  if (filters.brokerQuery) {
    const pattern = `%${filters.brokerQuery.toLowerCase()}%`;
    parts.push(sql`LOWER(COALESCE(${col('broker_name')}, '')) LIKE ${pattern}`);
  }

  if (parts.length === 0) {
    return sql`TRUE`;
  }

  return sql.join(parts, sql` AND `);
}

/** Drizzle conditions for direct salvage_cases queries. */
export function caseScopeDrizzle(filters: ManagerDashboardFilters): SQL | undefined {
  const parts: SQL[] = [];

  if (filters.assetType) {
    parts.push(eq(salvageCases.assetType, filters.assetType));
  }
  if (filters.branchName) {
    parts.push(
      sql`COALESCE(NULLIF(TRIM(${salvageCases.branchName}), ''), 'Unassigned') = ${filters.branchName}`
    );
  }
  if (filters.brokerQuery) {
    const pattern = `%${filters.brokerQuery.toLowerCase()}%`;
    parts.push(sql`LOWER(COALESCE(${salvageCases.brokerName}, '')) LIKE ${pattern}`);
  }
  if (filters.startDate) {
    parts.push(sql`${salvageCases.createdAt} >= ${filters.startDate.toISOString()}::timestamptz`);
  }
  if (filters.endDate) {
    parts.push(sql`${salvageCases.createdAt} <= ${filters.endDate.toISOString()}::timestamptz`);
  }

  if (parts.length === 0) {
    return undefined;
  }

  return and(...parts)!;
}
