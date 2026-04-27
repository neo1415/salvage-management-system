import { db } from "@/lib/db";
import { salvageCases, auctions, payments } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

async function diagnoseDuplicateIds() {
  console.log("🔍 Diagnosing Duplicate Case IDs\n");
  console.log("=" .repeat(80));

  // Get the adjuster user ID
  const adjusterUser = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.role, "claims_adjuster"),
  });

  if (!adjusterUser) {
    console.log("❌ No adjuster user found");
    return;
  }

  console.log(`\n📊 Checking cases for adjuster: ${adjusterUser.email}\n`);

  // Get all cases with their auctions and payments
  const cases = await db
    .select({
      caseId: salvageCases.id,
      claimReference: salvageCases.claimReference,
      status: salvageCases.status,
      auctionId: auctions.id,
      auctionStatus: auctions.status,
      paymentId: payments.id,
      paymentStatus: payments.status,
    })
    .from(salvageCases)
    .leftJoin(auctions, eq(salvageCases.id, auctions.caseId))
    .leftJoin(payments, eq(auctions.id, payments.auctionId))
    .where(eq(salvageCases.createdBy, adjusterUser.id));

  console.log(`Total rows returned from API query: ${cases.length}\n`);

  // Group by case ID to find duplicates
  const caseGroups = new Map<string, typeof cases>();
  
  for (const row of cases) {
    const existing = caseGroups.get(row.caseId) || [];
    existing.push(row);
    caseGroups.set(row.caseId, existing);
  }

  // Find duplicates
  const duplicates = Array.from(caseGroups.entries()).filter(
    ([_, rows]) => rows.length > 1
  );

  if (duplicates.length === 0) {
    console.log("✅ No duplicate case IDs found in the query result\n");
  } else {
    console.log(`❌ Found ${duplicates.length} cases with duplicate rows:\n`);
    
    for (const [caseId, rows] of duplicates) {
      console.log(`\n🔴 Case ID: ${caseId}`);
      console.log(`   Claim Reference: ${rows[0].claimReference}`);
      console.log(`   Case Status: ${rows[0].status}`);
      console.log(`   Appears ${rows.length} times in the result\n`);
      
      rows.forEach((row, index) => {
        console.log(`   Row ${index + 1}:`);
        console.log(`     - Auction ID: ${row.auctionId || "NULL"}`);
        console.log(`     - Auction Status: ${row.auctionStatus || "NULL"}`);
        console.log(`     - Payment ID: ${row.paymentId || "NULL"}`);
        console.log(`     - Payment Status: ${row.paymentStatus || "NULL"}`);
      });
    }
  }

  // Check the specific case ID from the error
  const problematicId = "7dfb4bb9-58d4-497a-b0a0-ec95fc4ae95a";
  const problematicCase = cases.filter((c) => c.caseId === problematicId);
  
  if (problematicCase.length > 0) {
    console.log(`\n\n🔍 Detailed analysis of ${problematicId}:\n`);
    console.log(`   Found ${problematicCase.length} rows for this case\n`);
    
    problematicCase.forEach((row, index) => {
      console.log(`   Row ${index + 1}:`);
      console.log(`     - Case Status: ${row.status}`);
      console.log(`     - Auction ID: ${row.auctionId || "NULL"}`);
      console.log(`     - Auction Status: ${row.auctionStatus || "NULL"}`);
      console.log(`     - Payment ID: ${row.paymentId || "NULL"}`);
      console.log(`     - Payment Status: ${row.paymentStatus || "NULL"}\n`);
    });
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n💡 ROOT CAUSE:");
  console.log("   The LEFT JOIN with auctions and payments tables is creating");
  console.log("   duplicate rows when a case has multiple auctions or payments.");
  console.log("\n💡 SOLUTION:");
  console.log("   The API should use DISTINCT or GROUP BY to prevent duplicates,");
  console.log("   or the UI should deduplicate the results by case ID.");
  console.log("\n✅ Diagnosis complete!\n");
}

diagnoseDuplicateIds().catch(console.error);
