/**
 * Fix Payment Record Script
 * 
 * This script fixes the payment record to correctly reflect that it's an escrow wallet payment
 */

import { db } from '../src/lib/db/drizzle';
import { payments } from '../src/lib/db/schema/payments';
import { eq } from 'drizzle-orm';

async function fixPaymentRecord() {
  try {
    console.log('🔧 Fixing Payment Record...\n');

    const paymentId = '1a2971ec-84e8-4a79-93ad-1ea2104629a7';

    // Get current payment
    const currentPayment = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    if (currentPayment.length === 0) {
      console.log('❌ Payment not found');
      return;
    }

    console.log('📊 BEFORE:');
    console.log(`  Payment Method: ${currentPayment[0].paymentMethod}`);
    console.log(`  Escrow Status: ${currentPayment[0].escrowStatus}`);
    console.log(`  Status: ${currentPayment[0].status}`);
    console.log('');

    // Update payment record
    await db
      .update(payments)
      .set({
        paymentMethod: 'escrow_wallet',
        escrowStatus: 'frozen',
        status: 'pending', // Reset to pending so Finance can verify and release
      })
      .where(eq(payments.id, paymentId));

    // Get updated payment
    const updatedPayment = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    console.log('✅ AFTER:');
    console.log(`  Payment Method: ${updatedPayment[0].paymentMethod}`);
    console.log(`  Escrow Status: ${updatedPayment[0].escrowStatus}`);
    console.log(`  Status: ${updatedPayment[0].status}`);
    console.log('');

    console.log('💡 NEXT STEPS:');
    console.log('  1. Finance Officer can now see this payment in the Finance Payments page');
    console.log('  2. When Finance Officer clicks "Approve", the money will be released from escrow');
    console.log('  3. Vendor does NOT need to pay again - money is already frozen in wallet');
    console.log('');

    console.log('✅ Payment record fixed!');
  } catch (error) {
    console.error('❌ Error fixing payment:', error);
    throw error;
  }
}

// Run the fix
fixPaymentRecord()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
