import "dotenv/config";
import { db } from "@/lib/db";
import { salvageCases, auctions, payments } from "@/lib/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

async function verifyRevenue() {
  console.log("🔍 Verifying Revenue Consistency...\n");

  // Date range from Master Report screenshot
  const startDate = new Date("2026-03-29");
  const endDate = new Date("2026-04-28T23:59:59");

  // Get all verified payments in date range
  console.log("📊 ALL VERIFIED PAYMENTS (March 29 - April 28, 2026):");
  const allPayments = await db
    .select({
      paymentId: payments.id,
      amount: payments.amount,
      auctionId: payments.auctionId,
      createdAt: payments.createdAt,
      status: payments.status,
    })
    .from(payments)
    .where(
      and(
        eq(payments.status, "verified"),
        gte(payments.createdAt, startDate),
        lte(payments.createdAt, endDate)
      )
    )
    .orderBy(payments.createdAt);

  let auctionTotal = 0;
  let registrationTotal = 0;
  let auctionCount = 0;
  let registrationCount = 0;

  console.log("\nPayment Details:");
  allPayments.forEach((payment) => {
    const amount = parseFloat(payment.amount);
    const type = payment.auctionId ? "AUCTION" : "REGISTRATION";
    
    if (payment.auctionId) {
      auctionTotal += amount;
      auctionCount++;
    } else {
      registrationTotal += amount;
      registrationCount++;
    }

    console.log(`  ${payment.createdAt.toISOString().split("T")[0]} | ${type.padEnd(12)} | ₦${amount.toLocaleString()}`);
  });

  console.log("\n" + "=".repeat(60));
  console.log(`\n💰 REVENUE SUMMARY:`);
  console.log(`   Auction Payments:      ₦${auctionTotal.toLocaleString()} (${auctionCount} payments)`);
  console.log(`   Registration Fees:     ₦${registrationTotal.toLocaleString()} (${registrationCount} payments)`);
  console.log(`   TOTAL REVENUE:         ₦${(auctionTotal + registrationTotal).toLocaleString()}`);
  console.log(`\n   Master Report shows:   ₦6,097,500`);
  console.log(`   Difference:            ₦${(6097500 - (auctionTotal + registrationTotal)).toLocaleString()}`);

  console.log("\n✅ Verification complete!");
}

verifyRevenue().catch(console.error);
