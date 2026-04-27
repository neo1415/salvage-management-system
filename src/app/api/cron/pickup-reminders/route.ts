/**
 * Pickup Reminder Notifications Cron API Route
 * 
 * This endpoint is called by a cron service (e.g., Vercel Cron, GitHub Actions, or external cron)
 * to send pickup reminder notifications every hour.
 * 
 * Sends reminder SMS 24 hours before pickup deadline (48 hours from payment verification)
 * Only sends to vendors who haven't confirmed pickup yet
 * 
 * Security: Protected with a secret token in production
 * 
 * Validates: Task 6.3 - Implement pickup reminder notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendPickupReminders } from '@/lib/cron/pickup-reminders';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

    // Run the pickup reminder job
    const result = await sendPickupReminders();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: 'Pickup reminder notifications completed',
      result,
    });
  } catch (error) {
    console.error('Error in pickup reminders cron:', error);
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
