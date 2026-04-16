import 'dotenv/config';
import { db } from '../src/lib/db/drizzle';
import { sql } from 'drizzle-orm';

/**
 * Add 'awaiting_payment' status to auction_status enum
 * This status is used when all documents are signed and vendor must choose payment method
 */
async function addAwaitingPaymentStatus() {
  try {
    console.log('🔄 Adding awaiting_payment status to auction_status enum...');
    
    // Add the new enum value
    await db.execute(sql`
      ALTER TYPE auction_status ADD VALUE IF NOT EXISTS 'awaiting_payment'
    `);
    
    console.log('✅ Successfully added awaiting_payment status to auction_status enum');
    console.log('');
    console.log('Valid auction statuses now:');
    console.log('  - scheduled');
    console.log('  - active');
    console.log('  - extended');
    console.log('  - closed');
    console.log('  - awaiting_payment (NEW)');
    console.log('  - cancelled');
    console.log('  - forfeited');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding awaiting_payment status:', error);
    process.exit(1);
  }
}

addAwaitingPaymentStatus();
