/**
 * Investigate Zero Revenue Data
 * 
 * Check why revenue reports show zero despite having sold cases
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases, auctions, payments } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

async function investigateZeroRevenue() {
  console.log('🔍 Investigating Zero Revenue Data...\n');

  try {
    // Step 1: Check sold cases
    console.log('Step 1: Checking sold cases...');
    const soldCases = await db
      .select()
      .from(salvageCases)
      .where(eq(salvageCases.status, 'sold'))
      .limit(5);
    
    console.log(`Found ${soldCases.length} sold cases\n`);

    // Step 2: For each sold case, check if it has an auction
    for (const sCase of soldCases) {
      console.log(`\n📦 Case: ${sCase.claimReference}`);
      console.log(`   Market Value: ₦${sCase.marketValue}`);
      console.log(`   Status: ${sCase.status}`);

      // Find auction for this case
      const caseAuctions = await db
        .select()
        .from(auctions)
        .where(eq(auctions.caseId, sCase.id));

      if (caseAuctions.length === 0) {
        console.log(`   ❌ NO AUCTION FOUND for this case!`);
        continue;
      }

      console.log(`   ✅ Found ${caseAuctions.length} auction(s)`);
      
      for (const auction of caseAuctions) {
        console.log(`\n   🔨 Auction: ${auction.id}`);
        console.log(`      Status: ${auction.status}`);
        console.log(`      Current Bid: ₦${auction.currentBid || 0}`);
        console.log(`      Winner: ${auction.winnerId || 'None'}`);

        // Find payments for this auction
        const auctionPayments = await db
          .select()
          .from(payments)
          .where(eq(payments.auctionId, auction.id));

        if (auctionPayments.length === 0) {
          console.log(`      ❌ NO PAYMENTS FOUND for this auction!`);
        } else {
          console.log(`      ✅ Found ${auctionPayments.length} payment(s)`);
          for (const payment of auctionPayments) {
            console.log(`\n      💰 Payment: ${payment.id}`);
            console.log(`         Amount: ₦${payment.amount}`);
            console.log(`         Status: ${payment.status}`);
            console.log(`         Method: ${payment.paymentMethod}`);
          }
        }
      }
    }

    // Step 3: Test the actual query used by the repository
    console.log('\n\n📊 Testing Repository Query...\n');
    const repoQuery = await db
      .select({
        caseId: salvageCases.id,
        claimRef: salvageCases.claimReference,
        marketValue: salvageCases.marketValue,
        paymentAmount: payments.amount,
        currentBid: auctions.currentBid,
      })
      .from(salvageCases)
      .leftJoin(auctions, eq(salvageCases.id, auctions.caseId))
      .leftJoin(payments, eq(auctions.id, payments.auctionId))
      .where(eq(salvageCases.status, 'sold'))
      .limit(10);

    console.log('Query Results:');
    repoQuery.forEach((row, i) => {
      console.log(`\n${i + 1}. ${row.claimRef}`);
      console.log(`   Market Value: ₦${row.marketValue}`);
      console.log(`   Payment Amount: ₦${row.paymentAmount || 'NULL'}`);
      console.log(`   Current Bid: ₦${row.currentBid || 'NULL'}`);
      
      const recoveryValue = parseFloat(row.paymentAmount || row.currentBid || '0');
      console.log(`   Recovery Value: ₦${recoveryValue}`);
    });

    // Step 4: Summary
    console.log('\n\n📈 Summary:');
    const withPayments = repoQuery.filter(r => r.paymentAmount).length;
    const withBids = repoQuery.filter(r => r.currentBid).length;
    const withEither = repoQuery.filter(r => r.paymentAmount || r.currentBid).length;
    
    console.log(`Total sold cases checked: ${repoQuery.length}`);
    console.log(`Cases with payments: ${withPayments}`);
    console.log(`Cases with bids: ${withBids}`);
    console.log(`Cases with either: ${withEither}`);
    console.log(`Cases with neither: ${repoQuery.length - withEither}`);

    if (withEither === 0) {
      console.log('\n⚠️  ROOT CAUSE: Sold cases have no associated payments or bids!');
      console.log('   This is why revenue shows as zero.');
      console.log('\n💡 Possible reasons:');
      console.log('   1. Cases marked as "sold" but auctions never completed');
      console.log('   2. Payments exist but auction_id foreign key is broken');
      console.log('   3. Test data was created without proper relationships');
    }

    console.log('\n✅ Investigation Complete!');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

investigateZeroRevenue();
