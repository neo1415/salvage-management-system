import { db } from '../src/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function verify() {
  const startDate = '2026-02-01';
  const endDate = '2026-04-28';

  console.log('=== TESTING FIXED QUERY ===');
  const results = await db.execute(sql`
    SELECT DISTINCT ON (a.id)
      a.id as auction_id,
      sc.claim_reference,
      a.status,
      p.amount as winning_bid,
      p.id as payment_id,
      p.created_at as payment_created
    FROM auctions a
    LEFT JOIN salvage_cases sc ON a.case_id = sc.id
    LEFT JOIN payments p ON p.auction_id = a.id AND p.status = 'verified'
    WHERE a.end_time >= ${startDate}::timestamp
      AND a.end_time <= ${endDate}::timestamp
      AND a.status IN ('closed', 'awaiting_payment')
      AND sc.status != 'draft'
    ORDER BY a.id, p.created_at DESC NULLS LAST
  `);

  console.log('Total auctions:', results.length);

  const htu7282 = results.filter((r: any) => r.claim_reference === 'HTU-7282');
  console.log('\nHTU-7282 results:', htu7282.length);
  console.log(JSON.stringify(htu7282, null, 2));

  const totalRevenue = results.reduce((sum: number, r: any) => {
    return sum + parseFloat(r.winning_bid || '0');
  }, 0);

  console.log('\nTotal Revenue:', totalRevenue);
  console.log('Expected: 6097500');
  console.log('Match:', totalRevenue === 6097500);

  // Check for any duplicates
  const auctionIds = results.map((r: any) => r.auction_id);
  const uniqueIds = new Set(auctionIds);
  console.log('\nDuplicate check:');
  console.log('Total rows:', auctionIds.length);
  console.log('Unique IDs:', uniqueIds.size);
  console.log('Has duplicates:', auctionIds.length !== uniqueIds.size);
}

verify().catch(console.error);
