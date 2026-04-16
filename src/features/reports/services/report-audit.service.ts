/**
 * Report Audit Service
 * 
 * Handles audit logging for all report access and generation
 * Task 3: Core Report Engine Foundation
 */

import { db } from '@/lib/db/drizzle';
import { reportAuditLog } from '@/lib/db/schema/reports';
import { eq, desc } from 'drizzle-orm';
import { ReportAuditEntry, ReportType, ExportFormat, ReportFilters } from '../types';

export class ReportAuditService {
  /**
   * Log report generation
   */
  static async logReportGeneration(
    userId: string,
    reportType: ReportType,
    filters: ReportFilters,
    executionTimeMs: number,
    success: boolean = true,
    errorMessage?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await db.insert(reportAuditLog).values({
        userId,
        reportType,
        action: 'generate',
        filters,
        executionTimeMs,
        success,
        errorMessage,
        ipAddress,
        userAgent,
      });
    } catch (error) {
      console.error('Error logging report generation:', error);
      // Don't throw - audit logging failure shouldn't break report generation
    }
  }

  /**
   * Log report export
   */
  static async logReportExport(
    userId: string,
    reportType: ReportType,
    exportFormat: ExportFormat,
    filters: ReportFilters,
    success: boolean = true,
    errorMessage?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await db.insert(reportAuditLog).values({
        userId,
        reportType,
        action: 'export',
        exportFormat,
        filters,
        success,
        errorMessage,
        ipAddress,
        userAgent,
      });
    } catch (error) {
      console.error('Error logging report export:', error);
    }
  }

  /**
   * Log report scheduling
   */
  static async logReportSchedule(
    userId: string,
    reportType: ReportType,
    filters: ReportFilters,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    try {
      await db.insert(reportAuditLog).values({
        userId,
        reportType,
        action: 'schedule',
        filters,
        success,
        errorMessage,
      });
    } catch (error) {
      console.error('Error logging report schedule:', error);
    }
  }

  /**
   * Log report sharing
   */
  static async logReportShare(
    userId: string,
    reportType: ReportType,
    filters: ReportFilters,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    try {
      await db.insert(reportAuditLog).values({
        userId,
        reportType,
        action: 'share',
        filters,
        success,
        errorMessage,
      });
    } catch (error) {
      console.error('Error logging report share:', error);
    }
  }

  /**
   * Get audit logs for a user
   */
  static async getUserAuditLogs(userId: string, limit: number = 100) {
    try {
      return await db
        .select()
        .from(reportAuditLog)
        .where(eq(reportAuditLog.userId, userId))
        .orderBy(desc(reportAuditLog.createdAt))
        .limit(limit);
    } catch (error) {
      console.error('Error getting user audit logs:', error);
      return [];
    }
  }

  /**
   * Get audit logs for a report type
   */
  static async getReportTypeAuditLogs(reportType: ReportType, limit: number = 100) {
    try {
      return await db
        .select()
        .from(reportAuditLog)
        .where(eq(reportAuditLog.reportType, reportType))
        .orderBy(desc(reportAuditLog.createdAt))
        .limit(limit);
    } catch (error) {
      console.error('Error getting report type audit logs:', error);
      return [];
    }
  }
}
