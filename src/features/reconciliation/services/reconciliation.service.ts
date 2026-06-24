import { db } from '@/lib/db';
import { escrowWallets, walletTransactions, reconciliationLogs, unmatchedTransactions, reconciliationAlerts } from '@/lib/db/schema';
import { sql, eq, and, gte, lte, desc, isNull, inArray, notInArray } from 'drizzle-orm';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { createNotification } from '@/features/notifications/services/notification.service';
import {
  isPaystackComparableReference,
  isAutomatedTestWalletEmail,
} from '@/features/reconciliation/utils/paystack-reference';

/**
 * Reconciliation Service
 * 
 * Provides perfect, auditable reconciliation between database balances and Paystack.
 * This service NEVER modifies existing payment flows - it only reads and reports.
 */

interface ReconciliationResult {
  paystackBalance: number;
  databaseBalance: number;
  discrepancy: number;
  status: 'passed' | 'failed';
  details: {
    totalVendors: number;
    totalAvailable: number;
    totalFrozen: number;
    totalForfeited: number;
    timestamp: string;
    ledgerBalance?: number;
    walletLedgerDiscrepancy?: number;
    paystackVsWalletGap?: number;
  };
}

interface PaystackTransaction {
  reference: string;
  amount: number;
  status: string;
  paid_at: string;
  channel: string;
  currency: string;
}

interface UnmatchedTransactionData {
  source: 'paystack' | 'database' | 'both';
  reference: string;
  paystackAmount?: number;
  databaseAmount?: number;
  status: 'missing_in_database' | 'missing_in_paystack' | 'amount_mismatch';
}

/**
 * Calculate total vendor balances from database
 * 
 * Sums all vendor wallet balances (available + frozen + forfeited)
 */
export async function calculateTotalVendorBalances(): Promise<{
  total: number;
  available: number;
  frozen: number;
  forfeited: number;
  vendorCount: number;
}> {
  const result = await db
    .select({
      total: sql<string>`COALESCE(SUM(balance), 0)`,
      available: sql<string>`COALESCE(SUM(available_balance), 0)`,
      frozen: sql<string>`COALESCE(SUM(frozen_amount), 0)`,
      forfeited: sql<string>`COALESCE(SUM(forfeited_amount), 0)`,
      count: sql<string>`COUNT(*)`,
    })
    .from(escrowWallets);

  const row = result[0];

  return {
    total: parseFloat(row.total || '0'),
    available: parseFloat(row.available || '0'),
    frozen: parseFloat(row.frozen || '0'),
    forfeited: parseFloat(row.forfeited || '0'),
    vendorCount: parseInt(row.count || '0', 10),
  };
}

/**
 * Fetch Paystack balance via API
 * 
 * Gets the current balance from Paystack merchant account.
 * NOTE: This requires Paystack API integration.
 */
