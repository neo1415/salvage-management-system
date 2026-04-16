/**
 * Audit Trail Report API
 * GET /api/reports/compliance/audit-trail
 * Task 30: Compliance & Audit Reports
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { ReportService } from '@/features/reports/services/report.service';
import { ComplianceService } from '@/features/reports/compliance/services/compliance.service';
import { ReportFilters } from '@/features/reports/types';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ status: 'error', error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    // Only admins and managers can view audit trails
    if (!['system_admin', 'salvage_manager'].includes(session.user.role)) {
      return NextResponse.json({ status: 'error', error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const { start, end } = ReportService.validateDateRange(searchParams.get('startDate'), searchParams.get('endDate'));

    const filters: ReportFilters = {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };

    const result = await ReportService.generateReport(
      { type: 'audit-trail', filters, includeCharts: false },
      session.user.id,
      session.user.role,
      async (filters) => await ComplianceService.generateAuditTrailReport(filters),
      { useCache: true, cacheTTL: 15 }
    );

    return NextResponse.json({
      status: 'success',
      data: result.data,
      metadata: { ...result.metadata, executionTimeMs: Date.now() - startTime },
    });
  } catch (error) {
    console.error('Audit trail report error:', error);
    return NextResponse.json({ status: 'error', error: { code: 'INTERNAL_SERVER_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } }, { status: 500 });
  }
}
