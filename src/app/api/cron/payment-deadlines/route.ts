/**
 * Payment Deadline Enforcement Cron API Route
 * 
 * This endpoint is called by a cron service (e.g., Vercel Cron, GitHub Actions, or external cron)
 * to enforce payment deadlines every hour.
 * 
 * Security: Should be protected with a secret token in production
 */

import { NextRequest, NextResponse } from 'next/server';
// import { enforcePaymentDeadlines } from '@/lib/cron/payment-deadlines';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (in production, use environment variable)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'dev-secret-change-in-production';

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // TODO: Re-enable when Turbopack build issue is resolved
    // Run the payment deadline enforcement
    // const result = await enforcePaymentDeadlines();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: 'Payment deadline enforcement temporarily disabled due to build issue',
      // result,
    });
  } catch (error) {
    console.error('Error in payment deadlines cron:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