export async function fetchPaystackBalance(): Promise<number> {
  try {
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    
    if (!paystackSecretKey) {
      throw new Error('PAYSTACK_SECRET_KEY not configured');
    }

    const response = await fetch('https://api.paystack.co/balance', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Paystack API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Paystack returns balance in kobo (smallest currency unit)
    // Convert to naira by dividing by 100
    const balanceInKobo = data.data[0]?.balance || 0;
    return balanceInKobo / 100;
  } catch (error) {
    console.error('Error fetching Paystack balance:', error);
    throw error;
  }
}

export async function calculateVendorBalanceBreakdown(): Promise<{
  all: Awaited<ReturnType<typeof calculateTotalVendorBalances>>;
  operational: {
    total: number;
    available: number;
    frozen: number;
    forfeited: number;
    vendorCount: number;
  };
  testPollution: {
    total: number;
    available: number;
    frozen: number;
    forfeited: number;
    vendorCount: number;
  };
  testWallets: Array<{
    vendorId: string;
    email: string | null;
    businessName: string | null;
    balance: number;
  }>;
  operationalWallets: Array<{
    vendorId: string;
    email: string | null;
    businessName: string | null;
    balance: number;
    available: number;
    frozen: number;
  }>;
}> {
  const rows = await db
    .select({
      vendorId: escrowWallets.vendorId,
      balance: escrowWallets.balance,
      available: escrowWallets.availableBalance,
      frozen: escrowWallets.frozenAmount,
      forfeited: escrowWallets.forfeitedAmount,
      email: users.email,
      businessName: vendors.businessName,
      fullName: users.fullName,
    })
    .from(escrowWallets)
    .leftJoin(vendors, eq(escrowWallets.vendorId, vendors.id))
    .leftJoin(users, eq(vendors.userId, users.id));

  let testTotal = 0;
  let testAvailable = 0;
  let testFrozen = 0;
  let testForfeited = 0;
  let testCount = 0;
  let opTotal = 0;
  let opAvailable = 0;
  let opFrozen = 0;
  let opForfeited = 0;
  let opCount = 0;

  const testWallets: Array<{
    vendorId: string;
    email: string | null;
    businessName: string | null;
    balance: number;
  }> = [];
  const operationalWallets: Array<{
    vendorId: string;
    email: string | null;
    businessName: string | null;
    balance: number;
    available: number;
    frozen: number;
  }> = [];

  for (const row of rows) {
    const balance = parseFloat(row.balance);
    const available = parseFloat(row.available);
    const frozen = parseFloat(row.frozen);
    const forfeited = parseFloat(row.forfeited ?? '0');
    const isTest = isAutomatedTestWalletEmail(row.email);

    if (isTest) {
      testTotal += balance;
      testAvailable += available;
      testFrozen += frozen;
      testForfeited += forfeited;
      testCount += 1;
      testWallets.push({
        vendorId: row.vendorId,
        email: row.email,
        businessName: row.businessName || row.fullName,
        balance,
      });
    } else {
      opTotal += balance;
      opAvailable += available;
      opFrozen += frozen;
      opForfeited += forfeited;
      opCount += 1;
      operationalWallets.push({
        vendorId: row.vendorId,
        email: row.email,
        businessName: row.businessName || row.fullName,
        balance,
        available,
        frozen,
      });
    }
  }

  const all = await calculateTotalVendorBalances();

  return {
    all,
    operational: {
      total: opTotal,
      available: opAvailable,
      frozen: opFrozen,
      forfeited: opForfeited,
      vendorCount: opCount,
    },
    testPollution: {
      total: testTotal,
      available: testAvailable,
      frozen: testFrozen,
      forfeited: testForfeited,
      vendorCount: testCount,
    },
    testWallets,
    operationalWallets,
  };
}

/**
 * Perform daily reconciliation
 *
 * Compares database balances with Paystack balance and logs the result.
 * Sends alerts if discrepancy exceeds tolerance.
 */
export async function performDailyReconciliation(): Promise<ReconciliationResult> {
  // Step 1: Calculate total vendor balances from database
  const dbBalances = await calculateTotalVendorBalances();

  // Step 2: Ledger total — primary pass/fail is wallet vs ledger integrity
  const ledgerBalances = await getLedgerVendorBalances();
  const walletLedgerDiscrepancy = Math.abs(dbBalances.total - ledgerBalances.total);

  // Step 3: Fetch Paystack balance for reference (not used for pass/fail)
  let paystackBalance: number;
  try {
    paystackBalance = await fetchPaystackBalance();
  } catch (error) {
    console.error('Failed to fetch Paystack balance:', error);
    paystackBalance = 0;
  }

  const paystackVsWalletGap = Math.abs(paystackBalance - dbBalances.total);

  // Step 4: Determine status from internal bookkeeping (₦1 tolerance for rounding)
  const TOLERANCE = 1.0;
  const status: 'passed' | 'failed' = walletLedgerDiscrepancy <= TOLERANCE ? 'passed' : 'failed';

  const result: ReconciliationResult = {
    paystackBalance,
    databaseBalance: dbBalances.total,
    discrepancy: walletLedgerDiscrepancy,
    status,
    details: {
      totalVendors: dbBalances.vendorCount,
      totalAvailable: dbBalances.available,
      totalFrozen: dbBalances.frozen,
      totalForfeited: dbBalances.forfeited,
      timestamp: new Date().toISOString(),
      ledgerBalance: ledgerBalances.total,
      walletLedgerDiscrepancy,
      paystackVsWalletGap,
    },
  };

  // Step 6: Log reconciliation result
  await db.insert(reconciliationLogs).values({
    reconciliationDate: new Date().toISOString().split('T')[0],
    paystackBalance: paystackBalance.toString(),
    databaseBalance: dbBalances.total.toString(),
    discrepancy: walletLedgerDiscrepancy.toString(),
    status,
    details: result.details,
  });

  // Step 7: Send alert if failed
  if (status === 'failed') {
    await flagDiscrepancy(result);
  }

  return result;
}

/**
 * Flag discrepancy and send alerts
 * 
 * Sends critical alerts to finance officers and system admins.
 */
async function flagDiscrepancy(result: ReconciliationResult): Promise<void> {
  const severity = result.discrepancy > 10000 ? 'critical' : 
                   result.discrepancy > 1000 ? 'high' : 
                   result.discrepancy > 100 ? 'medium' : 'low';

  const message = `Wallet vs ledger reconciliation failed: ₦${result.discrepancy.toFixed(2)} discrepancy. ` +
                  `Wallet total: ₦${result.databaseBalance.toFixed(2)}, ` +
                  `Ledger total: ₦${(result.details as { ledgerBalance?: number }).ledgerBalance?.toFixed(2) ?? 'unknown'}. ` +
                  `Paystack merchant balance (reference): ₦${result.paystackBalance.toFixed(2)}`;

  // Get finance officers and admins (you'll need to implement this query)
  const alertRecipients = await getFinanceOfficersAndAdmins();

  await db.insert(reconciliationAlerts).values({
    alertType: 'discrepancy',
    severity,
    message,
    sentTo: alertRecipients,
  });

  await Promise.allSettled(
    alertRecipients.map((userId) =>
      createNotification({
        userId,
        type: 'system_alert',
        title: 'Reconciliation discrepancy detected',
        message,
        data: {
          severity,
          discrepancy: result.discrepancy,
          paystackBalance: result.paystackBalance,
          databaseBalance: result.databaseBalance,
          url: '/finance/reconciliation',
        },
      })
    )
  );

  console.error('CRITICAL RECONCILIATION ALERT:', message);
}

/**
 * Get finance officers and system admins for alerts
 */
async function getFinanceOfficersAndAdmins(): Promise<string[]> {
  const recipients = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        inArray(users.role, ['finance_officer', 'system_admin']),
        notInArray(users.status, ['suspended', 'deleted'])
      )
    );

  return recipients.map((recipient) => recipient.id);
}

