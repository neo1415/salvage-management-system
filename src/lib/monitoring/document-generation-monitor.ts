/**
 * Document Generation Monitoring Utility
 * 
 * Queries audit logs to track document generation health metrics.
 * Provides success rates, failure analysis, and health indicators.
 * 
 * Usage:
 * ```typescript
 * import { getDocumentGenerationHealth } from '@/lib/monitoring/document-generation-monitor';
 * 
 * const health = await getDocumentGenerationHealth();
 * console.log(`Success rate: ${health.successRate.last24h}%`);
 * ```
 */

import { db } from '@/lib/db/drizzle';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { auctions } from '@/lib/db/schema/auctions';
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import { AuditActionType } from '@/lib/utils/audit-logger';

/**
 * Time period for metrics calculation
 */
export enum TimePeriod {
  LAST_HOUR = 'last_hour',
  LAST_24_HOURS = 'last_24h',
  LAST_7_DAYS = 'last_7d',
}

/**
 * Document generation health metrics
 */
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

/**
 * Get timestamp for time period
 */
function getTimestampForPeriod(period: TimePeriod): Date {
  const now