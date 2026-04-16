/**
 * Add Unique Constraint to Payments Table
 * 
 * Prevents duplicate payment records for the same auction and vendor
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function addUniqueConstraint() {
  console.log('\n🔧 ADDING UNIQUE CONSTRAINT TO PAYMENTS TABLE');
  console.log('==============================================\n');

  try {
    // Check if constraint already exists
    const checkResult = await db.execute(sql`
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'unique_auction_vendor_payment'
    `);

    const rows = Array.isArray(checkResult) ? checkResult : checkResult.rows || [];
    
    if (rows.length > 0) {
      console.log('✅ Unique constraint already exists: unique_auction_vendor_payment');
      console.log('   No action needed\n');
      return;
    }

    console.log('📝 Adding unique constraint...');

    // Add unique constraint
    await db.execute(sql`
      ALTER TABLE payments 
      ADD CONSTRAINT unique_auction_vendor_payment 
      UNIQUE (auction_id, vendor_id)
    `);

    console.log('✅ Added unique constraint: unique_auction_vendor_payment\n');

    // Create index for faster lookups
    console.log('📝 Creating index for faster lookups...');
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_payments_auction_vendor 
      ON payments(auction_id, vendor_id)
    `);

    console.log('✅ Created index: idx_payments_auction_vendor\n');

    // Add comment
    await db.execute(sql`
      COMMENT ON CONSTRAINT unique_auction_vendor_payment ON payments IS 
      'Prevents duplicate payment records for the same auction and vendor. Added to fix concurrent auction closure issue.'
    `);

    console.log('✅ Migration complete!\n');
    console.log('📊 RESULT:');
    console.log('   - Unique constraint added to payments table');
    console.log('   - Index created for (auction_id, vendor_id)');
    console.log('   - Future duplicate payments will be prevented at database level\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
addUniqueConstraint()
  .then(() => {
    console.log('✅ Script complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script error:', error);
    process.exit(1);
  });
