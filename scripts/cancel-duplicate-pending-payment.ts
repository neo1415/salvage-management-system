import { db } from '@/lib/db';
import { payments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function cancelDuplicatePendingPayment() {
  const paymentId = 'b943339d-de9a-439f-aee3-0ce9c22a1d7f'; // The pending payment ID
  
  console.log(`🔍 Rejecting duplicate pending payment: ${paymentId}`);
  
  try {
    // Update the payment status to rejected (valid enum value)
    await db
      .update(payments)
      .set({
        status: 'rejected',
        updatedAt: new Date(),
      })
      .where(eq(payments.id, paymentId));
    
    console.log('✅ Payment rejected successfully');
    console.log('The finance dashboard should now only show the verified payment');
    
  } catch (error) {
    console.error('❌ Error rejecting payment:', error);
    throw error;
  }
}

cancelDuplicatePendingPayment()
  .then(() => {
    console.log('✅ Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
