'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { MetricGrid, MetricValue } from '@/components/reports/common/report-ui';
import { formatNaira } from '@/lib/utils/currency-formatter';
import { describeUnmatchedStatus } from '@/features/reconciliation/utils/paystack-reference';

interface UnmatchedTransaction {
  id: string;
  reference: string;
  paystackAmount: string | null;
  databaseAmount: string | null;
  status: string;
  createdAt: Date;
}

interface BalanceBreakdown {
  operational: {
    total: number;
    available: number;
    frozen: number;
    forfeited: number;
    vendorCount: number;
  };
  operationalWallets: Array<{
    vendorId: string;
    email: string | null;
    businessName: string | null;
    balance: number;
    available: number;
    frozen: number;
  }>;
}

interface WalletVsLedgerComparison {
  matched: number;
  discrepancies: Array<{
    vendorId: string;
    vendorName?: string;
    vendorEmail?: string | null;
    walletBalance: number;
    ledgerBalance: number;
    discrepancy: number;
  }>;
}

interface ReconciliationData {
  balanceBreakdown: BalanceBreakdown;
  paystackBalance: { balance: number | null; error: string | null };
  walletVsLedgerComparison: WalletVsLedgerComparison;
  unmatchedTransactions: UnmatchedTransaction[];
  statistics: {
    ledgerDiscrepancy: string;
    paystackDiscrepancy: string | null;
    walletLedgerHealthy: boolean;
    walletTopupIssues: number;
    walletLedgerDiscrepancies: number;
  };
}

