/**
 * Fraud Auto-Suspend Cron Job API Route
 * 
 * Requirements:
 * - Requirement 36: Auto-Suspend Repeat Offenders
 * - Enterprise Standards Section 6.3: Security & Fraud Prevention
 * 
 * Schedule: Every hour (0 * * * *)
 * 
 * Usage:
 * - Vercel Cron: Configured in vercel.json
 * - Manual: POST /api/cron/fraud-auto-suspend with Authorization header
 */

import { NextRequest, NextResponse } from 'next/server';
import { fraudAutoSuspendService } from '@/lib/cron/fraud-auto-suspend';

/**
 * POST /api/cron/fraud-auto-suspend
 * 
 * Runs the fraud auto-suspend cron job
 * 
 * Security:
 * - Requires Authorization header with CRON_SECRET
 * - Only accessible via POST
 * 
 * @param request - Next.js request
 * @returns Fraud auto-suspend result
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'dev-secret-change-in-production';

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ Unauthorized cron job access attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🚀 Fraud auto-suspend cron job triggered');

    // Run the fraud auto-suspend service
    const result = await fraudAutoSuspendService.run();

    // Log results
    console.log('📊 Fraud auto-suspend results:', {
      vendorsSuspended: result.vendorsSuspended,
      bidsCancelled: result.bidsCancelled,
      notificationsSent: result.notificationsSent,
      errors: result.errors.length,
    });

    // Return success response
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results: result,
    });
  } catch (error) {
    console.error('❌ Fraud auto-suspend cron job failed:', error);

    return NextResponse.json(
      {
        success: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/fraud-auto-suspend
 * 
 * Returns information about the cron job
 * Does not execute the job
 */
export async function GET() {
  return NextResponse.json({
    name: 'Fraud Auto-Suspend',
    description: 'Automatically suspends vendors with 3+ confirmed fraud flags',
    schedule: 'Every hour (0 * * * *)',
    requirements: ['36'],
    usage: 'POST /api/cron/fraud-auto-suspend with Authorization: Bearer <CRON_SECRET>',
  });
}
