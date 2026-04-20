import { db } from "@/lib/db";
import { payments } from "@/lib/db/schema/payments";
import { eq, and, isNull } from "drizzle-orm";

/**
 * Delete Stuck Pending Registration Fee Payment
 * 
 * This script deletes pending registration fee payments that are stuck
 * so that vendors can retry the payment process.
 * 
 * Usage: npx tsx scripts/delete-stuck-registration-payment.ts <vendor_id>
 */

async function deleteStuckRegistrationPayment(vendorId: string) {
  console.log(`\n🔍 Searching for stuck registration fee payment for vendor ${vendorId}...`);

  try {
    // Find pending registration fee payment (auctionId is NULL, reference starts with REG-)
    const stuckPayments = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.vendorId, vendorId),
          eq(payments.status, "pending"),
          isNull(payments.auctionId)
        )
      );

    if (stuckPayments.length === 0) {
      console.log("✅ No stuck registration fee payments found.");
      return;
    }

    console.log(`\n📋 Found ${stuckPayments.length} stuck payment(s):`);
    stuckPayments.forEach((payment) => {
      console.log(`  - Payment ID: ${payment.id}`);
      console.log(`    Reference: ${payment.reference}`);
      console.log(`    Amount: ₦${payment.amount.toLocaleString()}`);
      console.log(`    Status: ${payment.status}`);
      console.log(`    Created: ${payment.createdAt}`);
      console.log("");
    });

    // Delete the stuck payments
    for (const payment of stuckPayments) {
      await db.delete(payments).where(eq(payments.id, payment.id));
      console.log(`✅ Deleted payment ${payment.id} (${payment.reference})`);
    }

    console.log(`\n✅ Successfully deleted ${stuckPayments.length} stuck payment(s).`);
    console.log("Vendor can now retry the registration fee payment.");
  } catch (error) {
    console.error("❌ Error deleting stuck payment:", error);
    throw error;
  }
}

// Main execution
const vendorId = process.argv[2];

if (!vendorId) {
  console.error("❌ Error: Vendor ID is required");
  console.log("\nUsage: npx tsx scripts/delete-stuck-registration-payment.ts <vendor_id>");
  console.log("Example: npx tsx scripts/delete-stuck-registration-payment.ts 123");
  process.exit(1);
}

deleteStuckRegistrationPayment(vendorId)
  .then(() => {
    console.log("\n✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });
