/**
 * Compliance & Audit Reports Service
 * 
 * Provides compliance tracking and audit trail reporting
 * Task 30: Compliance & Audit Reports
 */

import { db } from '@/lib/db/drizzle';
import { reportAuditLog } from '@/lib/db/schema/reports';
import { salvageCases, auctions, payments, users } from '@/lib/db/schema';
import { eq, and, gte, lte, desc, count, sql } from 'drizzle-orm';
import { ReportFilters } from '../../types';

export interface ComplianceReport {
  summary: {
    totalActions: number;
    uniqueUsers: number;
    reportTypes: number;
    successRate: number;
    averageExecutionTime: number;
  };
  auditTrail: Array<{
    id: string;
    userId: string;
    userName: string;
    reportType: string;
    action: string;
    timestamp: Date;
    success: boolean;
    executionTimeMs: number;
    ipAddress?: string;
  }>;
  complianceMetrics: {
    dataAccessCompliance: number;
    reportGenerationCompliance: number;
    exportCompliance: number;
  };
}

export interface RegulatoryComplianceReport {
  summary: {
    totalCases: number;
    compliantCases: number;
    complianceRate: number;
    pendingReviews: number;
  };
  caseCompliance: Array<{
    caseId: string;
    claimReference: string;
    status: string;
    hasAllDocuments: boolean;
    hasApproval: boolean;
    isCompliant: boolean;
  }>;
  documentCompliance: {
    totalRequired: number;
    totalGenerated: number;
    completionRate: number;
  };
}

export class ComplianceService {
  /**
   * Generate audit trail report
   */
  static async generateAuditTrailReport(filters: ReportFilters): Promise<ComplianceReport> {
    const conditions = [];
    
    if (filters.startDate) {
      conditions.push(gte(reportAuditLog.createdAt, new Date(filters.startDate)));
    }
    if (filters.endDate) {
      conditions.push(lte(reportAuditLog.createdAt, new Date(filters.endDate)));
    }
    if (filters.userIds && filters.userIds.length > 0) {
      conditions.push(sql`${reportAuditLog.userId} = ANY(${filters.userIds})`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get audit trail data
    const auditData = await db
      .select({
        id: reportAuditLog.id,
        userId: reportAuditLog.userId,
        userName: users.name,
        reportType: reportAuditLog.reportType,
        action: reportAuditLog.action,
        timestamp: reportAuditLog.createdAt,
        success: reportAuditLog.success,
        executionTimeMs: reportAuditLog.executionTimeMs,
        ipAddress: reportAuditLog.ipAddress,
      })
      .from(reportAuditLog)
      .leftJoin(users, eq(reportAuditLog.userId, users.id))
      .where(whereClause)
      .orderBy(desc(reportAuditLog.createdAt))
      .limit(1000);

    // Calculate summary metrics
    const totalActions = auditData.length;
    const uniqueUsers = new Set(auditData.map(a => a.userId).filter(Boolean)).size;
    const reportTypes = new Set(auditData.map(a => a.reportType)).size;
    const successfulActions = auditData.filter(a => a.success).length;
    const successRate = totalActions > 0 ? (successfulActions / totalActions) * 100 : 0;
    const avgExecutionTime = auditData.length > 0
      ? auditData.reduce((sum, a) => sum + (a.executionTimeMs || 0), 0) / auditData.length
      : 0;

    // Calculate compliance metrics
    const generateActions = auditData.filter(a => a.action === 'generate').length;
    const exportActions = auditData.filter(a => a.action === 'export').length;
    const totalReportActions = generateActions + exportActions;

    return {
      summary: {
        totalActions,
        uniqueUsers,
        reportTypes,
        successRate: Math.round(successRate * 100) / 100,
        averageExecutionTime: Math.round(avgExecutionTime),
      },
      auditTrail: auditData.map(a => ({
        id: a.id,
        userId: a.userId || 'unknown',
        userName: a.userName || 'Unknown User',
        reportType: a.reportType,
        action: a.action,
        timestamp: a.timestamp,
        success: a.success,
        executionTimeMs: a.executionTimeMs || 0,
        ipAddress: a.ipAddress || undefined,
      })),
      complianceMetrics: {
        dataAccessCompliance: totalActions > 0 ? (successfulActions / totalActions) * 100 : 100,
        reportGenerationCompliance: generateActions > 0 ? (auditData.filter(a => a.action === 'generate' && a.success).length / generateActions) * 100 : 100,
        exportCompliance: exportActions > 0 ? (auditData.filter(a => a.action === 'export' && a.success).length / exportActions) * 100 : 100,
      },
    };
  }

  /**
   * Generate regulatory compliance report
   */
  static async generateRegulatoryComplianceReport(filters: ReportFilters): Promise<RegulatoryComplianceReport> {
    const conditions = [];
    
    if (filters.startDate) {
      conditions.push(gte(salvageCases.createdAt, new Date(filters.startDate)));
    }
    if (filters.endDate) {
      conditions.push(lte(salvageCases.createdAt, new Date(filters.endDate)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get case data with compliance indicators
    const cases = await db
      .select({
        caseId: salvageCases.id,
        claimReference: salvageCases.claimReference,
        status: salvageCases.status,
        hasAuction: sql<boolean>`EXISTS(SELECT 1 FROM ${auctions} WHERE ${auctions.caseId} = ${salvageCases.id})`,
        hasPayment: sql<boolean>`EXISTS(SELECT 1 FROM ${payments} p JOIN ${auctions} a ON p.auction_id = a.id WHERE a.case_id = ${salvageCases.id} AND p.status = 'completed')`,
      })
      .from(salvageCases)
      .where(whereClause)
      .limit(500);

    // Determine compliance for each case
    const caseCompliance = cases.map(c => {
      const hasAllDocuments = c.status !== 'draft'; // Simplified check
      const hasApproval = c.status === 'approved' || c.status === 'active_auction' || c.status === 'closed';
      const isCompliant = hasAllDocuments && hasApproval;

      return {
        caseId: c.caseId,
        claimReference: c.claimReference,
        status: c.status,
        hasAllDocuments,
        hasApproval,
        isCompliant,
      };
    });

    const totalCases = caseCompliance.length;
    const compliantCases = caseCompliance.filter(c => c.isCompliant).length;
    const complianceRate = totalCases > 0 ? (compliantCases / totalCases) * 100 : 0;
    const pendingReviews = caseCompliance.filter(c => c.status === 'pending_approval').length;

    // Document compliance (simplified)
    const casesWithAuctions = cases.filter(c => c.hasAuction).length;
    const casesWithPayments = cases.filter(c => c.hasPayment).length;

    return {
      summary: {
        totalCases,
        compliantCases,
        complianceRate: Math.round(complianceRate * 100) / 100,
        pendingReviews,
      },
      caseCompliance,
      documentCompliance: {
        totalRequired: totalCases,
        totalGenerated: casesWithAuctions,
        completionRate: totalCases > 0 ? (casesWithAuctions / totalCases) * 100 : 0,
      },
    };
  }

  /**
   * Generate user activity compliance report
   */
  static async generateUserActivityReport(filters: ReportFilters) {
    const conditions = [];
    
    if (filters.startDate) {
      conditions.push(gte(reportAuditLog.createdAt, new Date(filters.startDate)));
    }
    if (filters.endDate) {
      conditions.push(lte(reportAuditLog.createdAt, new Date(filters.endDate)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get user activity summary
    const userActivity = await db
      .select({
        userId: reportAuditLog.userId,
        userName: users.name,
        userRole: users.role,
        totalActions: count(reportAuditLog.id),
        reportTypes: sql<string[]>`array_agg(DISTINCT ${reportAuditLog.reportType})`,
      })
      .from(reportAuditLog)
      .leftJoin(users, eq(reportAuditLog.userId, users.id))
      .where(whereClause)
      .groupBy(reportAuditLog.userId, users.name, users.role)
      .orderBy(desc(count(reportAuditLog.id)));

    return {
      summary: {
        totalUsers: userActivity.length,
        totalActions: userActivity.reduce((sum, u) => sum + u.totalActions, 0),
      },
      userActivity: userActivity.map(u => ({
        userId: u.userId || 'unknown',
        userName: u.userName || 'Unknown User',
        userRole: u.userRole || 'unknown',
        totalActions: u.totalActions,
        reportTypes: u.reportTypes || [],
      })),
    };
  }
}
