/**
 * Comprehensive Reporting System - Type Definitions
 * 
 * Core types and interfaces for the reporting system
 * Task 3: Core Report Engine Foundation
 */

/**
 * User roles with report access
 */
export type UserRole = 
  | 'system_admin'
  | 'salvage_manager'
  | 'finance_officer'
  | 'claims_adjuster'
  | 'vendor';

/**
 * Report categories
 */
export type ReportCategory = 
  | 'financial'
  | 'operational'
  | 'user_performance'
  | 'compliance'
  | 'executive'
  | 'master'
  | 'ai_magazine';

/**
 * Report types
 */
export type ReportType =
  // Financial
  | 'revenue-analysis'
  | 'payment-analytics'
  | 'vendor-spending'
  | 'profitability'
  // Operational
  | 'case-processing'
  | 'auction-performance'
  | 'document-management'
  | 'vendor-performance'
  // User Performance
  | 'adjuster-metrics'
  | 'finance-metrics'
  | 'manager-metrics'
  | 'admin-metrics'
  | 'my-performance'
  // Compliance
  | 'regulatory-compliance'
  | 'audit-trail'
  | 'document-compliance'
  // Executive
  | 'kpi-dashboard'
  | 'strategic-insights'
  // Master
  | 'comprehensive-report'
  | 'role-specific-report'
  // AI
  | 'ai-magazine';

/**
 * Export formats
 */
export type ExportFormat = 'pdf' | 'excel' | 'csv' | 'json';

/**
 * Report filters
 */
export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  assetTypes?: string[];
  regions?: string[];
  userIds?: string[];
  vendorIds?: string[];
  status?: string[];
  minAmount?: number;
  maxAmount?: number;
  groupBy?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * Report configuration
 */
export interface ReportConfig {
  type: ReportType;
  filters: ReportFilters;
  includeCharts?: boolean;
  chartTypes?: string[];
  format?: ExportFormat;
}

/**
 * Report result
 */
export interface ReportResult<T = any> {
  reportId: string;
  type: ReportType;
  data: T;
  metadata: ReportMetadata;
  charts?: ChartData[];
}

/**
 * Report metadata
 */
export interface ReportMetadata {
  generatedAt: string;
  generatedBy: string;
  filters: ReportFilters;
  recordCount: number;
  executionTimeMs: number;
  cached: boolean;
}

/**
 * Chart data
 */
export interface ChartData {
  id: string;
  type: 'line' | 'bar' | 'pie' | 'heatmap' | 'scatter' | 'gauge' | 'funnel' | 'area';
  title: string;
  data: any;
  options?: any;
}

/**
 * Report permissions
 */
export interface ReportPermissions {
  canViewFinancial: boolean;
  canViewOperational: boolean;
  canViewUserPerformance: boolean;
  canViewCompliance: boolean;
  canViewExecutive: boolean;
  canViewAllUsers: boolean;
  canScheduleReports: boolean;
  canExportReports: boolean;
  canViewAuditLogs: boolean;
}

/**
 * Role-based permissions mapping
 */
export const ROLE_PERMISSIONS: Record<UserRole, ReportPermissions> = {
  system_admin: {
    canViewFinancial: true,
    canViewOperational: true,
    canViewUserPerformance: true,
    canViewCompliance: true,
    canViewExecutive: true,
    canViewAllUsers: true,
    canScheduleReports: true,
    canExportReports: true,
    canViewAuditLogs: true,
  },
  salvage_manager: {
    canViewFinancial: true,
    canViewOperational: true,
    canViewUserPerformance: true,
    canViewCompliance: true,
    canViewExecutive: true,
    canViewAllUsers: true,
    canScheduleReports: true,
    canExportReports: true,
    canViewAuditLogs: false,
  },
  finance_officer: {
    canViewFinancial: true,
    canViewOperational: false,
    canViewUserPerformance: false,
    canViewCompliance: true,
    canViewExecutive: false,
    canViewAllUsers: false,
    canScheduleReports: true,
    canExportReports: true,
    canViewAuditLogs: false,
  },
  claims_adjuster: {
    canViewFinancial: false,
    canViewOperational: false,
    canViewUserPerformance: true, // Own only
    canViewCompliance: false,
    canViewExecutive: false,
    canViewAllUsers: false,
    canScheduleReports: false,
    canExportReports: true,
    canViewAuditLogs: false,
  },
  vendor: {
    canViewFinancial: false,
    canViewOperational: false,
    canViewUserPerformance: true, // Own only
    canViewCompliance: false,
    canViewExecutive: false,
    canViewAllUsers: false,
    canScheduleReports: false,
    canExportReports: true,
    canViewAuditLogs: false,
  },
};

/**
 * Report cache entry
 */
export interface ReportCacheEntry {
  key: string;
  data: any;
  expiresAt: Date;
}

/**
 * Scheduled report configuration
 */
export interface ScheduledReportConfig {
  reportType: ReportType;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  scheduleConfig: {
    dayOfWeek?: number;
    dayOfMonth?: number;
    time: string;
    timezone: string;
  };
  recipients: string[];
  filters: ReportFilters;
  format: ExportFormat;
}

/**
 * Report audit entry
 */
export interface ReportAuditEntry {
  userId: string;
  reportType: ReportType;
  action: 'generate' | 'export' | 'schedule' | 'share';
  filters?: ReportFilters;
  exportFormat?: ExportFormat;
  ipAddress?: string;
  userAgent?: string;
  executionTimeMs?: number;
  success: boolean;
  errorMessage?: string;
}
