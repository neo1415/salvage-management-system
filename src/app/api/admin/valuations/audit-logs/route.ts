/**
 * Admin API: Valuation Audit Logs
 * 
 * GET /api/admin/valuations/audit-logs - Query audit logs with filters
 * 
 * Requirements: 12.2, 12.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { valuationAuditService } from '@/features/valuations/services/audit.service';

/**
 * GET /api/admin/valuations/audit-logs
 * Query audit logs with filters
 * Requirements: 12.2, 12.5
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication and authorization
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Restrict to admin role only (Requirement 12.5)
    if (session.user.role !== 'system_admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin role required' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId') || undefined;
    const entityType = searchParams.get('entityType') as 'valuation' | 'deduction' | undefined;
    const action = searchParams.get('action') as 'create' | 'update' | 'delete' | 'import' | undefined;
    const startDate = searchParams.get('startDate') 
      ? new Date(searchParams.get('startDate')!) 
      : undefined;
    const endDate = searchParams.get('endDate') 
      ? new Date(searchParams.get('endDate')!) 
      : undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Query audit logs (Requirements: 12.2, 12.5)
    const result = await valuationAuditService.query({
      userId,
      entityType,
      action,
      startDate,
      endDate,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
