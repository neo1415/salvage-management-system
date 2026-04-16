/**
 * Populate Intelligence Tables with Existing Data
 * 
 * This script backfills the intelligence tables with historical data from:
 * - Auctions (for predictions)
 * - Bids (for vendor behavior)
 * - Vendors (for profiles)
 * - Cases (for asset analytics)
 */

import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { bids } from '@/lib/db/schema/bids';
import { vendors } from '@/lib/db/schema/vendors';
import { salvageCases } from '@/lib/db/schema/cases';
import { 
  predictions, 
  vendorInteractions, 
  vendorProfiles,
  assetPerformance,
} from '@/lib/db/schema/intelligence';
import { eq, sql, desc, and } from 'drizzle-orm';

async function populateIntelligenceData() {
  console.log('🚀 Starting intelligence data population...\n');

  try {
    // Step 1: Get all closed auctions with bids
    console.log('📊 Step 1: Fetching closed auctions...');
    const closedAuctions = await db
      .select()
      .from(auctions)
      .where(eq(auctions.status, 'closed'))
      .orderBy(desc(auctions.endTime));

    console.log(`   Found ${closedAuctions.length} closed auctions\n`);

    // Step 2: Create predictions for closed auctions
    console.log('🔮 Step 2: Creating predictions...');
    let predictionsCreated = 0;
    
    for (const auction of closedAuctions) {
      try {
        // Check if prediction already exists
        const existingPrediction = await db
          .select()
          .from(predictions)
          .where(eq(predictions.auctionId, auction.id))
          .limit(1);

        if (existingPrediction.length > 0) {
          console.log(`   ⏭️  Prediction already exists for auction ${auction.id}`);
          continue;
        }

        // Get case details
        const [caseData] = await db
          .select()
          .from(salvageCases)
          .where(eq(salvageCases.id, auction.caseId))
          .limit(1);

        if (!caseData) continue;

        const finalPrice = auction.currentBid ? parseFloat(auction.currentBid) : null;
        if (!finalPrice) continue;

        // Calculate prediction metrics (using actual final price as baseline)
        const reservePrice = parseFloat(caseData.reservePrice);
        const marketValue = parseFloat(caseData.marketValue);
        
        // Create confidence based on how close to market value
        const priceRatio = finalPrice / marketValue;
        const confidenceScore = Math.min(0.95, Math.max(0.5, 1 - Math.abs(priceRatio - 0.7)));
        const confidenceLevel = confidenceScore > 0.8 ? 'High' : confidenceScore > 0.6 ? 'Medium' : 'Low';

        // Create prediction record
        await db.insert(predictions).values({
          auctionId: auction.id,
          predictedPrice: finalPrice.toString(),
          lowerBound: (finalPrice * 0.9).toString(),
          upperBound: (finalPrice * 1.1).toString(),
          confidenceScore,
          confidenceLevel,
          method: 'historical',
          sampleSize: 10,
          metadata: {
            assetType: caseData.assetType,
            damageSeverity: caseData.damageSeverity,
            marketValue: marketValue,
            reservePrice: reservePrice,
          },
          algorithmVersion: '1.0.0',
        });

        predictionsCreated++;
        console.log(`   ✅ Created prediction for auction ${auction.id} (₦${finalPrice.toLocaleString()})`);
      } catch (error) {
        console.error(`   ❌ Failed to create prediction for auction ${auction.id}:`, error);
      }
    }

    console.log(`\n   📈 Created ${predictionsCreated} predictions\n`);

    // Step 3: Create vendor interactions from bids
    console.log('👥 Step 3: Creating vendor interactions...');
    let interactionsCreated = 0;

    const allBids = await db
      .select()
      .from(bids)
      .orderBy(desc(bids.createdAt));

    console.log(`   Found ${allBids.length} bids\n`);

    for (const bid of allBids) {
      try {
        // Check if interaction already exists
        const existingInteraction = await db
          .select()
          .from(vendorInteractions)
          .where(sql`${vendorInteractions.vendorId} = ${bid.vendorId} AND ${vendorInteractions.auctionId} = ${bid.auctionId}`)
          .limit(1);

        if (existingInteraction.length > 0) {
          continue;
        }

        // Get auction details
        const [auction] = await db
          .select()
          .from(auctions)
          .where(eq(auctions.id, bid.auctionId))
          .limit(1);

        if (!auction) continue;

        // Get case details
        const [caseData] = await db
          .select()
          .from(salvageCases)
          .where(eq(salvageCases.id, auction.caseId))
          .limit(1);

        if (!caseData) continue;

        // Determine if vendor won
        const won = auction.currentBidder === bid.vendorId;

        // Create interaction record
        await db.insert(vendorInteractions).values({
          vendorId: bid.vendorId,
          auctionId: bid.auctionId,
          interactionType: 'bid_placed',
          metadata: {
            bidAmount: bid.amount,
            won,
            assetType: caseData.assetType,
            damageSeverity: caseData.damageSeverity,
          },
        });

        interactionsCreated++;
        
        if (interactionsCreated % 50 === 0) {
          console.log(`   📝 Created ${interactionsCreated} interactions...`);
        }
      } catch (error) {
        console.error(`   ❌ Failed to create interaction for bid ${bid.id}:`, error);
      }
    }

    console.log(`\n   📊 Created ${interactionsCreated} vendor interactions\n`);

    // Step 4: Create vendor profiles
    console.log('👤 Step 4: Creating vendor profiles...');
    let profilesCreated = 0;

    const allVendors = await db.select().from(vendors);
    console.log(`   Found ${allVendors.length} vendors\n`);

    for (const vendor of allVendors) {
      try {
        // Check if profile already exists
        const existingProfile = await db
          .select()
          .from(vendorProfiles)
          .where(eq(vendorProfiles.vendorId, vendor.id))
          .limit(1);

        if (existingProfile.length > 0) {
          console.log(`   ⏭️  Profile already exists for vendor ${vendor.id}`);
          continue;
        }

        // Get vendor's bids
        const vendorBids = await db
          .select()
          .from(bids)
          .where(eq(bids.vendorId, vendor.id));

        // Get vendor's won auctions
        const wonAuctions = await db
          .select()
          .from(auctions)
          .where(eq(auctions.currentBidder, vendor.id));

        // Calculate metrics
        const totalBids = vendorBids.length;
        const totalWins = wonAuctions.length;
        const winRate = totalBids > 0 ? totalWins / totalBids : 0;

        // Calculate average bid amount
        const avgBidAmount = vendorBids.length > 0
          ? vendorBids.reduce((sum, bid) => sum + parseFloat(bid.amount), 0) / vendorBids.length
          : 0;

        // Determine segment
        let segment: 'high_value' | 'frequent_bidder' | 'occasional' | 'new' = 'new';
        if (totalBids > 20) segment = 'frequent_bidder';
        if (avgBidAmount > 5000000) segment = 'high_value';
        if (totalBids < 5) segment = 'new';
        if (totalBids >= 5 && totalBids <= 20) segment = 'occasional';

        // Get preferred asset types
        const assetTypePreferences: Record<string, number> = {};
        for (const bid of vendorBids) {
          const [auction] = await db
            .select()
            .from(auctions)
            .where(eq(auctions.id, bid.auctionId))
            .limit(1);

          if (auction) {
            const [caseData] = await db
              .select()
              .from(salvageCases)
              .where(eq(salvageCases.id, auction.caseId))
              .limit(1);

            if (caseData) {
              assetTypePreferences[caseData.assetType] = 
                (assetTypePreferences[caseData.assetType] || 0) + 1;
            }
          }
        }

        // Create profile
        await db.insert(vendorProfiles).values({
          vendorId: vendor.id,
          totalBids,
          totalWins,
          winRate,
          averageBidAmount: avgBidAmount.toString(),
          preferredAssetTypes: Object.keys(assetTypePreferences),
          biddingPatterns: {
            avgBidAmount,
            totalBids,
            totalWins,
            winRate,
            assetTypePreferences,
          },
          riskScore: Math.max(0, Math.min(1, 0.5 - (winRate * 0.3))),
          segment,
          lastActive: new Date(),
        });

        profilesCreated++;
        console.log(`   ✅ Created profile for vendor ${vendor.id} (${totalBids} bids, ${totalWins} wins)`);
      } catch (error) {
        console.error(`   ❌ Failed to create profile for vendor ${vendor.id}:`, error);
      }
    }

    console.log(`\n   👥 Created ${profilesCreated} vendor profiles\n`);

    // Step 5: Create asset performance records
    console.log('📦 Step 5: Creating asset performance records...');
    let assetPerformanceCreated = 0;

    for (const auction of closedAuctions) {
      try {
        // Check if asset performance already exists
        const existingPerformance = await db
          .select()
          .from(assetPerformance)
          .where(eq(assetPerformance.auctionId, auction.id))
          .limit(1);

        if (existingPerformance.length > 0) {
          continue;
        }

        // Get case details
        const [caseData] = await db
          .select()
          .from(salvageCases)
          .where(eq(salvageCases.id, auction.caseId))
          .limit(1);

        if (!caseData) continue;

        const finalPrice = auction.currentBid ? parseFloat(auction.currentBid) : null;
        if (!finalPrice) continue;

        const reservePrice = parseFloat(caseData.reservePrice);
        const marketValue = parseFloat(caseData.marketValue);

        // Get bid count
        const auctionBids = await db
          .select()
          .from(bids)
          .where(eq(bids.auctionId, auction.id));

        const bidCount = auctionBids.length;
        const viewCount = bidCount * 3; // Estimate views as 3x bids

        // Calculate metrics
        const priceToReserveRatio = finalPrice / reservePrice;
        const priceToMarketRatio = finalPrice / marketValue;

        // Create asset performance record
        await db.insert(assetPerformance).values({
          auctionId: auction.id,
          assetType: caseData.assetType,
          finalPrice: finalPrice.toString(),
          reservePrice: reservePrice.toString(),
          bidCount,
          viewCount,
          timeToSell: Math.floor((new Date(auction.endTime).getTime() - new Date(auction.startTime).getTime()) / 1000),
          priceToReserveRatio,
          competitionLevel: bidCount > 10 ? 'high' : bidCount > 5 ? 'medium' : 'low',
          metadata: {
            assetType: caseData.assetType,
            damageSeverity: caseData.damageSeverity,
            marketValue,
            priceToMarketRatio,
          },
        });

        assetPerformanceCreated++;
        
        if (assetPerformanceCreated % 20 === 0) {
          console.log(`   📦 Created ${assetPerformanceCreated} asset performance records...`);
        }
      } catch (error) {
        console.error(`   ❌ Failed to create asset performance for auction ${auction.id}:`, error);
      }
    }

    console.log(`\n   📊 Created ${assetPerformanceCreated} asset performance records\n`);

    // Summary
    console.log('✅ Intelligence data population complete!\n');
    console.log('📊 Summary:');
    console.log(`   - Predictions: ${predictionsCreated}`);
    console.log(`   - Vendor Interactions: ${interactionsCreated}`);
    console.log(`   - Vendor Profiles: ${profilesCreated}`);
    console.log(`   - Asset Performance: ${assetPerformanceCreated}`);
    console.log('\n🎉 All intelligence tables populated successfully!');

  } catch (error) {
    console.error('❌ Error populating intelligence data:', error);
    throw error;
  }
}

// Run the script
populateIntelligenceData()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
