import { db } from '@/lib/db/drizzle';
import { auctionWinners, auctions, vendors } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function checkFrozenDeposits() {
  console.log('Checking all frozen deposits...\n');
  
  const vendor = await db.query.vendors.findFirst({
    where: eq(vendors.businessName, 'Master')
  });
  
  if (!vendor) {
    console.error('Vendor not found');
    return;
  }
  
  const winners = await db.query.auctionWinners.findMany({
    where: eq(auctionWinners.vendorId, vendor.id),
    with: {
      auction: true
    }
  });
  
  console.log(`Found ${winners.length} winner records:\n`);
  
  let totalFrozen = 0;
  
  for (const winner of winners) {
    const deposit = parseFloat(winner.depositAmount);
    totalFrozen += deposit;
    
    console.log(`Auction: ${winner.auction.title}`);
    console.log(`  ID: ${winner.auctionId}`);
    console.log(`  Status: ${winner.status}`);
    console.log(`  Bid: ₦${parseFloat(winner.bidAmount).toLocaleString()}`);
    console.log(`  Deposit: ₦${deposit.toLocaleString()}`);
    console.log(`  Auction Status: ${winner.auction.status}`);
    console.log('');
  }
  
  console.log(`Total deposits: ₦${totalFrozen.toLocaleString()}`);
}

checkFrozenDeposits()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
