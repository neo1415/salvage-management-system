/**
 * Document generation health metrics.
 *
 * This module is intentionally read-only. It aggregates existing audit logs and
 * release form records so monitoring cannot alter auction, payment, or document
 * state.
 */

import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { AuditActionType } from '@/lib/utils/audit-logger';

export enum TimePeriod {
  LAST_HOUR = 'last_hour',
  LAST_24_HOURS = 'last_24h',
  LAST_7_DAYS = 'last_7d',
}

export interface DocumentGenerationHealth {
  successRate: {
    lastHour: number;
    last24h: number;
    last7d: number;
  };
  totalGenerated: {
    lastHour: number;
    last24h: number;
    last7d: number;
  };
  totalFailed: {
    lastHour: number;
    last24h: number;
    last7d: number;
  };
  failuresByDocumentType: Array<{
    documentType: string;
    count: number;
    percentage: number;
  }>;
  failuresByErrorType: Array<{
    errorType: string;
    count: number;
    percentage: number;
    lastOccurrence: Date;
  }>;
  auctionsWithMissingDocuments: Array<{
    auctionId: string;
    missingDocuments: string[];
    missingSince: Date;
  }>;
  recentFailures: Array<{
    id: string;
    auctionId: string;
    documentType: string;
    errorMessage: string;
    timestamp: Date;
    userId: string;
  }>;
  averageRetryAttempts: number;
  lastChecked: Date;
}

const GENERATED_ACTION = AuditActionType.DOCUMENT_GENERATED;
const FAILED_ACTION = AuditActionType.DOCUMENT_GENERATION_FAILED;

function getTimestampForPeriod(period: TimePeriod): Date {
  const now = Date.now();

  switch (period) {
    case TimePeriod.LAST_HOUR:
      return new Date(now - 60 * 60 * 1000);
    case TimePeriod.LAST_24_HOURS:
      return new Date(now - 24 * 60 * 60 * 1000);
    case TimePeriod.LAST_7_DAYS:
      return new Date(now - 7 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now - 24 * 60 * 60 * 1000);
  }
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value) || 0;
  return 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

async function countAuditAction(actionType: AuditActionType, since: Date): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLogs)
    .where(and(eq(auditLogs.actionType, actionType), gte(auditLogs.createdAt, since)));

  return toNumber(row?.count);
}

async function getPeriodCounts(period: TimePeriod) {
  const since = getTimestampForPeriod(period);
  const [generated, failed] = await Promise.all([
    countAuditAction(GENERATED_ACTION, since),
    countAuditAction(FAILED_ACTION, since),
  ]);

  const total = generated + failed;
  const successRate = total === 0 ? 100 : Math.round((generated / total) * 1000) / 10;

  return { generated, failed, successRate };
}

async function getRecentFailures(): Promise<DocumentGenerationHealth['recentFailures']> {
  const rows = await db
    .select({
      id: auditLogs.id,
      userId: auditLogs.userId,
      entityId: auditLogs.entityId,
      afterState: auditLogs.afterState,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(eq(auditLogs.actionType, FAILED_ACTION))
    .orderBy(desc(auditLogs.createdAt))
    .limit(20);

  return rows.map((row) => {
    const state = asRecord(row.afterState);

    return {
      id: row.id,
      userId: row.userId,
      auctionId: String(state.auctionId || row.entityId || 'unknown'),
      documentType: String(state.documentType || state.document_type || 'unknown'),
      errorMessage: String(state.errorMessage || state.error || 'Document generation failed'),
      timestamp: row.createdAt,
    };
  });
}

async function getFailureBreakdowns() {
  const since = getTimestampForPeriod(TimePeriod.LAST_7_DAYS);

  const rows = await db
    .select({
      afterState: auditLogs.afterState,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(and(eq(auditLogs.actionType, FAILED_ACTION), gte(auditLogs.createdAt, since)))
    .orderBy(desc(auditLogs.createdAt));

  const byDocumentType = new Map<string, number>();
  const byErrorType = new Map<string, { count: number; lastOccurrence: Date }>();

  for (const row of rows) {
    const state = asRecord(row.afterState);
    const documentType = String(state.documentType || state.document_type || 'unknown');
    const errorType = String(state.errorType || state.errorCode || 'generation_error');

    byDocumentType.set(documentType, (byDocumentType.get(documentType) || 0) + 1);

    const existing = byErrorType.get(errorType);
    if (!existing) {
      byErrorType.set(errorType, { count: 1, lastOccurrence: row.createdAt });
    } else {
      existing.count += 1;
      if (row.createdAt > existing.lastOccurrence) {
        existing.lastOccurrence = row.createdAt;
      }
    }
  }

  const totalFailures = Math.max(rows.length, 1);

  return {
    failuresByDocumentType: Array.from(byDocumentType.entries()).map(([documentType, count]) => ({
      documentType,
      count,
      percentage: Math.round((count / totalFailures) * 1000) / 10,
    })),
    failuresByErrorType: Array.from(byErrorType.entries()).map(([errorType, value]) => ({
      errorType,
      count: value.count,
      percentage: Math.round((value.count / totalFailures) * 1000) / 10,
      lastOccurrence: value.lastOccurrence,
    })),
  };
}

async function getAuctionsWithMissingDocuments(): Promise<
  DocumentGenerationHealth['auctionsWithMissingDocuments']
> {
  const rows = await db
    .select({
      auctionId: releaseForms.auctionId,
      documentType: releaseForms.documentType,
      createdAt: releaseForms.createdAt,
    })
    .from(releaseForms)
    .where(inArray(releaseForms.status, ['pending', 'expired']))
    .orderBy(desc(releaseForms.createdAt))
    .limit(100);

  const grouped = new Map<string, { missingDocuments: string[]; missingSince: Date }>();

  for (const row of rows) {
    const current = grouped.get(row.auctionId);
    if (!current) {
      grouped.set(row.auctionId, {
        missingDocuments: [row.documentType],
        missingSince: row.createdAt,
      });
      continue;
    }

    if (!current.missingDocuments.includes(row.documentType)) {
      current.missingDocuments.push(row.documentType);
    }
    if (row.createdAt < current.missingSince) {
      current.missingSince = row.createdAt;
    }
  }

  return Array.from(grouped.entries()).map(([auctionId, value]) => ({
    auctionId,
    ...value,
  }));
}

export async function getDocumentGenerationHealth(): Promise<DocumentGenerationHealth> {
  const [lastHour, last24h, last7d, failures, recentFailures, auctionsWithMissingDocuments] =
    await Promise.all([
      getPeriodCounts(TimePeriod.LAST_HOUR),
      getPeriodCounts(TimePeriod.LAST_24_HOURS),
      getPeriodCounts(TimePeriod.LAST_7_DAYS),
      getFailureBreakdowns(),
      getRecentFailures(),
      getAuctionsWithMissingDocuments(),
    ]);

  return {
    successRate: {
      lastHour: lastHour.successRate,
      last24h: last24h.successRate,
      last7d: last7d.successRate,
    },
    totalGenerated: {
      lastHour: lastHour.generated,
      last24h: last24h.generated,
      last7d: last7d.generated,
    },
    totalFailed: {
      lastHour: lastHour.failed,
      last24h: last24h.failed,
      last7d: last7d.failed,
    },
    failuresByDocumentType: failures.failuresByDocumentType,
    failuresByErrorType: failures.failuresByErrorType,
    auctionsWithMissingDocuments,
    recentFailures,
    averageRetryAttempts: 0,
    lastChecked: new Date(),
  };
}

