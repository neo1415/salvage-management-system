/**
 * Analyze Actual Salvage Data
 * 
 * Check what fields we actually have and what data exists
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases, auctions, payments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function analyzeActualData() {
  console.log('🔍 Analyzing Actual Salvage Data Structure...\n');

  try {
    // Get a sample sold case with all fields
    const soldCases = await db
      .select()
      .from(salvageCases)
      .where(eq(salvageCases.status, 'sold'))
      .limit(3);

    console.log(`Found ${soldCases.length} sold cases\n`);

    for (const sCase of soldCases) {
      console.log(`\n📦 Case: ${sCase.claimReference}`);
      console.log(`   Asset Type: ${sCase.assetType}`);
      console.log(`   Market Value: ₦${sCase.marketValue}`);
      console.log(`   Estimated Salvage Value: ₦${sCase.estimatedSalvageValue || 'NULL'}`);
      console.log(`   Reserve Price: ₦${sCase.reservePrice || 'NULL'}`);
      console.log(`   Status: ${sCase.status}`);

      // Get auction for this case
      const auction = await db
        .select()
        .from(auctions)
        .where(eq(auctions.caseId, sCase.id))
        .limit(1);

      if (auction.length > 0) {
        const auc = auction[0];
        console.log(`\n   🔨 Auction:`);
        console.log(`      Status: ${auc.status}`);
        console.log(`      Current Bid: ₦${auc.currentBid || 'NULL'}`);
        console.log(`      Winner: ${auc.currentBidder || 'NULL'}`);

        // Get payment
        const payment = await db
          .select()
          .from(payments)
          .where(eq(payments.auctionId, auc.id))
          .limit(1);

        if (payment.length > 0) {
          const pay = payment[0];
          console.log(`\n      💰 Payment:`);
          console.log(`         Amount: ₦${pay.amount}`);
          console.log(`         Status: ${pay.status}`);
          console.log(`         Method: ${pay.method}`);
        }

        // Calculate what we can
        console.log(`\n   📊 Available Calculations:`);
        const marketValue = parseFloat(sCase.marketValue);
        const estimatedSalvage = sCase.estimatedSalvageValue 
          ? parseFloat(sCase.estimatedSalvageValue) 
          : null;
        const reservePrice = sCase.reservePrice 
          ? parseFloat(sCase.reservePrice) 
          : null;
        const actualSale = auc.currentBid 
          ? parseFloat(auc.currentBid) 
          : null;

        console.log(`      Market Value: ₦${marketValue.toLocaleString()}`);
        console.log(`      Estimated Salvage: ₦${estimatedSalvage?.toLocaleString() || 'N/A'}`);
        console.log(`      Reserve Price: ₦${reservePrice?.toLocaleString() || 'N/A'}`);
        console.log(`      Actual Sale: ₦${actualSale?.toLocaleString() || 'N/A'}`);

        if (estimatedSalvage && actualSale) {
          const efficiency = (actualSale / estimatedSalvage) * 100;
          console.log(`      Recovery Efficiency: ${efficiency.toFixed(1)}%`);
        }

        if (reservePrice && actualSale) {
          const vsReserve = ((actualSale - reservePrice) / reservePrice) * 100;
          console.log(`      vs Reserve Price: ${vsReserve > 0 ? '+' : ''}${vsReserve.toFixed(1)}%`);
        }
      }
    }

    // Summary statistics
    console.log('\n\n📈 Database Field Summary:');
    const allSold = await db
      .select({
        hasEstimatedSalvage: salvageCases.estimatedSalvageValue,
        hasReservePrice: salvageCases.reservePrice,
      })
      .from(salvageCases)
      .where(eq(salvageCases.status, 'sold'));

    const withEstimatedSalvage = allSold.filter(c => c.hasEstimatedSalvage !== null).length;
    const withReservePrice = allSold.filter(c => c.hasReservePrice !== null).length;

    console.log(`Total sold cases: ${allSold.length}`);
    console.log(`Cases with estimatedSalvageValue: ${withEstimatedSalvage}`);
    console.log(`Cases with reservePrice: ${withReservePrice}`);

    console.log('\n✅ Analysis Complete!');
  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

analyzeActualData();
