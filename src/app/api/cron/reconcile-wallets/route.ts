import { NextResponse } from 'next/server';
import { performDailyReconciliation } from '@/features/reconciliation/services/reconciliation.service';

/**
 * Daily Wallet Reconciliation Cron Job
 * 
 * Runs daily to reconcile database balances with Paystack balance.
 * 
 * Schedule: Daily at 2:00 AM (off-peak hours)
 * Vercel Cron: 0 2 * * *
 * 
 * This job:
 * 1. Calculates total vendor balances from database
 * 2. Fetches Paystack balance via API
 * 3. Compares and logs discrepancies
 * 4. Sends alerts if discrepancy > ₦1
 * 
 * SAFETY: This job is READ-ONLY. It never modifies payment data.
 */
export async function GET(request: Request) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('[Security] CRON_SECRET not configured - refusing to run wallet reconciliation cron');
      return NextResponse.json(
        { error: 'Cron authentication is not configured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Reconciliation Cron] Starting daily wallet reconciliation...');

    // Perform reconciliation
    const result = await performDailyReconciliation();

    console.log('[Reconciliation Cron] Reconciliation complete:', {
      status: result.status,
      paystackBalance: result.paystackBalance,
      databaseBalance: result.databaseBalance,
      discrepancy: result.discrepancy,
    });

    return NextResponse.json({
      success: true,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Reconciliation Cron] Error:', error);

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
