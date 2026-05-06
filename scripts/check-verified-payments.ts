import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { eq, isNotNull } from 'drizzle-orm';

async function checkVerifiedPayments() {
  console.log('\n🔍 Checking verified payments...\n');

  const verifiedPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.status, 'verified'))
    .limit(10);

  console.log(`Found ${verifiedPayments.length} verified payments\n`);

  verifiedPayments.forEach((payment, index) => {
    console.log(`${index + 1}. Payment ID: ${payment.id}`);
    console.log(`   Auction ID: ${payment.auctionId || 'NULL'}`);
    console.log(`   Reference: ${payment.paymentReference}`);
    console.log(`   Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
    console.log(`   Method: ${payment.paymentMethod}`);
    console.log(`   Verified At: ${payment.verifiedAt?.toLocaleString()}\n`);
  });

  // Check for auction payments specifically
  const auctionPayments = await db
    .select()
    .from(payments)
    .where(isNotNull(payments.auctionId))
    .limit(10);

  console.log(`\nFound ${auctionPayments.length} auction payments (any status)\n`);

  auctionPayments.forEach((payment, index) => {
    console.log(`${index + 1}. Payment ID: ${payment.id}`);
    console.log(`   Auction ID: ${payment.auctionId}`);
    console.log(`   Status: ${payment.status}`);
    console.log(`   Reference: ${payment.paymentReference}`);
    console.log(`   Amount: ₦${parseFloat(payment.amount).toLocaleString()}\n`);
  });
}

checkVerifiedPayments()
  .then(() => {
    console.log('✅ Check complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
