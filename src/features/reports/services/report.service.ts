/**
 * Core Report Service
 * 
 * Base service for all report generation
 * Task 3: Core Report Engine Foundation
 */

import { ReportConfig, ReportResult, ReportType, ReportFilters, UserRole, ROLE_PERMISSIONS } from '../types';
import { ReportCacheService } from './report-cache.service';
import { ReportAuditService } from './report-audit.service';
import { v4 as uuidv4 } from 'uuid';

export class ReportService {
  /**
   * Check if user has permission to access report type
   */
  static hasPermission(userRole: UserRole, reportType: ReportType): boolean {
    const permissions = ROLE_PERMISSIONS[userRole];
    
    // Financial reports
    if (['revenue-analysis', 'payment-analytics', 'vendor-spending', 'profitability'].includes(reportType)) {
      return permissions.canViewFinancial;
    }
    
    // Operational reports
    if (['case-processing', 'auction-performance', 'document-management', 'vendor-performance'].includes(reportType)) {
      return permissions.canViewOperational;
    }
    
    // User performance reports
    if (['adjuster-metrics', 'finance-metrics', 'manager-metrics', 'admin-metrics', 'my-performance'].includes(reportType)) {
      return permissions.canViewUserPerformance;
    }
    
    // Compliance reports
    if (['regulatory-compliance', 'audit-trail', 'document-compliance'].includes(reportType)) {
      return permissions.canViewCompliance;
    }
    
    // Executive reports
    if (['kpi-dashboard', 'strategic-insights'].includes(reportType)) {
      return permissions.canViewExecutive;
    }
    
    // Master reports
    if (['comprehensive-report', 'role-specific-report'].includes(reportType)) {
      return permissions.canViewExecutive;
    }
    
    // AI magazine
    if (reportType === 'ai-magazine') {
      return permissions.canViewExecutive;
    }
    
    return false;
  }

  /**
   * Filter data based on user role and permissions
   */
  static filterDataByRole(
    data: any[],
    userRole: UserRole,
    userId: string,
    dataType: 'user' | 'vendor' | 'general'
  ): any[] {
    const permissions = ROLE_PERMISSIONS[userRole];
    
    // Admins and managers see everything
    if (permissions.canViewAllUsers) {
      return data;
    }
    
    // For user-specific data, filter to own data only
    if (dataType === 'user') {
      return data.filter(item => item.userId === userId || item.id === userId);
    }
    
    // For vendor-specific data, filter to own data only
    if (dataType === 'vendor') {
      return data.filter(item => item.vendorId === userId || item.id === userId);
    }
    
    // For general data, return as is
    return data;
  }

  /**
   * Generate report with caching and audit logging
   */
  static async generateReport<T = any>(
    config: ReportConfig,
    userId: string,
    userRole: UserRole,
    dataFetcher: (filters: ReportFilters) => Promise<T>,
    options: {
      useCache?: boolean;
      cacheTTL?: number;
      ipAddress?: string;
      userAgent?: string;
    } = {}
  ): Promise<ReportResult<T>> {
    const startTime = Date.now();
    const { useCache = true, cacheTTL = 15, ipAddress, userAgent } = options;
    
    try {
      // Check permissions
      if (!this.hasPermission(userRole, config.type)) {
        throw new Error('Unauthorized: User does not have permission to access this report');
      }

      // Try to get from cache
      let data: T | null = null;
      let cached = false;
      
      if (useCache) {
        data = await ReportCacheService.getCachedReport(config.type, config.filters);
        if (data) {
          cached = true;
        }
      }

      // If not cached, fetch data
      if (!data) {
        data = await dataFetcher(config.filters);
        
        // Cache the result
        if (useCache && data) {
          await ReportCacheService.cacheReport(config.type, config.filters, data, cacheTTL);
        }
      }

      const executionTimeMs = Date.now() - startTime;

      // Log audit entry
      await ReportAuditService.logReportGeneration(
        userId,
        config.type,
        config.filters,
        executionTimeMs,
        true,
        undefined,
        ipAddress,
        userAgent
      );

      // Build result
      const result: ReportResult<T> = {
        reportId: uuidv4(),
        type: config.type,
        data: data as T,
        metadata: {
          generatedAt: new Date().toISOString(),
          generatedBy: userId,
          filters: config.filters,
          recordCount: Array.isArray(data) ? data.length : 0,
          executionTimeMs,
          cached,
        },
      };

      return result;
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log failed attempt
      await ReportAuditService.logReportGeneration(
        userId,
        config.type,
        config.filters,
        executionTimeMs,
        false,
        errorMessage,
        ipAddress,
        userAgent
      );

      throw error;
    }
  }

  /**
   * Validate date range
   */
  static validateDateRange(startDate?: string, endDate?: string): { start: Date; end: Date } {
    if (!startDate || !endDate) {
      throw new Error('startDate and endDate are required');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format. Use ISO date strings');
    }

    if (start > end) {
      throw new Error('startDate must be before endDate');
    }

    return { start, end };
  }

  /**
   * Calculate percentage
   */
  static calculatePercentage(value: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((value / total) * 10000) / 100;
  }

  /**
   * Round to 2 decimal places
   */
  static round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
