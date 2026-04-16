/**
 * Diagnose Documents Page Issue
 * 
 * Checks why recent documents aren't showing up on the documents page
 */

import { db } from '../src/lib/db/drizzle';
import { auctions } from '../src/lib/db/schema/auctions';
import { documents } from '../src/lib/db/schema/documents';
import { salvageCases } from '../src/lib/db/schema/cases';
import { eq, and, desc, or, inArray } from 'drizzle-orm';

async function diagnose() {
  console.log('🔍 Diagnosing Documents Page Issue\n');

  try {
    // Get all auctions with a winner (currentBidder is not null)
    const allWonAuctions = await db
      .select({
        id: auctions.id,
        status: auctions.status,
        currentBidder: auctions.currentBidder,
        endTime: auctions.endTime,
        assetType: salvageCases.assetType,
        assetDetails: salvageCases.assetDetails,
      })
      .from(auctions)
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .where(eq(auctions.currentBidder, auctions.currentBidder)) // Has a winner
      .orderBy(desc(auctions.endTime))
      .limit(20);

    console.log(`📊 Found ${allWonAuctions.length} auctions with winners\n`);

    // Group by status
    const byStatus: Record<string, number> = {};
    allWonAuctions.forEach(a => {
      byStatus[a.status] = (byStatus[a.status] || 0) + 1;
    });

    console.log('Status breakdown:');
    Object.entries(byStatus).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    console.log('');

    // Check documents for each auction
    console.log('📄 Checking documents for recent auctions:\n');
    
    for (const auction of allWonAuctions.slice(0, 10)) {
      const auctionDocs = await db
        .select()
        .from(documents)
        .where(eq(documents.auctionId, auction.id));

      const details = auction.assetDetails as Record<string, unknown>;
      const assetName = `${details.make || ''} ${details.model || ''}`.trim() || auction.assetType;

      console.log(`Auction ${auction.id} (${assetName})`);
      console.log(`  Status: ${auction.status}`);
      console.log(`  End Time: ${new Date(auction.endTime).toLocaleString('en-NG')}`);
      console.log(`  Documents: ${auctionDocs.length}`);
      
      if (auctionDocs.length > 0) {
        auctionDocs.forEach(doc => {
          console.log(`    - ${doc.documentType}: ${doc.status}`);
        });
      } else {
        console.log(`    ⚠️  No documents found!`);
      }
      console.log('');
    }

    // Check what the current API query returns
    console.log('🔍 Checking what current API query returns (status = "closed" only):\n');
    
    const closedOnly = await db
      .select({
        id: auctions.id,
        status: auctions.status,
        endTime: auctions.endTime,
      })
      .from(auctions)
      .where(eq(auctions.status, 'closed'))
      .orderBy(desc(auctions.endTime))
      .limit(10);

    console.log(`Found ${closedOnly.length} closed auctions`);
    closedOnly.forEach(a => {
      console.log(`  ${a.id}: ${new Date(a.endTime).toLocaleString('en-NG')}`);
    });
    console.log('');

    // Check what would be returned if we include awaiting_payment
    console.log('🔍 Checking what would be returned if we include "awaiting_payment":\n');
    
    const closedOrAwaiting = await db
      .select({
        id: auctions.id,
        status: auctions.status,
        endTime: auctions.endTime,
      })
      .from(auctions)
      .where(
        or(
          eq(auctions.status, 'closed'),
          eq(auctions.status, 'awaiting_payment')
        )
      )
      .orderBy(desc(auctions.endTime))
      .limit(10);

    console.log(`Found ${closedOrAwaiting.length} closed or awaiting_payment auctions`);
    closedOrAwaiting.forEach(a => {
      console.log(`  ${a.id}: ${a.status} - ${new Date(a.endTime).toLocaleString('en-NG')}`);
    });
    console.log('');

    console.log('✅ Diagnosis complete!');
    console.log('\n📋 Summary:');
    console.log('  - The API only fetches auctions with status = "closed"');
    console.log('  - Recent auctions might be in "awaiting_payment" status');
    console.log('  - Solution: Include "awaiting_payment" status in the query');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  process.exit(0);
}

diagnose();
