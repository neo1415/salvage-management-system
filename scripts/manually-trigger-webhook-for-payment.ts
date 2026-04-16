import { paymentService } from '@/features/auction-deposit/services/payment.service';

/**
 * Manually trigger webhook processing for a specific payment
 * Use this when Paystack webhook didn't fire or failed
 */

async function manuallyTriggerWebhook() {
  console.log('🔧 Manually triggering webhook for payment\n');

  // The payment reference from your terminal log
  const paystackReference = 'PAY-afc83589-d6cb-4cff-b2c3-ef542a085e8a-1776160782358';

  console.log(`Processing payment: ${paystackReference}`);
  console.log('');

  try {
    await paymentService.handlePaystackWebhook(paystackReference, true);
    console.log('');
    console.log('✅ Webhook processed successfully!');
    console.log('');
    console.log('Check:');
    console.log('1. Deposit should be unfrozen');
    console.log('2. Debit transaction should appear in transaction history');
    console.log('3. Pickup authorization modal should show (if polling is working)');
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
  }
}

manuallyTriggerWebhook()
  .then(() => {
    console.log('\n✅ Script complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
