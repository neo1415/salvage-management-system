/**
 * Investigate Revenue Discrepancy
 * Why is revenue only ₦700,000 when we expect millions?
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases, auctions, payments, bids } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

async function investigateRevenue() {
  console.log('='.repeat(80));
  console.log('INVESTIGATING REVENUE DISCREPANCY');
  console.log('='.repeat(80));

  // 1. Check all sold cases
  console.log('\n1. SOLD CASES ANALYSIS');
  console.log('-'.repeat(80));
  
  const soldCases = await db
    .select()
    .from(salvageCases)
    .where(eq(salvageCases.status, 'sold'))
    .orderBy(desc(salvageCases.createdAt));
  
  // Get auctions for sold cases
  const soldCaseIds = soldCases.map(c => c.id);
  const auctionsForSold = soldCaseIds.length > 0 
    ? await db.select().from(auctions).where(eq(auctions.caseId, soldCaseIds[0]))
    : [];

  console.log(`\nTotal Sold Cases: ${soldCases.length}`);
  console.log('\nSold Cases Details:');
  console.log('Claim Ref | Market Value');
  console.log('-'.repeat(80));
  
  let totalMarketValue = 0;
  
  for (const c of soldCases) {
    const mv = parseFloat(c.marketValue || '0');
    totalMarketValue += mv;
    
    console.log(
      `${c.claimReference.padEnd(12)} | ` +
      `₦${mv.toLocaleString().padStart(12)}`
    );
  }
  
  console.log('-'.repeat(80));
  console.log(`TOTAL Market Value: ₦${totalMarketValue.toLocaleString()}`);

  // 2. Check payments for sold cases
  console.log('\n\n2. PAYMENTS FOR SOLD CASES');
  console.log('-'.repeat(80));
  
  // Get all payments
  const allPaymentsData = await db.select().from(payments);
  
  // Get auctions for sold cases
  const auctionsData = await db.select().from(auctions);
  
  // Match payments to sold cases
  const paymentsForSold = allPaymentsData.filter(p => {
    const auction = auctionsData.find(a => a.id === p.auctionId);
    if (!auction) return false;
    const soldCase = soldCases.find(c => c.id === auction.caseId);
    return !!soldCase;
  });

  console.log(`\nTotal Payments for Sold Cases: ${paymentsForSold.length}`);
  console.log('\nPayment Details:');
  console.log('Amount | Status | Method');
  console.log('-'.repeat(80));
  
  let totalPayments = 0;
  let verifiedPayments = 0;
  let totalVerifiedAmount = 0;
  
  for (const p of paymentsForSold) {
    const amount = parseFloat(p.amount);
    totalPayments += amount;
    
    if (p.status === 'verified') {
      verifiedPayments++;
      totalVerifiedAmount += amount;
    }
    
    console.log(
      `₦${amount.toLocaleString().padStart(12)} | ` +
      `${p.status.padEnd(10)} | ` +
      `${p.paymentMethod || 'N/A'}`
    );
  }
  
  console.log('-'.repeat(80));
  console.log(`Total All Payments: ₦${totalPayments.toLocaleString()}`);
  console.log(`Verified Payments: ${verifiedPayments} (₦${totalVerifiedAmount.toLocaleString()})`);

  // 3. Check ALL payments (not just sold)
  console.log('\n\n3. ALL PAYMENTS IN SYSTEM');
  console.log('-'.repeat(80));
  
  const allPayments = allPaymentsData;

  console.log(`\nTotal Payments in System: ${allPayments.length}`);
  
  const paymentsByStatus = allPayments.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('\nPayments by Status:');
  for (const [status, count] of Object.entries(paymentsByStatus)) {
    const total = allPayments
      .filter(p => p.status === status)
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);
    console.log(`  ${status}: ${count} payments (₦${total.toLocaleString()})`);
  }

  // 4. Check all auctions
  console.log('\n\n4. ALL AUCTIONS ANALYSIS');
  console.log('-'.repeat(80));
  
  const allAuctions = auctionsData;

  console.log(`\nTotal Auctions: ${allAuctions.length}`);
  
  const auctionsByStatus = allAuctions.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('\nAuctions by Status:');
  for (const [status, count] of Object.entries(auctionsByStatus)) {
    const total = allAuctions
      .filter(a => a.status === status)
      .reduce((sum, a) => sum + parseFloat(a.currentBid || '0'), 0);
    console.log(`  ${status}: ${count} auctions (₦${total.toLocaleString()} in bids)`);
  }

  // 5. Check bids
  console.log('\n\n5. BIDS ANALYSIS');
  console.log('-'.repeat(80));
  
  const allBids = await db
    .select({
      id: bids.id,
      auctionId: bids.auctionId,
      amount: bids.amount,
      status: bids.status,
    })
    .from(bids)
    .orderBy(desc(bids.createdAt));

  console.log(`\nTotal Bids: ${allBids.length}`);
  
  const totalBidAmount = allBids.reduce((sum, b) => sum + parseFloat(b.amount), 0);
  console.log(`Total Bid Amount: ₦${totalBidAmount.toLocaleString()}`);

  // 6. Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`\nSold Cases: ${soldCases.length}`);
  console.log(`  Market Value: ₦${totalMarketValue.toLocaleString()}`);
  console.log(`\nPayments for Sold Cases: ${paymentsForSold.length}`);
  console.log(`  Total: ₦${totalPayments.toLocaleString()}`);
  console.log(`  Verified: ₦${totalVerifiedAmount.toLocaleString()} (${verifiedPayments} payments)`);
  console.log(`\nAll Payments: ${allPayments.length}`);
  console.log(`All Auctions: ${allAuctions.length}`);
  console.log(`All Bids: ${allBids.length} (₦${totalBidAmount.toLocaleString()})`);
  
  console.log('\n' + '='.repeat(80));
  console.log('CONCLUSION');
  console.log('='.repeat(80));
  console.log('\nThe My Performance report shows: ₦700,000');
  console.log(`Verified payments from sold cases: ₦${totalVerifiedAmount.toLocaleString()}`);
  console.log(`Match: ${totalVerifiedAmount === 700000 ? '✅ YES' : '❌ NO'}`);
  
  if (totalVerifiedAmount < totalMarketValue * 0.1) {
    console.log('\n⚠️  WARNING: Revenue is very low compared to market value!');
    console.log('   Possible reasons:');
    console.log('   1. Most sold cases don\'t have verified payments yet');
    console.log('   2. Payments are stuck in "pending" status');
    console.log('   3. Payment verification process is not working');
    console.log('   4. Cases are marked as "sold" but payments haven\'t been processed');
  }
}

investigateRevenue()
  .then(() => {
    console.log('\n✅ Investigation complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Investigation failed:', error);
    process.exit(1);
  });
