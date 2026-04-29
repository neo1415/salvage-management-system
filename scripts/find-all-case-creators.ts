/**
 * Find all users who created cases (to find the missing ₦300k)
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function findAllCaseCreators() {
  console.log('🔍 Finding all users who created cases (Feb-Apr 2026)\n');

  const result = await db.execute(sql`
    SELECT 
      u.full_name, 
      u.role, 
      COUNT(sc.id) as cases,
      COALESCE(SUM(CAST(p.amount AS NUMERIC)), 0) as revenue
    FROM users u
    LEFT JOIN salvage_cases sc ON u.id = sc.created_by 
      AND sc.created_at >= '2026-02-01'
      AND sc.created_at <= '2026-04-28'
      AND sc.status != 'draft'
    LEFT JOIN auctions a ON sc.id = a.case_id
    LEFT JOIN payments p ON a.id = p.auction_id AND p.status = 'verified'
    WHERE u.full_name NOT LIKE '%Test%' 
      AND u.full_name NOT LIKE '%test%'
    GROUP BY u.id, u.full_name, u.role
    HAVING COUNT(sc.id) > 0
    ORDER BY revenue DESC
  `);

  console.log('All users with cases (excluding test accounts):\n');
  
  result.forEach((r: any) => {
    console.log(`${r.full_name} (${r.role})`);
    console.log(`  Cases: ${r.cases}`);
    console.log(`  Revenue: ₦${parseFloat(r.revenue).toLocaleString()}`);
    console.log('');
  });

  const totalRevenue = result.reduce((sum: number, r: any) => sum + parseFloat(r.revenue), 0);
  console.log(`\nTotal Revenue from all users: ₦${totalRevenue.toLocaleString()}`);
  console.log(`Expected Total: ₦6,097,500`);
  console.log(`Missing: ₦${(6097500 - totalRevenue).toLocaleString()}`);
}

findAllCaseCreators()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
