import { db } from "@/lib/db";
import { payments } from "@/lib/db/schema";
import { eq, and, gte } from "drizzle-orm";

interface PaystackTransaction {
  id: number;
  reference: string;
  amount: number; // in kobo
  status: string;
  paid_at: string;
  created_at: string;
  channel: string;
  currency: string;
  customer: {
    email: string;
  };
  metadata?: any;
}

interface PaystackTransactionsResponse {
  status: boolean;
  message: string;
  data: PaystackTransaction[];
  meta: {
    total: number;
    total_volume: number;
    page: number;
    pageCount: number;
  };
}

interface ReconciliationResult {
  summary: {
    paystackTotal: number;
    paystackCount: number;
    databaseTotal: number;
    databaseCount: number;
    discrepancy: number;
    matchedCount: number;
    unmatchedPaystack: number;
    unmatchedDatabase: number;
  };
  inPaystackNotInDatabase: Array<{
    reference: string;
    amount: number;
    status: string;
    paidAt: string;
    channel: string;
  }>;
  inDatabaseNotInPaystack: Array<{
    id: string;
    reference: string;
    amount: number;
    status: string;
    createdAt: Date;
  }>;
  matched: Array<{
    reference: string;
    paystackAmount: number;
    databaseAmount: number;
    amountMatch: boolean;
  }>;
}

