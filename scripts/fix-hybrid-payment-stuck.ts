import { db } from "@/lib/db";
import { payments, auctions, depositEvents, escrowWallets } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

async function fixHybridPaymentStuck() {
  console.log("🔧 Fixing Stuck Hybrid Payment...\n");

  const auctionId = "94dc28fd-8a53-4fda-aebe-d2ba192efc42";
  const vendorId = "5e4eaa5f-7438-4c4f-bc8a-59db91d4a8c3";

  try {
    // Get the pending payment
    const [payment] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.auctionId, auctionId),
          eq(payments.status, "pending")
        )
      )
      .limit(1);

    if (!payment) {
      console.log("❌ No pending payment found");
      return;
    }

    console.log(`📋 Found pending payment: ${payment.id}`);
    console.log(`   Amount: ₦${payment.amount.toLocaleString()}`);
    console.log(`   Method: ${payment.paymentMethod}`);

    // Get deposit event to see wallet portion
    const [depositEvent] = await db
      .select()
      .from(depositEvents)
      .where(eq(depositEvents.auctionId, auctionId))
      .limit(1);

    if (!depositEvent) {
      console.log("❌ No deposit event found");
      return;
    }

    const walletPortion = parseFloat(depositEvent.amount);
    console.log(`\n💰 Wallet portion deducted: ₦${walletPortion.toLocaleString()}`);

    // Calculate correct Paystack portion
    const fullAmount = parseFloat(payment.amount);
    const paystackPortion = fullAmount - walletPortion;

    console.log(`\n📊 Payment Breakdown:`);
    console.log(`   Full Amount: ₦${fullAmount.toLocaleString()}`);
    console.log(`   Wallet Portion: ₦${walletPortion.toLocaleString()}`);
    console.log(`   Paystack Portion (should be): ₦${paystackPortion.toLocaleString()}`);

    // Option 1: Cancel the pending payment and refund wallet
    console.log(`\n🔄 Fixing the issue...`);
    console.log(`   1. Refunding wallet portion (₦${walletPortion.toLocaleString()})`);
    console.log(`   2. Canceling pending payment`);
    console.log(`   3. Resetting auction status`);

    await db.transaction(async (tx) => {
      // Get wallet
      const [wallet] = await tx
        .select()
        .from(escrowWallets)
        .where(eq(escrowWallets.vendorId, vendorId))
        .for("update")
        .limit(1);

      if (!wallet) {
        throw new Error("Wallet not found");
      }

      const currentBalance = parseFloat(wallet.balance);
      const currentAvailable = parseFloat(wallet.availableBalance);
      const currentFrozen = parseFloat(wallet.frozenAmount);

      // Refund wallet portion
      const newBalance = currentBalance + walletPortion;
      const newAvailable = currentAvailable + walletPortion;

      await tx
        .update(escrowWallets)
        .set({
          balance: newBalance.toFixed(2),
          availableBalance: newAvailable.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(escrowWallets.vendorId, vendorId));

      console.log(`   ✅ Wallet refunded: ₦${walletPortion.toLocaleString()}`);

      // Record refund event
      await tx.insert(depositEvents).values({
        vendorId,
        auctionId,
        eventType: "unfreeze",
        amount: walletPortion.toFixed(2),
        balanceBefore: currentBalance.toFixed(2),
        balanceAfter: newBalance.toFixed(2),
        frozenBefore: currentFrozen.toFixed(2),
        frozenAfter: currentFrozen.toFixed(2),
        availableBefore: currentAvailable.toFixed(2),
        availableAfter: newAvailable.toFixed(2),
        description: `Hybrid payment refund - Paystack failed (₦${walletPortion.toFixed(2)})`,
      });

      // Cancel the pending payment
      await tx
        .delete(payments)
        .where(eq(payments.id, payment.id));

      console.log(`   ✅ Pending payment canceled`);

      // Reset auction status to awaiting_payment (it should already be this)
      await tx
        .update(auctions)
        .set({
          status: "awaiting_payment",
          updatedAt: new Date(),
        })
        .where(eq(auctions.id, auctionId));

      console.log(`   ✅ Auction status reset to awaiting_payment`);
    });

    console.log(`\n✅ Fix complete!`);
    console.log(`\n📝 Next steps:`);
    console.log(`   1. Refresh the auction page`);
    console.log(`   2. Choose your payment method again`);
    console.log(`   3. If using hybrid, wallet portion will be deducted again`);
    console.log(`   4. Complete Paystack payment for the balance`);

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

fixHybridPaymentStuck()
  .then(() => {
    console.log("\n✅ Script complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
