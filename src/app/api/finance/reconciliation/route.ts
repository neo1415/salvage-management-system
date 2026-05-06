import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getRecentReconciliationLogs,
  getUnresolvedUnmatchedTransactions,
  calculateTotalVendorBalances,
  getLedgerVendorBalances,
  getRecentLedgerTransactions,
  compareWalletVsLedgerBalances,
} from '@/features/reconciliation/services/reconciliation.service';
import { PaystackBalanceService } from '@/features/finance/services/paystack-balance.service';

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
      reconciliationLogs,
      unmatchedTransactions,
      vendorBalances,
      ledgerBalances,
      recentLedgerTransactions,
      walletVsLedgerComparison,
    ] = await Promise.all([
      getRecentReconciliationLogs(30), // Last 30 days
      getUnresolvedUnmatchedTransactions(),
      calculateTotalVendorBalances(),
      getLedgerVendorBalances(),
      getRecentLedgerTransactions(50),
      compareWalletVsLedgerBalances(),
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

    // Calculate statistics
    const passedCount = reconciliationLogs.filter(log => log.status === 'passed').length;
    const failedCount = reconciliationLogs.filter(log => log.status === 'failed').length;
    const successRate = reconciliationLogs.length > 0
      ? (passedCount / reconciliationLogs.length) * 100
      : 100;

    // Calculate ledger vs wallet discrepancy
    const ledgerDiscrepancy = Math.abs(vendorBalances.total - ledgerBalances.total);

    // Calculate Paystack vs Database discrepancy
    const paystackDiscrepancy = paystackBalance !== null
      ? Math.abs(paystackBalance - vendorBalances.total)
      : null;

    return NextResponse.json({
      success: true,
      data: {
        reconciliationLogs,
        unmatchedTransactions,
        vendorBalances,
        ledgerBalances,
        paystackBalance: paystackBalance !== null ? {
          balance: paystackBalance,
          error: null,
        } : {
          balance: null,
          error: paystackError,
        },
        recentLedgerTransactions,
        walletVsLedgerComparison,
        statistics: {
          totalReconciliations: reconciliationLogs.length,
          passed: passedCount,
          failed: failedCount,
          successRate: successRate.toFixed(2),
          unresolvedTransactions: unmatchedTransactions.length,
          ledgerDiscrepancy: ledgerDiscrepancy.toFixed(2),
          paystackDiscrepancy: paystackDiscrepancy !== null ? paystackDiscrepancy.toFixed(2) : null,
          walletLedgerMatched: walletVsLedgerComparison.matched,
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
