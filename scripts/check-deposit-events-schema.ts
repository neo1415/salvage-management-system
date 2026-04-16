import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function checkDepositEventsSchema() {
  try {
    console.log('🔍 Checking deposit_events table schema...\n');

    // Get column information
    const columns = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'deposit_events'
      ORDER BY ordinal_position;
    `);

    console.log('📋 Columns in deposit_events table:');
    console.log('='.repeat(80));
    
    if (Array.isArray(columns)) {
      for (const col of columns) {
        console.log(`  ${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
      }
    } else {
      console.log('Columns:', JSON.stringify(columns, null, 2));
    }

    console.log('\n✅ Schema check complete\n');

  } catch (error) {
    console.error('\n❌ Error checking schema:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
  } finally {
    process.exit(0);
  }
}

checkDepositEventsSchema();
