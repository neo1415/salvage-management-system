/**
 * Test what the manager performance report returns for Feb 1 - Apr 15
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases, auctions, payments, users } from '@/lib/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

async function testManagerRevenue() {
  console.log('TESTING MANAGER REVENUE CALCULATION (Feb 1 - Apr 15, 2026)\n');
  
  const startDate = new Date('2026-02-01');
  const endDate = new Date('2026-04-15T23:59:59');
  
  console.log(`Date Range: ${startDate.toISOString()} to ${endDate.toISOString()}\n`);
  
  // This is the exact query from the manager report
  const allCases = await db
    .select({
      id: salvageCases.id,
      status: salvageCases.status,
      createdBy: salvageCases.createdBy,
      createdAt: salvageCases.createdAt,
      approvedBy: salvageCases.approvedBy,
      approvedAt: salvageCases.approvedAt,
      adjusterName: users.fullName,
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
        lte(salvageCases.createdAt, endDate)
      )
    );
  
  console.log(`Total cases in date range: ${allCases.length}`);
  
  // Calculate revenue the same way the service does
  const totalRevenue = allCases
    .filter(c => c.paymentAmount)
    .reduce((sum, c) => sum + parseFloat(c.paymentAmount || '0'), 0);
  
  console.log(`\nRevenue Calculation:`);
  console.log(`Cases with verified payments: ${allCases.filter(c => c.paymentAmount).length}`);
  console.log(`Total Revenue: ₦${totalRevenue.toLocaleString()}`);
  
  // Show breakdown by status
  console.log(`\nBreakdown by case status:`);
  const statusMap = new Map<string, { count: number; revenue: number }>();
  
  for (const c of allCases.filter(c => c.paymentAmount)) {
    if (!statusMap.has(c.status)) {
      statusMap.set(c.status, { count: 0, revenue: 0 });
    }
    const stat = statusMap.get(c.status)!;
    stat.count++;
    stat.revenue += parseFloat(c.paymentAmount || '0');
  }
  
  for (const [status, stat] of statusMap.entries()) {
    console.log(`  ${status}: ${stat.count} cases, ₦${stat.revenue.toLocaleString()}`);
  }
  
  // Show all payments
  console.log(`\nAll verified payments in date range:`);
  console.log('Claim Ref | Status | Amount');
  console.log('-'.repeat(60));
  
  for (const c of allCases.filter(c => c.paymentAmount)) {
    console.log(
      `${(c.id || 'NO ID').substring(0, 15).padEnd(15)} | ` +
      `${c.status.padEnd(20)} | ` +
      `₦${parseFloat(c.paymentAmount || '0').toLocaleString()}`
    );
  }
}

testManagerRevenue()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
