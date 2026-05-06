import { db } from "@/lib/db";
import { payments, auctions, depositEvents } from "@/lib/db/schema";
import { eq, desc, and, isNotNull } from "drizzle-orm";

async function diagnoseHybridPayment() {
  console.log("🔍 Diagnosing Hybrid Payment Issue...\n");

  try {
    // Get the most recent auction payment
    const recentPayments = await db
      .select()
      .from(payments)
      .where(isNotNull(payments.auctionId))
      .orderBy(desc(payments.createdAt))
      .limit(5);

    console.log("📋 Recent Auction Payments:");
    for (const payment of recentPayments) {
      console.log(`\n💳 Payment ID: ${payment.id}`);
      console.log(`   Auction ID: ${payment.auctionId}`);
      console.log(`   Vendor ID: ${payment.vendorId}`);
      console.log(`   Amount: ₦${payment.amount.toLocaleString()}`);
      console.log(`   Method: ${payment.paymentMethod}`);
      console.log(`   Status: ${payment.status}`);
      console.log(`   Paystack Ref: ${payment.paystackReference || "N/A"}`);
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
          console.log(`   Winner ID: ${auction.winnerId || "N/A"}`);
        }

        // Get deposit events for this auction
        const events = await db
          .select()
          .from(depositEvents)
          .where(eq(depositEvents.auctionId, payment.auctionId))
          .orderBy(desc(depositEvents.createdAt))
          .limit(10);

        if (events.length > 0) {
          console.log(`\n   💰 Deposit Events (${events.length}):`);
          for (const event of events) {
            console.log(`      - ${event.eventType}: ₦${event.amount.toLocaleString()}`);
            console.log(`        Available: ${event.availableBefore} → ${event.availableAfter}`);
            console.log(`        Frozen: ${event.frozenBefore} → ${event.frozenAfter}`);
            console.log(`        ${event.description}`);
          }
        }

        // Check for all payments for this auction
        const allAuctionPayments = await db
          .select()
          .from(payments)
          .where(eq(payments.auctionId, payment.auctionId))
          .orderBy(desc(payments.createdAt));

        if (allAuctionPayments.length > 1) {
          console.log(`\n   ⚠️  Multiple Payments Found (${allAuctionPayments.length}):`);
          for (const p of allAuctionPayments) {
            console.log(`      - ${p.paymentMethod}: ₦${p.amount.toLocaleString()} (${p.status})`);
            console.log(`        ID: ${p.id}`);
            console.log(`        Ref: ${p.paystackReference || p.paymentReference || "N/A"}`);
          }
        }
      }
    }

    // Look for pending payments
    console.log("\n\n🔍 Checking for Pending Payments...");
    const pendingPayments = await db
      .select()
      .from(payments)
      .where(and(
        eq(payments.status, "pending"),
        isNotNull(payments.auctionId)
      ))
      .orderBy(desc(payments.createdAt))
      .limit(10);

    if (pendingPayments.length > 0) {
      console.log(`\n⚠️  Found ${pendingPayments.length} Pending Auction Payments:`);
      for (const p of pendingPayments) {
        console.log(`\n   Payment ID: ${p.id}`);
        console.log(`   Auction ID: ${p.auctionId}`);
        console.log(`   Amount: ₦${p.amount.toLocaleString()}`);
        console.log(`   Method: ${p.paymentMethod}`);
        console.log(`   Reference: ${p.paystackReference || p.paymentReference || "N/A"}`);
        console.log(`   Created: ${p.createdAt}`);
      }
    } else {
      console.log("✅ No pending auction payments found");
    }

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

diagnoseHybridPayment()
  .then(() => {
    console.log("\n✅ Diagnosis complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
