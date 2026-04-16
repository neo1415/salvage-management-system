import { db } from '../src/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function checkBidsColumns() {
  try {
    const result = await db.execute(sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'bids' 
      AND column_name IN ('deposit_amount', 'status', 'is_legacy')
      ORDER BY column_name;
    `);

    console.log('Bids table deposit system columns:');
    console.log(result);

    const rows = Array.isArray(result) ? result : (result.rows || []);
    
    if (rows.length === 0) {
      console.log('\n❌ NO DEPOSIT COLUMNS FOUND - They need to be added!');
    } else if (rows.length === 3) {
      console.log('\n✅ All 3 deposit columns exist');
    } else {
      console.log(`\n⚠️  Only ${rows.length}/3 columns found`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkBidsColumns();
