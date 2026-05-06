import { db } from "@/lib/db";
import { payments, walletTransactions, auctions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

async function diagnoseHybridPaymentIssue() {
  console.log("🔍 Diagnosing Hybrid Payment Issue...\n");

  try {
    // Get the most recent auction payments (filter by auctionId not null)
    const recentPayments = await db
      .select()
      .from(payments)
      .orderBy(desc(payments.createdAt))
      .limit(10);

    console.log("📋 Recent Auction Payments:");
    for (const payment of recentPayments) {
      console.log(`\n💳 Payment ID: ${payment.id}`);
      console.log(`   Auction ID: ${payment.auctionId}`);
      console.log(`   Amount: ₦${payment.amount.toLocaleString()}`);
      console.log(`   Method: ${payment.paymentMethod}`);
      console.log(`   Status: ${payment.status}`);
      console.log(`   Created: ${payment.createdAt}`);
      console.log(`   Updated: ${payment.updatedAt}`);

      if (payment.auctionId) {
        // Get auction details
        const auction = await db.query.auctions.findFirst({
          where: eq(auctions.id, payment.auctionId),
        });

        if (auction) {
          console.log(`\n   🏷️  Auction Status: ${auction.status}`);
          console.log(`   Final Price: ₦${auction.finalPrice?.toLocaleString() || "N/A"}`);
        }

        // Get wallet transactions for this auction
        const walletTxns = await db
          .select()
          .from(walletTransactions)
          .where(eq(walletTransactions.auctionId, payment.auctionId))
          .orderBy(desc(walletTransactions.createdAt));

        if (walletTxns.length > 0) {
          console.log(`\n   💰 Wallet Transactions (${walletTxns.length}):`);
          for (const txn of walletTxns) {
            console.log(`      - ${txn.type}: ₦${Math.abs(txn.amount).toLocaleString()} (${txn.status})`);
            console.log(`        Balance After: ₦${txn.balanceAfter.toLocaleString()}`);
            console.log(`        Frozen After: ₦${txn.frozenBalanceAfter.toLocaleString()}`);
          }
        }

        // Check for other payments for this auction
        const allAuctionPayments = await db
          .select()
          .from(payments)
          .where(eq(payments.auctionId, payment.auctionId))
          .orderBy(desc(payments.createdAt));

        if (allAuctionPayments.length > 1) {
          console.log(`\n   ⚠️  Multiple Payments Found (${allAuctionPayments.length}):`);
          for (const p of allAuctionPayments) {
            console.log(`      - ${p.paymentMethod}: ₦${p.amount.toLocaleString()} (${p.status})`);
          }
        }
      }
    }

    // Look for pending Paystack payments
    console.log("\n\n🔍 Checking for Pending Paystack Payments...");
    const pendingPaystack = await db
      .select()
      .from(payments)
      .where(eq(payments.status, "pending"))
      .orderBy(desc(payments.createdAt))
      .limit(10);

    if (pendingPaystack.length > 0) {
      console.log(`\n⚠️  Found ${pendingPaystack.length} Pending Payments:`);
      for (const p of pendingPaystack) {
        console.log(`\n   Payment ID: ${p.id}`);
        console.log(`   Auction ID: ${p.auctionId}`);
        console.log(`   Amount: ₦${p.amount.toLocaleString()}`);
        console.log(`   Method: ${p.paymentMethod}`);
        console.log(`   Reference: ${p.paystackReference || "N/A"}`);
        console.log(`   Created: ${p.createdAt}`);
      }
    }

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

diagnoseHybridPaymentIssue()
  .then(() => {
    console.log("\n✅ Diagnosis complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
