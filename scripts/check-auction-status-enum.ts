import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function checkStatuses() {
  const result = await db.execute(sql`SELECT unnest(enum_range(NULL::auction_status)) as status`);
  console.log('Auction statuses in database:');
  result.rows.forEach((row: any) => {
    console.log(`  - ${row.status}`);
  });
  process.exit(0);
}

checkStatuses();
