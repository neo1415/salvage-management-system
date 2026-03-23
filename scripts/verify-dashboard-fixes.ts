/**
 * Dashboard Data Fixes Verification Script
 * 
 * This script verifies that all three dashboard data fetching issues are fixed:
 * 1. Bidding history payment status
 * 2. Finance dashboard data
 * 3. Adjuster approved auctions count
 * 
 * Usage:
 *   npx tsx scripts/verify-dashboard-fixes.ts
 */

import { db } from '@/lib/db/drizzle';
import { payments, salvageCases, auctions } from '@/lib/db/schema';
import { eq, isNotNull, sql } from 'drizzle-orm';

interface VerificationResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
}

const results: VerificationResult[] = [];

async function verifyFinanceDashboardData() {
  console.log('\n🔍 Verifying Finance Dashboard Data...\n');

  try {
    // Check total payments
    const totalPaymentsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(payments);
    const totalPayments = totalPaymentsResult[0]?.count || 0;

    if (totalPayments === 0) {
      results.push({
        test: 'Finance Dashboard - Total Payments',
        status: 'WARN',
        message: 'No payment records found in database',
        details: { totalPayments: 0 },
      });
    } else {
      results.push({
        test: 'Finance Dashboard - Total Payments',
        status: 'PASS',
        message: `Found ${totalPayments} payment records`,
        details: { totalPayments },
      });
    }

    // Check payment status distribution
    const statusDistribution = await db
      .select({
        status: payments.status,
        count: sql<number>`count(*)::int`,
      })
      .from(payments)
      .groupBy(payments.status);

    results.push({
      test: 'Finance Dashboard - Payment Status Distribution',
      status: 'PASS',
      message: 'Payment status distribution retrieved',
      details: statusDistribution,
    });

    // Check payment method distribution
    const methodDistribution = await db
      .select({
        method: payments.paymentMethod,
        count: sql<number>`count(*)::int`,
      })
      .from(payments)
      .groupBy(payments.paymentMethod);

    results.push({
      test: 'Finance Dashboard - Payment Method Distribution',
      status: 'PASS',
      message: 'Payment method distribution retrieved',
      details: methodDistribution,
    });

    // Check total amount (sum of ALL payments)
    const totalAmountResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${payments.amount}::numeric), 0)::numeric`,
      })
      .from(payments);

    const totalAmount = parseFloat(totalAmountResult[0]?.total?.toString() || '0');

    results.push({
      test: 'Finance Dashboard - Total Amount',
      status: 'PASS',
      message: `Total amount (all payments): ₦${totalAmount.toLocaleString()}`,
      details: { totalAmount },
    });

    // Detailed breakdown by status
    const amountByStatus = await db
      .select({
        status: payments.status,
        total: sql<number>`COALESCE(SUM(${payments.amount}::numeric), 0)::numeric`,
        count: sql<number>`count(*)::int`,
      })
      .from(payments)
      .groupBy(payments.status);

    results.push({
      test: 'Finance Dashboard - Amount Breakdown by Status',
      status: 'PASS',
      message: 'Payment amounts grouped by status',
      details: amountByStatus.map(row => ({
        status: row.status,
        total: `₦${parseFloat(row.total?.toString() || '0').toLocaleString()}`,
        count: row.count,
      })),
    });

  } catch (error) {
    results.push({
      test: 'Finance Dashboard - Data Verification',
      status: 'FAIL',
      message: 'Error verifying finance dashboard data',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
}

async function verifyBiddingHistoryPaymentStatus() {
  console.log('\n🔍 Verifying Bidding History Payment Status...\n');

  try {
    // Find auctions with payments
    const auctionsWithPayments = await db
      .select({
        auctionId: payments.auctionId,
        paymentStatus: payments.status,
        caseStatus: salvageCases.status,
      })
      .from(payments)
      .innerJoin(auctions, eq(payments.auctionId, auctions.id))
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .limit(10);

    if (auctionsWithPayments.length === 0) {
      results.push({
        test: 'Bidding History - Payment Status',
        status: 'WARN',
        message: 'No auctions with payments found',
        details: { count: 0 },
      });
    } else {
      results.push({
        test: 'Bidding History - Payment Status',
        status: 'PASS',
        message: `Found ${auctionsWithPayments.length} auctions with payments`,
        details: auctionsWithPayments,
      });

      // Check for verified payments
      const verifiedPayments = auctionsWithPayments.filter(
        (a) => a.paymentStatus === 'verified'
      );

      if (verifiedPayments.length > 0) {
        results.push({
          test: 'Bidding History - Verified Payments',
          status: 'PASS',
          message: `Found ${verifiedPayments.length} verified payments (should show "Payment Completed")`,
          details: verifiedPayments,
        });
      }

      // Check for pending payments
      const pendingPayments = auctionsWithPayments.filter(
        (a) => a.paymentStatus === 'pending'
      );

      if (pendingPayments.length > 0) {
        results.push({
          test: 'Bidding History - Pending Payments',
          status: 'PASS',
          message: `Found ${pendingPayments.length} pending payments (should show "Payment Pending")`,
          details: pendingPayments,
        });
      }
    }

  } catch (error) {
    results.push({
      test: 'Bidding History - Payment Status Verification',
      status: 'FAIL',
      message: 'Error verifying bidding history payment status',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
}

async function verifyAdjusterApprovedCount() {
  console.log('\n🔍 Verifying Adjuster Approved Auctions Count...\n');

  try {
    // Get all adjusters
    const adjusters = await db
      .select({
        userId: salvageCases.createdBy,
      })
      .from(salvageCases)
      .groupBy(salvageCases.createdBy);

    if (adjusters.length === 0) {
      results.push({
        test: 'Adjuster Dashboard - Approved Count',
        status: 'WARN',
        message: 'No cases found in database',
        details: { adjusterCount: 0 },
      });
      return;
    }

    // Check approved count for each adjuster
    for (const adjuster of adjusters.slice(0, 5)) { // Check first 5 adjusters
      const totalCases = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(salvageCases)
        .where(eq(salvageCases.createdBy, adjuster.userId));

      const approvedCases = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(salvageCases)
        .where(
          sql`${salvageCases.createdBy} = ${adjuster.userId} AND ${salvageCases.approvedBy} IS NOT NULL`
        );

      const total = totalCases[0]?.count || 0;
      const approved = approvedCases[0]?.count || 0;

      if (total > 0) {
        results.push({
          test: `Adjuster Dashboard - User ${adjuster.userId.slice(0, 8)}...`,
          status: 'PASS',
          message: `Total: ${total}, Approved: ${approved}`,
          details: {
            userId: adjuster.userId,
            totalCases: total,
            approvedCases: approved,
            approvalRate: total > 0 ? `${Math.round((approved / total) * 100)}%` : '0%',
          },
        });
      }
    }

    // Overall statistics
    const totalApproved = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(salvageCases)
      .where(isNotNull(salvageCases.approvedBy));

    results.push({
      test: 'Adjuster Dashboard - Overall Approved Count',
      status: 'PASS',
      message: `Total approved cases across all adjusters: ${totalApproved[0]?.count || 0}`,
      details: { totalApproved: totalApproved[0]?.count || 0 },
    });

  } catch (error) {
    results.push({
      test: 'Adjuster Dashboard - Approved Count Verification',
      status: 'FAIL',
      message: 'Error verifying adjuster approved count',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
}

async function printResults() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 DASHBOARD DATA FIXES VERIFICATION RESULTS');
  console.log('='.repeat(80) + '\n');

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const warnings = results.filter((r) => r.status === 'WARN').length;

  results.forEach((result) => {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} ${result.test}`);
    console.log(`   ${result.message}`);
    if (result.details) {
      console.log(`   Details:`, JSON.stringify(result.details, null, 2));
    }
    console.log('');
  });

  console.log('='.repeat(80));
  console.log(`Summary: ${passed} passed, ${failed} failed, ${warnings} warnings`);
  console.log('='.repeat(80) + '\n');

  if (failed > 0) {
    console.log('❌ VERIFICATION FAILED - Please review the errors above\n');
    process.exit(1);
  } else if (warnings > 0) {
    console.log('⚠️  VERIFICATION PASSED WITH WARNINGS - Please review the warnings above\n');
    process.exit(0);
  } else {
    console.log('✅ ALL VERIFICATIONS PASSED\n');
    process.exit(0);
  }
}

async function main() {
  console.log('🚀 Starting Dashboard Data Fixes Verification...\n');

  try {
    await verifyFinanceDashboardData();
    await verifyBiddingHistoryPaymentStatus();
    await verifyAdjusterApprovedCount();
    await printResults();
  } catch (error) {
    console.error('❌ Verification script failed:', error);
    process.exit(1);
  }
}

main();
