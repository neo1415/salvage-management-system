/**
 * Populate Empty Intelligence Tables
 * 
 * Simple script to populate only the empty intelligence tables with sample data.
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function populateEmptyTables() {
  console.log('🚀 Populating empty intelligence tables...\n');

  try {
    // Calculate period dates (last 30 days)
    const periodEnd = new Date();
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - 30);
    
    const periodStartStr = periodStart.toISOString().split('T')[0];
    const periodEndStr = periodEnd.toISOString().split('T')[0];

    console.log(`📅 Period: ${periodStartStr} to ${periodEndStr}\n`);

    // Step 1: Asset Performance Analytics
    console.log('📦 Step 1: Asset Performance Analytics...');
    const result1: any = await db.execute(sql`
      INSERT INTO asset_performance_analytics (
        asset_type, make, model, total_auctions, total_bids,
        avg_bids_per_auction, avg_final_price, avg_time_to_sell,
        demand_score, period_start, period_end
      )
      SELECT 
        sc.asset_type,
        sc.asset_details->>'make' AS make,
        sc.asset_details->>'model' AS model,
        COUNT(DISTINCT a.id)::integer AS total_auctions,
        COUNT(b.id)::integer AS total_bids,
        (COUNT(b.id)::numeric / NULLIF(COUNT(DISTINCT a.id), 0))::numeric(8,2) AS avg_bids_per_auction,
        AVG(CAST(a.current_bid AS numeric))::numeric(12,2) AS avg_final_price,
        AVG(EXTRACT(EPOCH FROM (a.end_time - a.start_time)) / 3600)::integer AS avg_time_to_sell,
        LEAST(100, (COUNT(DISTINCT a.id) * 5))::integer AS demand_score,
        ${periodStartStr}::date AS period_start,
        ${periodEndStr}::date AS period_end
      FROM salvage_cases sc
      JOIN auctions a ON sc.id = a.case_id
      LEFT JOIN bids b ON a.id = b.auction_id
      WHERE a.status = 'closed' AND a.current_bid IS NOT NULL
      GROUP BY sc.asset_type, sc.asset_details->>'make', sc.asset_details->>'model'
      HAVING COUNT(DISTINCT a.id) >= 1
    `);
    console.log(`   ✅ Created ${result1.rowCount || 0} records\n`);

    // Step 2: Attribute Performance Analytics
    console.log('🎨 Step 2: Attribute Performance Analytics...');
    const result2: any = await db.execute(sql`
      INSERT INTO attribute_performance_analytics (
        asset_type, attribute_type, attribute_value, total_auctions,
        avg_price_premium, avg_bid_count, popularity_score,
        period_start, period_end
      )
      SELECT 
        sc.asset_type,
        'color' AS attribute_type,
        sc.asset_details->>'color' AS attribute_value,
        COUNT(DISTINCT a.id)::integer AS total_auctions,
        0::numeric(12,2) AS avg_price_premium,
        AVG((SELECT COUNT(*) FROM bids WHERE auction_id = a.id))::numeric(8,2) AS avg_bid_count,
        LEAST(100, (COUNT(DISTINCT a.id) * 10))::integer AS popularity_score,
        ${periodStartStr}::date AS period_start,
        ${periodEndStr}::date AS period_end
      FROM salvage_cases sc
      JOIN auctions a ON sc.id = a.case_id
      WHERE a.status = 'closed' 
        AND a.current_bid IS NOT NULL
        AND sc.asset_details->>'color' IS NOT NULL
      GROUP BY sc.asset_type, sc.asset_details->>'color'
      HAVING COUNT(DISTINCT a.id) >= 2
    `);
    console.log(`   ✅ Created ${result2.rowCount || 0} records\n`);

    // Step 3: Temporal Patterns Analytics
    console.log('⏰ Step 3: Temporal Patterns Analytics...');
    const result3: any = await db.execute(sql`
      INSERT INTO temporal_patterns_analytics (
        asset_type, hour_of_day, day_of_week, avg_bid_count,
        avg_final_price, avg_vendor_activity, peak_activity_score,
        period_start, period_end
      )
      SELECT 
        sc.asset_type,
        EXTRACT(HOUR FROM b.created_at)::integer AS hour_of_day,
        EXTRACT(DOW FROM b.created_at)::integer AS day_of_week,
        (COUNT(b.id)::numeric / NULLIF(COUNT(DISTINCT a.id), 0))::numeric(8,2) AS avg_bid_count,
        AVG(CAST(a.current_bid AS numeric))::numeric(12,2) AS avg_final_price,
        COUNT(DISTINCT b.vendor_id)::numeric(8,2) AS avg_vendor_activity,
        LEAST(100, (COUNT(b.id) * 2))::integer AS peak_activity_score,
        ${periodStartStr}::date AS period_start,
        ${periodEndStr}::date AS period_end
      FROM bids b
      JOIN auctions a ON b.auction_id = a.id
      JOIN salvage_cases sc ON a.case_id = sc.id
      WHERE a.status = 'closed' AND a.current_bid IS NOT NULL
      GROUP BY sc.asset_type, EXTRACT(HOUR FROM b.created_at), EXTRACT(DOW FROM b.created_at)
      HAVING COUNT(b.id) >= 3
    `);
    console.log(`   ✅ Created ${result3.rowCount || 0} records\n`);

    // Step 4: Geographic Patterns Analytics
    console.log('🌍 Step 4: Geographic Patterns Analytics...');
    const result4: any = await db.execute(sql`
      INSERT INTO geographic_patterns_analytics (
        region, asset_type, total_auctions, avg_final_price,
        price_variance, avg_vendor_count, demand_score,
        period_start, period_end
      )
      SELECT 
        COALESCE(sc.asset_details->>'location', 'Nigeria') AS region,
        sc.asset_type,
        COUNT(DISTINCT a.id)::integer AS total_auctions,
        AVG(CAST(a.current_bid AS numeric))::numeric(12,2) AS avg_final_price,
        COALESCE(STDDEV(CAST(a.current_bid AS numeric)), 0)::numeric(12,2) AS price_variance,
        AVG((SELECT COUNT(DISTINCT vendor_id) FROM bids WHERE auction_id = a.id))::numeric(8,2) AS avg_vendor_count,
        LEAST(100, (COUNT(DISTINCT a.id) * 5))::integer AS demand_score,
        ${periodStartStr}::date AS period_start,
        ${periodEndStr}::date AS period_end
      FROM salvage_cases sc
      JOIN auctions a ON sc.id = a.case_id
      WHERE a.status = 'closed' AND a.current_bid IS NOT NULL
      GROUP BY COALESCE(sc.asset_details->>'location', 'Nigeria'), sc.asset_type
      HAVING COUNT(DISTINCT a.id) >= 2
    `);
    console.log(`   ✅ Created ${result4.rowCount || 0} records\n`);

    // Step 5: Conversion Funnel Analytics
    console.log('📊 Step 5: Conversion Funnel Analytics...');
    const result5: any = await db.execute(sql`
      INSERT INTO conversion_funnel_analytics (
        asset_type, total_views, total_watches, total_bids, total_wins,
        view_to_watch_rate, watch_to_bid_rate, bid_to_win_rate,
        overall_conversion_rate, period_start, period_end
      )
      SELECT 
        sc.asset_type,
        COUNT(DISTINCT a.id)::integer AS total_views,
        COUNT(DISTINCT a.id)::integer AS total_watches,
        COUNT(DISTINCT b.id)::integer AS total_bids,
        COUNT(DISTINCT CASE WHEN a.current_bidder IS NOT NULL THEN a.id END)::integer AS total_wins,
        1.0::numeric(5,4) AS view_to_watch_rate,
        (COUNT(DISTINCT b.id)::numeric / NULLIF(COUNT(DISTINCT a.id), 0))::numeric(5,4) AS watch_to_bid_rate,
        (COUNT(DISTINCT CASE WHEN a.current_bidder IS NOT NULL THEN a.id END)::numeric / NULLIF(COUNT(DISTINCT b.id), 0))::numeric(5,4) AS bid_to_win_rate,
        (COUNT(DISTINCT CASE WHEN a.current_bidder IS NOT NULL THEN a.id END)::numeric / NULLIF(COUNT(DISTINCT a.id), 0))::numeric(5,4) AS overall_conversion_rate,
        ${periodStartStr}::date AS period_start,
        ${periodEndStr}::date AS period_end
      FROM salvage_cases sc
      JOIN auctions a ON sc.id = a.case_id
      LEFT JOIN bids b ON a.id = b.auction_id
      WHERE a.status = 'closed'
      GROUP BY sc.asset_type
      HAVING COUNT(DISTINCT a.id) >= 1
    `);
    console.log(`   ✅ Created ${result5.rowCount || 0} records\n`);

    // Step 6: ML Training Datasets
    console.log('🤖 Step 6: ML Training Datasets...');
    const dateRangeStart = new Date();
    dateRangeStart.setDate(dateRangeStart.getDate() - 90);
    const dateRangeEnd = new Date();
    
    const result6: any = await db.execute(sql`
      INSERT INTO ml_training_datasets (
        dataset_type, dataset_name, format, record_count, feature_count,
        date_range_start, date_range_end, metadata
      )
      SELECT 
        'price_prediction'::dataset_type AS dataset_type,
        'auction_price_prediction_' || sc.asset_type AS dataset_name,
        'json'::dataset_format AS format,
        COUNT(a.id)::integer AS record_count,
        10 AS feature_count,
        ${dateRangeStart.toISOString()}::timestamp AS date_range_start,
        ${dateRangeEnd.toISOString()}::timestamp AS date_range_end,
        jsonb_build_object(
          'description', 'Historical auction data for ' || sc.asset_type,
          'version', 'v1.0',
          'anonymized', true,
          'filters', jsonb_build_object('asset_type', sc.asset_type)
        ) AS metadata
      FROM salvage_cases sc
      JOIN auctions a ON sc.id = a.case_id
      WHERE a.status = 'closed'
        AND a.current_bid IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM ml_training_datasets 
          WHERE dataset_name = 'auction_price_prediction_' || sc.asset_type
        )
      GROUP BY sc.asset_type
      HAVING COUNT(a.id) >= 10
    `);
    console.log(`   ✅ Created ${result6.rowCount || 0} records\n`);

    // Summary
    console.log('✅ Population complete!\n');
    console.log('📊 Summary:');
    console.log(`   - Asset Performance: ${result1.rowCount || 0}`);
    console.log(`   - Attribute Performance: ${result2.rowCount || 0}`);
    console.log(`   - Temporal Patterns: ${result3.rowCount || 0}`);
    console.log(`   - Geographic Patterns: ${result4.rowCount || 0}`);
    console.log(`   - Conversion Funnel: ${result5.rowCount || 0}`);
    console.log(`   - ML Training Datasets: ${result6.rowCount || 0}`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

populateEmptyTables()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
