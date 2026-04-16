/**
 * Trace Manager Revenue - Feb 1 to Apr 15, 2026
 * Why is it only showing ₦700k when there should be ₦3.7M?
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases, auctions, payments, users } from '@/lib/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

async function traceManagerRevenue() {
  console.log('TRACING MANAGER REVENUE - FEB 1 TO APR 15, 2026\n');
  
  const startDate = new Date('2026-02-01');
  const endDate = new Date('2026-04-15');
  
  console.log(`Date Range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}\n`);
  
  // Get ALL cases in date range with payment info (EXACT same query as report)
  const allCases = await db
    .select({
      id: salvageCases.id,
      claimRef: salvageCases.claimReference,
      status: salvageCases.status,
      createdBy: salvageCases.createdBy,
      createdAt: salvageCases.createdAt,
      approvedBy: salvageCases.approvedBy,
      approvedAt: salvageCases.approvedAt,
      adjusterName: users.fullName,
      auctionId: auctions.id,
      currentBid: auctions.currentBid,
      paymentId: payments.id,
      paymentAmount: payments.amount,
      paymentStatus: payments.status,
    })
    .from(salvageCases)
    .leftJoin(users, eq(salvageCases.createdBy, users.id))
    .leftJoin(auctions, eq(salvageCases.id, auctions.caseId))
    .leftJoin(
      payments,
      and(
        eq(auctions.id, payments.auctionId),
        eq(payments.status, 'verified')
      )
    )
    .where(
      and(
        gte(salvageCases.createdAt, startDate),
        lte(salvageCases.createdAt, endDate)
      )
    )
    .orderBy(desc(salvageCases.createdAt));
  
  console.log(`Total Cases in Date Range: ${allCases.length}\n`);
  
  // Filter for sold cases
  const soldCases = allCases.filter(c => c.status === 'sold');
  console.log(`Sold Cases: ${soldCases.length}\n`);
  
  // Filter for sold cases WITH payments
  const soldWithPayments = soldCases.filter(c => c.paymentAmount && c.paymentStatus === 'verified');
  console.log(`Sold Cases WITH Verified Payments: ${soldWithPayments.length}\n`);
  
  // Calculate revenue (EXACT same logic as report)
  const totalRevenue = soldWithPayments.reduce((sum, c) => sum + parseFloat(c.paymentAmount || '0'), 0);
  
  console.log(`Calculated Revenue: ₦${totalRevenue.toLocaleString()}\n`);
  console.log(`Report Shows: ₦700,000`);
  console.log(`Match: ${totalRevenue === 700000 ? '✅ YES' : '❌ NO'}\n`);
  
  // Show payment details
  console.log('='.repeat(100));
  console.log('SOLD CASES WITH VERIFIED PAYMENTS:');
  console.log('='.repeat(100));
  console.log('Claim Ref | Adjuster | Created | Auction ID | Payment ID | Amount');
  console.log('-'.repeat(100));
  
  for (const c of soldWithPayments) {
    console.log(
      `${c.claimRef.padEnd(12)} | ` +
      `${(c.adjusterName || 'Unknown').substring(0, 15).padEnd(15)} | ` +
      `${new Date(c.createdAt).toISOString().split('T')[0]} | ` +
      `${c.auctionId ? c.auctionId.substring(0, 8) + '...' : 'NULL'.padEnd(11)} | ` +
      `${c.paymentId ? c.paymentId.substring(0, 8) + '...' : 'NULL'.padEnd(11)} | ` +
      `₦${parseFloat(c.paymentAmount || '0').toLocaleString()}`
    );
  }
  
  console.log('-'.repeat(100));
  console.log(`TOTAL: ₦${totalRevenue.toLocaleString()}\n`);
  
  // Now check: How many sold cases DON'T have payments?
  const soldWithoutPayments = soldCases.filter(c => !c.paymentAmount);
  console.log('='.repeat(100));
  console.log(`SOLD CASES WITHOUT PAYMENTS: ${soldWithoutPayments.length}`);
  console.log('='.repeat(100));
  
  if (soldWithoutPayments.length > 0) {
    console.log('Claim Ref | Adjuster | Created | Auction ID | Has Auction?');
    console.log('-'.repeat(100));
    
    for (const c of soldWithoutPayments.slice(0, 10)) {
      console.log(
        `${c.claimRef.padEnd(12)} | ` +
        `${(c.adjusterName || 'Unknown').substring(0, 15).padEnd(15)} | ` +
        `${new Date(c.createdAt).toISOString().split('T')[0]} | ` +
        `${c.auctionId ? c.auctionId.substring(0, 8) + '...' : 'NULL'.padEnd(11)} | ` +
        `${c.auctionId ? 'YES' : 'NO'}`
      );
    }
    
    if (soldWithoutPayments.length > 10) {
      console.log(`... and ${soldWithoutPayments.length - 10} more`);
    }
  }
  
  // Check ALL verified payments in the system for these cases
  console.log('\n' + '='.repeat(100));
  console.log('CHECKING: Do these sold cases have payments that the query missed?');
  console.log('='.repeat(100));
  
  const soldCaseIds = soldCases.map(c => c.id);
  
  const allPaymentsForSoldCases = await db
    .select({
      paymentId: payments.id,
      amount: payments.amount,
      status: payments.status,
      auctionId: payments.auctionId,
      caseId: salvageCases.id,
      claimRef: salvageCases.claimReference,
      caseStatus: salvageCases.status,
    })
    .from(payments)
    .innerJoin(auctions, eq(payments.auctionId, auctions.id))
    .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
    .where(
      and(
        gte(salvageCases.createdAt, startDate),
        lte(salvageCases.createdAt, endDate),
        eq(salvageCases.status, 'sold')
      )
    );
  
  const verifiedPaymentsForSoldCases = allPaymentsForSoldCases.filter(p => p.status === 'verified');
  
  console.log(`\nTotal Payments for Sold Cases (all statuses): ${allPaymentsForSoldCases.length}`);
  console.log(`Verified Payments for Sold Cases: ${verifiedPaymentsForSoldCases.length}`);
  
  const totalFromDirectQuery = verifiedPaymentsForSoldCases.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  console.log(`Total Amount (direct query): ₦${totalFromDirectQuery.toLocaleString()}\n`);
  
  if (verifiedPaymentsForSoldCases.length > soldWithPayments.length) {
    console.log('⚠️  DISCREPANCY FOUND!');
    console.log(`LEFT JOIN returned: ${soldWithPayments.length} payments`);
    console.log(`INNER JOIN returned: ${verifiedPaymentsForSoldCases.length} payments`);
    console.log(`Missing: ${verifiedPaymentsForSoldCases.length - soldWithPayments.length} payments\n`);
    
    // Find which payments are missing
    const foundPaymentIds = new Set(soldWithPayments.map(c => c.paymentId).filter(Boolean));
    const missingPayments = verifiedPaymentsForSoldCases.filter(p => !foundPaymentIds.has(p.paymentId));
    
    console.log('Missing Payments:');
    console.log('Claim Ref | Amount | Payment ID | Case Status');
    console.log('-'.repeat(80));
    
    for (const p of missingPayments) {
      console.log(
        `${p.claimRef.padEnd(12)} | ` +
        `₦${parseFloat(p.amount).toLocaleString().padStart(10)} | ` +
        `${p.paymentId.substring(0, 8)}... | ` +
        `${p.caseStatus}`
      );
    }
  } else {
    console.log('✅ No discrepancy - LEFT JOIN and INNER JOIN return same results');
  }
  
  console.log('\n' + '='.repeat(100));
  console.log('SUMMARY');
  console.log('='.repeat(100));
  console.log(`Cases in date range: ${allCases.length}`);
  console.log(`Sold cases: ${soldCases.length}`);
  console.log(`Sold cases with verified payments: ${soldWithPayments.length}`);
  console.log(`Sold cases without payments: ${soldWithoutPayments.length}`);
  console.log(`Revenue from LEFT JOIN query: ₦${totalRevenue.toLocaleString()}`);
  console.log(`Revenue from INNER JOIN query: ₦${totalFromDirectQuery.toLocaleString()}`);
  console.log(`\nReport shows: ₦700,000`);
  console.log(`Expected (from payment page): ₦3,755,000`);
  console.log(`\nDifference: ₦${(3755000 - totalRevenue).toLocaleString()}`);
}

traceManagerRevenue()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