/**
 * Fetch Paystack transactions for a date range
 * 
 * Gets transactions from Paystack API for reconciliation matching.
 */
export async function fetchPaystackTransactions(
  from: Date,
  to: Date
): Promise<PaystackTransaction[]> {
  try {
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    
    if (!paystackSecretKey) {
      throw new Error('PAYSTACK_SECRET_KEY not configured');
    }

    const fromDate = from.toISOString().split('T')[0];
    const toDate = to.toISOString().split('T')[0];

    const response = await fetch(
      `https://api.paystack.co/transaction?from=${fromDate}&to=${toDate}&perPage=100`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Paystack API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching Paystack transactions:', error);
    return [];
  }
}

/**
 * Match transactions between Paystack and database
 * 
 * Compares Paystack transactions with database records and flags mismatches.
 */
export async function matchTransactions(
  from: Date,
  to: Date
): Promise<{ matched: number; unmatched: number }> {
  // Fetch Paystack transactions
  const paystackTxns = await fetchPaystackTransactions(from, to);

  // Fetch database transactions for the same period
  const dbTxns = await db
    .select()
    .from(walletTransactions)
    .where(
      and(
        gte(walletTransactions.createdAt, from),
        lte(walletTransactions.createdAt, to)
      )
    );

  let matched = 0;
  let unmatched = 0;

  // Check Paystack transactions against database
  for (const psTxn of paystackTxns) {
    const dbTxn = dbTxns.find(t => t.reference === psTxn.reference);

    if (!dbTxn) {
      // Transaction in Paystack but not in database
      await flagUnmatchedTransaction({
        source: 'paystack',
        reference: psTxn.reference,
        paystackAmount: psTxn.amount / 100, // Convert from kobo
        status: 'missing_in_database',
      });
      unmatched++;
    } else {
      // Check for amount mismatch
      const paystackAmount = psTxn.amount / 100;
      const dbAmount = parseFloat(dbTxn.amount);

      if (Math.abs(paystackAmount - dbAmount) > 0.01) {
        await flagUnmatchedTransaction({
          source: 'both',
          reference: psTxn.reference,
          paystackAmount,
          databaseAmount: dbAmount,
          status: 'amount_mismatch',
        });
        unmatched++;
      } else {
        matched++;
      }
    }
  }

  // Check for database transactions not in Paystack (deposit refs only — skip internal escrow movements)
  for (const dbTxn of dbTxns) {
    if (!isPaystackComparableReference(dbTxn.reference)) {
      continue;
    }

    const psTxn = paystackTxns.find(t => t.reference === dbTxn.reference);

    if (!psTxn) {
      await flagUnmatchedTransaction({
        source: 'database',
        reference: dbTxn.reference,
        databaseAmount: parseFloat(dbTxn.amount),
        status: 'missing_in_paystack',
      });
      unmatched++;
    }
  }

  return { matched, unmatched };
}

/**
 * Flag unmatched transaction
 * 
 * Logs transactions that don't match between Paystack and database.
 */
export async function flagUnmatchedTransaction(
  data: UnmatchedTransactionData
): Promise<void> {
  await db.insert(unmatchedTransactions).values({
    source: data.source,
    reference: data.reference,
    paystackAmount: data.paystackAmount?.toString(),
    databaseAmount: data.databaseAmount?.toString(),
    status: data.status,
  });

  // Send alert for critical mismatches
  if (data.status === 'amount_mismatch' || data.status === 'missing_in_database') {
    const message = `Unmatched transaction: ${data.reference} - ${data.status}`;
    
    const alertRecipients = await getFinanceOfficersAndAdmins();

    await db.insert(reconciliationAlerts).values({
      alertType: 'unmatched_transaction',
      severity: 'high',
      message,
      sentTo: alertRecipients,
    });

    console.warn('UNMATCHED TRANSACTION ALERT:', message);
  }
}

/**
 * Get recent reconciliation logs
 * 
 * Returns the last N reconciliation attempts.
 */
export async function getRecentReconciliationLogs(limit: number = 30) {
  return await db
    .select()
    .from(reconciliationLogs)
    .orderBy(desc(reconciliationLogs.createdAt))
    .limit(limit);
}

/**
 * Get unresolved unmatched transactions
 * 
 * Returns transactions that haven't been resolved yet.
 */
export async function getUnresolvedUnmatchedTransactions() {
  return await db
    .select()
    .from(unmatchedTransactions)
    .where(isNull(unmatchedTransactions.resolvedAt))
    .orderBy(desc(unmatchedTransactions.createdAt));
}

/**
 * Resolve unmatched transaction
 * 
 * Marks an unmatched transaction as resolved with notes.
 */
export async function resolveUnmatchedTransaction(
  id: string,
  resolvedBy: string,
  resolutionNotes: string
): Promise<void> {
  await db
    .update(unmatchedTransactions)
    .set({
      resolvedAt: new Date(),
      resolvedBy,
      resolutionNotes,
    })
    .where(eq(unmatchedTransactions.id, id));
}

/**
 * Get ledger balances for all vendor wallets
 * 
 * Returns ledger-calculated balances for comparison with database balances.
 */
export async function getLedgerVendorBalances(): Promise<{
  total: number;
  byVendor: Array<{ vendorId: string; balance: number }>;
}> {
  const { ledgerAccounts, ledgerEntries } = await import('@/lib/db/schema/ledger');
  
  // Main vendor wallet accounts only (exclude :frozen / :available sub-accounts used for deposit tracking)
  const vendorAccounts = await db
    .select()
    .from(ledgerAccounts)
    .where(
      and(
        eq(ledgerAccounts.accountType, 'vendor_wallet'),
        sql`${ledgerAccounts.accountId} NOT LIKE '%:%'`
      )
    );

  // Calculate balance for each vendor
  const balancePromises = vendorAccounts.map(async (account) => {
    const result = await db
      .select({
        balance: sql<string>`COALESCE(SUM(${ledgerEntries.debit}) - SUM(${ledgerEntries.credit}), 0)`,
      })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.accountId, account.id));

    return {
      vendorId: account.accountId,
      balance: parseFloat(result[0].balance),
    };
  });

  const byVendor = await Promise.all(balancePromises);
  const total = byVendor.reduce((sum, v) => sum + v.balance, 0);

  return { total, byVendor };
}

