/**
 * Verify Intelligence Dashboard Data
 * 
 * Test queries that the dashboards use to ensure data will display.
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function verifyDashboards() {
  console.log('🔍 Verifying Intelligence Dashboard Data...\n');

  try {
    // 1. Vendor Market Insights - Trending Assets
    console.log('1️⃣  Trending Assets (Vendor Market Insights):');
    const trendingAssets: any = await db.execute(sql`
      SELECT 
        asset_type,
        make,
        model,
        total_auctions,
        avg_final_price,
        demand_score
      FROM asset_performance_analytics
      ORDER BY demand_score DESC
      LIMIT 5
    `);
    console.log(`   Found ${trendingAssets.length} trending assets`);
    if (trendingAssets.length > 0) {
      console.log(`   Sample: ${trendingAssets[0].make} ${trendingAssets[0].model} - Demand: ${trendingAssets[0].demand_score}`);
    }
    console.log();

    // 2. Best Time to Bid (Temporal Patterns)
    console.log('2️⃣  Best Time to Bid (Temporal Patterns):');
    const temporalPatterns: any = await db.execute(sql`
      SELECT 
        hour_of_day,
        day_of_week,
        peak_activity_score,
        avg_final_price
      FROM temporal_patterns_analytics
      ORDER BY peak_activity_score DESC
      LIMIT 5
    `);
    console.log(`   Found ${temporalPatterns.length} temporal patterns`);
    if (temporalPatterns.length > 0) {
      console.log(`   Peak: Hour ${temporalPatterns[0].hour_of_day}, Day ${temporalPatterns[0].day_of_week} - Score: ${temporalPatterns[0].peak_activity_score}`);
    }
    console.log();

    // 3. Regional Insights (Geographic Patterns)
    console.log('3️⃣  Regional Insights (Geographic Patterns):');
    const geoPatterns: any = await db.execute(sql`
      SELECT 
        region,
        asset_type,
        total_auctions,
        avg_final_price,
        demand_score
      FROM geographic_patterns_analytics
      ORDER BY demand_score DESC
      LIMIT 5
    `);
    console.log(`   Found ${geoPatterns.length} geographic patterns`);
    if (geoPatterns.length > 0) {
      console.log(`   Top Region: ${geoPatterns[0].region} - Demand: ${geoPatterns[0].demand_score}`);
    }
    console.log();

    // 4. Admin Intelligence - ML Datasets
    console.log('4️⃣  ML Training Datasets (Admin Intelligence):');
    const mlDatasets: any = await db.execute(sql`
      SELECT 
        dataset_name,
        dataset_type,
        record_count,
        feature_count
      FROM ml_training_datasets
      LIMIT 5
    `);
    console.log(`   Found ${mlDatasets.length} ML datasets`);
    if (mlDatasets.length > 0) {
      console.log(`   Sample: ${mlDatasets[0].dataset_name} - ${mlDatasets[0].record_count} records`);
    }
    console.log();

    // 5. Vendor Segments
    console.log('5️⃣  Vendor Segments (Admin Intelligence):');
    const vendorSegments: any = await db.execute(sql`
      SELECT 
        activity_segment,
        COUNT(*) as count
      FROM vendor_segments
      GROUP BY activity_segment
      ORDER BY count DESC
    `);
    console.log(`   Found ${vendorSegments.length} segment types`);
    vendorSegments.forEach((seg: any) => {
      console.log(`   - ${seg.activity_segment}: ${seg.count} vendors`);
    });
    console.log();

    // 6. Conversion Funnel
    console.log('6️⃣  Conversion Funnel (Admin Analytics):');
    const conversionFunnel: any = await db.execute(sql`
      SELECT 
        asset_type,
        total_views,
        total_bids,
        total_wins,
        overall_conversion_rate
      FROM conversion_funnel_analytics
      LIMIT 5
    `);
    console.log(`   Found ${conversionFunnel.length} conversion funnels`);
    if (conversionFunnel.length > 0) {
      console.log(`   Sample: ${conversionFunnel[0].asset_type} - ${conversionFunnel[0].total_views} views, ${conversionFunnel[0].total_wins} wins`);
    }
    console.log();

    // 7. Attribute Performance (Colors)
    console.log('7️⃣  Attribute Performance (Colors):');
    const attributes: any = await db.execute(sql`
      SELECT 
        attribute_value as color,
        total_auctions,
        popularity_score
      FROM attribute_performance_analytics
      WHERE attribute_type = 'color'
      ORDER BY popularity_score DESC
      LIMIT 5
    `);
    console.log(`   Found ${attributes.length} color attributes`);
    if (attributes.length > 0) {
      console.log(`   Most Popular: ${attributes[0].color} - Score: ${attributes[0].popularity_score}`);
    }
    console.log();

    // Summary
    console.log('✅ Dashboard Data Verification Complete!\n');
    console.log('📊 Summary:');
    console.log(`   ✅ Trending Assets: ${trendingAssets.length > 0 ? 'Available' : 'Empty'}`);
    console.log(`   ✅ Temporal Patterns: ${temporalPatterns.length > 0 ? 'Available' : 'Empty'}`);
    console.log(`   ✅ Geographic Patterns: ${geoPatterns.length > 0 ? 'Available' : 'Empty'}`);
    console.log(`   ✅ ML Datasets: ${mlDatasets.length > 0 ? 'Available' : 'Empty'}`);
    console.log(`   ✅ Vendor Segments: ${vendorSegments.length > 0 ? 'Available' : 'Empty'}`);
    console.log(`   ✅ Conversion Funnel: ${conversionFunnel.length > 0 ? 'Available' : 'Empty'}`);
    console.log(`   ✅ Attribute Performance: ${attributes.length > 0 ? 'Available' : 'Empty'}`);

    const allAvailable = 
      trendingAssets.length > 0 &&
      temporalPatterns.length > 0 &&
      geoPatterns.length > 0 &&
      mlDatasets.length > 0 &&
      vendorSegments.length > 0 &&
      conversionFunnel.length > 0 &&
      attributes.length > 0;

    if (allAvailable) {
      console.log('\n🎉 All dashboard sections have data! Dashboards should now display properly.');
    } else {
      console.log('\n⚠️  Some sections are still empty. Check the queries above.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

verifyDashboards()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
