/**
 * Diagnose Case Processing Status Issues
 * 
 * Checks actual case and auction statuses in the database
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases, auctions } from '@/lib/db/schema';
import { eq, sql, not, like } from 'drizzle-orm';

async function diagnoseCaseProcessingStatus() {
  console.log('=== Case Processing Status Diagnosis ===\n');

  // Get all non-TEST cases with their auction status
  const cases = await db
    .select({
      caseId: salvageCases.id,
      claimReference: salvageCases.claimReference,
      caseStatus: salvageCases.status,
      assetType: salvageCases.assetType,
      marketValue: salvageCases.marketValue,
      createdAt: salvageCases.createdAt,
      auctionId: auctions.id,
      auctionStatus: auctions.status,
      auctionEndTime: auctions.endTime,
    })
    .from(salvageCases)
    .leftJoin(auctions, eq(salvageCases.id, auctions.caseId))
    .where(not(like(salvageCases.claimReference, 'TEST%')))
    .orderBy(sql`${salvageCases.createdAt} DESC`);

  console.log(`Found ${cases.length} non-TEST cases\n`);

  // Group by status
  const statusGroups: Record<string, typeof cases> = {};
  
  for (const c of cases) {
    // Determine display status based on case and auction status
    let displayStatus = c.caseStatus;
    
    if (c.auctionStatus) {
      // If there's an auction, use auction status
      if (c.auctionStatus === 'active') {
        displayStatus = 'active_auction';
      } else if (c.auctionStatus === 'closed' && c.caseStatus === 'approved') {
        displayStatus = 'sold';
      } else if (c.auctionStatus === 'scheduled') {
        displayStatus = 'scheduled';
      }
    }
    
    if (!statusGroups[displayStatus]) {
      statusGroups[displayStatus] = [];
    }
    statusGroups[displayStatus].push(c);
  }

  // Print summary by status
  console.log('=== Status Summary ===');
  for (const [status, items] of Object.entries(statusGroups)) {
    console.log(`${status}: ${items.length} cases`);
  }
  console.log('');

  // Show active auctions in detail
  console.log('=== Active Auctions ===');
  const activeAuctions = cases.filter(c => c.auctionStatus === 'active');
  console.log(`Found ${activeAuctions.length} active auctions:`);
  for (const c of activeAuctions) {
    console.log(`  - ${c.claimReference} (Case: ${c.caseStatus}, Auction: ${c.auctionStatus}, End: ${c.auctionEndTime})`);
  }
  console.log('');

  // Show cases marked as "approved" but should be "sold"
  console.log('=== Cases with Closed Auctions (Should be "sold") ===');
  const closedAuctions = cases.filter(c => c.auctionStatus === 'closed' && c.caseStatus === 'approved');
  console.log(`Found ${closedAuctions.length} cases:`);
  for (const c of closedAuctions) {
    console.log(`  - ${c.claimReference} (Case: ${c.caseStatus}, Auction: ${c.auctionStatus})`);
  }
  console.log('');

  // Show scheduled auctions
  console.log('=== Scheduled Auctions ===');
  const scheduledAuctions = cases.filter(c => c.auctionStatus === 'scheduled');
  console.log(`Found ${scheduledAuctions.length} scheduled auctions:`);
  for (const c of scheduledAuctions) {
    console.log(`  - ${c.claimReference} (Case: ${c.caseStatus}, Auction: ${c.auctionStatus})`);
  }
  console.log('');

  // Show all cases sorted by date (latest first)
  console.log('=== All Cases (Latest First) ===');
  console.log('Claim Ref | Case Status | Auction Status | Created');
  console.log('-'.repeat(70));
  for (const c of cases.slice(0, 25)) {
    const displayStatus = c.auctionStatus === 'active' ? 'active_auction' :
                         c.auctionStatus === 'closed' && c.caseStatus === 'approved' ? 'sold' :
                         c.auctionStatus === 'scheduled' ? 'scheduled' :
                         c.caseStatus;
    console.log(`${c.claimReference.padEnd(15)} | ${c.caseStatus.padEnd(12)} | ${(c.auctionStatus || 'none').padEnd(14)} | ${c.createdAt.toISOString().split('T')[0]}`);
  }
}

diagnoseCaseProcessingStatus()
  .then(() => {
    console.log('\n✅ Diagnosis complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
