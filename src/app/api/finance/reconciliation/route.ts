import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getUnresolvedUnmatchedTransactions,
  getLedgerVendorBalances,
  compareWalletVsLedgerBalances,
  calculateVendorBalanceBreakdown,
} from '@/features/reconciliation/services/reconciliation.service';
import { PaystackBalanceService } from '@/features/finance/services/paystack-balance.service';
import { getSettlementReconciliationSummary } from '@/lib/finance/settlement-reconciliation';

/**
 * Finance Reconciliation Dashboard API
 * 
 * Provides reconciliation data for finance officers.
 * 
 * GET /api/finance/reconciliation
 * - Returns recent reconciliation logs
 * - Returns unresolved unmatched transactions
 * - Returns current vendor balance breakdown
 * 
 * Authorization: Finance Officer or System Admin only
 */
export async function GET() {
  try {
    // Check authentication
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check authorization (Finance Officer or System Admin)
    const userRole = session.user.role;
    if (userRole !== 'finance_officer' && userRole !== 'system_admin') {
      return NextResponse.json(
        { error: 'Forbidden: Finance Officer or System Admin access required' },
        { status: 403 }
      );
    }

    // Fetch reconciliation data
    const [
      unmatchedTransactions,
      ledgerBalances,
      walletVsLedgerComparison,
      balanceBreakdown,
      settlementReconciliation,
    ] = await Promise.all([
      getUnresolvedUnmatchedTransactions(),
      getLedgerVendorBalances(),
      compareWalletVsLedgerBalances(),
      calculateVendorBalanceBreakdown(),
      getSettlementReconciliationSummary(25),
    ]);

    // Fetch Paystack balance (with error handling)
    let paystackBalance: number | null = null;
    let paystackError: string | null = null;

    try {
      const paystackService = new PaystackBalanceService();
      paystackBalance = await paystackService.fetchBalance();
    } catch (error) {
      paystackError = error instanceof Error ? error.message : 'Failed to fetch Paystack balance';
      console.error('[Reconciliation API] Paystack balance fetch error:', error);
    }

    const operationalLedgerTotal = balanceBreakdown.operationalWallets.reduce((sum, w) => {
      const ledgerBalance =
        ledgerBalances.byVendor.find((v) => v.vendorId === w.vendorId)?.balance ?? 0;
      return sum + ledgerBalance;
    }, 0);
    const ledgerDiscrepancy = Math.abs(balanceBreakdown.operational.total - operationalLedgerTotal);

    const walletTopupIssues = unmatchedTransactions.filter(
      (txn) => txn.reference.toUpperCase().startsWith('WALLET_')
    );

    const paystackDiscrepancy = paystackBalance !== null
      ? Math.abs(paystackBalance - balanceBreakdown.operational.total)
      : null;

    const walletLedgerHealthy =
      ledgerDiscrepancy <= 1 && walletVsLedgerComparison.discrepancies.length === 0;

    return NextResponse.json({
      success: true,
      data: {
        balanceBreakdown,
        paystackBalance: paystackBalance !== null ? {
          balance: paystackBalance,
          error: null,
        } : {
          balance: null,
          error: paystackError,
        },
        walletVsLedgerComparison,
        unmatchedTransactions: walletTopupIssues,
        settlementReconciliation,
        statistics: {
          ledgerDiscrepancy: ledgerDiscrepancy.toFixed(2),
          paystackDiscrepancy: paystackDiscrepancy !== null ? paystackDiscrepancy.toFixed(2) : null,
          walletLedgerHealthy,
          walletTopupIssues: walletTopupIssues.length,
          walletLedgerDiscrepancies: walletVsLedgerComparison.discrepancies.length,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Reconciliation API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
