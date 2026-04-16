import { db } from '@/lib/db/drizzle';
import { depositEvents } from '@/lib/db/schema/auction-deposit';
import { eq, desc } from 'drizzle-orm';

const auctionId = '091f2626-5fbf-46ed-9641-a8d30fe0ffaa';

async function checkDepositEvents() {
  console.log(`\n🔍 Checking deposit events for auction ${auctionId}...\n`);

  const events = await db
    .select()
    .from(depositEvents)
    .where(eq(depositEvents.auctionId, auctionId))
    .orderBy(desc(depositEvents.createdAt));

  console.log(`📊 Deposit Events (${events.length}):\n`);

  for (const event of events) {
    console.log(`Event Type: ${event.eventType}`);
    console.log(`Amount: ₦${parseFloat(event.amount).toLocaleString()}`);
    console.log(`Balance Before: ${event.balanceBefore ? `₦${parseFloat(event.balanceBefore).toLocaleString()}` : 'NULL'}`);
    console.log(`Balance After: ₦${parseFloat(event.balanceAfter).toLocaleString()}`);
    console.log(`Frozen Before: ${event.frozenBefore ? `₦${parseFloat(event.frozenBefore).toLocaleString()}` : 'NULL'}`);
    console.log(`Frozen After: ₦${parseFloat(event.frozenAfter).toLocaleString()}`);
    console.log(`Available Before: ${event.availableBefore ? `₦${parseFloat(event.availableBefore).toLocaleString()}` : 'NULL'}`);
    console.log(`Available After: ${event.availableAfter ? `₦${parseFloat(event.availableAfter).toLocaleString()}` : 'NULL'}`);
    console.log(`Description: ${event.description}`);
    console.log(`Created: ${event.createdAt}`);
    console.log('');
  }

  console.log(`\n💡 Expected Events:`);
  console.log(`1. freeze - Deposit frozen when bid placed`);
  console.log(`2. unfreeze - Deposit unfrozen after payment verified`);
  console.log(`3. debit - Funds released to finance (from triggerFundReleaseOnDocumentCompletion)`);
  console.log(`\n✅ Check completed\n`);
}

checkDepositEvents().catch(console.error);
