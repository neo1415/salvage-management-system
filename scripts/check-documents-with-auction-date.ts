/**
 * Check documents using auction date range
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function checkDocuments() {
  console.log('🔍 CHECKING DOCUMENTS WITH AUCTION DATE RANGE\n');

  const startDate = '2026-02-01';
  const endDate = '2026-04-28';

  // Check with auction date range
  const result = await db.execute(sql`
    SELECT 
      COUNT(ad.*) as total,
      COUNT(ad.*) FILTER (WHERE ad.status = 'signed') as signed,
      COUNT(ad.*) FILTER (WHERE ad.status = 'pending') as pending,
      AVG(EXTRACT(EPOCH FROM (ad.signed_at - ad.created_at)) / 3600) FILTER (WHERE ad.status = 'signed') as avg_hours
    FROM auction_documents ad
    JOIN auctions a ON ad.auction_id = a.id
    WHERE a.created_at >= ${startDate} 
      AND a.created_at <= ${endDate}
  `);

  const row = result[0] as any;
  console.log('Documents (filtered by auction date):');
  console.log(`Total: ${row.total}`);
  console.log(`Signed: ${row.signed}`);
  console.log(`Pending: ${row.pending}`);
  console.log(`Avg Hours to Sign: ${parseFloat(row.avg_hours || '0').toFixed(2)}`);
  console.log('');

  // Also check total documents
  const totalResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM auction_documents
  `);
  console.log(`Total documents in database: ${(totalResult[0] as any).count}`);
}

checkDocuments()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
