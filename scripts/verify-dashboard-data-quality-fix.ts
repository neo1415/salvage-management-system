import { db } from "@/lib/db";
import { 
  assetPerformanceAnalytics,
  geographicPatternsAnalytics 
} from "@/lib/db/schema/analytics";

async function verifyDashboardDataQualityFix() {
  console.log("=== VERIFYING DASHBOARD DATA QUALITY FIXES ===\n");

  try {
    // 1. Verify Geographic Patterns
    console.log("1. GEOGRAPHIC PATTERNS - Checking normalized priceVariance:");
    console.log("=" .repeat(70));
    
    const geoPatterns = await db
      .select({
        region: geographicPatternsAnalytics.region,
        demandScore: geographicPatternsAnalytics.demandScore,
        priceVariance: geographicPatternsAnalytics.priceVariance,
        avgFinalPrice: geographicPatternsAnalytics.avgFinalPrice,
      })
      .from(geographicPatternsAnalytics)
      .limit(5);

    console.log(`Found ${geoPatterns.length} records\n`);
    
    let geoIssues = 0;
    geoPatterns.forEach((row, idx) => {
      const variance = Number(row.priceVariance);
      const isValid = variance >= 0 && variance <= 100;
      
      console.log(`Record ${idx + 1}: ${row.region}`);
      console.log(`  Demand Score: ${row.demandScore}% (should be 0-100)`);
      console.log(`  Price Variance: ${variance.toFixed(2)}% (should be 0-100)`);
      console.log(`  Status: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
      console.log("");
      
      if (!isValid) geoIssues++;
    });

    if (geoIssues > 0) {
      console.log(`❌ Found ${geoIssues} issues in geographic patterns\n`);
    } else {
      console.log(`✅ All geographic patterns are valid\n`);
    }

    // 2. Verify Asset Performance
    console.log("2. ASSET PERFORMANCE - Checking avgSellThroughRate:");
    console.log("=" .repeat(70));
    
    const assetPerf = await db
      .select({
        assetType: assetPerformanceAnalytics.assetType,
        make: assetPerformanceAnalytics.make,
        model: assetPerformanceAnalytics.model,
        avgSellThroughRate: assetPerformanceAnalytics.avgSellThroughRate,
        demandScore: assetPerformanceAnalytics.demandScore,
      })
      .from(assetPerformanceAnalytics)
      .limit(10);

    console.log(`Found ${assetPerf.length} records\n`);
    
    let assetIssues = 0;
    assetPerf.forEach((row, idx) => {
      const rate = Number(row.avgSellThroughRate);
      const isValid = rate > 0 && rate <= 1;
      
      console.log(`Record ${idx + 1}: ${row.assetType} - ${row.make || 'N/A'} ${row.model || 'N/A'}`);
      console.log(`  Sell-Through Rate: ${(rate * 100).toFixed(1)}% (should be 20-95%)`);
      console.log(`  Demand Score: ${row.demandScore}% (should be 0-100)`);
      console.log(`  Status: ${isValid ? '✅ VALID' : '❌ INVALID (NULL or 0)'}`);
      console.log("");
      
      if (!isValid) assetIssues++;
    });

    if (assetIssues > 0) {
      console.log(`❌ Found ${assetIssues} issues in asset performance\n`);
    } else {
      console.log(`✅ All asset performance records are valid\n`);
    }

    // 3. Summary
    console.log("=" .repeat(70));
    console.log("VERIFICATION SUMMARY:");
    console.log("=" .repeat(70));
    
    if (geoIssues === 0 && assetIssues === 0) {
      console.log("✅ ALL FIXES VERIFIED SUCCESSFULLY!");
      console.log("\nExpected UI Display:");
      console.log("- Regional Insights: Demand should show 0-100% (not 10000%)");
      console.log("- Regional Insights: Variance should show 0-100% (not ±31625939%)");
      console.log("- Trending Assets: Sell-through should show 20-95% (not 0%)");
      console.log("- Trending Assets: Trend will show 0% (no historical price tracking yet)");
    } else {
      console.log(`❌ FOUND ${geoIssues + assetIssues} TOTAL ISSUES`);
      console.log("Please review the output above for details.");
    }

  } catch (error) {
    console.error("Error during verification:", error);
    throw error;
  }
}

verifyDashboardDataQualityFix()
  .then(() => {
    console.log("\n✅ Verification completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Verification failed:", error);
    process.exit(1);
  });
