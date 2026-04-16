/**
 * Simple Intelligence Data Population Script
 * 
 * Populates intelligence tables using correct table names:
 * - predictions (already populated)
 * - interactions (from bids)
 * - vendor_segments (from vendor bidding patterns)
 * - asset_performance_analytics (from closed auctions)
 * 
 * Run with: npx tsx scripts/simple-intelligence-population.ts
 */

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

async function populateInteractions() {
  console.log('\n👥 Populating interactions from bids...');
  
  const result: any = await db.execute(sql`
    INSERT INTO interactions (
      vendor_id,
      auction_id,
      interaction_type,
      interaction_data,
      created_at
    )
    SELECT 
      b.vendor_id,
      b.auction_id,
      'bid' AS interaction_type,
      jsonb_build_object(
        'bid_amount', b.amount,
        'bid_rank', (
          SELECT COUNT(*) + 1 
          FROM bids b2 
          WHERE b2.auction_id = b.auction_id 
            AND b2.amount > b.amount
        ),
        'is_winning', (a.current_bidder = b.vendor_id),
        'asset_type', sc.asset_type
      ) AS interaction_data,
      b.created_at
    FROM bids b
    JOIN auctions a ON b.auction_id = a.id
    JOIN salvage_cases sc ON a.case_id = sc.id
    WHERE NOT EXISTS (
      SELECT 1 FROM interactions i 
      WHERE i.vendor_id = b.vendor_id 
        AND i.auction_id = b.auction_id
        AND i.interaction_type = 'bid'
        AND i.created_at = b.created_at
    )
    LIMIT 1000
  `);
  
  console.log(`✅ Created ${result.rowCount || 0} interactions`);
}

async function populateVendorSegments() {
  console.log('\n📈 Populating vendor segments from bidding patterns...');
  
  const result: any = await db.execute(sql`
    INSERT INTO vendor_segments (
      vendor_id,
      segment_name,
      total_bids,
      total_wins,
      win_rate,
      avg_bid_amount,
      preferred_asset_types,
      risk_score,
      engagement_score,
      last_updated
    )
    SELECT 
      v.id AS vendor_id,
      CASE 
        WHEN COALESCE(bid_stats.avg_bid, 0) > 500000 THEN 'High Value'
        WHEN COALESCE(bid_stats.avg_bid, 0) > 200000 THEN 'Medium Value'
        ELSE 'Entry Level'
      END AS segment_name,
      COALESCE(bid_stats.total_bids, 0) AS total_bids,
      COALESCE(bid_stats.total_wins, 0) AS total_wins,
      CASE 
        WHEN COALESCE(bid_stats.total_bids, 0) > 0 
        THEN COALESCE(bid_stats.total_wins, 0)::float / bid_stats.total_bids 
        ELSE 0 
      END AS win_rate,
      COALESCE(bid_stats.avg_bid, 0) AS avg_bid_amount,
      COALESCE(bid_stats.asset_types, '[]'::jsonb) AS preferred_asset_types,
      CASE 
        WHEN COALESCE(bid_stats.avg_bid, 0) > 500000 THEN 0.8
        WHEN COALESCE(bid_stats.avg_bid, 0) > 200000 THEN 0.5
        ELSE 0.2
      END AS risk_score,
      CASE 
        WHEN COALESCE(bid_stats.total_bids, 0) > 20 THEN 0.9
        WHEN COALESCE(bid_stats.total_bids, 0) > 10 THEN 0.7
        WHEN COALESCE(bid_stats.total_bids, 0) > 5 THEN 0.5
        ELSE 0.3
      END AS engagement_score,
      NOW() AS last_updated
    FROM vendors v
    LEFT JOIN (
      SELECT 
        b.vendor_id,
        COUNT(DISTINCT b.id) AS total_bids,
        COUNT(DISTINCT CASE WHEN a.current_bidder = b.vendor_id THEN a.id END) AS total_wins,
        AVG(b.amount) AS avg_bid,
        jsonb_agg(DISTINCT sc.asset_type) FILTER (WHERE sc.asset_type IS NOT NULL) AS asset_types
      FROM bids b
      JOIN auctions a ON b.auction_id = a.id
      JOIN salvage_cases sc ON a.case_id = sc.id
      GROUP BY b.vendor_id
    ) bid_stats ON v.id = bid_stats.vendor_id
    WHERE NOT EXISTS (
      SELECT 1 FROM vendor_segments vs WHERE vs.vendor_id = v.id
    )
    AND bid_stats.total_bids IS NOT NULL
  `);
  
  console.log(`✅ Created ${result.rowCount || 0} vendor segments`);
}

async function populateAssetPerformance() {
  console.log('\n🚗 Populating asset performance analytics from closed auctions...');
  
  const result: any = await db.execute(sql`
    INSERT INTO asset_performance_analytics (
      asset_type,
      asset_identifier,
      total_auctions,
      avg_final_price,
      avg_bid_count,
      avg_time_to_close_hours,
      performance_score,
      last_updated
    )
    SELECT 
      sc.asset_type,
      COALESCE(
        sc.asset_details->>'make' || ' ' || sc.asset_details->>'model',
        sc.asset_details->>'brand' || ' ' || sc.asset_details->>'category',
        'Unknown'
      ) AS asset_identifier,
      COUNT(a.id) AS total_auctions,
      AVG(a.current_bid) AS avg_final_price,
      AVG((SELECT COUNT(*) FROM bids WHERE auction_id = a.id)) AS avg_bid_count,
      AVG(EXTRACT(EPOCH FROM (a.end_time - a.start_time)) / 3600) AS avg_time_to_close_hours,
      CASE 
        WHEN AVG(a.current_bid) > 500000 THEN 0.9
        WHEN AVG(a.current_bid) > 200000 THEN 0.7
        ELSE 0.5
      END AS performance_score,
      NOW() AS last_updated
    FROM auctions a
    JOIN salvage_cases sc ON a.case_id = sc.id
    WHERE a.status = 'closed'
      AND a.current_bid IS NOT NULL
      AND a.current_bid > 0
    GROUP BY 
      sc.asset_type,
      COALESCE(
        sc.asset_details->>'make' || ' ' || sc.asset_details->>'model',
        sc.asset_details->>'brand' || ' ' || sc.asset_details->>'category',
        'Unknown'
      )
    HAVING COUNT(a.id) >= 1
  `);
  
  console.log(`✅ Created ${result.rowCount || 0} asset performance records`);
}

async function main() {
  console.log('🚀 Starting simple intelligence data population...\n');
  
  try {
    // Populate in order
    await populateInteractions();
    await populateVendorSegments();
    await populateAssetPerformance();
    
    console.log('\n✅ All intelligence data populated successfully!');
    console.log('\n📊 Summary:');
    
    // Get counts
    const predictionCount: any = await db.execute(sql`SELECT COUNT(*) as count FROM predictions`);
    const interactionCount: any = await db.execute(sql`SELECT COUNT(*) as count FROM interactions`);
    const segmentCount: any = await db.execute(sql`SELECT COUNT(*) as count FROM vendor_segments`);
    const assetCount: any = await db.execute(sql`SELECT COUNT(*) as count FROM asset_performance_analytics`);
    
    console.log(`  - Predictions: ${predictionCount[0]?.count || 0}`);
    console.log(`  - Interactions: ${interactionCount[0]?.count || 0}`);
    console.log(`  - Vendor Segments: ${segmentCount[0]?.count || 0}`);
    console.log(`  - Asset Performance: ${assetCount[0]?.count || 0}`);
    
  } catch (error) {
    console.error('❌ Error populating intelligence data:', error);
    throw error;
  }
}

main()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
