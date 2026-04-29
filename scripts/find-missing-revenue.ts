import { db } from '../src/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function findMissing() {
  const startDate = '2026-02-01';
  const endDate = '2026-04-28';

  console.log('=== FINDING MISSING REVENUE ===');

  // Get all verified payments in date range (by payment created_at)
  const allPayments = await db.execute(sql`
    SELECT 
      p.id,
      p.amount,
      p.auction_id,
      p.created_at,
      a.end_time,
      sc.claim_reference
    FROM payments p
    LEFT JOIN auctions a ON p.auction_id = a.id
    LEFT JOIN salvage_cases sc ON a.case_id = sc.id
    WHERE p.status = 'verified'
      AND p.created_at >= ${startDate}::timestamp
      AND p.created_at <= ${endDate}::timestamp
    ORDER BY p.amount DESC
  `);

  console.log('Total payments in date range (by payment date):', allPayments.length);
  const totalFromPayments = allPayments.reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0);
  console.log('Total from payments:', totalFromPayments);

  // Get auctions in date range (by auction end_time)
  const auctionsInRange = await db.execute(sql`
    SELECT 
      a.id,
      a.end_time,
      sc.claim_reference,
      p.amount
    FROM auctions a
    LEFT JOIN salvage_cases sc ON a.case_id = sc.id
    LEFT JOIN payments p ON p.auction_id = a.id AND p.status = 'verified'
    WHERE a.end_time >= ${startDate}::timestamp
      AND a.end_time <= ${endDate}::timestamp
      AND a.status IN ('closed', 'awaiting_payment')
    ORDER BY a.end_time
  `);

  console.log('\nAuctions in end_time range:', auctionsInRange.length);
  const totalFromAuctions = auctionsInRange.reduce((sum: number, a: any) => sum + parseFloat(a.amount || '0'), 0);
  console.log('Total from auctions:', totalFromAuctions);

  // Find payments where auction end_time is outside range but payment is inside
  const mismatchedPayments = await db.execute(sql`
    SELECT 
      p.id,
      p.amount,
      p.created_at as payment_date,
      a.end_time as auction_end,
      sc.claim_reference
    FROM payments p
    LEFT JOIN auctions a ON p.auction_id = a.id
    LEFT JOIN salvage_cases sc ON a.case_id = sc.id
    WHERE p.status = 'verified'
      AND p.created_at >= ${startDate}::timestamp
      AND p.created_at <= ${endDate}::timestamp
      AND (a.end_time < ${startDate}::timestamp OR a.end_time > ${endDate}::timestamp)
    ORDER BY p.amount DESC
  `);

  console.log('\nPayments where auction end_time is outside range:');
  console.log('Count:', mismatchedPayments.length);
  if (mismatchedPayments.length > 0) {
    console.log(JSON.stringify(mismatchedPayments.slice(0, 10), null, 2));
    const mismatchedTotal = mismatchedPayments.reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0);
    console.log('Total mismatched:', mismatchedTotal);
    console.log('This explains the difference!');
  }
}

findMissing().catch(console.error);
