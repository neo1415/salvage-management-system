'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

interface ReconciliationLog {
  id: string;
  reconciliationDate: string;
  paystackBalance: string;
  databaseBalance: string;
  discrepancy: string;
  status: 'passed' | 'failed';
  createdAt: Date;
}

interface UnmatchedTransaction {
  id: string;
  source: string;
  reference: string;
  paystackAmount: string | null;
  databaseAmount: string | null;
  status: string;
  createdAt: Date;
}

interface VendorBalances {
  total: number;
  available: number;
  frozen: number;
  forfeited: number;
  vendorCount: number;
}

interface LedgerBalances {
  total: number;
  byVendor: Array<{ vendorId: string; balance: number }>;
}

interface LedgerTransaction {
  id: string;
  transactionId: string;
  accountType: string;
  accountId: string;
  accountName: string;
  debit: string;
  credit: string;
  description: string;
  reference: string | null;
  createdAt: Date;
}

interface WalletVsLedgerComparison {
  matched: number;
  discrepancies: Array<{
    vendorId: string;
    walletBalance: number;
    ledgerBalance: number;
    discrepancy: number;
  }>;
}

interface PaystackBalance {
  balance: number | null;
  error: string | null;
}

interface ReconciliationData {
  reconciliationLogs: ReconciliationLog[];
  unmatchedTransactions: UnmatchedTransaction[];
  vendorBalances: VendorBalances;
  ledgerBalances: LedgerBalances;
  paystackBalance: PaystackBalance;
  recentLedgerTransactions: LedgerTransaction[];
  walletVsLedgerComparison: WalletVsLedgerComparison;
  statistics: {
    totalReconciliations: number;
    passed: number;
    failed: number;
    successRate: string;
    unresolvedTransactions: number;
    ledgerDiscrepancy: string;
    paystackDiscrepancy: string | null;
    walletLedgerMatched: number;
    walletLedgerDiscrepancies: number;
  };
}

