/**
 * Scheduled Reports Execution Cron Job
 * 
 * Runs every hour to execute scheduled reports that are due.
 * Generates reports, distributes via email, and updates schedule.
 * 
 * Vercel Cron Configuration:
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/execute-scheduled-reports",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 * 
 * Task 29: Report Scheduling System
 */

import { NextRequest, NextResponse } from 'next/server';
import { ReportSchedulerService } from '@/features/reports/scheduling/services/report-scheduler.service';
import { ReportDistributionService } from '@/features/reports/scheduling/services/report-distribution.service';
import { ReportService } from '@/features/reports/services/report.service';
import { RevenueAnalysisService } from '@/features/reports/financial/services/revenue-analysis.service';
import { PaymentAnalyticsService } from '@/features/reports/financial/services/payment-analytics.service';
import { VendorSpendingService } from '@/features/reports/financial/services/vendor-spending.service';
import { ProfitabilityService } from '@/features/reports/financial/services/profitability.service';
import { AdjusterMetricsService, FinanceMetricsService, ManagerMetricsService } from '@/features/reports/user-performance/services';
import { ReportType } from '@/features/reports/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max execution time

/**
 * GET /api/cron/execute-scheduled-reports
 * Executes scheduled reports that are due
 */
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Verify cron secret (REQUIRED)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret) {
      console.error('[Security] CRON_SECRET not configured - cron endpoints are vulnerable!');
      return NextResponse.json(
        { error: 'Server misconfiguration' },
        { status: 500 }
      );
    }

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[Security] Unauthorized cron attempt', {
        hasAuthHeader: !!authHeader,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
      });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = new Date();
    console.log(`[Cron] Starting scheduled reports execution at ${now.toISOString()}`);

    // Get reports that are due
    const dueReports = await ReportSchedulerService.getDueReports();
    console.log(`[Cron] Found ${dueReports.length} reports to execute`);

    const results = [];

    for (const schedule of dueReports) {
      try {
        console.log(`[Cron] Executing scheduled report ${schedule.id} (${schedule.reportType})`);

        // Generate report
        const reportData = await generateReport(schedule.reportType, schedule.filters);

        // For now, we'll create a simple text buffer as placeholder
        // In Phase 5 Task 24-25, we'll implement actual PDF/Excel export
        const reportBuffer = Buffer.from(JSON.stringify(reportData, null, 2));

        // Distribute report
        const distribution = await ReportDistributionService.distributeReport({
          reportType: schedule.reportType,
          reportName: getReportName(schedule.reportType),
          recipients: schedule.recipients,
          format: schedule.format,
          reportData: reportBuffer,
          generatedAt: now,
          period: schedule.filters.startDate && schedule.filters.endDate
            ? {
                startDate: schedule.filters.startDate,
                endDate: schedule.filters.endDate,
              }
            : undefined,
        });

        // Mark as executed
        await ReportSchedulerService.markAsExecuted(
          schedule.id,
          distribution.success,
          distribution.errors.length > 0 ? distribution.errors.join('; ') : undefined
        );

        results.push({
          scheduleId: schedule.id,
          reportType: schedule.reportType,
          status: distribution.success ? 'success' : 'partial',
          delivered: distribution.delivered,
          failed: distribution.failed,
          errors: distribution.errors,
        });

        console.log(`[Cron] Successfully executed report ${schedule.id}, delivered to ${distribution.delivered} recipients`);
      } catch (error) {
        console.error(`[Cron] Error executing scheduled report ${schedule.id}:`, error);
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        await ReportSchedulerService.markAsExecuted(
          schedule.id,
          false,
          errorMessage
        );

        results.push({
          scheduleId: schedule.id,
          reportType: schedule.reportType,
          status: 'error',
          error: errorMessage,
        });
      }
    }

    console.log(`[Cron] Completed scheduled reports execution. Executed ${results.filter(r => r.status === 'success').length} reports`);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      reportsChecked: dueReports.length,
      reportsExecuted: results.filter(r => r.status === 'success' || r.status === 'partial').length,
      results,
    });
  } catch (error) {
    console.error('[Cron] Error in scheduled reports execution:', error);
    return NextResponse.json(
      {
        error: 'Failed to execute scheduled reports',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Generate report based on type
 */
async function generateReport(reportType: ReportType, filters: any): Promise<any> {
  switch (reportType) {
    case 'revenue-analysis':
      return await RevenueAnalysisService.generateReport(filters);
    case 'payment-analytics':
      return await PaymentAnalyticsService.generateReport(filters);
    case 'vendor-spending':
      return await VendorSpendingService.generateReport(filters);
    case 'profitability':
      return await ProfitabilityService.generateReport(filters);
    case 'adjuster-metrics':
      return await AdjusterMetricsService.generateReport(filters);
    case 'finance-metrics':
      return await FinanceMetricsService.generateReport(filters);
    case 'manager-metrics':
      return await ManagerMetricsService.generateReport(filters);
    default:
      throw new Error(`Unsupported report type: ${reportType}`);
  }
}

/**
 * Get human-readable report name
 */
function getReportName(reportType: ReportType): string {
  const names: Record<string, string> = {
    'revenue-analysis': 'Revenue & Recovery Analysis Report',
    'payment-analytics': 'Payment Analytics Report',
    'vendor-spending': 'Vendor Spending Analysis Report',
    'profitability': 'Profitability Report',
    'adjuster-metrics': 'Claims Adjuster Performance Report',
    'finance-metrics': 'Finance Officer Performance Report',
    'manager-metrics': 'Manager Performance Report',
  };

  return names[reportType] || reportType;
}
