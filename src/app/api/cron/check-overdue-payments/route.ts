/**
 * Cron Job API Endpoint: Check Overdue Payments
 * 
 * POST /api/cron/check-overdue-payments
 * 
 * Triggers the overdue payment checker to:
 * - Update payment status to 'overdue' for payments past deadline
 * - Send escalation emails to finance officers
 * - Send reminder emails/SMS to vendors
 * - Create in-app notifications
 * 
 * Schedule: Every hour (0 * * * *)
 * 
 * Security: Requires CRON_SECRET environment variable
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkOverduePayments } from '@/lib/cron/payment-overdue-checker';

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ Unauthorized cron job attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🔄 Starting overdue payment check...');

    // Run the overdue payment checker
    await checkOverduePayments();

    console.log('✅ Overdue payment check completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Overdue payment check completed',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error in overdue payment cron job:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check overdue payments',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Allow GET for health check
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'check-overdue-payments',
    description: 'Cron job to check for overdue payments and send escalations',
    schedule: 'Every hour (0 * * * *)',
    lastRun: 'Not tracked yet',
  });
}
