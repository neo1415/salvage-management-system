import { db } from '../src/lib/db/drizzle';
import { auctions, auctionWinners, depositEvents } from '../src/lib/db/schema';
import { eq, and } from 'drizzle-orm';

const auctionId = '94dc28fd-8a53-4fda-aebe-d2ba192efc42';
const vendorId = '5e4eaa5f-7438-4c4f-bc8a-59db91d4a8c3';
const bidAmount = '400000.00';

async function fixAuctionClosure() {
  console.log('🔧 Fixing auction closure data integrity issue...\n');

  // Step 1: Update auction with current bidder
  console.log('Step 1: Updating auction.currentBidderId...');
  await db.update(auctions)
    .set({
      currentBidderId: vendorId,
      updatedAt: new Date(),
    })
    .where(eq(auctions.id, auctionId));
  console.log('✅ Auction updated\n');

  // Step 2: Check for deposit event
  console.log('Step 2: Checking for deposit event...');
  const depositEvent = await db.query.depositEvents.findFirst({
    where: and(
      eq(depositEvents.auctionId, auctionId),
      eq(depositEvents.vendorId, vendorId),
      eq(depositEvents.eventType, 'freeze')
    ),
  });

  const depositAmount = depositEvent ? depositEvent.amount : '0.00';
  console.log(`- Deposit Amount: ₦${depositAmount}\n`);

  // Step 3: Create winner record
  console.log('Step 3: Creating winner record...');
  const [winnerRecord] = await db.insert(auctionWinners).values({
    auctionId: auctionId,
    vendorId: vendorId,
    bidAmount: bidAmount,
    depositAmount: depositAmount,
    rank: 1, // Primary winner
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();

  console.log('✅ Winner record created!');
  console.log(`- Winner ID: ${winnerRecord.id}`);
  console.log(`- Vendor ID: ${winnerRecord.vendorId}`);
  console.log(`- Bid Amount: ₦${winnerRecord.bidAmount}`);
  console.log(`- Deposit Amount: ₦${winnerRecord.depositAmount}\n`);

  console.log('🎉 Fix complete!');
  console.log('The payment modal should now work correctly.');
  console.log('Please refresh the page and try clicking "Pay Now" again.');

  process.exit(0);
}

fixAuctionClosure().catch(console.error);
