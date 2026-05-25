/**
 * Job Monitoring Dashboard API
 * Phase 16: Task 16.2.4
 * 
 * GET /api/intelligence/admin/job-monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

/**
 * GET /api/intelligence/admin/job-monitoring
 * Get job monitoring dashboard data
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Admin authorization check
    if (session.user.role !== 'Admin' && session.user.role !== 'Salvage_Manager') {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        healthStatus: {
          status: 'disabled',
          message: 'Background intelligence cron jobs are not configured in the Vercel runtime.',
        },
        metrics: [],
        recentLogs: [],
        cachedLogs: null,
        failureHistory: null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching job monitoring data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch job monitoring data',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
