import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function checkTable() {
  try {
    // Check if auction_winners table exists
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'auction_winners'
      )
    `);
    
    console.log('✅ auction_winners table exists:', result.rows[0].exists);
    
    if (result.rows[0].exists) {
      // Check table structure
      const columns = await db.execute(sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'auction_winners'
        ORDER BY ordinal_position
      `);
      
      console.log('\n📋 Table structure:');
      for (const col of columns.rows) {
        console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
      }
      
      // Check if there are any records
      const count = await db.execute(sql`SELECT COUNT(*) FROM auction_winners`);
      console.log(`\n📊 Total records: ${count.rows[0].count}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkTable();
