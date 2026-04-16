-- Migration: Add AI-Powered Marketplace Intelligence Materialized Views
-- Description: Creates vendor_bidding_patterns_mv and market_conditions_mv materialized views
-- Date: 2025-01-21

-- ============================================================================
-- VENDOR BIDDING PATTERNS MATERIALIZED VIEW
-- ============================================================================

CREATE MATERIALIZED VIEW vendor_bidding_patterns_mv AS
WITH vendor_bids AS (
  SELECT 
    b.vendor_id,
    b.amount,
    b.created_at,
    sc.asset_type,
    sc.asset_details,
    sc.damage_severity,
    sc.market_value,
    a.current_bidder = b.vendor_id AS is_winner,
    a.status
  FROM bids b
  JOIN auctions a ON b.auction_id = a.id
  JOIN salvage_cases sc ON a.case_id = sc.id
  WHERE b.created_at > NOW() - INTERVAL '12 months'
    AND a.status = 'closed'
),
make_counts AS (
  SELECT 
    vendor_id,
    asset_details->>'make' AS make,
    COUNT(*) AS make_count
  FROM vendor_bids
  WHERE asset_details->>'make' IS NOT NULL
  GROUP BY vendor_id, asset_details->>'make'
),
model_counts AS (
  SELECT 
    vendor_id,
    asset_details->>'model' AS model,
    COUNT(*) AS model_count
  FROM vendor_bids
  WHERE asset_details->>'model' IS NOT NULL
  GROUP BY vendor_id, asset_details->>'model'
),
top_makes_agg AS (
  SELECT 
    vendor_id,
    ARRAY_AGG(make ORDER BY make_count DESC) AS top_makes_full
  FROM (
    SELECT vendor_id, make, make_count,
           ROW_NUMBER() OVER (PARTITION BY vendor_id ORDER BY make_count DESC) AS rn
    FROM make_counts
  ) ranked
  WHERE rn <= 5
  GROUP BY vendor_id
),
top_models_agg AS (
  SELECT 
    vendor_id,
    ARRAY_AGG(model ORDER BY model_count DESC) AS top_models_full
  FROM (
    SELECT vendor_id, model, model_count,
           ROW_NUMBER() OVER (PARTITION BY vendor_id ORDER BY model_count DESC) AS rn
    FROM model_counts
  ) ranked
  WHERE rn <= 10
  GROUP BY vendor_id
),
asset_type_counts AS (
  SELECT 
    vendor_id,
    asset_type,
    COUNT(*) AS type_count
  FROM vendor_bids
  WHERE asset_type IS NOT NULL
  GROUP BY vendor_id, asset_type
),
damage_counts AS (
  SELECT 
    vendor_id,
    damage_severity,
    COUNT(*) AS damage_count
  FROM vendor_bids
  WHERE damage_severity IS NOT NULL
  GROUP BY vendor_id, damage_severity
),
win_rates_by_type AS (
  SELECT 
    vendor_id,
    asset_type,
    COUNT(*) FILTER (WHERE is_winner)::float / NULLIF(COUNT(*), 0) AS win_rate
  FROM vendor_bids
  WHERE asset_type IS NOT NULL
  GROUP BY vendor_id, asset_type
),
aggregated_patterns AS (
  SELECT 
    vb.vendor_id,
    PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY vb.amount) AS price_p10,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY vb.amount) AS price_p25,
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY vb.amount) AS price_median,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY vb.amount) AS price_p75,
    PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY vb.amount) AS price_p90,
    AVG(vb.amount) AS avg_bid_amount,
    STDDEV(vb.amount) AS bid_amount_stddev,
    COUNT(*) FILTER (WHERE vb.is_winner)::float / NULLIF(COUNT(*), 0) AS overall_win_rate,
    AVG(vb.amount / NULLIF(vb.market_value, 0)) AS avg_bid_to_value_ratio,
    COUNT(*) AS total_bids,
    COUNT(DISTINCT DATE_TRUNC('week', vb.created_at)) AS active_weeks,
    COUNT(*) / NULLIF(COUNT(DISTINCT DATE_TRUNC('week', vb.created_at)), 0) AS bids_per_week,
    MAX(vb.created_at) AS last_bid_at
  FROM vendor_bids vb
  GROUP BY vb.vendor_id
),
asset_type_freq_agg AS (
  SELECT 
    vendor_id,
    jsonb_object_agg(asset_type, type_count) AS asset_type_frequency
  FROM asset_type_counts
  GROUP BY vendor_id
),
damage_freq_agg AS (
  SELECT 
    vendor_id,
    jsonb_object_agg(damage_severity, damage_count) AS damage_level_frequency
  FROM damage_counts
  GROUP BY vendor_id
),
win_rate_agg AS (
  SELECT 
    vendor_id,
    jsonb_object_agg(asset_type, win_rate) AS win_rate_by_asset_type
  FROM win_rates_by_type
  GROUP BY vendor_id
)
SELECT 
  v.id AS vendor_id,
  v.tier,
  v.rating,
  v.categories,
  v.performance_stats,
  COALESCE(atf.asset_type_frequency, '{}'::jsonb) AS asset_type_frequency,
  COALESCE(tm.top_makes_full, ARRAY[]::varchar[]) AS top_makes,
  COALESCE(tmo.top_models_full, ARRAY[]::varchar[]) AS top_models,
  ap.price_p10,
  ap.price_p25,
  ap.price_median,
  ap.price_p75,
  ap.price_p90,
  ap.avg_bid_amount,
  ap.bid_amount_stddev,
  COALESCE(df.damage_level_frequency, '{}'::jsonb) AS damage_level_frequency,
  ap.overall_win_rate,
  COALESCE(wr.win_rate_by_asset_type, '{}'::jsonb) AS win_rate_by_asset_type,
  ap.avg_bid_to_value_ratio,
  ap.total_bids,
  ap.active_weeks,
  ap.bids_per_week,
  ap.last_bid_at,
  CASE 
    WHEN ap.avg_bid_to_value_ratio < 0.4 THEN 'bargain_hunter'
    WHEN ap.avg_bid_to_value_ratio > 0.7 THEN 'premium_buyer'
    ELSE 'value_seeker'
  END AS price_segment,
  CASE 
    WHEN (SELECT COUNT(*) FROM jsonb_object_keys(COALESCE(atf.asset_type_frequency, '{}'::jsonb))) <= 2 THEN 'specialist'
    ELSE 'generalist'
  END AS category_segment,
  CASE 
    WHEN ap.bids_per_week >= 3 THEN 'active_bidder'
    WHEN ap.bids_per_week >= 1 THEN 'regular_bidder'
    ELSE 'selective_bidder'
  END AS activity_segment,
  NOW() AS last_updated
