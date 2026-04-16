import { db } from '@/lib/db/drizzle';
import { depositEvents } from '@/lib/db/schema/auction-deposit';
import { eq } from 'drizzle-orm';

const auctionId = 'af6e9385-e082-4670-a55d-b46608614da2';

async function checkUnfreezeEvent() {
  const events = await db
    .select()
    .from(depositEvents)
    .where(eq(depositEvents.auctionId, auctionId));

  console.log(`Deposit Events for ${auctionId.substring(0, 8)}...\n`);
  
  events.forEach((e, i) => {
    console.log(`Event ${i + 1}:`);
    console.log(`  Type: ${e.eventType}`);
    console.log(`  Amount: ₦${parseFloat(e.amount).toLocaleString()}`);
    console.log(`  Balance Before: ${e.balanceBefore || 'NULL'}`);
    console.log(`  Balance After: ${e.balanceAfter}`);
    console.log(`  Frozen Before: ${e.frozenBefore || 'NULL'}`);
    console.log(`  Frozen After: ${e.frozenAfter}`);
    console.log(`  Available Before: ${e.availableBefore || 'NULL'}`);
    console.log(`  Available After: ${e.availableAfter || 'NULL'}`);
    console.log(`  Description: ${e.description}`);
    console.log(`  Created: ${e.createdAt.toLocaleString()}`);
    console.log('');
  });
}

checkUnfreezeEvent()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