/**
 * Get recent ledger transactions
 * 
 * Returns the most recent ledger entries for audit trail.
 */
export async function getRecentLedgerTransactions(limit: number = 50) {
  const { ledgerEntries, ledgerAccounts } = await import('@/lib/db/schema/ledger');
  
  const transactions = await db
    .select({
      id: ledgerEntries.id,
      transactionId: ledgerEntries.transactionId,
      accountType: ledgerAccounts.accountType,
      accountId: ledgerAccounts.accountId,
      accountName: ledgerAccounts.name,
      debit: ledgerEntries.debit,
      credit: ledgerEntries.credit,
      description: ledgerEntries.description,
      reference: ledgerEntries.reference,
      createdAt: ledgerEntries.createdAt,
    })
    .from(ledgerEntries)
    .innerJoin(ledgerAccounts, eq(ledgerEntries.accountId, ledgerAccounts.id))
    .orderBy(desc(ledgerEntries.createdAt))
    .limit(limit);

  return transactions;
}

/**
 * Compare wallet balances vs ledger balances
 * 
 * Identifies discrepancies between database wallet balances and ledger-calculated balances.
 */
export async function compareWalletVsLedgerBalances(): Promise<{
  matched: number;
  discrepancies: Array<{
    vendorId: string;
    vendorName: string;
    vendorEmail: string | null;
    walletBalance: number;
    ledgerBalance: number;
    discrepancy: number;
    explanation: string;
  }>;
}> {
  // Get wallet balances from database
  const wallets = await db
    .select({
      wallet: escrowWallets,
      vendorBusinessName: vendors.businessName,
      userFullName: users.fullName,
      userEmail: users.email,
    })
    .from(escrowWallets)
    .leftJoin(vendors, eq(escrowWallets.vendorId, vendors.id))
    .leftJoin(users, eq(vendors.userId, users.id));

  // Get ledger balances
  const ledgerBalances = await getLedgerVendorBalances();

  const discrepancies: Array<{
    vendorId: string;
    vendorName: string;
    vendorEmail: string | null;
    walletBalance: number;
    ledgerBalance: number;
    discrepancy: number;
    explanation: string;
  }> = [];

  let matched = 0;

  for (const row of wallets) {
    const wallet = row.wallet;
    if (isAutomatedTestWalletEmail(row.userEmail)) {
      continue;
    }

    const ledgerBalance = ledgerBalances.byVendor.find(
      v => v.vendorId === wallet.vendorId
    )?.balance || 0;

    const walletBalance = parseFloat(wallet.balance);
    const discrepancy = Math.abs(walletBalance - ledgerBalance);

    // Allow ₦1 tolerance for rounding
    if (discrepancy > 1.0) {
      discrepancies.push({
        vendorId: wallet.vendorId,
        vendorName: row.vendorBusinessName || row.userFullName || 'Unknown vendor',
        vendorEmail: row.userEmail || null,
        walletBalance,
        ledgerBalance,
        discrepancy,
        explanation: walletBalance > ledgerBalance
          ? 'Wallet balance is higher than the double-entry ledger. This usually means a wallet update was recorded without a matching ledger entry.'
          : 'Ledger balance is higher than the wallet balance. This usually means a ledger entry exists without the wallet balance reflecting it.',
      });
    } else {
      matched++;
    }
  }

  return { matched, discrepancies };
}
