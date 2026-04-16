/**
 * Manually Verify Payment
 * Manually trigger what the webhook should have done
 */

import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { eq } from 'drizzle-orm';
import { paymentService } from '@/features/auction-deposit/services/payment.service';

const AUCTION_ID = '260582d5-5c55-4ca5-8e22-609fef09b7f3';

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Manually Verify Payment');
  console.log('═══════════════════════════════════════════════════════\n');

  // Get the pending payment
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.auctionId, AUCTION_ID))
    .limit(1);

  if (!payment) {
    console.log('❌ No payment found\n');
    return;
  }

  console.log('Found payment:');
  console.log(`  ID: ${payment.id}`);
  console.log(`  Status: ${payment.status}`);
  console.log(`  Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
  console.log(`  Method: ${payment.paymentMethod}`);
  console.log(`  Reference: ${payment.paymentReference}\n`);

  if (payment.status === 'verified') {
    console.log('✅ Payment already verified\n');
    return;
  }

  console.log('Manually verifying payment (simulating webhook)...\n');

  try {
    // Call the webhook handler with the payment reference
    await paymentService.handlePaystackWebhook(payment.paymentReference!, true);

    console.log('✅ Payment verified successfully!\n');
    console.log('This should have:');
    console.log('  1. Marked payment as verified');
    console.log('  2. Unfrozen ₦100k deposit from wallet');
    console.log('  3. Deducted total ₦130k from wallet');
    console.log('  4. Generated documents (if applicable)');
    console.log('  5. Enabled pickup authorization\n');

    console.log('Please refresh your page to see the changes.\n');
  } catch (error) {
    console.error('❌ Error verifying payment:', error);
    console.error('\nError details:', error instanceof Error ? error.message : 'Unknown error');
  }
}

main().catch(console.error);
