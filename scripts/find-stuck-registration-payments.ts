import { db } from "@/lib/db";
import { payments } from "@/lib/db/schema/payments";
import { eq, and, isNull } from "drizzle-orm";

/**
 * Find all stuck pending registration fee payments
 */

async function findStuckRegistrationPayments() {
  console.log("\n🔍 Searching for stuck registration fee payments...\n");

  try {
    const stuckPayments = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.status, "pending"),
          isNull(payments.auctionId)
        )
      );

    if (stuckPayments.length === 0) {
      console.log("✅ No stuck registration fee payments found.");
      return;
    }

    console.log(`📋 Found ${stuckPayments.length} stuck registration fee payment(s):\n`);
    
    stuckPayments.forEach((payment, index) => {
      console.log(`${index + 1}. Payment ID: ${payment.id}`);
      console.log(`   Vendor ID: ${payment.vendorId}`);
      console.log(`   Reference: ${payment.reference}`);
      console.log(`   Amount: ₦${payment.amount.toLocaleString()}`);
      console.log(`   Status: ${payment.status}`);
      console.log(`   Created: ${payment.createdAt}`);
      console.log("");
    });

    console.log("\n💡 To delete a stuck payment, run:");
    console.log("   npx tsx scripts/delete-stuck-registration-payment.ts <vendor_id>");
  } catch (error) {
    console.error("❌ Error finding stuck payments:", error);
    throw error;
  }
}

findStuckRegistrationPayments()
  .then(() => {
    console.log("\n✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });
