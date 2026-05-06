import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function checkTable() {
  try {
    console.log('🔍 Checking if auction_winners table exists...\n');
    
    // Try to query the table directly
    const result = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'auction_winners'
    `);
    
    console.log('Query result:', result);
    console.log('Rows length:', result.rows?.length);
    
    if (result.rows && result.rows.length > 0) {
      console.log('\n✅ auction_winners table EXISTS');
      
      // Check the structure
      const structure = await db.execute(sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'auction_winners'
        ORDER BY ordinal_position
      `);
      
      console.log('\n📋 Table structure:');
      console.log(structure.rows);
    } else {
      console.log('❌ auction_winners table DOES NOT EXIST');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkTable();
