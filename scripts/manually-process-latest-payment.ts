import { paymentService } from '@/features/auction-deposit/services/payment.service';

async function processLatestPayment() {
  try {
    console.log('🔄 Manually processing latest payment...\n');

    const reference = 'PAY-af6e9385-e082-4670-a55d-b46608614da2-1776082361868';
    
    console.log(`Processing payment with reference: ${reference}`);
    
    await paymentService.handlePaystackWebhook(reference, true);
    
    console.log('\n✅ Payment processed successfully');
  } catch (error) {
    console.error('\n❌ Error processing payment:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  } finally {
    process.exit(0);
  }
}

processLatestPayment();
