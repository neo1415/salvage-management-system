import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { auctions } from '@/lib/db/schema/auctions';
import { eq } from 'drizzle-orm';

async function comparePayments() {
  console.log('🔍 Comparing Payment Statuses\n');
  
  // Check the CORRECT payment (RGA-3700)
  const [correctPayment] = await db
    .select()
    .from(payments)
    .where(eq(payments.paymentReference, 'PAY-c1c20342-25ba-4d1a-9132-0d79ba0efd42-1777744981639'))
    .limit(1);
  
  if (correctPayment) {
    console.log('✅ CORRECT Payment (RGA-3700):');
    console.log('   Payment Status:', correctPayment.status);
    console.log('   Auction ID:', correctPayment.auctionId);
    
    if (correctPayment.auctionId) {
      const [correctAuction] = await db
        .select()
        .from(auctions)
        .where(eq(auctions.id, correctPayment.auctionId))
        .limit(1);
      
      if (correctAuction) {
        console.log('   Auction Status:', correctAuction.status);
        console.log('   Auction Winner ID:', correctAuction.winnerId);
      }
    }
  }
  
  console.log('');
  
  // Check the TEST payment (REF-5677)
  const [testPayment] = await db
    .select()
    .from(payments)
    .where(eq(payments.paymentReference, 'PAY-962dc370-973f-49b8-a533-8286b61c0271-1777989845198'))
    .limit(1);
  
  if (testPayment) {
    console.log('❌ TEST Payment (REF-5677):');
    console.log('   Payment Status:', testPayment.status);
    console.log('   Auction ID:', testPayment.auctionId);
    
    if (testPayment.auctionId) {
      const [testAuction] = await db
        .select()
        .from(auctions)
        .where(eq(auctions.id, testPayment.auctionId))
        .limit(1);
      
      if (testAuction) {
        console.log('   Auction Status:', testAuction.status);
        console.log('   Auction Winner ID:', testAuction.winnerId);
      }
    }
  }
  
  console.log('\n📋 EXPECTED BEHAVIOR:');
  console.log('   After payment webhook, auction status should be "sold" or "payment_verified"');
  console.log('   NOT "closed"');
}

comparePayments()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
