import { db } from '../src/lib/db/drizzle';
import { auctionWinners } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

const auctionId = '94dc28fd-8a53-4fda-aebe-d2ba192efc42';

async function checkWinners() {
  console.log('🔍 Checking ALL winner records for auction...\n');

  const allWinners = await db.query.auctionWinners.findMany({
    where: eq(auctionWinners.auctionId, auctionId),
  });

  console.log(`Found ${allWinners.length} winner record(s):\n`);

  allWinners.forEach((winner, index) => {
    console.log(`Winner ${index + 1}:`);
    console.log(`- Vendor ID: ${winner.vendorId}`);
    console.log(`- Bid Amount: ₦${winner.bidAmount}`);
    console.log(`- Deposit Amount: ₦${winner.depositAmount}`);
    console.log(`- Status: ${winner.status}`);
    console.log(`- Created At: ${winner.createdAt}`);
    console.log(`- Updated At: ${winner.updatedAt}\n`);
  });

  if (allWinners.length === 0) {
    console.log('❌ No winner records found at all - this is a data integrity issue');
    console.log('The auction closed but no winner record was created');
  }

  process.exit(0);
}

checkWinners().catch(console.error);
