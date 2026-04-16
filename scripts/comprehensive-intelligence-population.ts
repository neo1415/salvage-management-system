/**
 * Comprehensive Intelligence Data Population Script
 * 
 * This script populates ALL intelligence tables from existing database records:
 * - predictions (from closed auctions with winning bids)
 * - vendor_interactions (from bids)
 * - vendor_profiles (from vendor bidding patterns)
 * - asset_performance (from closed auctions)
 * 
 * Run with: npx tsx scripts/comprehensive-intelligence-population.ts
 */

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { 
  predictions, 
  vendorInteractions, 
  vendorProfiles, 
  assetPerformance 
} from '@/lib/db/schema/intelligence';
import { auctions, bids, salvageCases, vendors } from '@/lib/db/schema';

async function populatePredictions() {
  console.log('\n📊 Populating predictions from closed auctions...');
  
  const result: any = await db.execute(sql`
    INSERT INTO predictions (
      auction_id,
      predicted_price,
      lower_bound,
      upper_bound,
      confidence_score,
      confidence_level,
      method,
      sample_size,
      metadata,
      algorithm_version,
      created_at
    )
    SELECT 
      a.id AS auction_id,
      a.current_bid AS predicted_price,
      a.current_bid * 0.85 AS lower_bound,
      a.current_bid * 1.15 AS upper_bound,
      0.75 AS confidence_score,
      'Medium' AS confidence_level,
      'historical' AS method,
      (SELECT COUNT(*) FROM bids WHERE auction_id = a.id) AS sample_size,
      jsonb_build_object(
        'asset_type', sc.asset_type,
        'damage_severity', sc.damage_severity,
        'market_value', sc.market_value,
        'bid_count', (SELECT COUNT(*) FROM bids WHERE auction_id = a.id)
      ) AS metadata,
      '1.0.0' AS algorithm_version,
      a.end_time AS created_at
    FROM auctions a
    JOIN salvage_cases sc ON a.case_id = sc.id
    WHERE a.status = 'closed'
      AND a.current_bid IS NOT NULL
      AND a.current_bid > 0
      AND NOT EXISTS (
        SELECT 1 FROM predictions p WHERE p.auction_id = a.id
      )
  `);
  
  console.log(`✅ Created ${result.rowCount || 0} predictions`);
}

async function populateVendorInteractions() {
  console.log('\n👥 Populating vendor interactions from bids...');
  
  const result: any = await db.execute(sql`
    INSERT INTO vendor_interactions (
      vendor_id,
      auction_id,
      interaction_type,
      interaction_data,
      created_at
    )
    SELECT 
      b.vendor_id,
      b.auction_id,
      'bid_placed' AS interaction_type,
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
      SELECT 1 FROM vendor_interactions vi 
      WHERE vi.vendor_id = b.vendor_id 
        AND vi.auction_id = b.auction_id
        AND vi.interaction_type = 'bid_placed'
        AND vi.created_at = b.created_at
    )
  `);
  
  console.log(`✅ Created ${result.rowCount || 0} vendor interactions`);
}

