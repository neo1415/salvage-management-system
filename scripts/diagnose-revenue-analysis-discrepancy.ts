import "dotenv/config";
import { db } from "@/lib/db";
import { salvageCases, auctions, payments, vendors } from "@/lib/db/schema";
import { eq, and, gte, lte, sql, inArray } from "drizzle-orm";

async function diagnoseRevenueAnalysis() {
  console.log("🔍 Diagnosing Revenue Analysis Discrepancies...\n");

  const startDate = new Date("2026-03-29");
  const endDate = new Date("2026-04-28T23:59:59");

  // 1. Check Salvage Recovery Revenue (from auctions)
  console.log("📊 SALVAGE RECOVERY REVENUE (Auction Payments):");
  const auctionRevenue = await db
    .select({
      totalRevenue: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
      count: sql<number>`COUNT(DISTINCT ${payments.id})`,
    })
    .from(payments)
    .innerJoin(auctions, eq(payments.auctionId, auctions.id))
    .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
    .where(
      and(
        eq(payments.status, "verified"),
        sql`${payments.auctionId} IS NOT NULL`,
        gte(salvageCases.createdAt, startDate),
        lte(salvageCases.createdAt, endDate)
      )
    );

  console.log(`   Total: ₦${auctionRevenue[0]?.totalRevenue.toLocaleString()}`);
  console.log(`   Count: ${auctionRevenue[0]?.count} payments\n`);

  // 2. Check Registration Fee Revenue
  console.log("📊 REGISTRATION FEE REVENUE:");
  const registrationRevenue = await db
    .select({
      totalRevenue: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
      count: sql<number>`COUNT(DISTINCT ${payments.id})`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.status, "verified"),
        sql`${payments.auctionId} IS NULL`,
        gte(payments.createdAt, startDate),
        lte(payments.createdAt, endDate)
      )
    );

  console.log(`   Total: ₦${registrationRevenue[0]?.totalRevenue.toLocaleString()}`);
  console.log(`   Count: ${registrationRevenue[0]?.count} payments\n`);

  // 3. Total Revenue (should match Master Report)
  const totalRevenue =
    (auctionRevenue[0]?.totalRevenue || 0) +
    (registrationRevenue[0]?.totalRevenue || 0);
  console.log("💰 TOTAL REVENUE:");
  console.log(`   Auction Revenue: ₦${auctionRevenue[0]?.totalRevenue.toLocaleString()}`);
  console.log(`   Registration Revenue: ₦${registrationRevenue[0]?.totalRevenue.toLocaleString()}`);
  console.log(`   TOTAL: ₦${totalRevenue.toLocaleString()}\n`);

  // 4. Check case locations
  console.log("📍 CASE LOCATIONS:");
  const caseLocations = await db
    .select({
      location: salvageCases.locationName,
      count: sql<number>`COUNT(*)`,
    })
    .from(salvageCases)
    .where(
      and(
        gte(salvageCases.createdAt, startDate),
        lte(salvageCases.createdAt, endDate),
        inArray(salvageCases.status, ["approved", "sold", "active_auction"])
      )
    )
    .groupBy(salvageCases.locationName);

  console.log("   Locations found:");
  caseLocations.forEach((loc) => {
    console.log(`   - ${loc.location || "NULL"}: ${loc.count} cases`);
  });
  console.log();

  // 5. Get detailed breakdown by asset type with items
  console.log("📦 DETAILED ASSET BREAKDOWN:");
  const detailedBreakdown = await db
    .select({
      assetType: salvageCases.assetType,
      claimReference: salvageCases.claimReference,
      itemDetails: salvageCases.itemDetails,
      location: salvageCases.locationName,
      marketValue: salvageCases.marketValue,
      salvageValue: salvageCases.salvageValue,
      auctionId: auctions.id,
      winningBid: auctions.winningBid,
    })
    .from(salvageCases)
    .leftJoin(auctions, eq(salvageCases.id, auctions.caseId))
    .where(
      and(
        gte(salvageCases.createdAt, startDate),
        lte(salvageCases.createdAt, endDate),
        inArray(salvageCases.status, ["approved", "sold", "active_auction"])
      )
    )
    .orderBy(salvageCases.assetType, salvageCases.claimReference);

  const byAssetType: Record<string, any[]> = {};
  detailedBreakdown.forEach((item) => {
    const type = item.assetType || "unknown";
    if (!byAssetType[type]) byAssetType[type] = [];
    byAssetType[type].push(item);
  });

  Object.entries(byAssetType).forEach(([type, items]) => {
    console.log(`\n   ${type.toUpperCase()} (${items.length} cases):`);
    items.slice(0, 5).forEach((item) => {
      console.log(`   - ${item.claimReference}`);
      console.log(`     Location: ${item.location || "NOT SET"}`);
      console.log(`     Item: ${item.itemDetails || "NOT SET"}`);
      console.log(`     Market Value: ₦${item.marketValue?.toLocaleString()}`);
      console.log(`     Salvage Value: ₦${item.salvageValue?.toLocaleString()}`);
      console.log(`     Winning Bid: ₦${item.winningBid?.toLocaleString() || "N/A"}`);
    });
    if (items.length > 5) {
      console.log(`   ... and ${items.length - 5} more`);
    }
  });

  // 6. Check registration fee payments with vendor details
  console.log("\n\n💳 REGISTRATION FEE PAYMENTS:");
  const regFeePayments = await db
    .select({
      paymentId: payments.id,
      vendorId: payments.vendorId,
      businessName: vendors.businessName,
      amount: payments.amount,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .leftJoin(vendors, eq(payments.vendorId, vendors.id))
    .where(
      and(
        eq(payments.status, "verified"),
        sql`${payments.auctionId} IS NULL`,
        gte(payments.createdAt, startDate),
        lte(payments.createdAt, endDate)
      )
    )
    .orderBy(payments.createdAt);

  if (regFeePayments.length > 0) {
    regFeePayments.forEach((payment) => {
      console.log(`   - ${payment.businessName || "Unknown Vendor"}`);
      console.log(`     Amount: ₦${payment.amount.toLocaleString()}`);
      console.log(`     Date: ${payment.createdAt.toISOString().split("T")[0]}`);
    });
  } else {
    console.log("   No registration fee payments found in this period");
  }

  console.log("\n✅ Diagnosis complete!");
}

diagnoseRevenueAnalysis().catch(console.error);
