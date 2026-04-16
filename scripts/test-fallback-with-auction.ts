/**
 * Test Fallback Chain with Specific Auction
 * 
 * This script helps you test the fallback chain with your newly closed auction.
 * 
 * Usage:
 * npx tsx scripts/test-fallback-with-auction.ts <auction-id>
 */

import { db } from '@/lib/db/drizzle';
import { 
  auctions, 
  auctionWinners, 
  auctionDocuments,
  escrowWallets
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

async function main() {
  const auctionId = process.argv[2];

  if (!auctionId) {
    console.error('❌ Please provide auction ID');
    console.log('Usage: npx tsx scripts/test-fallback-with-auction.ts <auction-id>');
    process.exit(1);
  }

  console.log('🔍 Testing Fallback Chain Setup');
  console.log('='.repeat(80));
  console.log(`Auction ID: ${auctionId}`);
  console.log('');

  // 1. Check auction exists and status
  console.log('📋 Step 1: Checking auction...');
  const [auction] = await db
    .select()
    .from(auctions)
    .where(eq(auctions.id, auctionId))
    .limit(1);

  if (!auction) {
    console.error('❌ Auction not found');
    process.exit(1);
  }

  console.log(`✅ Auction found: ${auction.status}`);
  console.log('');

  // 2. Check top bidders
  console.log('📋 Step 2: Checking top bidders...');
  const topBidders = await db
    .select()
    .from(auctionWinners)
    .where(eq(auctionWinners.auctionId, auctionId))
    .orderBy(auctionWinners.rank);

  if (topBidders.length === 0) {
    console.error('❌ No bidders found');
    process.exit(1);
  }

  console.log(`✅ Found ${topBidders.length} bidders:`);
  for (const bidder of topBidders) {
    console.log(`   Rank ${bidder.rank}: ${bidder.vendorId} - ₦${parseFloat(bidder.bidAmount).toLocaleString()} (deposit: ₦${parseFloat(bidder.depositAmount).toLocaleString()})`);
  }
  console.log('');

  // 3. Check winner's documents
  console.log('📋 Step 3: Checking winner documents...');
  const winner = topBidders.find(b => b.rank === 1);
  
  if (!winner) {
    console.error('❌ No winner found');
    process.exit(1);
  }

  const documents = await db
    .select()
    .from(auctionDocuments)
    .where(
      and(
        eq(auctionDocuments.auctionId, auctionId),
        eq(auctionDocuments.vendorId, winner.vendorId)
      )
    );

  if (documents.length === 0) {
    console.log('⚠️  No documents found - they should be generated when auction closes');
  } else {
    console.log(`✅ Found ${documents.length} documents:`);
    for (const doc of documents) {
      const signed = doc.signedAt ? '✅ Signed' : '❌ Not signed';
      console.log(`   ${doc.type}: ${signed}`);
      console.log(`   Validity deadline: ${doc.validityDeadline?.toISOString()}`);
      if (doc.paymentDeadline) {
        console.log(`   Payment deadline: ${doc.paymentDeadline.toISOString()}`);
      }
    }
  }
  console.log('');

  // 4. Check wallet states
  console.log('📋 Step 4: Checking wallet states...');
  for (const bidder of topBidders.slice(0, 3)) {
    const [wallet] = await db
      .select()
      .from(escrowWallets)
      .where(eq(escrowWallets.vendorId, bidder.vendorId))
      .limit(1);

    if (wallet) {
      const frozen = parseFloat(wallet.frozenAmount);
      const available = parseFloat(wallet.availableBalance);
      console.log(`   Rank ${bidder.rank} (${bidder.vendorId}):`);
      console.log(`      Frozen: ₦${frozen.toLocaleString()}`);
      console.log(`      Available: ₦${available.toLocaleString()}`);
    }
  }
  console.log('');

  // 5. Show testing timeline
  console.log('📅 Testing Timeline (with TESTING_MODE=true):');
  console.log('='.repeat(80));
  console.log('');
  console.log('NOW: Auction closed, documents generated');
  console.log('');
  console.log('⏰ In 5 minutes: Document validity expires');
  console.log('   - Winner has 5 minutes to sign documents');
  console.log('');
  console.log('⏰ In 6 minutes: Buffer period expires (1 minute buffer)');
  console.log('   - Run: curl -X GET http://localhost:3000/api/cron/check-document-deadlines \\');
  console.log('           -H "Authorization: Bearer $CRON_SECRET"');
  console.log('   - System will:');
  console.log('     1. Unfreeze winner\'s deposit');
  console.log('     2. Promote next eligible bidder');
  console.log('     3. Generate new documents (5 min validity)');
  console.log('');
  console.log('IF winner signs documents:');
  console.log('⏰ In 10 minutes: Payment deadline expires');
  console.log('   - Winner has 10 minutes to pay after signing');
  console.log('');
  console.log('⏰ In 11 minutes: Buffer period expires (1 minute buffer)');
  console.log('   - Run: curl -X GET http://localhost:3000/api/cron/check-payment-deadlines \\');
  console.log('           -H "Authorization: Bearer $CRON_SECRET"');
  console.log('   - System will:');
  console.log('     1. Forfeit deposit (100%)');
  console.log('     2. Unfreeze winner\'s deposit');
  console.log('     3. Promote next eligible bidder');
  console.log('     4. Generate new documents (5 min validity)');
  console.log('');
  console.log('='.repeat(80));
  console.log('');
  console.log('🎯 Quick Test Commands:');
  console.log('');
  console.log('# Check document deadline (run after 6 minutes)');
  console.log(`curl -X GET http://localhost:3000/api/cron/check-document-deadlines -H "Authorization: Bearer ${process.env.CRON_SECRET}"`);
  console.log('');
  console.log('# Check payment deadline (run after 11 minutes if winner signed)');
  console.log(`curl -X GET http://localhost:3000/api/cron/check-payment-deadlines -H "Authorization: Bearer ${process.env.CRON_SECRET}"`);
  console.log('');
  console.log('# Check auction state');
  console.log(`npx tsx scripts/check-auction-payment-state.ts ${auctionId}`);
  console.log('');
  console.log('='.repeat(80));
  console.log('');
  console.log('✅ Setup complete! Wait 6 minutes then run the document deadline check.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
