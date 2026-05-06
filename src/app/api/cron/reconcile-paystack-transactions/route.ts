import { NextResponse } from 'next/server';
import { matchTransactions } from '@/features/reconciliation/services/reconciliation.service';

/**
 * Paystack Transaction Reconciliation Cron Job
 * 
 * Runs daily to match Paystack transactions with database records.
 * 
 * Schedule: Daily at 3:00 AM (after wallet reconciliation)
 * Vercel Cron: 0 3 * * *
 * 
 * This job:
 * 1. Fetches last 24 hours of Paystack transactions
 * 2. Matches against database wallet_transactions
 * 3. Flags unmatched transactions
 * 4. Flags amount mismatches
 * 
 * SAFETY: This job is READ-ONLY. It never modifies payment data.
 */
export async function GET(request: Request) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Transaction Reconciliation Cron] Starting Paystack transaction matching...');

    // Match transactions from last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const today = new Date();

    const result = await matchTransactions(yesterday, today);

    console.log('[Transaction Reconciliation Cron] Matching complete:', {
      matched: result.matched,
      unmatched: result.unmatched,
    });

    return NextResponse.json({
      success: true,
      result,
      period: {
        from: yesterday.toISOString(),
        to: today.toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Transaction Reconciliation Cron] Error:', error);

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
