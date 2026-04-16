import { db } from '@/lib/db/drizzle';
import { salvageCases, auctions, payments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function check() {
  // Get one sold case without payment
  const caseId = '11c5c2e9-7391-47f6-a56f-8d48830012cd';
  
  const caseData = await db.select().from(salvageCases).where(eq(salvageCases.id, caseId));
  console.log(`Case: ${caseData[0].claimReference} - Status: ${caseData[0].status}`);
  
  const auctionData = await db.select().from(auctions).where(eq(auctions.caseId, caseId));
  console.log(`Auctions: ${auctionData.length}`);
  
  if (auctionData.length > 0) {
    const paymentData = await db.select().from(payments).where(eq(payments.auctionId, auctionData[0].id));
    console.log(`Payments: ${paymentData.length}`);
    if (paymentData.length > 0) {
      console.log(`Status: ${paymentData.map(p => p.status).join(', ')}`);
    }
  }
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
