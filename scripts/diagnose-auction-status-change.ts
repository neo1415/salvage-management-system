/**
 * Diagnose Auction Status Change Issue
 * 
 * Investigates why auction status changes from 'closed' to 'active' after document signing
 */

import { config } from 'dotenv';
config();

import { db } from '@/lib/db/drizzle';
import { auctions, releaseForms } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

const AUCTION_ID = '17b57f99-f7a8-4642-9d3b-5b7cb66f2407';

async function diagnose() {
  console.log('🔍 Diagnosing Auction Status Change Issue\n');
  console.log(`Auction ID: ${AUCTION_ID}\n`);

  // 1. Check current auction status
  console.log('1️⃣ Current Auction Status:');
  const [auction] = await db
    .select()
    .from(auctions)
    .where(eq(auctions.id, AUCTION_ID))
    .limit(1);

  if (!auction) {
    console.log('❌ Auction not found');
    process.exit(1);
  }

  console.log(`   Status: ${auction.status}`);
  console.log(`   Current Bid: ${auction.currentBid}`);
  console.log(`   Current Bidder: ${auction.currentBidder}`);
  console.log(`   End Time: ${auction.endTime}`);
  console.log(`   Updated At: ${auction.updatedAt}\n`);

  // 2. Check documents
  console.log('2️⃣ Document Signing Status:');
  const documents = await db
    .select()
    .from(releaseForms)
    .where(eq(releaseForms.auctionId, AUCTION_ID))
    .orderBy(desc(releaseForms.createdAt));

  console.log(`   Total Documents: ${documents.length}`);
  for (const doc of documents) {
    console.log(`   - ${doc.documentType}: ${doc.status} (signed at: ${doc.signedAt || 'not signed'})`);
  }

  const signedDocs = documents.filter(d => d.status === 'signed');
  const allSigned = documents.length > 0 && signedDocs.length === documents.length;
  console.log(`   All Signed: ${allSigned}\n`);

  // 3. Check Redis cache
  console.log('3️⃣ Checking Redis Cache:');
  try {
    const { redis } = await import('@/lib/redis/client');
    const cacheKey = `auction:details:${AUCTION_ID}`;
    const cachedData = await redis.get(cacheKey);
    
    if (cachedData) {
      console.log(`   ✅ Cache exists for key: ${cacheKey}`);
      if (typeof cachedData === 'string') {
        const parsed = JSON.parse(cachedData);
        console.log(`   Cached Status: ${parsed.status || 'unknown'}`);
        console.log(`   Cached Data:`, JSON.stringify(parsed, null, 2));
      } else {
        console.log(`   Cached Status: ${cachedData.status || 'unknown'}`);
      }
    } else {
      console.log(`   ℹ️  No cache found for key: ${cacheKey}`);
    }
  } catch (error) {
    console.log(`   ⚠️  Could not check Redis cache:`, error);
  }

  console.log('\n4️⃣ Analysis:');
  if (auction.status === 'closed' && !allSigned) {
    console.log('   ✅ Status is correct: closed (documents not all signed yet)');
  } else if (auction.status === 'awaiting_payment' && allSigned) {
    console.log('   ✅ Status is correct: awaiting_payment (all documents signed)');
  } else if (auction.status === 'active') {
    console.log('   ❌ BUG DETECTED: Status should NOT be "active"');
    console.log('      Expected: "closed" or "awaiting_payment"');
    console.log('      Actual: "active"');
    console.log('\n   Possible causes:');
    console.log('   1. Cache not invalidated after document signing');
    console.log('   2. Status update logic has a bug');
    console.log('   3. Race condition in status updates');
  } else {
    console.log(`   ⚠️  Unexpected status: ${auction.status}`);
  }

  process.exit(0);
}

diagnose().catch((error) => {
  console.error('❌ Diagnosis failed:', error);
  process.exit(1);
});
