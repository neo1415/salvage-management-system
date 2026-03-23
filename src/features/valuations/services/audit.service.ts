/**
 * Valuation Audit Logging Service
 * 
 * Logs all changes to valuations and deductions for audit trail
 * Requirements: 12.1, 12.2, 12.4, 12.5
 */

import { db } from '@/lib/db';
import { valuationAuditLogs } from '@/lib/db/schema/vehicle-valuations';
import { desc, eq, and, gte, lte } from 'drizzle-orm';

export type AuditAction = 'create' | 'update' | 'delete' | 'import';
export type AuditEntityType = 'valuation' | 'deduction';

export interface AuditLogEntry {
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  userId: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  metadata?: Record<string, unknown>;
}

export interface AuditLogQuery {
  userId?: string;
  entityType?: AuditEntityType;
  action?: AuditAction;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export class ValuationAuditService {
  /**
   * Log an audit entry
   * Requirements: 12.1, 12.4
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await db.insert(valuationAuditLogs).values({
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        userId: entry.userId,
        changedFields: entry.changes || null,
      });
    } catch (error) {
      console.error('Failed to log audit entry:', error);
      // Don't throw - audit logging should not break the main operation
    }
  }

  /**
   * Query audit logs with filters
   * Requirements: 12.2, 12.5
   */
  async query(query: AuditLogQuery) {
    const {
      userId,
      entityType,
      action,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = query;

    const conditions = [];

    if (userId) {
      conditions.push(eq(valuationAuditLogs.userId, userId));
    }
    if (entityType) {
      conditions.push(eq(valuationAuditLogs.entityType, entityType));
    }
    if (action) {
      conditions.push(eq(valuationAuditLogs.action, action));
    }
    if (startDate) {
      conditions.push(gte(valuationAuditLogs.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(valuationAuditLogs.createdAt, endDate));
    }

    const offset = (page - 1) * limit;

    let queryBuilder = db.select().from(valuationAuditLogs);

    if (conditions.length > 0) {
      queryBuilder = queryBuilder.where(and(...conditions)) as typeof queryBuilder;
    }

    // Reverse chronological order (Requirement 12.2)
    const results = await queryBuilder
      .orderBy(desc(valuationAuditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    let countQuery = db.select().from(valuationAuditLogs);
    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions)) as typeof countQuery;
    }
    const totalResults = await countQuery;
    const total = totalResults.length;

    return {
      data: results.map(log => ({
        ...log,
        changedFields: log.changedFields || null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get audit history for a specific entity
   * Requirements: 12.5
   */
  async getEntityHistory(entityType: AuditEntityType, entityId: string) {
    const results = await db
      .select()
      .from(valuationAuditLogs)
      .where(
        and(
          eq(valuationAuditLogs.entityType, entityType),
          eq(valuationAuditLogs.entityId, entityId)
        )
      )
      .orderBy(desc(valuationAuditLogs.createdAt));

    return results.map(log => ({
      ...log,
      changedFields: log.changedFields || null,
    }));
  }
}

// Export singleton instance
export const valuationAuditService = new ValuationAuditService();