export function ReconciliationDashboard() {
  const [data, setData] = useState<ReconciliationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/finance/reconciliation');
      
      if (!response.ok) {
        throw new Error('Failed to fetch reconciliation data');
      }

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

  if (loading) {
    return <ReconciliationSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return null;
  }

  const latestLog = data.reconciliationLogs[0];

  return (
    <div className="space-y-6">
      {/* Header with Refresh Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Reconciliation Status</h2>
          <p className="text-sm text-muted-foreground">
            Last updated: {latestLog ? new Date(latestLog.createdAt).toLocaleString() : 'Never'}
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.statistics.successRate}%</div>
            <p className="text-xs text-muted-foreground">
              {data.statistics.passed} passed, {data.statistics.failed} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vendors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.vendorBalances.vendorCount}</div>
            <p className="text-xs text-muted-foreground">Active vendor wallets</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paystack Balance</CardTitle>
          </CardHeader>
          <CardContent>
            {data.paystackBalance.error ? (
              <>
                <div className="text-2xl font-bold text-red-500">Error</div>
                <p className="text-xs text-muted-foreground">{data.paystackBalance.error}</p>
              </>
            ) : data.paystackBalance.balance !== null ? (
              <>
                <div className="text-2xl font-bold">
                  ₦{data.paystackBalance.balance.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">Paystack API</p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">N/A</div>
                <p className="text-xs text-muted-foreground">Not available</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₦{data.vendorBalances.total.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Wallet total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ledger Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₦{data.ledgerBalances.total.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Ledger total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unresolved Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.statistics.unresolvedTransactions}</div>
            <p className="text-xs text-muted-foreground">Unmatched transactions</p>
          </CardContent>
        </Card>
      </div>

      {/* Latest Reconciliation Status */}
      {latestLog && (
        <Card>
          <CardHeader>
            <CardTitle>Latest Reconciliation</CardTitle>
            <CardDescription>
              {new Date(latestLog.reconciliationDate).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status:</span>
                <Badge variant={latestLog.status === 'passed' ? 'default' : 'destructive'}>
                  {latestLog.status === 'passed' ? (
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                  ) : (
                    <XCircle className="h-3 w-3 mr-1" />
                  )}
                  {latestLog.status.toUpperCase()}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Paystack Balance</p>
                  <p className="text-lg font-semibold">
                    ₦{parseFloat(latestLog.paystackBalance).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Database Balance</p>
                  <p className="text-lg font-semibold">
                    ₦{parseFloat(latestLog.databaseBalance).toLocaleString()}
                  </p>
                </div>
              </div>

              {parseFloat(latestLog.discrepancy) > 0 && (
                <Alert variant={latestLog.status === 'failed' ? 'destructive' : 'default'}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Discrepancy: ₦{parseFloat(latestLog.discrepancy).toLocaleString()}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vendor Balance Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Vendor Balance Breakdown</CardTitle>
          <CardDescription>Current distribution of vendor funds</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm">Available Balance</span>
              <span className="font-semibold">
                ₦{data.vendorBalances.available.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Frozen Amount</span>
              <span className="font-semibold">
                ₦{data.vendorBalances.frozen.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Forfeited Amount</span>
              <span className="font-semibold">
                ₦{data.vendorBalances.forfeited.toLocaleString()}
              </span>
            </div>
            <div className="border-t pt-4 flex justify-between items-center">
              <span className="text-sm font-bold">Total</span>
              <span className="font-bold text-lg">
                ₦{data.vendorBalances.total.toLocaleString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Three-Way Balance Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Three-Way Balance Comparison</CardTitle>
          <CardDescription>
            Comparing Paystack API, Database, and Ledger balances
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Balance Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <p className="text-xs text-muted-foreground mb-2">Paystack Balance</p>
                {data.paystackBalance.error ? (
                  <>
                    <p className="text-lg font-bold text-red-500">Error</p>
                    <p className="text-xs text-red-500 mt-1">{data.paystackBalance.error}</p>
                  </>
                ) : data.paystackBalance.balance !== null ? (
                  <p className="text-lg font-bold">
                    ₦{data.paystackBalance.balance.toLocaleString()}
                  </p>
                ) : (
                  <p className="text-lg font-bold text-muted-foreground">N/A</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">Real-time API</p>
              </div>

              <div className="text-center p-4 border rounded-lg">
                <p className="text-xs text-muted-foreground mb-2">Database Balance</p>
                <p className="text-lg font-bold">
                  ₦{data.vendorBalances.total.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Internal records</p>
              </div>

              <div className="text-center p-4 border rounded-lg">
                <p className="text-xs text-muted-foreground mb-2">Ledger Balance</p>
                <p className="text-lg font-bold">
                  ₦{data.ledgerBalances.total.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Double-entry</p>
              </div>
            </div>

            {/* Discrepancy Analysis */}
            <div className="space-y-3">
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-3">Discrepancy Analysis</h4>
                
                {/* Paystack vs Database */}
                {data.paystackBalance.balance !== null && !data.paystackBalance.error && (
                  <div className="flex justify-between items-center p-3 bg-muted rounded-lg mb-2">
                    <span className="text-sm">Paystack vs Database</span>
                    <span className={`font-semibold ${
                      data.statistics.paystackDiscrepancy && parseFloat(data.statistics.paystackDiscrepancy) > 1
                        ? 'text-red-500'
                        : 'text-green-500'
                    }`}>
                      {data.statistics.paystackDiscrepancy && parseFloat(data.statistics.paystackDiscrepancy) > 1 ? (
                        <>₦{parseFloat(data.statistics.paystackDiscrepancy).toLocaleString()}</>
                      ) : (
                        'Perfect Match ✓'
                      )}
                    </span>
                  </div>
                )}

                {/* Database vs Ledger */}
                <div className="flex justify-between items-center p-3 bg-muted rounded-lg mb-2">
                  <span className="text-sm">Database vs Ledger</span>
                  <span className={`font-semibold ${
                    parseFloat(data.statistics.ledgerDiscrepancy) > 1
                      ? 'text-red-500'
                      : 'text-green-500'
                  }`}>
                    {parseFloat(data.statistics.ledgerDiscrepancy) > 1 ? (
                      <>₦{parseFloat(data.statistics.ledgerDiscrepancy).toLocaleString()}</>
                    ) : (
                      'Perfect Match ✓'
                    )}
                  </span>
                </div>

                {/* Overall Status */}
                <div className="mt-4 p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Overall Reconciliation Status</span>
                    {data.paystackBalance.balance !== null && 
                     !data.paystackBalance.error &&
                     data.statistics.paystackDiscrepancy &&
                     parseFloat(data.statistics.paystackDiscrepancy) <= 1 &&
                     parseFloat(data.statistics.ledgerDiscrepancy) <= 1 ? (
                      <Badge variant="default" className="bg-green-500">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        All Systems Match
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Discrepancies Found
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Wallet vs Ledger Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Wallet vs Ledger Comparison</CardTitle>
          <CardDescription>
            Double-entry ledger validation against database balances
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm">Database Wallet Total</span>
              <span className="font-semibold">
                ₦{data.vendorBalances.total.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Ledger Calculated Total</span>
              <span className="font-semibold">
                ₦{data.ledgerBalances.total.toLocaleString()}
              </span>
            </div>
            <div className="border-t pt-4 flex justify-between items-center">
              <span className="text-sm font-bold">Discrepancy</span>
              <span className={`font-bold text-lg ${parseFloat(data.statistics.ledgerDiscrepancy) > 1 ? 'text-red-500' : 'text-green-500'}`}>
                {parseFloat(data.statistics.ledgerDiscrepancy) > 1 ? (
                  <>₦{parseFloat(data.statistics.ledgerDiscrepancy).toLocaleString()}</>
                ) : (
                  'Perfect Match'
                )}
              </span>
            </div>
            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Vendor Accounts</span>
                <Badge variant={data.walletVsLedgerComparison.discrepancies.length === 0 ? 'default' : 'destructive'}>
                  {data.statistics.walletLedgerMatched} matched, {data.statistics.walletLedgerDiscrepancies} discrepancies
                </Badge>
              </div>
              {data.walletVsLedgerComparison.discrepancies.length > 0 && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {data.walletVsLedgerComparison.discrepancies.length} vendor account(s) have discrepancies between wallet and ledger
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Wallet vs Ledger Discrepancies */}
      {data.walletVsLedgerComparison.discrepancies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Wallet vs Ledger Discrepancies</CardTitle>
            <CardDescription>
              Vendor accounts with mismatches between database and ledger
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.walletVsLedgerComparison.discrepancies.map((disc, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-mono text-sm font-semibold">{disc.vendorId}</p>
                      <p className="text-xs text-muted-foreground">Vendor ID</p>
                    </div>
                    <Badge variant="destructive">
                      ₦{disc.discrepancy.toLocaleString()} discrepancy
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Wallet Balance</p>
                      <p className="font-semibold">₦{disc.walletBalance.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Ledger Balance</p>
                      <p className="font-semibold">₦{disc.ledgerBalance.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Ledger Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Ledger Transactions</CardTitle>
          <CardDescription>Last 50 double-entry ledger entries</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.recentLedgerTransactions.map((txn) => (
              <div key={txn.id} className="border-b pb-2 last:border-b-0">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{txn.description}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {txn.transactionId.substring(0, 8)}...
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {txn.accountType}: {txn.accountId}
                    </p>
                  </div>
                  <div className="text-right">
                    {parseFloat(txn.debit) > 0 && (
                      <p className="text-sm font-semibold text-green-600">
                        +₦{parseFloat(txn.debit).toLocaleString()}
                      </p>
                    )}
                    {parseFloat(txn.credit) > 0 && (
                      <p className="text-sm font-semibold text-red-600">
                        -₦{parseFloat(txn.credit).toLocaleString()}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(txn.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Unmatched Transactions */}
      {data.unmatchedTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Unmatched Transactions</CardTitle>
            <CardDescription>
              Transactions that don't match between Paystack and database
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.unmatchedTransactions.map((txn) => (
                <div key={txn.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-mono text-sm">{txn.reference}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(txn.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="destructive">{txn.status.replace(/_/g, ' ')}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Paystack Amount</p>
                      <p className="font-semibold">
                        {txn.paystackAmount ? `₦${parseFloat(txn.paystackAmount).toLocaleString()}` : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Database Amount</p>
                      <p className="font-semibold">
                        {txn.databaseAmount ? `₦${parseFloat(txn.databaseAmount).toLocaleString()}` : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reconciliation History */}
      <Card>
        <CardHeader>
          <CardTitle>Reconciliation History</CardTitle>
          <CardDescription>Last 30 days of reconciliation attempts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.reconciliationLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  {log.status === 'passed' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm">
                    {new Date(log.reconciliationDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">
                    {parseFloat(log.discrepancy) > 0 ? (
                      <span className="text-red-500">
                        ₦{parseFloat(log.discrepancy).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-green-500">Perfect Match</span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReconciliationSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
