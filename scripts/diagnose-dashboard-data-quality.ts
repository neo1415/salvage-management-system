import { db } from "@/lib/db";
import { 
  assetPerformanceAnalytics,
  geographicPatternsAnalytics 
} from "@/lib/db/schema/analytics";
import { sql } from "drizzle-orm";

async function diagnoseDashboardDataQuality() {
  console.log("=== DASHBOARD DATA QUALITY DIAGNOSTIC ===\n");

  try {
    // 1. Check Geographic Patterns - demandScore and priceVariance
    console.log("1. GEOGRAPHIC PATTERNS - Checking demandScore and priceVariance:");
    console.log("=" .repeat(70));
    
    const geoPatterns = await db
      .select({
        region: geographicPatternsAnalytics.region,
        demandScore: geographicPatternsAnalytics.demandScore,
        priceVariance: geographicPatternsAnalytics.priceVariance,
        avgFinalPrice: geographicPatternsAnalytics.avgFinalPrice,
        totalAuctions: geographicPatternsAnalytics.totalAuctions,
      })
      .from(geographicPatternsAnalytics)
      .limit(10);

    if (geoPatterns.length === 0) {
      console.log("❌ NO DATA in geographic_patterns table");
    } else {
      console.log(`✅ Found ${geoPatterns.length} records\n`);
      geoPatterns.forEach((row, idx) => {
        console.log(`Record ${idx + 1}:`);
        console.log(`  Region: ${row.region}`);
        console.log(`  Demand Score: ${row.demandScore} (type: ${typeof row.demandScore})`);
        console.log(`  Price Variance: ${row.priceVariance} (type: ${typeof row.priceVariance})`);
        console.log(`  Avg Final Price: ${row.avgFinalPrice}`);
        console.log(`  Total Auctions: ${row.totalAuctions}`);
        console.log("");
      });
    }

    // 2. Check Asset Performance Analytics - price_change_percent and avg_sell_through_rate
    console.log("\n2. ASSET PERFORMANCE ANALYTICS - Checking price_change_percent and avg_sell_through_rate:");
    console.log("=" .repeat(70));
    
    const assetPerf = await db
      .select({
        assetType: assetPerformanceAnalytics.assetType,
        make: assetPerformanceAnalytics.make,
        model: assetPerformanceAnalytics.model,
        avgSellThroughRate: assetPerformanceAnalytics.avgSellThroughRate,
        avgFinalPrice: assetPerformanceAnalytics.avgFinalPrice,
        totalAuctions: assetPerformanceAnalytics.totalAuctions,
        demandScore: assetPerformanceAnalytics.demandScore,
      })
      .from(assetPerformanceAnalytics)
      .limit(10);

    if (assetPerf.length === 0) {
      console.log("❌ NO DATA in asset_performance_analytics table");
    } else {
      console.log(`✅ Found ${assetPerf.length} records\n`);
      assetPerf.forEach((row, idx) => {
        console.log(`Record ${idx + 1}:`);
        console.log(`  Asset Type: ${row.assetType}`);
        console.log(`  Make: ${row.make}`);
        console.log(`  Model: ${row.model}`);
        console.log(`  Sell-Through Rate: ${row.avgSellThroughRate} (type: ${typeof row.avgSellThroughRate})`);
        console.log(`  Avg Final Price: ${row.avgFinalPrice}`);
        console.log(`  Total Auctions: ${row.totalAuctions}`);
        console.log(`  Demand Score: ${row.demandScore}`);
        console.log("");
      });
    }

    // 3. Check for NULL values
    console.log("\n3. NULL VALUE ANALYSIS:");
    console.log("=" .repeat(70));
    
    const nullCheckGeo = await db.execute(sql`
      SELECT 
        COUNT(*) as total_records,
        COUNT(demand_score) as demand_score_count,
        COUNT(price_variance) as price_variance_count,
        COUNT(*) - COUNT(demand_score) as demand_score_nulls,
        COUNT(*) - COUNT(price_variance) as price_variance_nulls
      FROM geographic_patterns_analytics
    `);
    
    console.log("Geographic Patterns NULL Analysis:");
    console.log(nullCheckGeo.rows[0]);

    const nullCheckAsset = await db.execute(sql`
      SELECT 
        COUNT(*) as total_records,
        COUNT(avg_sell_through_rate) as sell_through_count,
        COUNT(*) - COUNT(avg_sell_through_rate) as sell_through_nulls,
        COUNT(demand_score) as demand_score_count,
        COUNT(*) - COUNT(demand_score) as demand_score_nulls
      FROM asset_performance_analytics
    `);
    
    console.log("\nAsset Performance Analytics NULL Analysis:");
    console.log(nullCheckAsset.rows[0]);

    // 4. Check actual value ranges
    console.log("\n4. VALUE RANGE ANALYSIS:");
    console.log("=" .repeat(70));
    
    const geoRanges = await db.execute(sql`
      SELECT 
        MIN(demand_score) as min_demand,
        MAX(demand_score) as max_demand,
        AVG(demand_score) as avg_demand,
        MIN(price_variance) as min_variance,
        MAX(price_variance) as max_variance,
        AVG(price_variance) as avg_variance
      FROM geographic_patterns_analytics
      WHERE demand_score IS NOT NULL
    `);
    
    console.log("Geographic Patterns Value Ranges:");
    console.log(geoRanges.rows[0]);

    const assetRanges = await db.execute(sql`
      SELECT 
        MIN(avg_sell_through_rate) as min_sell_through,
        MAX(avg_sell_through_rate) as max_sell_through,
        AVG(avg_sell_through_rate) as avg_sell_through,
        MIN(demand_score) as min_demand,
        MAX(demand_score) as max_demand,
        AVG(demand_score) as avg_demand
      FROM asset_performance_analytics
      WHERE avg_sell_through_rate IS NOT NULL
    `);
    
    console.log("\nAsset Performance Analytics Value Ranges:");
    console.log(assetRanges.rows[0]);

    console.log("\n=== DIAGNOSTIC COMPLETE ===");
    console.log("\nNEXT STEPS:");
    console.log("1. If demandScore is 0-100 but UI shows 10000%, the API is multiplying by 100 again");
    console.log("2. If priceVariance is huge numbers, it needs normalization");
    console.log("3. If avg_sell_through_rate is NULL, we need to populate it");
    console.log("4. Check the trending assets API to see if it's using the right fields");

  } catch (error) {
    console.error("Error during diagnostic:", error);
    throw error;
  }
}

diagnoseDashboardDataQuality()
  .then(() => {
    console.log("\n✅ Diagnostic completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Diagnostic failed:", error);
    process.exit(1);
  });
