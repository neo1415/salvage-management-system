import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { eq } from 'drizzle-orm';

const auctionId = '091f2626-5fbf-46ed-9641-a8d30fe0ffaa';
const vendorId = '049ac348-f4e2-42e0-99cf-b9f4f811560c';

async function fixPayment() {
  console.log(`\n🔧 Fixing payment for auction ${auctionId}...\n`);

  // Step 1: Delete the duplicate pending escrow_wallet payment
  const duplicatePaymentId = '8d055242-f55f-4256-a1c1-b8fc44c6bab7';
  
  console.log(`🗑️  Deleting duplicate pending escrow_wallet payment...`);
  await db
    .delete(payments)
    .where(eq(payments.id, duplicatePaymentId));
  
  console.log(`✅ Duplicate payment deleted\n`);

  // Step 2: Manually trigger fund release
  console.log(`💰 Triggering fund release for verified Paystack payment...`);
  
  const { triggerFundReleaseOnDocumentCompletion } = await import('@/features/documents/services/document.service');
  
  try {
    await triggerFundReleaseOnDocumentCompletion(
      auctionId,
      vendorId,
      'system' // userId for audit trail
    );
    
    console.log(`✅ Fund release completed successfully!\n`);
    console.log(`   This should have:`);
    console.log(`   - Created "debit" event in transaction history`);
    console.log(`   - Transferred money to finance dashboard`);
    console.log(`   - Sent pickup authorization (SMS, email, push, in-app)`);
    console.log(`   - Updated case status to "sold"`);
  } catch (error) {
    console.error(`❌ Fund release failed:`, error);
    if (error instanceof Error) {
      console.error(`   Error message: ${error.message}`);
    }
  }

  console.log(`\n✅ Fix completed\n`);
}

fixPayment().catch(console.error);
