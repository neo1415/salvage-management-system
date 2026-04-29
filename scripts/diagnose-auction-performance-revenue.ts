/**
 * Diagnose Auction Performance Revenue Issue
 */

import { db } from '../src/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function diagnose() {
  console.log('=== DIAGNOSING AUCTION PERFORMANCE REVENUE ===\n');

  const startDate = '2026-02-01';
  const endDate = '2026-04-28';

  // Get all auctions in the date range with their payment status
  const allAuctions = await db.execute(sql`
    SELECT 
      a.id,
      sc.claim_reference,
      a.status,
      a.end_time,
      a.current_bid,
      p.id as payment_id,
      p.amount as payment_amount,
      p.status as payment_status
    FROM auctions a
    LEFT JOIN salvage_cases sc ON a.case_id = sc.id
    LEFT JOIN payments p ON p.auction_id = a.id
    WHERE a.end_time >= ${startDate}::timestamp
      AND a.end_time <= ${endDate}::timestamp
      AND a.status IN ('closed', 'awaiting_payment')
      AND sc.status != 'draft'
    ORDER BY sc.claim_reference, p.created_at DESC
  `);

  console.log(`Total auction records: ${allAuctions.length}\n`);

  // Group by auction
  const auctionMap = new Map<string, any[]>();
  allAuctions.forEach((row: any) => {
    if (!auctionMap.has(row.id)) {
      auctionMap.set(row.id, []);
    }
    auctionMap.get(row.id)!.push(row);
  });

  console.log(`Unique auctions: ${auctionMap.size}\n`);

  // Categorize auctions
  const withVerifiedPayment: any[] = [];
  const withPendingPayment: any[] = [];
  const withNoPayment: any[] = [];
  const withMultiplePayments: any[] = [];

  auctionMap.forEach((rows, auctionId) => {
    const verifiedPayments = rows.filter((r: any) => r.payment_status === 'verified');
    const pendingPayments = rows.filter((r: any) => r.payment_status === 'pending');
    
    if (verifiedPayments.length > 1) {
      withMultiplePayments.push(rows[0]);
    } else if (verifiedPayments.length === 1) {
      withVerifiedPayment.push(rows[0]);
    } else if (pendingPayments.length > 0) {
      withPendingPayment.push(rows[0]);
    } else if (rows[0].payment_id === null) {
      withNoPayment.push(rows[0]);
    }
  });

  console.log('AUCTION CATEGORIES:\n');
  console.log(`✅ With Verified Payment: ${withVerifiedPayment.length}`);
  console.log(`⏳ With Pending Payment: ${withPendingPayment.length}`);
  console.log(`❌ With No Payment: ${withNoPayment.length}`);
  console.log(`🔄 With Multiple Payments: ${withMultiplePayments.length}\n`);

  // Show auctions with multiple payments
  if (withMultiplePayments.length > 0) {
    console.log('AUCTIONS WITH MULTIPLE PAYMENTS:');
    withMultiplePayments.forEach((auction: any) => {
      const payments = auctionMap.get(auction.id)!.filter((r: any) => r.payment_status === 'verified');
      console.log(`  ${auction.claim_reference}:`);
      payments.forEach((p: any) => {
        console.log(`    - ₦${parseFloat(p.payment_amount).toLocaleString()} (${p.payment_status})`);
      });
    });
    console.log('');
  }

  // Calculate expected revenue (only from verified payments, one per auction)
  let expectedRevenue = 0;
  auctionMap.forEach((rows) => {
    const verifiedPayments = rows.filter((r: any) => r.payment_status === 'verified');
    if (verifiedPayments.length > 0) {
      // Take the latest payment (first in the array since we ordered by created_at DESC)
      expectedRevenue += parseFloat(verifiedPayments[0].payment_amount || '0');
    }
  });

  console.log('EXPECTED REVENUE CALCULATION:\n');
  console.log(`Auctions with verified payments: ${withVerifiedPayment.length + withMultiplePayments.length}`);
  console.log(`Expected Total Revenue: ₦${expectedRevenue.toLocaleString()}\n`);

  // Show sample of auctions without payments
  if (withNoPayment.length > 0) {
    console.log(`SAMPLE AUCTIONS WITHOUT PAYMENTS (showing first 10 of ${withNoPayment.length}):`);
    withNoPayment.slice(0, 10).forEach((auction: any) => {
      console.log(`  - ${auction.claim_reference}: ${auction.status} (Current Bid: ₦${parseFloat(auction.current_bid || '0').toLocaleString()})`);
    });
    console.log('');
  }
}

diagnose()
  .then(() => {
    console.log('✅ Diagnosis complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
