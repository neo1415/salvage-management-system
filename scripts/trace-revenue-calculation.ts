/**
 * Trace Revenue Calculation
 * Step by step trace of what the report is calculating
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases, auctions, payments, users } from '@/lib/db/schema';
import { eq, and, gte, lte, inArray, desc } from 'drizzle-orm';

async function traceRevenue() {
  console.log('TRACING REVENUE CALCULATION\n');
  
  // Find Ademola
  const ademola = await db.select().from(users).where(eq(users.fullName, 'Ademola Dan'));
  const ademolaId = ademola[0].id;
  
  // Date range (last 30 days)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  console.log(`Ademola ID: ${ademolaId}`);
  console.log(`Date Range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}\n`);
  
  // Execute the EXACT same query as the report
  const results = await db
    .select({
      adjusterId: salvageCases.createdBy,
      adjusterName: users.fullName,
      caseId: salvageCases.id,
      status: salvageCases.status,
      marketValue: salvageCases.marketValue,
      createdAt: salvageCases.createdAt,
      approvedAt: salvageCases.approvedAt,
      currentBid: auctions.currentBid,
      paymentAmount: payments.amount,
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
        lte(salvageCases.createdAt, endDate),
        inArray(salvageCases.createdBy, [ademolaId])
      )
    )
    .orderBy(desc(salvageCases.createdAt));
  
  console.log(`Total Rows Returned: ${results.length}\n`);
  
  // Filter for sold cases with payments (EXACT same logic as report)
  const withPayments = results.filter(c => c.paymentAmount && c.status === 'sold');
  
  console.log(`Rows with paymentAmount AND status='sold': ${withPayments.length}\n`);
  
  // Calculate revenue (EXACT same logic as report)
  const revenue = withPayments.reduce((sum, c) => sum + parseFloat(c.paymentAmount || '0'), 0);
  
  console.log(`Calculated Revenue: ₦${revenue.toLocaleString()}\n`);
  
  // Show details
  console.log('Details of Rows with Payments:');
  console.log('Case ID | Status | Payment Amount');
  console.log('-'.repeat(60));
  
  for (const row of withPayments) {
    console.log(
      `${row.caseId.substring(0, 8)}... | ` +
      `${row.status.padEnd(15)} | ` +
      `₦${parseFloat(row.paymentAmount || '0').toLocaleString()}`
    );
  }
  
  console.log('-'.repeat(60));
  console.log(`TOTAL: ₦${revenue.toLocaleString()}`);
  
  // Check for NULL payments
  const soldCases = results.filter(c => c.status === 'sold');
  const soldWithoutPayment = soldCases.filter(c => !c.paymentAmount);
  
  console.log(`\nSold Cases: ${soldCases.length}`);
  console.log(`Sold Cases WITHOUT payment in result: ${soldWithoutPayment.length}`);
  
  if (soldWithoutPayment.length > 0) {
    console.log('\nSold Cases Missing Payments:');
    for (const c of soldWithoutPayment.slice(0, 5)) {
      console.log(`  ${c.caseId} - created ${new Date(c.createdAt).toISOString().split('T')[0]}`);
    }
  }
}

traceRevenue()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
