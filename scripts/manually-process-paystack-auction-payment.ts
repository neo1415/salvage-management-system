import { paymentService } from '@/features/auction-deposit/services/payment.service';
import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { eq } from 'drizzle-orm';

/**
 * Manually process a Paystack auction payment
 * Use this when the webhook didn't fire or failed
 */

async function manuallyProcessPaystackPayment() {
  console.log('🔧 Manually Processing Paystack Auction Payment...\n');

  try {
    const paymentReference = 'PAY-ea06c5e4-6b98-46b7-a10b-c3a6b876fdd5-1776077176140';
    
    console.log(`Processing payment: ${paymentReference}\n`);

    // Check current payment state
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.paymentReference, paymentReference))
      .limit(1);

    if (!payment) {
      console.log('❌ Payment not found!');
      return;
    }

    console.log('📊 Current Payment State:');
    console.log(`   - Status: ${payment.status}`);
    console.log(`   - Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
    console.log(`   - Payment Method: ${payment.paymentMethod}`);
    console.log('');

    if (payment.status === 'verified') {
      console.log('✅ Payment already verified!');
      return;
    }

    console.log('🔄 Processing payment through webhook handler...\n');

    // Call the webhook handler directly
    // This will:
    // 1. Verify payment with Paystack API
    // 2. Update payment status to "verified"
    // 3. Release frozen deposit from wallet
    // 4. Transfer total amount to NEM Insurance
    // 5. Update auction status to "payment_verified"
    await paymentService.handlePaystackWebhook(paymentReference, true);

    console.log('\n✅ Payment processed successfully!');
    console.log('');
    console.log('📋 What happened:');
    console.log('   1. ✅ Verified payment with Paystack API');
    console.log('   2. ✅ Updated payment status to "verified"');
    console.log('   3. ✅ Released frozen deposit from wallet');
    console.log('   4. ✅ Transferred total amount to NEM Insurance');
    console.log('   5. ✅ Updated auction status to "payment_verified"');
    console.log('');
    console.log('💰 Wallet State:');
    console.log('   - Frozen deposit has been released');
    console.log('   - Total amount transferred to NEM Insurance');
    console.log('');
    console.log('🎯 Next Steps:');
    console.log('   1. Refresh the vendor auction page');
    console.log('   2. Check Finance Officer payments page');
    console.log('   3. Verify wallet balance is correct');

  } catch (error) {
    console.error('\n❌ Error processing payment:', error);
    
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    throw error;
  }
}

// Run the script
manuallyProcessPaystackPayment()
  .then(() => {
    console.log('\n✅ Script complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
