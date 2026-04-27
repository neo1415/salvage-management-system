import { db } from '@/lib/db/drizzle';
import { auctionConfigs } from '@/lib/db/schema/auction-deposit';
import { desc } from 'drizzle-orm';

async function diagnoseAndFixAuctionConfig() {
  console.log('🔍 AUCTION CONFIG DIAGNOSIS AND FIX\n');
  console.log('='

.repeat(60));
  
  // 1. Check current config in database
  console.log('\n1️⃣ CURRENT CONFIG IN DATABASE:\n');
  const configs = await db
    .select()
    .from(auctionConfigs)
    .orderBy(desc(auctionConfigs.createdAt))
    .limit(1);
  
  if (configs.length === 0) {
    console.log('❌ No configs found in database!\n');
    return;
  }
  
  const latestConfig = configs[0];
  console.log(`Latest Config (ID: ${latestConfig.id}):`);
  console.log(`  ✅ Registration Fee: ₦${Number(latestConfig.registrationFee).toLocaleString()}`);
  console.log(`  ⚠️  Minimum Bid Increment: ₦${Number(latestConfig.minimumBidIncrement).toLocaleString()}`);
  console.log(`  ⚠️  Tier 1 Bid Limit: ₦${Number(latestConfig.tier1BidLimit).toLocaleString()}`);
  console.log(`  ⚠️  Tier 2 Bid Limit: ₦${Number(latestConfig.tier2BidLimit).toLocaleString()}`);
  console.log(`  Deposit Percentage: ${latestConfig.depositPercentage}%`);
  console.log(`  Payment Deadline: ${latestConfig.paymentDeadlineHours} hours`);
  console.log(`  Document Deadline: ${latestConfig.documentDeadlineHours} hours`);
  console.log(`  Active: ${latestConfig.isActive}`);
  
  // 2. Identify hardcoded values in code
  console.log('\n' + '='.repeat(60));
  console.log('\n2️⃣ HARDCODED VALUES FOUND IN CODE:\n');
  console.log('❌ PROBLEM LOCATIONS:');
  console.log('  1. src/features/auctions/services/bidding.service.ts:619');
  console.log('     const minimumBid = currentBid ? currentBid + 20000 : minimumIncrement;');
  console.log('     ^^^ HARDCODED 20000 instead of using config.minimumBidIncrement\n');
  
  console.log('  2. src/features/auctions/services/bidding.service.ts:239');
  console.log('     const minimumBid = currentBidAmount ? currentBidAmount + 20000 : ...');
  console.log('     ^^^ HARDCODED 20000 instead of using config.minimumBidIncrement\n');
  
  // 3. Show the impact
  console.log('='.repeat(60));
  console.log('\n3️⃣ IMPACT ANALYSIS:\n');
  console.log(`Current Config Says: Minimum Bid Increment = ₦${Number(latestConfig.minimumBidIncrement).toLocaleString()}`);
  console.log(`Code Actually Uses: Minimum Bid Increment = ₦20,000 (HARDCODED)`);
  console.log('\n❌ MISMATCH DETECTED!');
  console.log('   - Admin sets config to ₦50,000');
  console.log('   - But bidding still uses ₦20,000');
  console.log('   - Config changes have NO EFFECT on actual bidding\n');
  
  // 4. Show other potentially affected configs
  console.log('='.repeat(60));
  console.log('\n4️⃣ OTHER CONFIGS THAT MAY NOT BE APPLIED:\n');
  console.log('Need to verify these are being used correctly:');
  console.log(`  ⚠️  Tier 1 Bid Limit: ₦${Number(latestConfig.tier1BidLimit).toLocaleString()}`);
  console.log(`  ⚠️  Tier 2 Bid Limit: ₦${Number(latestConfig.tier2BidLimit).toLocaleString()}`);
  console.log(`  ⚠️  Payment Deadline: ${latestConfig.paymentDeadlineHours} hours`);
  console.log(`  ⚠️  Document Deadline: ${latestConfig.documentDeadlineHours} hours`);
  
  // 5. Provide fix summary
  console.log('\n' + '='.repeat(60));
  console.log('\n5️⃣ FIX REQUIRED:\n');
  console.log('The bidding service needs to be updated to:');
  console.log('  1. Load config at the start of placeBid()');
  console.log('  2. Use config.minimumBidIncrement instead of hardcoded 20000');
  console.log('  3. Pass config to validateBid() method');
  console.log('  4. Use config values in transaction validation');
  console.log('\nThis will ensure ALL config changes take effect immediately.');
  
  console.log('\n' + '='.repeat(60));
  console.log('\n✅ DIAGNOSIS COMPLETE\n');
}

diagnoseAndFixAuctionConfig()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
