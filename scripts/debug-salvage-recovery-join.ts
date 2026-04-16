/**
 * Debug Salvage Recovery Join Issue
 */

import 'dotenv/config';
import { db } from '../src/lib/db/drizzle';
import { salvageCases, auctions, payments } from '../src/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

async function debugJoin() {
  console.log('=== Debugging Salvage Recovery Join ===\n');

  // 1. Count sold cases
  const soldCases = await db
    .select({ count: sql<number>`count(*)` })
    .from(salvageCases)
    .where(eq(salvageCases.status, 'sold'));
  console.log(`1. Sold cases: ${soldCases[0].count}\n`);

  // 2. Check auctions for sold cases
  const auctionsForSold = await db
    .select({
      caseId: salvageCases.id,
      claimRef: salvageCases.claimReference,
      auctionId: auctions.id,
      auctionStatus: auctions.status,
    })
    .from(salvageCases)
    .leftJoin(auctions, eq(salvageCases.id, auctions.caseId))
    .where(eq(salvageCases.status, 'sold'))
    .limit(5);
  
  console.log('2. Sample auctions for sold cases:');
  console.table(auctionsForSold);
  console.log();

  // 3. Check payments for these auctions
  const paymentsForAuctions = await db
    .select({
      auctionId: payments.auctionId,
      amount: payments.amount,
      status: payments.status,
      vendorId: payments.vendorId,
    })
    .from(payments)
    .where(sql`${payments.auctionId} IS NOT NULL`)
    .limit(10);
  
  console.log('3. Sample payments with auctionId:');
  console.table(paymentsForAuctions);
  console.log();

  // 4. Full join to see what's happening
  const fullJoin = await db
    .select({
      caseId: salvageCases.id,
      claimRef: salvageCases.claimReference,
      caseStatus: salvageCases.status,
      auctionId: auctions.id,
      paymentAmount: payments.amount,
      paymentStatus: payments.status,
    })
    .from(salvageCases)
    .leftJoin(auctions, eq(salvageCases.id, auctions.caseId))
    .leftJoin(payments, eq(auctions.id, payments.auctionId))
    .where(eq(salvageCases.status, 'sold'))
    .limit(10);
  
  console.log('4. Full join (case -> auction -> payment):');
  console.table(fullJoin);
  console.log();

  // 5. Count verified payments with auctionId
  const verifiedPayments = await db
    .select({
      count: sql<number>`count(*)`,
      total: sql<number>`sum(cast(${payments.amount} as numeric))`,
    })
    .from(payments)
    .where(and(
      eq(payments.status, 'verified'),
      sql`${payments.auctionId} IS NOT NULL`
    ));
  
  console.log('5. Verified payments with auctionId:');
  console.log(`   Count: ${verifiedPayments[0].count}`);
  console.log(`   Total: ₦${verifiedPayments[0].total?.toLocaleString() || 0}`);
  console.log();

  // 6. Check if multiple payments per auction
  const paymentsPerAuction = await db
    .select({
      auctionId: payments.auctionId,
      count: sql<number>`count(*)`,
      total: sql<number>`sum(cast(${payments.amount} as numeric))`,
    })
    .from(payments)
    .where(sql`${payments.auctionId} IS NOT NULL`)
    .groupBy(payments.auctionId)
    .having(sql`count(*) > 1`);
  
  console.log('6. Auctions with multiple payments:');
  console.table(paymentsPerAuction);
}

debugJoin()
  .then(() => {
    console.log('\n✅ Debug complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Debug failed:', error);
    process.exit(1);
  });