async function fetchAllPaystackTransactions(): Promise<PaystackTransaction[]> {
  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

  if (!PAYSTACK_SECRET_KEY) {
    throw new Error("PAYSTACK_SECRET_KEY not found in environment variables");
  }

  const allTransactions: PaystackTransaction[] = [];
  let page = 1;
  let hasMore = true;
  const perPage = 100; // Max allowed by Paystack

  console.log("🔍 Fetching transactions from Paystack...");

  while (hasMore) {
    try {
      const response = await fetch(
        `https://api.paystack.co/transaction?perPage=${perPage}&page=${page}&status=success`,
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Paystack API error: ${response.statusText}`);
      }

      const data: PaystackTransactionsResponse = await response.json();

      if (!data.status) {
        throw new Error(`Paystack API returned error: ${data.message}`);
      }

      allTransactions.push(...data.data);

      console.log(
        `   Page ${page}/${data.meta.pageCount}: ${data.data.length} transactions`
      );

      hasMore = page < data.meta.pageCount;
      page++;

      // Rate limiting: wait 1 second between requests
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error);
      throw error;
    }
  }

  console.log(`✅ Total Paystack transactions fetched: ${allTransactions.length}\n`);
  return allTransactions;
}

async function fetchDatabasePayments() {
  console.log("🔍 Fetching payments from database...");

  const dbPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.status, "verified"));

  console.log(`✅ Total database payments fetched: ${dbPayments.length}\n`);
  return dbPayments;
}

async function reconcileTransactions(): Promise<ReconciliationResult> {
  // Fetch data from both sources
  const paystackTransactions = await fetchAllPaystackTransactions();
  const databasePayments = await fetchDatabasePayments();

  // Create lookup maps (use paymentReference instead of reference)
  const paystackMap = new Map(
    paystackTransactions.map((t) => [t.reference, t])
  );
  const databaseMap = new Map(
    databasePayments.map((p) => [p.paymentReference, p])
  );

  // Calculate totals
  const paystackTotal = paystackTransactions.reduce(
    (sum, t) => sum + t.amount / 100, // Convert kobo to naira
    0
  );
  const databaseTotal = databasePayments.reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );

  // Find matches and mismatches
  const matched: ReconciliationResult["matched"] = [];
  const inPaystackNotInDatabase: ReconciliationResult["inPaystackNotInDatabase"] = [];
  const inDatabaseNotInPaystack: ReconciliationResult["inDatabaseNotInPaystack"] = [];

  // Check Paystack transactions against database
  for (const paystackTx of paystackTransactions) {
    const dbPayment = databaseMap.get(paystackTx.reference);

    if (dbPayment) {
      // Found in both systems
      const paystackAmount = paystackTx.amount / 100; // Convert kobo to naira
      const databaseAmount = Number(dbPayment.amount);
      const amountMatch = Math.abs(paystackAmount - databaseAmount) < 0.01; // Allow 1 kobo difference

      matched.push({
        reference: paystackTx.reference,
        paystackAmount,
        databaseAmount,
        amountMatch,
      });
    } else {
      // In Paystack but not in database
      inPaystackNotInDatabase.push({
        reference: paystackTx.reference,
        amount: paystackTx.amount / 100,
        status: paystackTx.status,
        paidAt: paystackTx.paid_at,
        channel: paystackTx.channel,
      });
    }
  }

  // Check database payments against Paystack
  for (const dbPayment of databasePayments) {
    if (dbPayment.paymentReference && !paystackMap.has(dbPayment.paymentReference)) {
      // In database but not in Paystack
      inDatabaseNotInPaystack.push({
        id: dbPayment.id,
        reference: dbPayment.paymentReference,
        amount: Number(dbPayment.amount),
        status: dbPayment.status,
        createdAt: dbPayment.createdAt,
      });
    }
  }

  return {
    summary: {
      paystackTotal,
      paystackCount: paystackTransactions.length,
      databaseTotal,
      databaseCount: databasePayments.length,
      discrepancy: databaseTotal - paystackTotal,
      matchedCount: matched.length,
      unmatchedPaystack: inPaystackNotInDatabase.length,
      unmatchedDatabase: inDatabaseNotInPaystack.length,
    },
    inPaystackNotInDatabase,
    inDatabaseNotInPaystack,
    matched,
  };
}

function formatCurrency(amount: number): string {
  return `₦${amount.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function printReport(result: ReconciliationResult) {
  console.log("\n" + "=".repeat(80));
  console.log("📊 PAYSTACK RECONCILIATION REPORT");
  console.log("=".repeat(80) + "\n");

  // Summary
  console.log("📈 SUMMARY");
  console.log("-".repeat(80));
  console.log(`Paystack Transactions: ${result.summary.paystackCount} transactions`);
  console.log(`Paystack Total:        ${formatCurrency(result.summary.paystackTotal)}`);
  console.log();
  console.log(`Database Payments:     ${result.summary.databaseCount} payments`);
  console.log(`Database Total:        ${formatCurrency(result.summary.databaseTotal)}`);
  console.log();
  console.log(`Discrepancy:           ${formatCurrency(result.summary.discrepancy)}`);
  console.log();
  console.log(`✅ Matched:            ${result.summary.matchedCount} transactions`);
  console.log(`❌ In Paystack only:   ${result.summary.unmatchedPaystack} transactions`);
  console.log(`❌ In Database only:   ${result.summary.unmatchedDatabase} payments`);
  console.log();

  // Transactions in Paystack but not in Database
  if (result.inPaystackNotInDatabase.length > 0) {
    console.log("\n🔴 TRANSACTIONS IN PAYSTACK BUT NOT IN DATABASE");
    console.log("-".repeat(80));
    console.log(
      `Found ${result.inPaystackNotInDatabase.length} transactions in Paystack that are missing from your database:\n`
    );

    const paystackOnlyTotal = result.inPaystackNotInDatabase.reduce(
      (sum, t) => sum + t.amount,
      0
    );

    result.inPaystackNotInDatabase.slice(0, 20).forEach((tx, index) => {
      console.log(`${index + 1}. Reference: ${tx.reference}`);
      console.log(`   Amount:    ${formatCurrency(tx.amount)}`);
      console.log(`   Paid At:   ${tx.paidAt}`);
      console.log(`   Channel:   ${tx.channel}`);
      console.log();
    });

    if (result.inPaystackNotInDatabase.length > 20) {
      console.log(`   ... and ${result.inPaystackNotInDatabase.length - 20} more`);
      console.log();
    }

    console.log(`Total missing from database: ${formatCurrency(paystackOnlyTotal)}`);
  }

  // Payments in Database but not in Paystack
  if (result.inDatabaseNotInPaystack.length > 0) {
    console.log("\n🔴 PAYMENTS IN DATABASE BUT NOT IN PAYSTACK");
    console.log("-".repeat(80));
    console.log(
      `Found ${result.inDatabaseNotInPaystack.length} payments in your database that are missing from Paystack:\n`
    );

    const databaseOnlyTotal = result.inDatabaseNotInPaystack.reduce(
      (sum, p) => sum + p.amount,
      0
    );

    result.inDatabaseNotInPaystack.slice(0, 20).forEach((payment, index) => {
      console.log(`${index + 1}. Reference: ${payment.reference}`);
      console.log(`   Amount:    ${formatCurrency(payment.amount)}`);
      console.log(`   Status:    ${payment.status}`);
      console.log(`   Created:   ${payment.createdAt.toISOString()}`);
      console.log();
    });

    if (result.inDatabaseNotInPaystack.length > 20) {
      console.log(`   ... and ${result.inDatabaseNotInPaystack.length - 20} more`);
      console.log();
    }

    console.log(`Total not in Paystack: ${formatCurrency(databaseOnlyTotal)}`);
  }

  // Amount mismatches
  const amountMismatches = result.matched.filter((m) => !m.amountMatch);
  if (amountMismatches.length > 0) {
    console.log("\n⚠️  AMOUNT MISMATCHES");
    console.log("-".repeat(80));
    console.log(
      `Found ${amountMismatches.length} transactions with amount discrepancies:\n`
    );

    amountMismatches.slice(0, 10).forEach((match, index) => {
      console.log(`${index + 1}. Reference: ${match.reference}`);
      console.log(`   Paystack:  ${formatCurrency(match.paystackAmount)}`);
      console.log(`   Database:  ${formatCurrency(match.databaseAmount)}`);
      console.log(
        `   Difference: ${formatCurrency(
          match.databaseAmount - match.paystackAmount
        )}`
      );
      console.log();
    });

    if (amountMismatches.length > 10) {
      console.log(`   ... and ${amountMismatches.length - 10} more`);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("✅ RECONCILIATION COMPLETE");
  console.log("=".repeat(80) + "\n");
}

async function saveReportToFile(result: ReconciliationResult) {
  const fs = await import('fs/promises');
  const timestamp = Date.now();
  const filename = `logs/paystack-reconciliation-${timestamp}.json`;

  const report = {
    timestamp: new Date().toISOString(),
    ...result,
  };

  await fs.writeFile(filename, JSON.stringify(report, null, 2));
  console.log(`📄 Full report saved to: ${filename}\n`);
}

// Main execution
async function main() {
  try {
    console.log("🚀 Starting Paystack Reconciliation...\n");

    const result = await reconcileTransactions();
    printReport(result);
    await saveReportToFile(result);

    console.log("💡 NEXT STEPS:");
    console.log("-".repeat(80));
    console.log("1. Review transactions in Paystack but not in database");
    console.log("   → These might be webhook failures or missed payments");
    console.log();
    console.log("2. Review payments in database but not in Paystack");
    console.log("   → These might be test data or wallet-funded transactions");
    console.log();
    console.log("3. Check if you're using TEST vs PRODUCTION Paystack keys");
    console.log("   → Test keys won't show production transactions");
    console.log();
  } catch (error) {
    console.error("❌ Error during reconciliation:", error);
    process.exit(1);
  }
}

main();
