/**
 * Analyze relationship between sold cases and payments
 */

import 'dotenv/config';
import { db } from '../src/lib/db/drizzle';
import { salvageCases, auctions, payments } from '../src/lib/db/schema';
import { eq, and, sql, isNotNull } from 'drizzle-orm';

async function analyzeSoldCases() {
  console.log('=== Analyzing Sold Cases and Payments ===\n');

  // 1. All sold cases with their auction and payment status
  const soldCasesAnalysis = await db
    .select({
      caseId: salvageCases.id,
      claimRef: salvageCases.claimReference,
      caseStatus: salvageCases.status,
      auctionId: auctions.id,
      auctionStatus: auctions.status,
      hasPayment: sql<boolean>`${payments.id} IS NOT NULL`,
      paymentStatus: payments.status,
      paymentAmount: payments.amount,
    })
    .from(salvageCases)
    .leftJoin(auctions, eq(salvageCases.id, auctions.caseId))
    .leftJoin(payments, eq(auctions.id, payments.auctionId))
    .where(eq(salvageCases.status, 'sold'));

  console.log(`Total sold cases: ${soldCasesAnalysis.length}\n`);

  // Group by payment status
  const withPayment = soldCasesAnalysis.filter(c => c.hasPayment);
  const withoutPayment = soldCasesAnalysis.filter(c => !c.hasPayment);

  console.log(`Cases WITH payments: ${withPayment.length}`);
  console.log(`Cases WITHOUT payments: ${withoutPayment.length}\n`);

  // Show cases with payments
  if (withPayment.length > 0) {
    console.log('Cases with payments:');
    console.table(withPayment.map(c => ({
      claimRef: c.claimRef,
      auctionStatus: c.auctionStatus,
      paymentStatus: c.paymentStatus,
      amount: c.paymentAmount,
    })));
    console.log();
  }

  // Show sample cases without payments
  if (withoutPayment.length > 0) {
    console.log('Sample cases WITHOUT payments (first 5):');
    console.table(withoutPayment.slice(0, 5).map(c => ({
      claimRef: c.claimRef,
      caseStatus: c.caseStatus,
      auctionStatus: c.auctionStatus,
      hasAuction: c.auctionId !== null,
    })));
    console.log();
  }

  // 2. Check if payments exist but aren't linked to sold cases
  const allPayments = await db
    .select({
      paymentId: payments.id,
      auctionId: payments.auctionId,
      amount: payments.amount,
      status: payments.status,
      caseStatus: salvageCases.status,
      auctionStatus: auctions.status,
    })
    .from(payments)
    .leftJoin(auctions, eq(payments.auctionId, auctions.id))
    .leftJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
    .where(isNotNull(payments.auctionId));

  console.log(`Total payments with auctionId: ${allPayments.length}\n`);

  // Group by case status
  const paymentsByCaseStatus: Record<string, number> = {};
  for (const p of allPayments) {
    const status = p.caseStatus || 'no_case';
    paymentsByCaseStatus[status] = (paymentsByCaseStatus[status] || 0) + 1;
  }

  console.log('Payments grouped by case status:');
  console.table(paymentsByCaseStatus);
  console.log();

  // 3. The key insight
  console.log('=== KEY INSIGHT ===');
  console.log(`There are ${soldCasesAnalysis.length} cases marked as "sold"`);
  console.log(`But only ${withPayment.length} of them have payments`);
  console.log(`This means ${withoutPayment.length} cases are marked "sold" without payments\n`);

  console.log('POSSIBLE REASONS:');
  console.log('1. Cases are marked "sold" before payment is verified');
  console.log('2. Payment records exist but auctionId link is broken');
  console.log('3. Cases were sold through a different process\n');

  // 4. Check auction statuses for sold cases
  const auctionStatuses: Record<string, number> = {};
  for (const c of soldCasesAnalysis) {
    const status = c.auctionStatus || 'no_auction';
    auctionStatuses[status] = (auctionStatuses[status] || 0) + 1;
  }

  console.log('Auction statuses for sold cases:');
  console.table(auctionStatuses);
}

analyzeSoldCases()
  .then(() => {
    console.log('\n✅ Analysis complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Analysis failed:', error);
    process.exit(1);
  });
