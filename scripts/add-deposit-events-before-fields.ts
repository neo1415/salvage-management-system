import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function addDepositEventsBeforeFields() {
  try {
    console.log('🔄 Adding before/after fields to deposit_events table...\n');

    // Add the new columns
    await db.execute(sql`
      ALTER TABLE deposit_events
      ADD COLUMN IF NOT EXISTS balance_before NUMERIC(12, 2),
      ADD COLUMN IF NOT EXISTS frozen_before NUMERIC(12, 2),
      ADD COLUMN IF NOT EXISTS available_before NUMERIC(12, 2),
      ADD COLUMN IF NOT EXISTS available_after NUMERIC(12, 2);
    `);

    console.log('✅ Columns added successfully\n');

    // Verify the columns were added
    const columns = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'deposit_events'
      ORDER BY ordinal_position;
    `);

    console.log('📋 Updated schema:');
    console.log('='.repeat(80));
    
    if (Array.isArray(columns)) {
      for (const col of columns) {
        console.log(`  ${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
      }
    }

    console.log('\n✅ Migration complete\n');

  } catch (error) {
    console.error('\n❌ Migration error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
  } finally {
    process.exit(0);
  }
}

addDepositEventsBeforeFields();
