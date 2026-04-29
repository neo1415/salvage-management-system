/**
 * Check all claims adjusters in the database
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function checkAllAdjusters() {
  console.log('🔍 Checking all claims adjusters in database\n');

  // Get all adjusters
  const adjusters = await db.execute(sql`
    SELECT 
      id, 
      full_name, 
      role, 
      created_at,
      (SELECT COUNT(*) FROM salvage_cases WHERE created_by = users.id AND status != 'draft') as case_count
    FROM users 
    WHERE role = 'claims_adjuster'
    ORDER BY full_name
  `);

  console.log(`Total Claims Adjusters: ${adjusters.length}\n`);
  
  adjusters.forEach((adj: any, i: number) => {
    console.log(`${i + 1}. ${adj.full_name}`);
    console.log(`   ID: ${adj.id}`);
    console.log(`   Cases: ${adj.case_count}`);
    console.log(`   Created: ${new Date(adj.created_at).toLocaleDateString()}`);
    console.log('');
  });

  // Check which adjusters have cases in the date range
  console.log('\n📊 Adjusters with cases in Feb-Apr 2026:\n');
  
  const adjustersWithCases = await db.execute(sql`
    SELECT 
      u.id,
      u.full_name,
      COUNT(sc.id) as cases_processed,
      COALESCE(SUM(CAST(p.amount AS NUMERIC)), 0) as revenue
    FROM users u
    LEFT JOIN salvage_cases sc ON u.id = sc.created_by 
      AND sc.created_at >= '2026-02-01'
      AND sc.created_at <= '2026-04-28'
      AND sc.status != 'draft'
    LEFT JOIN auctions a ON sc.id = a.case_id
    LEFT JOIN payments p ON a.id = p.auction_id AND p.status = 'verified'
    WHERE u.role = 'claims_adjuster'
    GROUP BY u.id, u.full_name
    HAVING COUNT(sc.id) > 0
    ORDER BY revenue DESC
  `);

  adjustersWithCases.forEach((adj: any, i: number) => {
    console.log(`${i + 1}. ${adj.full_name}`);
    console.log(`   Cases: ${adj.cases_processed}`);
    console.log(`   Revenue: ₦${parseFloat(adj.revenue).toLocaleString()}`);
    console.log('');
  });
}

checkAllAdjusters()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
