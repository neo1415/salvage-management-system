/**
 * Diagnose Prediction Data Issues
 * 
 * This script checks what data is actually available for predictions
 */

import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { bids } from '@/lib/db/schema/bids';
import { salvageCases } from '@/lib/db/schema/cases';
import { eq, sql, desc, and, isNotNull } from 'drizzle-orm';

async function diagnosePredictionData() {
  console.log('🔍 Diagnosing Prediction Data...\n');

  try {
    // Check total auctions
    console.log('📊 Step 1: Checking auctions table...');
    const totalAuctions = await db
      .select({ count: sql<number>`count(*)` })
      .from(auctions);
    console.log(`   Total auctions: ${totalAuctions[0].count}`);

    // Check closed auctions
    const closedAuctions = await db
      .select({ count: sql<number>`count(*)` })
      .from(auctions)
      .where(eq(auctions.status, 'closed'));
    console.log(`   Closed auctions: ${closedAuctions[0].count}`);

    // Check closed auctions with bids
    const closedWithBids = await db
      .select({ count: sql<number>`count(*)` })
      .from(auctions)
      .where(
        and(
          eq(auctions.status, 'closed'),
          isNotNull(auctions.currentBid)
        )
      );
    console.log(`   Closed auctions with bids: ${closedWithBids[0].count}\n`);

    // Check sample closed auctions
    console.log('📋 Step 2: Sample closed auctions...');
    const sampleAuctions = await db
      .select({
        id: auctions.id,
        status: auctions.status,
        currentBid: auctions.currentBid,
        startTime: auctions.startTime,
        endTime: auctions.endTime,
        caseId: auctions.caseId,
      })
      .from(auctions)
      .where(eq(auctions.status, 'closed'))
      .orderBy(desc(auctions.endTime))
      .limit(5);

    for (const auction of sampleAuctions) {
      console.log(`   Auction ${auction.id}:`);
      console.log(`     Status: ${auction.status}`);
      console.log(`     Current Bid: ${auction.currentBid}`);
      console.log(`     End Time: ${auction.endTime}`);
      
      // Get case details
      const caseData = await db
        .select({
          assetType: salvageCases.assetType,
          assetDetails: salvageCases.assetDetails,
          damageSeverity: salvageCases.damageSeverity,
          marketValue: salvageCases.marketValue,
        })
        .from(salvageCases)
        .where(eq(salvageCases.id, auction.caseId))
        .limit(1);

      if (caseData[0]) {
        console.log(`     Asset Type: ${caseData[0].assetType}`);
        console.log(`     Damage: ${caseData[0].damageSeverity}`);
        console.log(`     Market Value: ${caseData[0].marketValue}`);
        console.log(`     Asset Details:`, JSON.stringify(caseData[0].assetDetails, null, 2));
      }
      console.log('');
    }

    // Check bids
    console.log('💰 Step 3: Checking bids table...');
    const totalBids = await db
      .select({ count: sql<number>`count(*)` })
      .from(bids);
    console.log(`   Total bids: ${totalBids[0].count}\n`);

    // Test similarity query for a specific auction
    console.log('🔬 Step 4: Testing similarity query...');
    if (sampleAuctions.length > 0) {
      const testAuction = sampleAuctions[0];
      const testCase = await db
        .select()
        .from(salvageCases)
        .where(eq(salvageCases.id, testAuction.caseId))
        .limit(1);

      if (testCase[0]) {
        const assetType = testCase[0].assetType;
        const assetDetails = testCase[0].assetDetails || {};
        const targetMake = assetDetails.make;
        const targetModel = assetDetails.model;
        const targetDamage = testCase[0].damageSeverity;

        console.log(`   Testing for auction ${testAuction.id}:`);
        console.log(`     Asset Type: ${assetType}`);
        console.log(`     Make: ${targetMake}`);
        console.log(`     Model: ${targetModel}`);
        console.log(`     Damage: ${targetDamage}\n`);

        // Calculate date threshold (12 months ago)
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        // Simple query to find similar auctions
        const similarAuctions = await db
          .select({
            id: auctions.id,
            currentBid: auctions.currentBid,
            endTime: auctions.endTime,
            assetType: salvageCases.assetType,
            assetDetails: salvageCases.assetDetails,
            damageSeverity: salvageCases.damageSeverity,
          })
          .from(auctions)
          .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
          .where(
            and(
              eq(auctions.status, 'closed'),
              isNotNull(auctions.currentBid),
              eq(salvageCases.assetType, assetType),
              sql`${auctions.endTime} > ${twelveMonthsAgo.toISOString()}`,
              sql`${auctions.id} != ${testAuction.id}`
            )
          )
          .limit(10);

        console.log(`   Found ${similarAuctions.length} similar auctions (same asset type, closed, with bids, last 12 months)`);
        
        if (similarAuctions.length > 0) {
          console.log('\n   Sample similar auctions:');
          for (const similar of similarAuctions.slice(0, 3)) {
            console.log(`     - ${similar.id}: ₦${similar.currentBid} (${similar.assetType})`);
            console.log(`       Details:`, JSON.stringify(similar.assetDetails, null, 2));
          }
        }
      }
    }

    console.log('\n✅ Diagnosis complete!');

  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
    throw error;
  }
}

// Run the script
diagnosePredictionData()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