export function ReconciliationDashboard() {
  const [walletIssuesPage, setWalletIssuesPage] = useState(1);
  const WALLET_ISSUES_PER_PAGE = 10;
  const [data, setData] = useState<ReconciliationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/finance/reconciliation');
      if (!response.ok) throw new Error('Failed to fetch reconciliation data');
      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) return <ReconciliationSkeleton />;

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  const op = data.balanceBreakdown.operational;
  const ledgerGap = parseFloat(data.statistics.ledgerDiscrepancy);
  const paystackGap = data.statistics.paystackDiscrepancy
    ? parseFloat(data.statistics.paystackDiscrepancy)
    : null;
  const booksOk = data.statistics.walletLedgerHealthy;
  const hasIssues =
    !booksOk ||
    data.statistics.walletTopupIssues > 0 ||
    data.walletVsLedgerComparison.discrepancies.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h2 className="text-2xl font-bold">Wallet reconciliation</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            What vendors hold in the app vs what your books record. Use Paystack balance when you need
            to fund the merchant account for withdrawals.
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <MetricGrid className="lg:grid-cols-3">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total in vendor wallets</CardTitle>
          </CardHeader>
          <CardContent>
            <MetricValue>{formatNaira(op.total)}</MetricValue>
            <p className="text-xs text-muted-foreground mt-1">
              {op.vendorCount} vendors · {formatNaira(op.available)} available ·{' '}
              {formatNaira(op.frozen)} frozen
            </p>
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">App matches books</CardTitle>
            {booksOk ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <MetricValue>{booksOk ? 'Yes' : formatNaira(ledgerGap)}</MetricValue>
            <p className="text-xs text-muted-foreground mt-1">
              {booksOk
                ? 'Wallet balances match the ledger'
                : 'Gap between wallet and ledger — review below'}
            </p>
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Paystack merchant balance</CardTitle>
          </CardHeader>
          <CardContent>
            {data.paystackBalance.error ? (
              <>
                <MetricValue className="text-red-500">Unavailable</MetricValue>
                <p className="text-xs text-muted-foreground mt-1">{data.paystackBalance.error}</p>
              </>
            ) : data.paystackBalance.balance !== null ? (
              <>
                <MetricValue>{formatNaira(data.paystackBalance.balance)}</MetricValue>
                <p className="text-xs text-muted-foreground mt-1">
                  Cash at Paystack for this API key
                  {paystackGap !== null && paystackGap > 1000
                    ? ` · ${formatNaira(paystackGap)} below wallet total`
                    : ''}
                </p>
              </>
            ) : (
              <MetricValue>N/A</MetricValue>
            )}
          </CardContent>
        </Card>
      </MetricGrid>

      {!hasIssues && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-sm text-green-900">
            All vendor wallets match the ledger. No wallet top-up issues flagged.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Vendor wallets</CardTitle>
          <CardDescription>Amount each vendor can access in the app right now</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.balanceBreakdown.operationalWallets.map((w) => (
            <div
              key={w.vendorId}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 py-2 last:border-0 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{w.businessName || w.email || 'Vendor'}</p>
                {w.email && <p className="text-xs text-muted-foreground truncate">{w.email}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold">{formatNaira(w.balance)}</p>
                {w.frozen > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {formatNaira(w.available)} available · {formatNaira(w.frozen)} frozen
                  </p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {data.walletVsLedgerComparison.discrepancies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Wallet / ledger mismatches</CardTitle>
            <CardDescription>These vendors need engineering review</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.walletVsLedgerComparison.discrepancies.map((d) => (
              <div key={d.vendorId} className="flex justify-between gap-4 text-sm border rounded-lg p-3">
                <div>
                  <p className="font-medium">{d.vendorName || d.vendorEmail || d.vendorId}</p>
                  <p className="text-xs text-muted-foreground">
                    Wallet {formatNaira(d.walletBalance)} · Ledger {formatNaira(d.ledgerBalance)}
                  </p>
                </div>
                <Badge variant="destructive">{formatNaira(d.discrepancy)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {data.statistics.walletTopupIssues > 0 && (() => {
        const walletIssues = data.unmatchedTransactions
          .filter((t) => t.reference.toUpperCase().startsWith('WALLET_'));
        const totalWalletIssues = walletIssues.length;
        const pageCount = Math.max(1, Math.ceil(totalWalletIssues / WALLET_ISSUES_PER_PAGE));
        const safePage = Math.min(walletIssuesPage, pageCount);
        const pageStart = (safePage - 1) * WALLET_ISSUES_PER_PAGE;
        const visibleIssues = walletIssues.slice(pageStart, pageStart + WALLET_ISSUES_PER_PAGE);

        return (
        <Card>
          <CardHeader>
            <CardTitle>Wallet top-up issues ({totalWalletIssues})</CardTitle>
            <CardDescription>
              Paystack wallet funding that does not match app records (WALLET references only)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {visibleIssues.map((txn) => (
              <div key={txn.id} className="border rounded-lg p-3 text-sm">
                <p className="font-mono text-xs break-all">{txn.reference}</p>
                <p className="text-muted-foreground text-xs mt-1">
                  {describeUnmatchedStatus(txn.status)} ·{' '}
                  {new Date(txn.createdAt).toLocaleString()}
                </p>
                <p className="mt-1">
                  Paystack:{' '}
                  {txn.paystackAmount ? formatNaira(parseFloat(txn.paystackAmount)) : '—'} · App:{' '}
                  {txn.databaseAmount ? formatNaira(parseFloat(txn.databaseAmount)) : '—'}
                </p>
              </div>
            ))}
            {totalWalletIssues > WALLET_ISSUES_PER_PAGE && (
              <div className="flex items-center justify-between gap-3 pt-2">
                <p className="text-xs text-muted-foreground">
                  Showing {pageStart + 1}-{Math.min(pageStart + WALLET_ISSUES_PER_PAGE, totalWalletIssues)} of {totalWalletIssues}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={safePage <= 1}
                    onClick={() => setWalletIssuesPage((page) => Math.max(1, page - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={safePage >= pageCount}
                    onClick={() => setWalletIssuesPage((page) => Math.min(pageCount, page + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        );
      })()}
    </div>
  );
}

function ReconciliationSkeleton() {
  return (
    <div className="space-y-6">
      <MetricGrid className="lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-4 w-32" /></CardHeader>
            <CardContent><Skeleton className="h-8 w-24" /></CardContent>
          </Card>
        ))}
      </MetricGrid>
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-32 w-full" /></CardContent>
      </Card>
    </div>
  );
}
