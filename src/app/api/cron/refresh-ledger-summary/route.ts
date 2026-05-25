/**
 * Cron Job: Refresh Ledger Transaction Summary
 * 
 * Refreshes the materialized view that shows transaction balance status.
 * 
 * Schedule: Every hour
 * 
 * Purpose:
 * - Keep ledger_transaction_summary up to date
 * - Detect unbalanced transactions quickly
 * - Provide fast queries for ledger validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { ledgerService } from '@/features/ledger/services/ledger.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds timeout

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('[Security] CRON_SECRET not configured - refusing to run ledger summary refresh cron');
      return NextResponse.json(
        { error: 'Cron authentication is not configured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Cron] Starting ledger summary refresh...');

    // Refresh materialized view
    await ledgerService.refreshTransactionSummary();

    // Check for unbalanced transactions
    const unbalanced = await ledgerService.getUnbalancedTransactions();

    if (unbalanced.length > 0) {
      console.error(`[Cron] ⚠️ Found ${unbalanced.length} unbalanced transactions!`);
      
      // Log details
      unbalanced.forEach((txn) => {
        console.error(
          `[Cron] Transaction ${txn.transactionId}: ` +
          `debit=${txn.totalDebit}, credit=${txn.totalCredit}, ` +
          `discrepancy=${txn.discrepancy}`
        );
      });

      // TODO: Send alert to system admin
      // await sendCriticalAlert({
      //   type: 'UNBALANCED_LEDGER_TRANSACTIONS',
      //   count: unbalanced.length,
      //   transactions: unbalanced,
      // });
    }

    console.log('[Cron] ✅ Ledger summary refresh complete');

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      unbalancedCount: unbalanced.length,
      unbalanced: unbalanced.length > 0 ? unbalanced : undefined,
    });

  } catch (error) {
    console.error('[Cron] Ledger summary refresh failed:', error);
    return NextResponse.json(
      { 
        error: 'Ledger summary refresh failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
