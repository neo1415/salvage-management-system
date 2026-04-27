import { db } from '@/lib/db';
import { payments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function verifyFix() {
  const auctionId = '552d0821-238a-4d26-bc8f-0853f8b5c4d9';
  
  console.log(`🔍 Checking payments for auction: ${auctionId}\n`);
  
  const allPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.auctionId, auctionId));
  
  console.log(`Found ${allPayments.length} payment(s):\n`);
  
  allPayments.forEach((payment, index) => {
    console.log(`Payment ${index + 1}:`);
    console.log(`  ID: ${payment.id}`);
    console.log(`  Status: ${payment.status}`);
    console.log(`  Amount: ₦${payment.amount}`);
    console.log(`  Created: ${payment.createdAt}`);
    console.log(`  Updated: ${payment.updatedAt}`);
    console.log('');
  });
  
  const pendingPayments = allPayments.filter(p => p.status === 'pending');
  const verifiedPayments = allPayments.filter(p => p.status === 'verified');
  const rejectedPayments = allPayments.filter(p => p.status === 'rejected');
  
  console.log('Summary:');
  console.log(`  ✅ Verified: ${verifiedPayments.length}`);
  console.log(`  ⏳ Pending: ${pendingPayments.length}`);
  console.log(`  ❌ Rejected: ${rejectedPayments.length}`);
  console.log('');
  
  if (pendingPayments.length === 0 && verifiedPayments.length === 1) {
    console.log('✅ SUCCESS: Only one verified payment exists, no pending duplicates!');
  } else {
    console.log('⚠️  WARNING: Unexpected payment state');
  }
}

verifyFix()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
