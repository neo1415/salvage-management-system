/**
 * Check deposit_events table constraints
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function checkConstraints() {
  console.log('🔍 Checking deposit_events table constraints...\n');

  try {
    const result: any = await db.execute(sql`
      SELECT 
        conname AS constraint_name,
        contype AS constraint_type,
        pg_get_constraintdef(oid) AS constraint_definition
      FROM pg_constraint
      WHERE conrelid = 'deposit_events'::regclass
      ORDER BY conname;
    `);

    console.log('Constraints found:');
    if (result && result.length > 0) {
      result.forEach((row: any) => {
        console.log(`  - ${row.constraint_name} (${row.constraint_type}): ${row.constraint_definition}`);
      });
    } else {
      console.log('  No constraints found or result format unexpected');
      console.log('  Raw result:', result);
    }

    // Also check column info
    console.log('\n🔍 Checking auction_id column type...\n');
    const columnInfo: any = await db.execute(sql`
      SELECT 
        column_name,
        data_type,
        udt_name
      FROM information_schema.columns
      WHERE table_name = 'deposit_events' AND column_name = 'auction_id';
    `);

    console.log('Column info:', columnInfo);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

checkConstraints();
