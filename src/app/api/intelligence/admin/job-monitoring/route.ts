/**
 * Job Monitoring Dashboard API
 * Phase 16: Task 16.2.4
 * 
 * GET /api/intelligence/admin/job-monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getJobPerformanceMetrics,
  getRecentJobLogs,
  getJobHealthStatus,
  getJobLogsFromCache,
  getJobFailureHistory,
} from '@/features/intelligence/jobs';

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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const jobName = searchParams.get('jobName');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Get job health status
    const healthStatus = getJobHealthStatus();

    // Get performance metrics
    const metrics = jobName
      ? getJobPerformanceMetrics(jobName)
      : getJobPerformanceMetrics();

    // Get recent logs
    const recentLogs = getRecentJobLogs(jobName || undefined, limit);

    // Get cached logs and failure history if specific job requested
    let cachedLogs = null;
    let failureHistory = null;
    if (jobName) {
      cachedLogs = await getJobLogsFromCache(jobName);
      failureHistory = await getJobFailureHistory(jobName);
    }

    return NextResponse.json({
      success: true,
      data: {
        healthStatus,
        metrics,
        recentLogs,
        cachedLogs,
        failureHistory,
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
