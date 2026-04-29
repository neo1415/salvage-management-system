/**
 * Check payment breakdown to find the missing revenue
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function checkPaymentBreakdown() {
  console.log('🔍 Checking payment breakdown (Feb-Apr 2026)\n');

  // Auction vs Registration
  const breakdown = await db.execute(sql`
    SELECT 
      CASE 
        WHEN auction_id IS NOT NULL THEN 'Auction Payment'
        ELSE 'Registration Fee'
      END as category,
      COUNT(*) as count,
      SUM(CAST(amount AS NUMERIC)) as total
    FROM payments
    WHERE status = 'verified'
      AND created_at >= '2026-02-01'
      AND created_at <= '2026-04-28'
    GROUP BY CASE WHEN auction_id IS NOT NULL THEN 'Auction Payment' ELSE 'Registration Fee' END
  `);

  console.log('Payments by category:\n');
  breakdown.forEach((r: any) => {
    console.log(`${r.category}: ${r.count} payments, ₦${parseFloat(r.total).toLocaleString()}`);
  });

  // Total
  const total = await db.execute(sql`
    SELECT 
      COUNT(*) as count,
      SUM(CAST(amount AS NUMERIC)) as total
    FROM payments
    WHERE status = 'verified'
      AND created_at >= '2026-02-01'
      AND created_at <= '2026-04-28'
  `);

  console.log('\n\nTotal verified payments:\n');
  console.log(`Count: ${(total[0] as any).count}`);
  console.log(`Total: ₦${parseFloat((total[0] as any).total).toLocaleString()}`);
}

checkPaymentBreakdown()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