async function populateVendorProfiles() {
  console.log('\n📈 Populating vendor profiles from bidding patterns...');
  
  const result: any = await db.execute(sql`
    INSERT INTO vendor_profiles (
      vendor_id,
      total_bids,
      total_wins,
      win_rate,
      avg_bid_amount,
      preferred_asset_types,
      bidding_pattern,
      risk_profile,
      last_updated
    )
    SELECT 
      v.id AS vendor_id,
      COALESCE(bid_stats.total_bids, 0) AS total_bids,
      COALESCE(bid_stats.total_wins, 0) AS total_wins,
      CASE 
        WHEN COALESCE(bid_stats.total_bids, 0) > 0 
        THEN COALESCE(bid_stats.total_wins, 0)::float / bid_stats.total_bids 
        ELSE 0 
      END AS win_rate,
      COALESCE(bid_stats.avg_bid, 0) AS avg_bid_amount,
      COALESCE(bid_stats.asset_types, '[]'::jsonb) AS preferred_asset_types,
      jsonb_build_object(
        'avg_bids_per_auction', COALESCE(bid_stats.avg_bids_per_auction, 0),
        'bid_frequency', 'regular',
        'typical_bid_timing', 'mid_auction'
      ) AS bidding_pattern,
      CASE 
        WHEN COALESCE(bid_stats.avg_bid, 0) > 500000 THEN 'high'
        WHEN COALESCE(bid_stats.avg_bid, 0) > 200000 THEN 'medium'
        ELSE 'low'
      END AS risk_profile,
      NOW() AS last_updated
    FROM vendors v
    LEFT JOIN (
      SELECT 
        b.vendor_id,
        COUNT(DISTINCT b.id) AS total_bids,
        COUNT(DISTINCT CASE WHEN a.current_bidder = b.vendor_id THEN a.id END) AS total_wins,
        AVG(b.amount) AS avg_bid,
        COUNT(DISTINCT b.id)::float / NULLIF(COUNT(DISTINCT b.auction_id), 0) AS avg_bids_per_auction,
        jsonb_agg(DISTINCT sc.asset_type) FILTER (WHERE sc.asset_type IS NOT NULL) AS asset_types
      FROM bids b
      JOIN auctions a ON b.auction_id = a.id
      JOIN salvage_cases sc ON a.case_id = sc.id
      GROUP BY b.vendor_id
    ) bid_stats ON v.id = bid_stats.vendor_id
    WHERE NOT EXISTS (
      SELECT 1 FROM vendor_profiles vp WHERE vp.vendor_id = v.id
    )
    ON CONFLICT (vendor_id) DO UPDATE SET
      total_bids = EXCLUDED.total_bids,
      total_wins = EXCLUDED.total_wins,
      win_rate = EXCLUDED.win_rate,
      avg_bid_amount = EXCLUDED.avg_bid_amount,
      preferred_asset_types = EXCLUDED.preferred_asset_types,
      bidding_pattern = EXCLUDED.bidding_pattern,
      risk_profile = EXCLUDED.risk_profile,
      last_updated = NOW()
  `);
  
  console.log(`✅ Created/updated ${result.rowCount || 0} vendor profiles`);
}

async function populateAssetPerformance() {
  console.log('\n🚗 Populating asset performance from closed auctions...');
  
  const result: any = await db.execute(sql`
    INSERT INTO asset_performance (
      asset_type,
      asset_identifier,
      total_auctions,
      avg_final_price,
      avg_bid_count,
      avg_time_to_close,
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
      AVG(EXTRACT(EPOCH FROM (a.end_time - a.start_time)) / 3600) AS avg_time_to_close,
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
    ON CONFLICT (asset_type, asset_identifier) DO UPDATE SET
      total_auctions = EXCLUDED.total_auctions,
      avg_final_price = EXCLUDED.avg_final_price,
      avg_bid_count = EXCLUDED.avg_bid_count,
      avg_time_to_close = EXCLUDED.avg_time_to_close,
      performance_score = EXCLUDED.performance_score,
      last_updated = NOW()
  `);
  
  console.log(`✅ Created/updated ${result.rowCount || 0} asset performance records`);
}

async function main() {
  console.log('🚀 Starting comprehensive intelligence data population...\n');
  
  try {
    // Populate in order of dependencies
    await populatePredictions();
    await populateVendorInteractions();
    await populateVendorProfiles();
    await populateAssetPerformance();
    
    console.log('\n✅ All intelligence data populated successfully!');
    console.log('\n📊 Summary:');
    
    // Get counts
    const predictionCount: any = await db.execute(sql`SELECT COUNT(*) as count FROM predictions`);
    const interactionCount: any = await db.execute(sql`SELECT COUNT(*) as count FROM vendor_interactions`);
    const profileCount: any = await db.execute(sql`SELECT COUNT(*) as count FROM vendor_profiles`);
    const assetCount: any = await db.execute(sql`SELECT COUNT(*) as count FROM asset_performance`);
    
    console.log(`  - Predictions: ${predictionCount[0]?.count || 0}`);
    console.log(`  - Vendor Interactions: ${interactionCount[0]?.count || 0}`);
    console.log(`  - Vendor Profiles: ${profileCount[0]?.count || 0}`);
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
