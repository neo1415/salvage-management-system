/**
 * Fix 14 cases stuck in "active_auction" status
 * Update their status to "sold" since their auctions are closed
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function fixStuckCases() {
  console.log('🔧 FIXING CASES STUCK IN "active_auction" STATUS\n');
  console.log('=' .repeat(80));

  // Find all cases stuck in "active_auction" with closed auctions
  const stuckCases = await db.execute(sql`
    SELECT 
      sc.id,
      sc.claim_reference,
      sc.status as case_status,
      a.id as auction_id,
      a.status as auction_status,
      a.current_bidder,
      a.end_time
    FROM salvage_cases sc
    JOIN auctions a ON sc.id = a.case_id
    WHERE sc.status = 'active_auction'
      AND a.status IN ('closed', 'awaiting_payment')
    ORDER BY sc.created_at DESC
  `);

  console.log(`\nFound ${stuckCases.length} cases stuck in "active_auction" status\n`);

  if (stuckCases.length === 0) {
    console.log('✅ No stuck cases found!');
    return;
  }

  // Update each case
  let fixedCount = 0;
  for (const caseRow of stuckCases as any[]) {
    try {
      await db.execute(sql`
        UPDATE salvage_cases
        SET status = 'sold', updated_at = NOW()
        WHERE id = ${caseRow.id}
      `);

      fixedCount++;
      console.log(`✅ ${fixedCount}. ${caseRow.claim_reference}`);
      console.log(`   Case Status: active_auction → sold`);
      console.log(`   Auction Status: ${caseRow.auction_status}`);
      console.log(`   Winner: ${caseRow.current_bidder || 'None'}`);
      console.log('');
    } catch (error) {
      console.error(`❌ Failed to fix ${caseRow.claim_reference}:`, error);
    }
  }

  console.log('=' .repeat(80));
  console.log(`\n✅ Fixed ${fixedCount} out of ${stuckCases.length} cases\n`);

  // Verify the fix
  const remainingStuck = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM salvage_cases sc
    JOIN auctions a ON sc.id = a.case_id
    WHERE sc.status = 'active_auction'
      AND a.status IN ('closed', 'awaiting_payment')
  `);

  const remaining = parseInt((remainingStuck[0] as any)?.count || '0');
  console.log(`Remaining stuck cases: ${remaining}`);

  if (remaining === 0) {
    console.log('✅ All stuck cases have been fixed!');
  } else {
    console.log(`⚠️  ${remaining} cases still stuck - may need manual review`);
  }
}

fixStuckCases()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
