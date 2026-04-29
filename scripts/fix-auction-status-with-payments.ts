/**
 * Fix Auction Status - Update auctions to "closed" when they have verified payments
 * 
 * Root Cause: Many auctions are stuck in "awaiting_payment" status even though
 * they have verified payments. This causes incorrect reporting.
 */

import { db } from '../src/lib/db/drizzle';
import { auctions, payments } from '../src/lib/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';

async function fixAuctionStatuses() {
  console.log('=== FIXING AUCTION STATUSES ===\n');

  // Find auctions with "awaiting_payment" status that have verified payments
  const auctionsToFix = await db.execute(sql`
    SELECT 
      a.id,
      sc.claim_reference,
      a.status,
      p.id as payment_id,
      p.amount,
      p.status as payment_status,
      p.created_at as payment_date
    FROM auctions a
    LEFT JOIN salvage_cases sc ON a.case_id = sc.id
    INNER JOIN payments p ON p.auction_id = a.id AND p.status = 'verified'
    WHERE a.status = 'awaiting_payment'
    ORDER BY sc.claim_reference
  `);

  console.log(`Found ${auctionsToFix.length} auctions with verified payments but wrong status\n`);

  if (auctionsToFix.length === 0) {
    console.log('✅ No auctions need status updates');
    return;
  }

  // Show sample of auctions to fix
  console.log('Sample auctions to fix:');
  auctionsToFix.slice(0, 10).forEach((auction: any) => {
    console.log(`  - ${auction.claim_reference}: ${auction.status} → closed (Payment: ₦${parseFloat(auction.amount).toLocaleString()})`);
  });
  console.log('');

  // Update auction statuses
  const auctionIds = auctionsToFix.map((a: any) => a.id);
  
  const result = await db
    .update(auctions)
    .set({ 
      status: 'closed',
      updatedAt: new Date()
    })
    .where(inArray(auctions.id, auctionIds));

  console.log(`✅ Updated ${auctionsToFix.length} auctions to "closed" status\n`);

  // Verify the fix
  console.log('=== VERIFICATION ===\n');
  
  const stillBroken = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM auctions a
    INNER JOIN payments p ON p.auction_id = a.id AND p.status = 'verified'
    WHERE a.status = 'awaiting_payment'
  `);

  const brokenCount = parseInt((stillBroken[0] as any)?.count || '0');
  
  if (brokenCount === 0) {
    console.log('✅ All auctions with verified payments now have "closed" status');
  } else {
    console.log(`⚠️  Still ${brokenCount} auctions with verified payments but wrong status`);
  }

  // Show updated revenue calculation
  console.log('\n=== REVENUE CHECK ===\n');
  
  const revenueCheck = await db.execute(sql`
    SELECT 
      COUNT(DISTINCT a.id) as total_auctions,
      COUNT(DISTINCT p.id) as total_payments,
      SUM(CAST(p.amount AS NUMERIC)) as total_revenue
    FROM auctions a
    LEFT JOIN salvage_cases sc ON a.case_id = sc.id
    LEFT JOIN payments p ON p.auction_id = a.id AND p.status = 'verified'
    WHERE a.end_time >= '2026-02-01'
      AND a.end_time <= '2026-04-28'
      AND a.status IN ('closed', 'awaiting_payment')
      AND sc.status != 'draft'
  `);

  const stats = revenueCheck[0] as any;
  console.log(`Total Auctions: ${stats.total_auctions}`);
  console.log(`Total Payments: ${stats.total_payments}`);
  console.log(`Total Revenue: ₦${parseFloat(stats.total_revenue || '0').toLocaleString()}`);
  console.log('');
}

fixAuctionStatuses()
  .then(() => {
    console.log('✅ Fix complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
