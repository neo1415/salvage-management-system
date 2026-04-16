/**
 * Check if approved_by column exists and has data
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema';
import { sql, isNotNull } from 'drizzle-orm';

async function check() {
  console.log('=== CHECKING APPROVED_BY COLUMN ===\n');

  // Check if column exists
  const columnCheck = await db.execute(sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'salvage_cases' 
    AND column_name = 'approved_by'
  `);

  if (columnCheck.length === 0) {
    console.log('❌ approved_by column does NOT exist!');
    console.log('   Need to add it via migration');
    return;
  }

  console.log('✅ approved_by column exists');
  console.log(`   Type: ${(columnCheck[0] as any).data_type}\n`);

  // Check how many cases have approved_by set
  const casesWithApprover = await db
    .select({ count: sql<number>`count(*)` })
    .from(salvageCases)
    .where(isNotNull(salvageCases.approvedBy));

  const totalApproved = await db
    .select({ count: sql<number>`count(*)` })
    .from(salvageCases)
    .where(sql`status IN ('approved', 'active_auction', 'sold')`);

  console.log(`Cases with approved_by set: ${(casesWithApprover[0] as any).count}`);
  console.log(`Total approved cases: ${(totalApproved[0] as any).count}`);

  if ((casesWithApprover[0] as any).count === 0) {
    console.log('\n⚠️  No cases have approved_by set!');
    console.log('   This means the approval process is not setting this field.');
    console.log('   Need to update the approval API to set approved_by.');
  }

  console.log('\n=== CHECK COMPLETE ===');
}

check()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
