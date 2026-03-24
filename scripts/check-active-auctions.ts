import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { auctions, salvageCases } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client);

async function checkActiveAuctions() {
  try {
    console.log('🔍 Checking for active auctions...\n');

    // Get all auctions with their status
    const allAuctions = await db
      .select({
        id: auctions.id,
        status: auctions.status,
        endTime: auctions.endTime,
        currentBid: auctions.currentBid,
        caseId: auctions.caseId,
      })
      .from(auctions)
      .orderBy(auctions.createdAt);

    console.log(`📊 Total auctions: ${allAuctions.length}\n`);

    // Group by status
    const statusCounts: Record<string, number> = {};
    allAuctions.forEach((auction) => {
      statusCounts[auction.status] = (statusCounts[auction.status] || 0) + 1;
    });

    console.log('📈 Auctions by status:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

    // Check for active auctions
    const activeAuctions = allAuctions.filter((a) => a.status === 'active');
    
    console.log(`\n✅ Active auctions: ${activeAuctions.length}`);

    if (activeAuctions.length > 0) {
      console.log('\n📋 Active auction details:');
      for (const auction of activeAuctions) {
        const now = new Date();
        const hasExpired = auction.endTime <= now;
        
        console.log(`\n  Auction ID: ${auction.id}`);
        console.log(`  Status: ${auction.status}`);
        console.log(`  End Time: ${auction.endTime}`);
        console.log(`  Has Expired: ${hasExpired ? '⚠️ YES' : '✅ NO'}`);
        console.log(`  Current Bid: ${auction.currentBid || 'No bids'}`);
        console.log(`  Case ID: ${auction.caseId}`);
      }
    }

    // Check for expired active auctions
    const now = new Date();
    const expiredActiveAuctions = activeAuctions.filter((a) => a.endTime <= now);
    
    if (expiredActiveAuctions.length > 0) {
      console.log(`\n⚠️ Found ${expiredActiveAuctions.length} expired active auctions that should be closed!`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkActiveAuctions();
