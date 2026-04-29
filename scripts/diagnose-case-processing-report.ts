import "dotenv/config";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

async function diagnoseCaseProcessingReport() {
  console.log("\n🔍 CASE PROCESSING REPORT DIAGNOSTIC");
  console.log("=" .repeat(80));

  // Master Report Data (Source of Truth)
  console.log("\n📊 MASTER REPORT DATA (Source of Truth):");
  console.log("-".repeat(80));

  const masterReportData = await db.execute(sql`
    SELECT 
      COUNT(DISTINCT c.id) as total_cases,
      AVG(EXTRACT(EPOCH FROM (c.updated_at - c.created_at)) / 3600) as avg_processing_hours,
      COUNT(DISTINCT CASE WHEN c.status = 'sold' THEN c.id END) as sold_cases,
      COUNT(DISTINCT CASE WHEN c.status = 'pending_approval' THEN c.id END) as pending_approval_cases,
      COUNT(DISTINCT CASE WHEN c.status = 'approved' THEN c.id END) as approved_cases,
      COUNT(DISTINCT CASE WHEN c.asset_type = 'vehicle' THEN c.id END) as vehicle_cases,
      COUNT(DISTINCT CASE WHEN c.asset_type = 'electronics' THEN c.id END) as electronics_cases,
      COUNT(DISTINCT CASE WHEN c.asset_type = 'machinery' THEN c.id END) as machinery_cases
    FROM salvage_cases c
    WHERE c.created_at >= '2026-02-01' AND c.created_at < '2026-04-29'
  `);

  const masterData = (masterReportData as any)[0] as any;
  console.log(`  Total Cases: ${masterData.total_cases}`);
  console.log(`  Avg Processing Time: ${Number(masterData.avg_processing_hours).toFixed(1)} hours`);
  console.log(`  Sold: ${masterData.sold_cases}`);
  console.log(`  Pending Approval: ${masterData.pending_approval_cases}`);
  console.log(`  Approved: ${masterData.approved_cases}`);
  console.log(`  Vehicle: ${masterData.vehicle_cases}`);
  console.log(`  Electronics: ${masterData.electronics_cases}`);
  console.log(`  Machinery: ${masterData.machinery_cases}`);

  // Case Processing Report Data (Current)
  console.log("\n📊 CASE PROCESSING REPORT DATA (Current):");
  console.log("-".repeat(80));

  const caseProcessingData = await db.execute(sql`
    SELECT 
      COUNT(DISTINCT c.id) as total_cases,
      AVG(EXTRACT(EPOCH FROM (c.updated_at - c.created_at)) / 3600) as avg_processing_hours,
      COUNT(DISTINCT CASE WHEN c.status = 'sold' THEN c.id END) as sold_cases,
      COUNT(DISTINCT CASE WHEN c.status = 'pending_approval' THEN c.id END) as pending_approval_cases,
      COUNT(DISTINCT CASE WHEN c.status = 'approved' THEN c.id END) as approved_cases,
      COUNT(DISTINCT CASE WHEN c.asset_type = 'vehicle' THEN c.id END) as vehicle_cases,
      COUNT(DISTINCT CASE WHEN c.asset_type = 'electronics' THEN c.id END) as electronics_cases,
      COUNT(DISTINCT CASE WHEN c.asset_type = 'machinery' THEN c.id END) as machinery_cases,
      (COUNT(DISTINCT CASE WHEN c.status IN ('approved', 'sold') THEN c.id END)::float / 
       NULLIF(COUNT(DISTINCT c.id), 0) * 100) as approval_rate
    FROM salvage_cases c
    WHERE c.created_at >= '2026-03-29' AND c.created_at < '2026-04-29'
  `);

  const reportData = (caseProcessingData as any)[0] as any;
  console.log(`  Total Cases: ${reportData.total_cases}`);
  console.log(`  Avg Processing Time: ${Number(reportData.avg_processing_hours).toFixed(1)} hours`);
  console.log(`  Approval Rate: ${Number(reportData.approval_rate).toFixed(1)}%`);
  console.log(`  Sold: ${reportData.sold_cases}`);
  console.log(`  Pending Approval: ${reportData.pending_approval_cases}`);
  console.log(`  Approved: ${reportData.approved_cases}`);
  console.log(`  Vehicle: ${reportData.vehicle_cases}`);
  console.log(`  Electronics: ${reportData.electronics_cases}`);
  console.log(`  Machinery: ${reportData.machinery_cases}`);

  // Check by asset type with processing times
  console.log("\n📊 PROCESSING TIME BY ASSET TYPE:");
  console.log("-".repeat(80));

  const assetTypeData = await db.execute(sql`
    SELECT 
      c.asset_type,
      COUNT(DISTINCT c.id) as case_count,
      AVG(EXTRACT(EPOCH FROM (c.updated_at - c.created_at)) / 3600) as avg_processing_hours
    FROM salvage_cases c
    WHERE c.created_at >= '2026-03-29' AND c.created_at < '2026-04-29'
    GROUP BY c.asset_type
    ORDER BY c.asset_type
  `);

  for (const row of assetTypeData as any[]) {
    console.log(`  ${row.asset_type}: ${row.case_count} cases, ${Number(row.avg_processing_hours).toFixed(1)} hours avg`);
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n🎯 ANALYSIS:");
  console.log(`  Master Report shows ${masterData.total_cases} total cases (Feb 1 - Apr 28)`);
  console.log(`  Case Processing Report shows ${reportData.total_cases} total cases (Mar 29 - Apr 28)`);
  console.log(`  Date ranges are DIFFERENT - this is expected`);
  console.log("\n  KEY QUESTION: Should Case Processing Report use the same date range as Master Report?");
  console.log("  Or should it have its own date filter?");
  console.log("\n" + "=".repeat(80));

  console.log("\n✅ Diagnostic complete");
}

diagnoseCaseProcessingReport()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
