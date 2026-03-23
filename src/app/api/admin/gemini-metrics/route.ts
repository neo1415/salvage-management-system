/**
 * Gemini Metrics API Endpoint
 * 
 * Provides access to Gemini damage detection metrics for monitoring dashboards.
 * Requires admin authentication.
 * 
 * GET /api/admin/gemini-metrics - Get current metrics summary
 * POST /api/admin/gemini-metrics/reset - Reset metrics (for testing)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { getGeminiMetricsCollector } from '@/lib/monitoring/gemini-metrics';
import { getGeminiRateLimiter } from '@/lib/integrations/gemini-rate-limiter';

/**
 * GET /api/admin/gemini-metrics
 * 
 * Returns current Gemini metrics summary including:
 * - Success rates by method
 * - Average response times
 * - Daily quota usage
 * - Error rates and top errors
 * - Active alerts
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }
    
    // Get metrics collector and rate limiter
    const metricsCollector = getGeminiMetricsCollector();
    const rateLimiter = getGeminiRateLimiter();
    
    // Get metrics summary
    const summary = metricsCollector.getSummary();
    
    // Get rate limiter status
    const rateLimiterStatus = rateLimiter.getStatus();
    
    // Check for alerts
    const alerts = metricsCollector.checkAlerts();
    
    // Combine all data
    const response = {
      summary,
      rateLimiter: {
        minuteUsage: rateLimiterStatus.minuteUsage,
        minuteLimit: rateLimiterStatus.minuteLimit,
        dailyUsage: rateLimiterStatus.dailyUsage,
        dailyLimit: rateLimiterStatus.dailyLimit,
        dailyResetAt: rateLimiterStatus.dailyResetAt,
        lastRequestAt: rateLimiterStatus.lastRequestAt,
      },
      alerts,
      timestamp: new Date().toISOString(),
    };
    
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[Gemini Metrics API] Error fetching metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/gemini-metrics/reset
 * 
 * Resets metrics collector (for testing purposes)
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }
    
    // Reset metrics
    const metricsCollector = getGeminiMetricsCollector();
    metricsCollector.reset();
    
    console.info('[Gemini Metrics API] Metrics reset by admin:', session.user.email);
    
    return NextResponse.json({
      success: true,
      message: 'Metrics reset successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Gemini Metrics API] Error resetting metrics:', error);
    return NextResponse.json(
      { error: 'Failed to reset metrics', details: error.message },
      { status: 500 }
    );
  }
}
