import { db } from "@/lib/db";
import { payments, auctions, depositEvents } from "@/lib/db/schema";
import { eq, and, isNotNull, desc } from "drizzle-orm";

async function verifyHybridPaymentFix() {
  console.log("🔍 Verifying Hybrid Payment Fix...\n");

  try {
    // Check recent auction payments
    const recentPayments = await db
      .select()
      .from(payments)
      .where(isNotNull(payments.auctionId))
      .orderBy(desc(payments.createdAt))
      .limit(10);

    console.log("📋 Recent Auction Payments:");
    let issuesFound = 0;

    for (const payment of recentPayments) {
      if (!payment.auctionId) continue;

      // Get deposit events for this auction
      const events = await db
        .select()
        .from(depositEvents)
        .where(eq(depositEvents.auctionId, payment.auctionId))
        .orderBy(desc(depositEvents.createdAt));

      // Check if this is a hybrid payment (has wallet deduction event)
      const walletDeduction = events.find(e => 
        e.description.includes("Hybrid payment") && 
        e.description.includes("wallet portion deducted")
      );

      if (walletDeduction) {
        const walletPortion = parseFloat(walletDeduction.amount);
        const paymentAmount = parseFloat(payment.amount);

        console.log(`\n💳 Payment ID: ${payment.id}`);
        console.log(`   Auction ID: ${payment.auctionId}`);
        console.log(`   Status: ${payment.status}`);
        console.log(`   Payment Amount: ₦${paymentAmount.toLocaleString()}`);
        console.log(`   Wallet Portion: ₦${walletPortion.toLocaleString()}`);

        // Get auction to check final bid
        const auction = await db.query.auctions.findFirst({
          where: eq(auctions.id, payment.auctionId),
        });

        if (auction && auction.finalPrice) {
          const finalPrice = parseFloat(auction.finalPrice);
          const expectedPaystackPortion = finalPrice - walletPortion;

          console.log(`   Final Price: ₦${finalPrice.toLocaleString()}`);
          console.log(`   Expected Paystack: ₦${expectedPaystackPortion.toLocaleString()}`);

          // Verify payment amount matches expected Paystack portion
          const difference = Math.abs(paymentAmount - expectedPaystackPortion);
          if (difference > 0.01) {
            console.log(`   ❌ ISSUE: Payment amount doesn't match expected Paystack portion!`);
            console.log(`      Difference: ₦${difference.toFixed(2)}`);
            issuesFound++;
          } else {
            console.log(`   ✅ CORRECT: Payment amount matches Paystack portion`);
          }
        }
      }
    }

    if (issuesFound === 0) {
      console.log(`\n\n✅ All hybrid payments verified successfully!`);
      console.log(`   No issues found with payment amounts.`);
    } else {
      console.log(`\n\n⚠️  Found ${issuesFound} issue(s) with hybrid payment amounts.`);
      console.log(`   These may be old payments from before the fix.`);
    }

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

verifyHybridPaymentFix()
  .then(() => {
    console.log("\n✅ Verification complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
