/**
 * Configuration History API Route
 * Returns audit trail of configuration changes
 * 
 * Requirements:
 * - Requirement 20: Configuration Change Audit Trail
 * 
 * SECURITY: Role-based access control (System Admin only)
 * PERFORMANCE: Supports filtering and pagination
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { configService } from '@/features/auction-deposit/services/config.service';

/**
 * GET /api/admin/config/history
 * Get configuration change history
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // RBAC: Verify user is System Admin or Manager
    const authorizedRoles = ['system_admin', 'salvage_manager'];
    if (!authorizedRoles.includes(session.user.role || '')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Forbidden - System Admin role required' 
        },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const parameter = searchParams.get('parameter') || undefined;
    const startDate = searchParams.get('startDate') 
      ? new Date(searchParams.get('startDate')!) 
      : undefined;
    const endDate = searchParams.get('endDate') 
      ? new Date(searchParams.get('endDate')!) 
      : undefined;
    const changedBy = searchParams.get('changedBy') || undefined;
    const limit = parseInt(searchParams.get('limit') || '100');

    // Get configuration history
    const history = await configService.getConfigHistory({
      parameter,
      startDate,
      endDate,
      changedBy,
      limit,
    });

    return NextResponse.json({
      success: true,
      history,
      count: history.length,
    });
  } catch (error) {
    console.error('Get config history error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve configuration history. Please try again.'
      },
      { status: 500 }
    );
  }
}