FROM vendors v
LEFT JOIN aggregated_patterns ap ON ap.vendor_id = v.id
LEFT JOIN asset_type_freq_agg atf ON atf.vendor_id = v.id
LEFT JOIN damage_freq_agg df ON df.vendor_id = v.id
LEFT JOIN win_rate_agg wr ON wr.vendor_id = v.id
LEFT JOIN top_makes_agg tm ON tm.vendor_id = v.id
LEFT JOIN top_models_agg tmo ON tmo.vendor_id = v.id;

CREATE UNIQUE INDEX idx_vendor_bidding_patterns_vendor_id ON vendor_bidding_patterns_mv(vendor_id);
CREATE INDEX idx_vendor_bidding_patterns_segments ON vendor_bidding_patterns_mv(price_segment, category_segment, activity_segment);
CREATE INDEX idx_vendor_bidding_patterns_last_updated ON vendor_bidding_patterns_mv(last_updated);


-- ============================================================================
-- MARKET CONDITIONS MATERIALIZED VIEW
-- ============================================================================

CREATE MATERIALIZED VIEW market_conditions_mv AS
WITH recent_auctions AS (
  SELECT 
    a.id,
    a.end_time,
    a.current_bid,
    sc.asset_type,
    sc.damage_severity,
    COUNT(b.id) AS bid_count,
    COUNT(DISTINCT b.vendor_id) AS unique_bidders
  FROM auctions a
  JOIN salvage_cases sc ON a.case_id = sc.id
  LEFT JOIN bids b ON b.auction_id = a.id
  WHERE a.status = 'closed'
    AND a.end_time > NOW() - INTERVAL '90 days'
  GROUP BY a.id, sc.id
),
historical_baseline AS (
  SELECT 
    a.id,
    a.end_time,
    a.current_bid,
    sc.asset_type,
    sc.damage_severity,
    COUNT(b.id) AS bid_count,
    COUNT(DISTINCT b.vendor_id) AS unique_bidders
  FROM auctions a
  JOIN salvage_cases sc ON a.case_id = sc.id
  LEFT JOIN bids b ON b.auction_id = a.id
  WHERE a.status = 'closed'
    AND a.end_time BETWEEN NOW() - INTERVAL '180 days' AND NOW() - INTERVAL '90 days'
  GROUP BY a.id, sc.id
),
aggregated_metrics AS (
  SELECT 
    AVG(ra.bid_count) AS avg_bids_recent,
    AVG(hb.bid_count) AS avg_bids_historical,
    AVG(ra.unique_bidders) AS avg_unique_bidders_recent,
    AVG(ra.current_bid) AS avg_price_recent,
    AVG(hb.current_bid) AS avg_price_historical
  FROM recent_auctions ra
  CROSS JOIN historical_baseline hb
)
SELECT 
  avg_bids_recent AS avg_bids_per_auction_recent,
  avg_bids_historical AS avg_bids_per_auction_historical,
  avg_unique_bidders_recent,
  avg_price_recent AS avg_final_price_recent,
  avg_price_historical AS avg_final_price_historical,
  CASE 
    WHEN avg_bids_recent > avg_bids_historical * 1.3 THEN 'high'
    WHEN avg_bids_recent > avg_bids_historical * 1.1 THEN 'moderate_high'
    WHEN avg_bids_recent < avg_bids_historical * 0.7 THEN 'low'
    WHEN avg_bids_recent < avg_bids_historical * 0.9 THEN 'moderate_low'
    ELSE 'normal'
  END AS competition_level,
  CASE 
    WHEN avg_price_recent > avg_price_historical * 1.2 THEN 'rising'
    WHEN avg_price_recent > avg_price_historical * 1.05 THEN 'slight_rise'
    WHEN avg_price_recent < avg_price_historical * 0.8 THEN 'falling'
    WHEN avg_price_recent < avg_price_historical * 0.95 THEN 'slight_fall'
    ELSE 'stable'
  END AS price_trend,
  NOW() AS last_updated
FROM aggregated_metrics;

CREATE INDEX idx_market_conditions_last_updated ON market_conditions_mv(last_updated);
