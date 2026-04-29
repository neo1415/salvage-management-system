import "dotenv/config";
import { db } from "@/lib/db";
import { payments } from "@/lib/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

async function checkMasterReportRevenue() {
  console.log("🔍 Checking Master Report Revenue (Feb 1 - Apr 28, 2026)...\n");

  const startDate = new Date("2026-02-01");
  const endDate = new Date("2026-04-28T23:59:59");

  // Master Report query (from master-report.service.ts)
  const revenueResult = await db.execute(sql`
    SELECT 
      COALESCE(SUM(CAST(amount AS NUMERIC)), 0) as total_revenue
    FROM payments
    WHERE status = 'verified'
      AND created_at >= ${startDate.toISOString()}
      AND created_at <= ${endDate.toISOString()}
  `);

  console.log("💰 MASTER REPORT REVENUE:");
  console.log(`   Total: ₦${parseFloat((revenueResult[0] as any)?.total_revenue || '0').toLocaleString()}`);

  // Break down by auction vs registration
  const breakdown = await db
    .select({
      hasAuction: sql<boolean>`${payments.auctionId} IS NOT NULL`,
      count: sql<number>`COUNT(*)`,
      total: sql<number>`SUM(${payments.amount})`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.status, "verified"),
        gte(payments.createdAt, startDate),
        lte(payments.createdAt, endDate)
      )
    )
    .groupBy(sql`${payments.auctionId} IS NOT NULL`);

  console.log("\n📊 BREAKDOWN:");
  breakdown.forEach((row) => {
    const type = row.hasAuction ? "Auction Payments" : "Registration Fees";
    console.log(`   ${type}: ₦${parseFloat(row.total).toLocaleString()} (${row.count} payments)`);
  });

  console.log("\n✅ Check complete!");
}

checkMasterReportRevenue().catch(console.error);
