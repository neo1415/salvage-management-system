import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function checkDuplicates() {
  const startDate = '2026-02-01';
  const endDate = '2026-04-28';

  // Check for duplicate payments for the same auction
  const duplicates = await db.execute(sql`
    SELECT 
      p.auction_id,
      sc.claim_reference,
      COUNT(*) as payment_count,
      STRING_AGG(CAST(p.amount AS TEXT), ', ') as amounts,
      STRING_AGG(p.id, ', ') as payment_ids
    FROM payments p
    INNER JOIN auctions a ON p.auction_id = a.id
    LEFT JOIN salvage_cases sc ON a.case_id = sc.id
    WHERE p.status = 'verified'
      AND p.created_at >= ${startDate}
      AND p.created_at <= ${endDate}
    GROUP BY p.auction_id, sc.claim_reference
    HAVING COUNT(*) > 1
    ORDER BY payment_count DESC
  `);

  console.log('Duplicate payments found:', duplicates.length);
  duplicates.forEach((row: any) => {
    console.log(`  - ${row.claim_reference} (auction ${row.auction_id}): ${row.payment_count} payments - amounts: ₦${row.amounts}`);
  });

  // Check HTU-7282 specifically
  console.log('\nChecking HTU-7282 specifically:');
  const htu7282 = await db.execute(sql`
    SELECT 
      a.id as auction_id,
      sc.claim_reference,
      p.id as payment_id,
      p.amount,
      p.created_at,
      p.status
    FROM salvage_cases sc
    JOIN auctions a ON sc.id = a.case_id
    LEFT JOIN payments p ON a.id = p.auction_id
    WHERE sc.claim_reference = 'HTU-7282'
    ORDER BY p.created_at DESC
  `);

  htu7282.forEach((row: any) => {
    console.log(`  Auction: ${row.auction_id}, Payment: ${row.payment_id}, Amount: ₦${row.amount}, Status: ${row.status}, Date: ${row.created_at}`);
  });
}

checkDuplicates()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
