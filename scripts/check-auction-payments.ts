import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { eq } from 'drizzle-orm';

const auctionId = '7340f16e-4689-4795-98f4-be9a7731efe4';

async function checkPayments() {
  console.log(`Checking payments for auction: ${auctionId}\n`);
  
  const result = await db
    .select()
    .from(payments)
    .where(eq(payments.auctionId, auctionId));
  
  console.log(`Found ${result.length} payment records:\n`);
  
  result.forEach((payment, index) => {
    console.log(`Payment ${index + 1}:`);
    console.log(`  ID: ${payment.id}`);
    console.log(`  Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
    console.log(`  Method: ${payment.paymentMethod}`);
    console.log(`  Status: ${payment.status}`);
    console.log(`  Reference: ${payment.paymentReference}`);
    console.log(`  Created: ${payment.createdAt}`);
    console.log('');
  });
}

checkPayments()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
