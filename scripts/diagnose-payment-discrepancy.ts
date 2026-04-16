import { db } from '@/lib/db/drizzle';
import { payments, auctions, salvageCases } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';

async function diagnoseDiscrepancy() {
  console.log('=== Diagnosing Payment Discrepancy ===\n');

  // Get all payments
  const allPayments = await db.select().from(payments);
  console.log(`Total payments in DB: ${allPayments.length}`);
  
  const totalAllPayments = allPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  console.log(`Total amount (all payments): ₦${totalAllPayments.toLocaleString()}\n`);

  // Group by status
  const byStatus: Record<string, { count: number; total: number }> = {};
  for (const p of allPayments) {
    if (!byStatus[p.status]) byStatus[p.status] = { count: 0, total: 0 };
    byStatus[p.status].count++;
    byStatus[p.status].total += parseFloat(p.amount);
  }

  console.log('By Status:');
  for (const [status, data] of Object.entries(byStatus)) {
    console.log(`  ${status}: ${data.count} payments, ₦${data.total.toLocaleString()}`);
  }
  console.log('');

  // Get verified payments only
  const verifiedPayments = allPayments.filter(p => p.status === 'verified');
  const totalVerified = verifiedPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  console.log(`Verified payments: ${verifiedPayments.length}, ₦${totalVerified.toLocaleString()}\n`);

  // Get auction-related payments
  const auctionIds = allPayments.map(p => p.auctionId).filter(Boolean);
  console.log(`Payments with auctionId: ${auctionIds.length}`);
  
  const auctionPayments = allPayments.filter(p => p.auctionId);
  const totalAuctionPayments = auctionPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  console.log(`Total auction payments: ₦${totalAuctionPayments.toLocaleString()}\n`);

  // Get sold cases with their auction bids
  const soldCases = await db
    .select({
      caseId: salvageCases.id,
      claimRef: salvageCases.claimReference,
      marketValue: salvageCases.marketValue,
      auctionId: auctions.id,
      currentBid: auctions.currentBid,
      winnerId: auctions.winnerId,
    })
    .from(salvageCases)
    .leftJoin(auctions, eq(salvageCases.id, auctions.caseId))
    .where(eq(salvageCases.status, 'sold'));

  console.log(`Sold cases: ${soldCases.length}`);
  const totalCurrentBids = soldCases.reduce((sum, c) => sum + parseFloat(c.currentBid || '0'), 0);
  console.log(`Total currentBid values: ₦${totalCurrentBids.toLocaleString()}\n`);

  // Check which sold cases have payments
  console.log('Sold cases payment status:');
  for (const sCase of soldCases.slice(0, 10)) {
    const payment = allPayments.find(p => p.auctionId === sCase.auctionId);
    console.log(`  ${sCase.claimRef}: Bid=₦${parseFloat(sCase.currentBid || '0').toLocaleString()}, Payment=${payment ? `₦${parseFloat(payment.amount).toLocaleString()} (${payment.status})` : 'NONE'}`);
  }

  console.log('\n=== Summary ===');
  console.log(`Vendor Spending Query: Only VERIFIED auction payments = ₦${totalVerified.toLocaleString()}`);
  console.log(`Salvage Recovery Query: currentBid OR paymentAmount = ₦${totalCurrentBids.toLocaleString()}`);
  console.log(`Payment Analytics Query: ALL payments (any status) = ₦${totalAllPayments.toLocaleString()}`);

  console.log('\n=== Diagnosis Complete ===');
  process.exit(0);
}

diagnoseDiscrepancy().catch(console.error);
