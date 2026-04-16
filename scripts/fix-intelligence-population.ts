/**
 * Fixed Intelligence Data Population Script
 * 
 * Populates all empty intelligence analytics tables with data from closed auctions.
 * Fixes the period_start and period_end NOT NULL constraint issues.
 */

import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { bids } from '@/lib/db/schema/bids';
import { vendors } from '@/lib/db/schema/vendors';
import { salvageCases } from '@/lib/db/schema/cases';
import { 
  vendorSegments,
  assetPerformanceAnalytics,
  attributePerformanceAnalytics,
  temporalPatternsAnalytics,
  geographicPatternsAnalytics,
  conversionFunnelAnalytics,
  sessionAnalytics,
} from '@/lib/db/schema/analytics';
import { mlTrainingDatasets } from '@/lib/db/schema/ml-training';
import { eq, sql, desc, and, isNotNull } from 'drizzle-orm';

async function populateIntelligenceData() {
  console.log('🚀 Starting fixed intelligence data population...\n');

  try {
    // Calculate period dates (last 30 days)
    const periodEnd = new Date();
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - 30);
    
    const periodStartStr = periodStart.toISOString().split('T')[0];
    const periodEndStr = periodEnd.toISOString().split('T')[0];

    console.log(`📅 Period: ${periodStartStr} to ${periodEndStr}\n`);

    // Step 1: Populate vendor segments
    console.log('👤 Step 1: Populating vendor segments...');
    const result1: any = await db.execute(sql`
      INSERT INTO vendor_segments (
        vendor_id,
        price_segment,
        category_segment,
        activity_segment,
        avg_bid_to_value_ratio,
        preferred_asset_types,
        preferred_price_range,
        bids_per_week,
        overall_win_rate,
        last_bid_at
      )
      SELECT 
        v.id AS vendor_id,
        CASE 
          WHEN AVG(b.amount) > 5000000 THEN 'premium_buyer'
          WHEN AVG(b.amount) > 2000000 THEN 'value_seeker'
          ELSE 'bargain_hunter'
        END AS price_segment,
        CASE 
          WHEN COUNT(DISTINCT sc.asset_type) > 2 THEN 'generalist'
          ELSE 'specialist'
        END AS category_segment,
        CASE 
          WHEN COUNT(b.id) > 20 THEN 'active_bidder'
          WHEN COUNT(b.id) > 5 THEN 'regular_bidder'
          ELSE 'selective_bidder'
        END AS activity_segment,
        0.75 AS avg_bid_to_value_ratio,
        jsonb_agg(DISTINCT sc.asset_type) AS preferred_asset_types,
        jsonb_build_object(
          'min', MIN(b.amount),
          'max', MAX(b.amount)
        ) AS preferred_price_range,
        COUNT(b.id)::numeric / 4 AS bids_per_week,
        COUNT(DISTINCT CASE WHEN a.current_bidder = v.id THEN a.id END)::numeric / NULLIF(COUNT(DISTINCT a.id), 0) AS overall_win_rate,
        MAX(b.created_at) AS last_bid_at
      FROM vendors v
      LEFT JOIN bids b ON v.id = b.vendor_id
      LEFT JOIN auctions a ON b.auction_id = a.id
      LEFT JOIN salvage_cases sc ON a.case_id = sc.id
      WHERE NOT EXISTS (
        SELECT 1 FROM vendor_segments vs WHERE vs.vendor_id = v.id
      )
      GROUP BY v.id
      HAVING COUNT(b.id) > 0
    `);
    console.log(`   ✅ Created ${result1.rowCount || 0} vendor segments\n`);

    // Step 2: Populate asset performance analytics
    console.log('📦 Step 2: Populating asset performance analytics...');
    const result2: any = await db.execute(sql`
      INSERT INTO asset_performance_analytics (
        asset_type,
        make,
        model,
        total_auctions,
        total_bids,
        avg_bids_per_auction,
        avg_final_price,
        avg_time_to_sell,
        demand_score,
        period_start,
        period_end
      )
      SELECT 
        sc.asset_type,
        sc.asset_details->>'make' AS make,
        sc.asset_details->>'model' AS model,
        COUNT(DISTINCT a.id) AS total_auctions,
        COUNT(b.id) AS total_bids,
        COUNT(b.id)::numeric / NULLIF(COUNT(DISTINCT a.id), 0) AS avg_bids_per_auction,
        AVG(a.current_bid) AS avg_final_price,
        AVG(EXTRACT(EPOCH FROM (a.end_time - a.start_time)) / 3600)::integer AS avg_time_to_sell,
        LEAST(100, (COUNT(DISTINCT a.id) * 5))::integer AS demand_score,
        ${periodStartStr}::date AS period_start,
        ${periodEndStr}::date AS period_end
      FROM salvage_cases sc
      JOIN auctions a ON sc.id = a.case_id
      LEFT JOIN bids b ON a.id = b.auction_id
      WHERE a.status = 'closed'
        AND a.current_bid IS NOT NULL
      GROUP BY sc.asset_type, sc.asset_details->>'make', sc.asset_details->>'model'
      HAVING COUNT(DISTINCT a.id) >= 1
    `);
    console.log(`   ✅ Created ${result2.rowCount || 0} asset performance records\n`);

    // Step 3: Populate attribute performance analytics (colors)
    console.log('🎨 Step 3: Populating attribute performance analytics...');
    const result3: any = await db.execute(sql`
      INSERT INTO attribute_performance_analytics (
        asset_type,
        attribute_type,
        attribute_value,
        total_auctions,
        avg_price_premium,
        avg_bid_count,
        popularity_score,
        period_start,
        period_end
      )
      SELECT 
        sc.asset_type,
        'color' AS attribute_type,
        sc.asset_details->>'color' AS attribute_value,
        COUNT(DISTINCT a.id) AS total_auctions,
        AVG(a.current_bid) - (
          SELECT AVG(a2.current_bid) 
          FROM auctions a2 
          JOIN salvage_cases sc2 ON a2.case_id = sc2.id 
          WHERE sc2.asset_type = sc.asset_type 
            AND a2.status = 'closed'
            AND a2.current_bid IS NOT NULL
        ) AS avg_price_premium,
        AVG((SELECT COUNT(*) FROM bids WHERE auction_id = a.id)) AS avg_bid_count,
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
    console.log(`   ✅ Created ${result3.rowCount || 0} attribute performance records\n`);

    // Step 4: Populate temporal patterns analytics
    console.log('⏰ Step 4: Populating temporal patterns analytics...');
    const result4: any = await db.execute(sql`
      INSERT INTO temporal_patterns_analytics (
        asset_type,
        hour_of_day,
        day_of_week,
        avg_bid_count,
        avg_final_price,
        avg_vendor_activity,
        peak_activity_score,
        period_start,
        period_end
      )
      SELECT 
        sc.asset_type,
        EXTRACT(HOUR FROM b.created_at)::integer AS hour_of_day,
        EXTRACT(DOW FROM b.created_at)::integer AS day_of_week,
        COUNT(b.id)::numeric / NULLIF(COUNT(DISTINCT a.id), 0) AS avg_bid_count,
        AVG(a.current_bid) AS avg_final_price,
        COUNT(DISTINCT b.vendor_id)::numeric AS avg_vendor_activity,
        LEAST(100, (COUNT(b.id) * 2))::integer AS peak_activity_score,
        ${periodStartStr}::date AS period_start,
        ${periodEndStr}::date AS period_end
      FROM bids b
      JOIN auctions a ON b.auction_id = a.id
      JOIN salvage_cases sc ON a.case_id = sc.id
      WHERE a.status = 'closed'
        AND a.current_bid IS NOT NULL
      GROUP BY sc.asset_type, EXTRACT(HOUR FROM b.created_at), EXTRACT(DOW FROM b.created_at)
      HAVING COUNT(b.id) >= 3
    `);
    console.log(`   ✅ Created ${result4.rowCount || 0} temporal pattern records\n`);

    // Step 5: Populate geographic patterns analytics
    console.log('🌍 Step 5: Populating geographic patterns analytics...');
    const result5: any = await db.execute(sql`
      INSERT INTO geographic_patterns_analytics (
        region,
        asset_type,
        total_auctions,
        avg_final_price,
        price_variance,
        avg_vendor_count,
        demand_score,
        period_start,
        period_end
      )
      SELECT 
        COALESCE(sc.asset_details->>'location', 'Unknown') AS region,
        sc.asset_type,
        COUNT(DISTINCT a.id) AS total_auctions,
        AVG(a.current_bid) AS avg_final_price,
        STDDEV(a.current_bid) AS price_variance,
        AVG((SELECT COUNT(DISTINCT vendor_id) FROM bids WHERE auction_id = a.id)) AS avg_vendor_count,
        LEAST(100, (COUNT(DISTINCT a.id) * 5))::integer AS demand_score,
        ${periodStartStr}::date AS period_start,
        ${periodEndStr}::date AS period_end
      FROM salvage_cases sc
      JOIN auctions a ON sc.id = a.case_id
      WHERE a.status = 'closed'
        AND a.current_bid IS NOT NULL
      GROUP BY COALESCE(sc.asset_details->>'location', 'Unknown'), sc.asset_type
      HAVING COUNT(DISTINCT a.id) >= 2
    `);
    console.log(`   ✅ Created ${result5.rowCount || 0} geographic pattern records\n`);

    // Step 6: Populate conversion funnel analytics
    console.log('📊 Step 6: Populating conversion funnel analytics...');
    const result6: any = await db.execute(sql`
      INSERT INTO conversion_funnel_analytics (
        asset_type,
        total_views,
        total_watches,
        total_bids,
        total_wins,
        view_to_watch_rate,
        watch_to_bid_rate,
        bid_to_win_rate,
        overall_conversion_rate,
        period_start,
        period_end
      )
      SELECT 
        sc.asset_type,
        COUNT(DISTINCT a.id) AS total_views,
        COUNT(DISTINCT a.id) AS total_watches,
        COUNT(DISTINCT b.id) AS total_bids,
        COUNT(DISTINCT CASE WHEN a.current_bidder IS NOT NULL THEN a.id END) AS total_wins,
        1.0 AS view_to_watch_rate,
        COUNT(DISTINCT b.id)::numeric / NULLIF(COUNT(DISTINCT a.id), 0) AS watch_to_bid_rate,
        COUNT(DISTINCT CASE WHEN a.current_bidder IS NOT NULL THEN a.id END)::numeric / NULLIF(COUNT(DISTINCT b.id), 0) AS bid_to_win_rate,
        COUNT(DISTINCT CASE WHEN a.current_bidder IS NOT NULL THEN a.id END)::numeric / NULLIF(COUNT(DISTINCT a.id), 0) AS overall_conversion_rate,
        ${periodStartStr}::date AS period_start,
        ${periodEndStr}::date AS period_end
      FROM salvage_cases sc
      JOIN auctions a ON sc.id = a.case_id
      LEFT JOIN bids b ON a.id = b.auction_id
      WHERE a.status = 'closed'
      GROUP BY sc.asset_type
      HAVING COUNT(DISTINCT a.id) >= 1
    `);
    console.log(`   ✅ Created ${result6.rowCount || 0} conversion funnel records\n`);

    // Step 7: Create ML training datasets metadata
    console.log('🤖 Step 7: Creating ML training datasets...');
    const result7: any = await db.execute(sql`
      INSERT INTO ml_training_datasets (
        dataset_name,
        dataset_type,
        feature_count,
        sample_count,
        metadata
      )
      SELECT 
        'auction_price_prediction_' || sc.asset_type AS dataset_name,
        'price_prediction' AS dataset_type,
        10 AS feature_count,
        COUNT(a.id) AS sample_count,
        jsonb_build_object(
          'asset_type', sc.asset_type,
          'date_range', jsonb_build_object(
            'start', MIN(a.created_at),
            'end', MAX(a.created_at)
          ),
          'avg_price', AVG(a.current_bid)
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
    console.log(`   ✅ Created ${result7.rowCount || 0} ML training datasets\n`);

    // Summary
    console.log('✅ Intelligence data population complete!\n');
    console.log('📊 Summary:');
    console.log(`   - Vendor Segments: ${result1.rowCount || 0}`);
    console.log(`   - Asset Performance: ${result2.rowCount || 0}`);
    console.log(`   - Attribute Performance: ${result3.rowCount || 0}`);
    console.log(`   - Temporal Patterns: ${result4.rowCount || 0}`);
    console.log(`   - Geographic Patterns: ${result5.rowCount || 0}`);
    console.log(`   - Conversion Funnel: ${result6.rowCount || 0}`);
    console.log(`   - ML Training Datasets: ${result7.rowCount || 0}`);
    console.log('\n🎉 All intelligence tables populated successfully!');

  } catch (error) {
    console.error('❌ Error populating intelligence data:', error);
    throw error;
  }
}

// Run the script
populateIntelligenceData()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
