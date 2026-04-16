# Design Document: AI-Powered Marketplace Intelligence

## Overview

The AI-Powered Marketplace Intelligence system enhances the salvage auction marketplace through two core engines:

1. **Auction Price Prediction Engine**: Forecasts final auction prices using SQL-based similarity matching, weighted historical analysis, and market condition adjustments
2. **Smart Vendor Recommendation System**: Generates personalized auction feeds using hybrid collaborative and content-based filtering

Both engines operate entirely within PostgreSQL without external ML services, handle cold-start scenarios gracefully, comply with GDPR requirements, and collect structured data for future ML model training.

### Key Design Principles

- **SQL-First Architecture**: All algorithms implemented as PostgreSQL queries and materialized views
- **Sub-200ms Performance**: Aggressive caching and query optimization for real-time responsiveness
- **Cold-Start Resilience**: Progressive fallback strategies from data-driven to heuristic approaches
- **Privacy by Design**: GDPR-compliant data handling with anonymization and deletion workflows
- **Continuous Learning**: Automated accuracy tracking and parameter adjustment based on outcomes

### Technology Stack

- **Database**: PostgreSQL with Drizzle ORM
- **Backend**: Next.js 14 App Router with TypeScript
- **Real-Time**: Socket.IO for live updates
- **Caching**: Redis for vendor profiles and predictions
- **Background Jobs**: Node-cron for materialized view refresh and accuracy calculation

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Auction View │  │ Vendor Feed  │  │ Admin        │          │
│  │ (Predictions)│  │ (Recommend.) │  │ Dashboard    │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          │ Socket.IO        │ REST API         │ REST API
          │                  │                  │
┌─────────┼──────────────────┼──────────────────┼─────────────────┐
│         ▼                  ▼                  ▼                  │
│  ┌──────────────────────────────────────────────────────┐       │
│  │           Next.js API Routes Layer                   │       │
│  │  /api/auctions/{id}/prediction                       │       │
│  │  /api/vendors/{id}/recommendations                   │       │
│  │  /api/intelligence/interactions                      │       │
│  │  /api/intelligence/metrics                           │       │
│  │  /api/intelligence/export                            │       │
│  └──────────────────┬───────────────────────────────────┘       │
│                     │                                            │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              Service Layer                                │    │
│  │  ┌─────────────────┐  ┌──────────────────┐               │    │
│  │  │ Prediction      │  │ Recommendation   │               │    │
│  │  │ Service         │  │ Service          │               │    │
│  │  └────────┬────────┘  └────────┬─────────┘               │    │
│  │           │                    │                          │    │
│  │  ┌────────┴────────────────────┴─────────┐               │    │
│  │  │ Interaction Tracking Service          │               │    │
│  │  └────────┬──────────────────────────────┘               │    │
│  │           │                                               │    │
│  │  ┌────────┴──────────┐  ┌──────────────────┐            │    │
│  │  │ Market Analysis   │  │ Accuracy Tracking│            │    │
│  │  │ Service           │  │ Service          │            │    │
│  │  └───────────────────┘  └──────────────────┘            │    │
│  └──────────────────┬───────────────────────────────────────┘    │
│                     │                                             │
│  ┌──────────────────┴───────────────────────────────────────┐    │
│  │              Caching Layer (Redis)                        │    │
│  │  - Vendor profiles (active sessions)                      │    │
│  │  - Predictions (5-min TTL)                                │    │
│  │  - Recommendations (15-min TTL)                           │    │
│  │  - Market conditions (1-hour TTL)                         │    │
│  └──────────────────┬───────────────────────────────────────┘    │
│                     │                                             │
│  ┌──────────────────┴───────────────────────────────────────┐    │
│  │           PostgreSQL Database Layer                       │    │
│  │                                                            │    │
│  │  Core Tables:                                              │    │
│  │  - auctions, bids, salvage_cases, vendors                 │    │
│  │                                                            │    │
│  │  Intelligence Tables:                                      │    │
│  │  - predictions, recommendations, interactions             │    │
│  │  - algorithm_config, vendor_profiles_mv                   │    │
│  │  - market_conditions_mv, accuracy_metrics                 │    │
│  │                                                            │    │
│  │  Materialized Views:                                       │    │
│  │  - vendor_bidding_patterns                                │    │
│  │  - market_conditions_summary                              │    │
│  │  - item_similarity_matrix                                 │    │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │           Background Jobs (Node-cron)                      │  │
│  │  - Materialized view refresh (every 5 min)                │  │
│  │  - Accuracy calculation (hourly)                          │  │
│  │  - Algorithm parameter tuning (daily)                     │  │
│  │  - Data archival (weekly)                                 │  │
│  └────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

### Data Flow

#### Prediction Flow
1. Vendor views auction → API request to `/api/auctions/{id}/prediction`
2. Check Redis cache for recent prediction
3. If cache miss: PredictionService queries database
4. Execute similarity matching SQL (find historical auctions)
5. Calculate weighted average with market adjustments
6. Compute confidence score based on sample size and recency
7. Store prediction in `predictions` table
8. Cache result in Redis (5-min TTL)
9. Return prediction to client
10. Socket.IO broadcasts update to other viewers

#### Recommendation Flow
1. Vendor accesses marketplace → API request to `/api/vendors/{id}/recommendations`
2. Check Redis cache for vendor recommendations
3. If cache miss: RecommendationService queries database
4. Load vendor bidding patterns from materialized view
5. Execute collaborative filtering (item-item similarity)
6. Execute content-based filtering (attribute matching)
7. Combine scores (60% collaborative, 40% content-based)
8. Rank auctions by match score
9. Store recommendations in `recommendations` table
10. Cache result in Redis (15-min TTL)
11. Return ranked list to client

#### Interaction Tracking Flow
1. User action (view/bid/win) → POST to `/api/intelligence/interactions`
2. Validate and enrich event data
3. Insert into `interactions` table
4. Trigger materialized view refresh (async)
5. Update vendor profile cache
6. If auction closed: calculate prediction accuracy


## 1. Algorithm Deep Dive

### 1.1 Auction Price Prediction Algorithm

#### Similarity Matching Logic

The prediction engine finds similar historical auctions using a multi-tier matching strategy:

**SQL Query for Similarity Matching (Vehicles):**

```sql
WITH similar_auctions AS (
  SELECT 
    a.id AS auction_id,
    a.current_bid AS final_price,
    sc.asset_details,
    sc.damage_severity,
    sc.market_value,
    a.created_at,
    a.end_time,
    COUNT(b.id) AS bid_count,
    -- Similarity score calculation
    (
      CASE 
        -- Exact make/model match: 100 points
        WHEN sc.asset_details->>'make' = $target_make 
         AND sc.asset_details->>'model' = $target_model THEN 100
        -- Make match only: 50 points
        WHEN sc.asset_details->>'make' = $target_make THEN 50
        ELSE 0
      END +
      -- Year proximity: 20 points for exact, -5 per year difference
      CASE 
        WHEN (sc.asset_details->>'year')::int = $target_year THEN 20
        WHEN ABS((sc.asset_details->>'year')::int - $target_year) = 1 THEN 15
        WHEN ABS((sc.asset_details->>'year')::int - $target_year) = 2 THEN 10
        ELSE 0
      END +
      -- Damage severity match: 30 points for exact, 15 for ±1 level
      CASE 
        WHEN sc.damage_severity = $target_damage THEN 30
        WHEN (
          (sc.damage_severity = 'minor' AND $target_damage = 'moderate') OR
          (sc.damage_severity = 'moderate' AND $target_damage IN ('minor', 'severe')) OR
          (sc.damage_severity = 'severe' AND $target_damage = 'moderate')
        ) THEN 15
        ELSE 0
      END +
      -- Market value proximity: 10 points if within 20%
      CASE 
        WHEN ABS(sc.market_value - $target_market_value) / $target_market_value < 0.2 THEN 10
        ELSE 0
      END
    ) AS similarity_score,
    -- Time decay weight (exponential decay over 6 months)
    EXP(-EXTRACT(EPOCH FROM (NOW() - a.end_time)) / (6 * 30 * 24 * 60 * 60)) AS time_weight
  FROM auctions a
  JOIN salvage_cases sc ON a.case_id = sc.id
  LEFT JOIN bids b ON b.auction_id = a.id
  WHERE 
    a.status = 'closed'
    AND a.current_bid IS NOT NULL
    AND sc.asset_type = $target_asset_type
    -- Only consider auctions from last 12 months
    AND a.end_time > NOW() - INTERVAL '12 months'
    -- Minimum similarity threshold
    AND (
      sc.asset_details->>'make' = $target_make
      OR sc.damage_severity = $target_damage
    )
  GROUP BY a.id, sc.id
  HAVING (
    CASE 
      WHEN sc.asset_details->>'make' = $target_make 
       AND sc.asset_details->>'model' = $target_model THEN 100
      WHEN sc.asset_details->>'make' = $target_make THEN 50
      ELSE 0
    END +
    CASE 
      WHEN (sc.asset_details->>'year')::int = $target_year THEN 20
      WHEN ABS((sc.asset_details->>'year')::int - $target_year) = 1 THEN 15
      WHEN ABS((sc.asset_details->>'year')::int - $target_year) = 2 THEN 10
      ELSE 0
    END +
    CASE 
      WHEN sc.damage_severity = $target_damage THEN 30
      WHEN (
        (sc.damage_severity = 'minor' AND $target_damage = 'moderate') OR
        (sc.damage_severity = 'moderate' AND $target_damage IN ('minor', 'severe')) OR
        (sc.damage_severity = 'severe' AND $target_damage = 'moderate')
      ) THEN 15
      ELSE 0
    END +
    CASE 
      WHEN ABS(sc.market_value - $target_market_value) / $target_market_value < 0.2 THEN 10
      ELSE 0
    END
  ) >= 60  -- Minimum similarity threshold
  ORDER BY similarity_score DESC, time_weight DESC
  LIMIT 50
)
SELECT * FROM similar_auctions;
```

**Similarity Scoring Breakdown:**
- Make + Model exact match: 100 points (highest priority)
- Make only match: 50 points
- Year exact match: 20 points (±1 year: 15, ±2 years: 10)
- Damage severity exact: 30 points (±1 level: 15)
- Market value within 20%: 10 points
- **Minimum threshold: 60 points** to be considered similar

#### Weighted Average Calculation

Once similar auctions are identified, calculate the predicted price:

**Formula:**

```
predicted_price = Σ(final_price_i × similarity_weight_i × time_weight_i) / Σ(similarity_weight_i × time_weight_i)

where:
  similarity_weight_i = similarity_score_i / 100  (normalized 0-1.6)
  time_weight_i = e^(-days_ago_i / 180)  (exponential decay over 6 months)
```

**SQL Implementation:**

```sql
WITH weighted_prices AS (
  SELECT 
    final_price,
    similarity_score / 100.0 AS similarity_weight,
    time_weight,
    (similarity_score / 100.0) * time_weight AS combined_weight
  FROM similar_auctions
)
SELECT 
  SUM(final_price * combined_weight) / SUM(combined_weight) AS predicted_price,
  COUNT(*) AS sample_size,
  STDDEV(final_price) AS price_variance
FROM weighted_prices;
```


#### Market Condition Adjustments

Market conditions are calculated from recent auction activity and applied as multipliers:

**Market Condition Calculation SQL:**

```sql
WITH market_metrics AS (
  SELECT 
    -- Competition level: average bids per auction
    AVG(bid_count) AS avg_bids_per_auction,
    -- Historical baseline (last 90 days)
    (
      SELECT AVG(bid_count) 
      FROM (
        SELECT COUNT(b.id) AS bid_count
        FROM auctions a
        LEFT JOIN bids b ON b.auction_id = a.id
        WHERE a.status = 'closed'
          AND a.end_time BETWEEN NOW() - INTERVAL '90 days' AND NOW() - INTERVAL '30 days'
        GROUP BY a.id
      ) historical
    ) AS baseline_bids,
    -- Price trend: comparing recent vs historical averages
    AVG(a.current_bid) AS recent_avg_price,
    (
      SELECT AVG(current_bid)
      FROM auctions
      WHERE status = 'closed'
        AND end_time BETWEEN NOW() - INTERVAL '90 days' AND NOW() - INTERVAL '30 days'
    ) AS historical_avg_price,
    -- Active vendor count
    COUNT(DISTINCT b.vendor_id) AS active_vendors
  FROM auctions a
  LEFT JOIN bids b ON b.auction_id = a.id
  WHERE a.status = 'closed'
    AND a.end_time > NOW() - INTERVAL '30 days'
  GROUP BY a.id
),
adjustments AS (
  SELECT 
    -- Competition adjustment: ±15% based on bid activity
    CASE 
      WHEN avg_bids_per_auction > baseline_bids * 1.3 THEN 1.15  -- High competition
      WHEN avg_bids_per_auction > baseline_bids * 1.1 THEN 1.08  -- Moderate competition
      WHEN avg_bids_per_auction < baseline_bids * 0.7 THEN 0.85  -- Low competition
      WHEN avg_bids_per_auction < baseline_bids * 0.9 THEN 0.92  -- Slightly low
      ELSE 1.0  -- Normal competition
    END AS competition_multiplier,
    -- Trend adjustment: ±10% based on price movement
    CASE 
      WHEN recent_avg_price > historical_avg_price * 1.2 THEN 1.10  -- Rising market
      WHEN recent_avg_price > historical_avg_price * 1.05 THEN 1.05  -- Slight rise
      WHEN recent_avg_price < historical_avg_price * 0.8 THEN 0.90  -- Falling market
      WHEN recent_avg_price < historical_avg_price * 0.95 THEN 0.95  -- Slight fall
      ELSE 1.0  -- Stable market
    END AS trend_multiplier,
    -- Seasonal adjustment (example: vehicles sell better in certain months)
    CASE 
      WHEN EXTRACT(MONTH FROM NOW()) IN (1, 2, 12) THEN 0.95  -- Winter slowdown
      WHEN EXTRACT(MONTH FROM NOW()) IN (4, 5, 6) THEN 1.05   -- Spring/summer boost
      ELSE 1.0
    END AS seasonal_multiplier
  FROM market_metrics
)
SELECT 
  competition_multiplier,
  trend_multiplier,
  seasonal_multiplier,
  competition_multiplier * trend_multiplier * seasonal_multiplier AS total_adjustment
FROM adjustments;
```

**Final Adjusted Prediction:**

```
adjusted_predicted_price = base_predicted_price × total_adjustment

where:
  total_adjustment = competition_multiplier × trend_multiplier × seasonal_multiplier
  
Range: 0.85 to 1.15 (±15% maximum adjustment)
```

#### Confidence Score Calculation

Confidence score reflects prediction reliability based on data quality:

**Formula:**

```
confidence_score = base_confidence × sample_size_factor × recency_factor × variance_factor

where:
  base_confidence = 0.85  (85% baseline for good data)
  
  sample_size_factor = MIN(1.0, sample_size / 10)
    - 10+ similar auctions: 1.0 (no penalty)
    - 5 similar auctions: 0.5 (50% penalty)
    - 1 similar auction: 0.1 (90% penalty)
  
  recency_factor = AVG(time_weight_i)
    - Recent data (< 1 month): ~0.95
    - Older data (6 months): ~0.50
  
  variance_factor = 1 / (1 + (stddev / mean))
    - Low variance (stddev < 10% of mean): ~0.95
    - High variance (stddev > 40% of mean): ~0.60

Final score clamped to [0.0, 1.0]
```

**SQL Implementation:**

```sql
WITH confidence_calc AS (
  SELECT 
    0.85 AS base_confidence,
    LEAST(1.0, COUNT(*) / 10.0) AS sample_size_factor,
    AVG(time_weight) AS recency_factor,
    1.0 / (1.0 + (STDDEV(final_price) / NULLIF(AVG(final_price), 0))) AS variance_factor
  FROM similar_auctions
)
SELECT 
  LEAST(1.0, 
    base_confidence * sample_size_factor * recency_factor * variance_factor
  ) AS confidence_score,
  CASE 
    WHEN confidence_score >= 0.75 THEN 'High'
    WHEN confidence_score >= 0.50 THEN 'Medium'
    ELSE 'Low'
  END AS confidence_level
FROM confidence_calc;
```

**Confidence Intervals:**

```
lower_bound = predicted_price × (1 - (1 - confidence_score) × 0.3)
upper_bound = predicted_price × (1 + (1 - confidence_score) × 0.3)

Example:
  predicted_price = 1,000,000
  confidence_score = 0.80
  
  lower_bound = 1,000,000 × (1 - 0.20 × 0.3) = 940,000
  upper_bound = 1,000,000 × (1 + 0.20 × 0.3) = 1,060,000
  
  Range: ±6% for 80% confidence
```


#### Edge Cases Handling

**1. Outlier Detection and Handling:**

```sql
-- Identify outliers using IQR method
WITH price_stats AS (
  SELECT 
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY final_price) AS q1,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY final_price) AS q3,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY final_price) - 
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY final_price) AS iqr
  FROM similar_auctions
),
filtered_auctions AS (
  SELECT sa.*
  FROM similar_auctions sa, price_stats ps
  WHERE sa.final_price BETWEEN (ps.q1 - 1.5 * ps.iqr) AND (ps.q3 + 1.5 * ps.iqr)
)
SELECT * FROM filtered_auctions;
```

**2. Missing Data Handling:**

```typescript
// Pseudocode for handling incomplete asset details
if (!assetDetails.make || !assetDetails.model) {
  // Attempt fuzzy matching on available fields
  similarityQuery.addFuzzyMatch('asset_details', availableFields);
  confidenceScore *= 0.7;  // Reduce confidence by 30%
}

if (!assetDetails.year) {
  // Expand year range to ±5 years
  similarityQuery.yearRange = [-5, 5];
  confidenceScore *= 0.8;  // Reduce confidence by 20%
}
```

**3. Extreme Values:**

```typescript
// Handle reserve price higher than historical data
if (reservePrice > maxHistoricalPrice) {
  lowerBound = reservePrice;
  predictedPrice = reservePrice * 1.15;  // Extrapolate 15% above reserve
  upperBound = reservePrice * 1.35;
  confidenceScore *= 0.6;  // Low confidence for extrapolation
  metadata.warning = "Prediction based on extrapolation - reserve exceeds historical data";
}

// Handle unusually high early bids
if (currentBid > predictedPrice * 1.5) {
  // Recalculate using current bid as baseline
  predictedPrice = currentBid * 1.1;  // Expect 10% increase
  lowerBound = currentBid;
  upperBound = currentBid * 1.25;
  metadata.note = "High early bidding activity detected";
}
```

**4. Auction Extensions:**

```typescript
// Adjust prediction for extended auctions
if (extensionCount > 0) {
  // Each extension signals increased competition
  competitionBoost = 1 + (extensionCount * 0.05);  // 5% per extension
  predictedPrice *= competitionBoost;
  upperBound *= competitionBoost;
  metadata.note = `Auction extended ${extensionCount} time(s) - increased competition expected`;
}
```

**5. High Variance Markets:**

```sql
-- Widen confidence intervals for volatile markets
WITH variance_check AS (
  SELECT 
    STDDEV(final_price) / AVG(final_price) AS coefficient_of_variation
  FROM similar_auctions
)
SELECT 
  CASE 
    WHEN coefficient_of_variation > 0.4 THEN 
      -- Widen intervals by 50% for high variance
      predicted_price * (1 - (1 - confidence_score) * 0.45) AS lower_bound,
      predicted_price * (1 + (1 - confidence_score) * 0.45) AS upper_bound
    ELSE 
      -- Normal intervals
      predicted_price * (1 - (1 - confidence_score) * 0.3) AS lower_bound,
      predicted_price * (1 + (1 - confidence_score) * 0.3) AS upper_bound
  END
FROM variance_check;
```

#### Cold-Start Strategy

Progressive fallback logic when historical data is insufficient:

**Decision Tree:**

```
1. Check similar historical auctions (similarity_score >= 60)
   ├─ >= 10 auctions: Use full algorithm (confidence: High)
   ├─ 5-9 auctions: Use full algorithm (confidence: Medium)
   ├─ 3-4 auctions: Blend with salvage value (70% historical, 30% salvage)
   ├─ 1-2 auctions: Blend with salvage value (40% historical, 60% salvage)
   └─ 0 auctions: Proceed to step 2

2. Check estimatedSalvageValue from salvage_cases
   ├─ Available: Use salvage value (confidence: Low)
   │   - lower_bound = reservePrice
   │   - predicted_price = estimatedSalvageValue
   │   - upper_bound = estimatedSalvageValue * 1.3
   └─ Not available: Proceed to step 3

3. Calculate fallback from marketValue and damageSeverity
   ├─ damage = 'minor': salvage = marketValue * 0.75
   ├─ damage = 'moderate': salvage = marketValue * 0.50
   ├─ damage = 'severe': salvage = marketValue * 0.25
   └─ damage = 'none': salvage = marketValue * 0.90

4. If all else fails: Return "No Prediction Available"
   - Display message: "Insufficient data for price prediction"
   - Show market value and reserve price as reference
```

**SQL Implementation:**

```sql
WITH prediction_attempt AS (
  -- Attempt 1: Historical data
  SELECT 
    'historical' AS method,
    predicted_price,
    confidence_score,
    sample_size
  FROM calculate_historical_prediction($auction_id)
  WHERE sample_size >= 1
  
  UNION ALL
  
  -- Attempt 2: Salvage value fallback
  SELECT 
    'salvage_value' AS method,
    sc.estimated_salvage_value AS predicted_price,
    0.30 AS confidence_score,
    0 AS sample_size
  FROM salvage_cases sc
  JOIN auctions a ON a.case_id = sc.id
  WHERE a.id = $auction_id
    AND sc.estimated_salvage_value IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM calculate_historical_prediction($auction_id) WHERE sample_size >= 1
    )
  
  UNION ALL
  
  -- Attempt 3: Market value calculation
  SELECT 
    'market_value_calc' AS method,
    sc.market_value * 
      CASE sc.damage_severity
        WHEN 'none' THEN 0.90
        WHEN 'minor' THEN 0.75
        WHEN 'moderate' THEN 0.50
        WHEN 'severe' THEN 0.25
        ELSE 0.50
      END AS predicted_price,
    0.20 AS confidence_score,
    0 AS sample_size
  FROM salvage_cases sc
  JOIN auctions a ON a.case_id = sc.id
  WHERE a.id = $auction_id
    AND NOT EXISTS (
      SELECT 1 FROM calculate_historical_prediction($auction_id) WHERE sample_size >= 1
    )
    AND sc.estimated_salvage_value IS NULL
)
SELECT * FROM prediction_attempt
ORDER BY confidence_score DESC
LIMIT 1;
```


### 1.2 Vendor Recommendation Algorithm

#### Collaborative Filtering (Item-Item Similarity)

Find auctions similar to those the vendor previously bid on:

**SQL Query for Item-Item Similarity:**

```sql
WITH vendor_bid_history AS (
  -- Get auctions the vendor has bid on
  SELECT DISTINCT
    sc.id AS case_id,
    sc.asset_type,
    sc.asset_details,
    sc.damage_severity,
    sc.market_value,
    b.amount AS bid_amount,
    b.created_at AS bid_time,
    -- Recency weight: more recent bids weighted higher
    EXP(-EXTRACT(EPOCH FROM (NOW() - b.created_at)) / (90 * 24 * 60 * 60)) AS recency_weight
  FROM bids b
  JOIN auctions a ON b.auction_id = a.id
  JOIN salvage_cases sc ON a.case_id = sc.id
  WHERE b.vendor_id = $vendor_id
    AND b.created_at > NOW() - INTERVAL '12 months'
),
active_auctions AS (
  -- Get currently active auctions (exclude already bid on)
  SELECT 
    a.id AS auction_id,
    sc.id AS case_id,
    sc.asset_type,
    sc.asset_details,
    sc.damage_severity,
    sc.market_value,
    sc.reserve_price,
    a.watching_count,
    a.current_bid
  FROM auctions a
  JOIN salvage_cases sc ON a.case_id = sc.id
  WHERE a.status IN ('active', 'scheduled')
    AND NOT EXISTS (
      SELECT 1 FROM bids b 
      WHERE b.auction_id = a.id AND b.vendor_id = $vendor_id
    )
),
similarity_scores AS (
  SELECT 
    aa.auction_id,
    aa.case_id,
    vbh.case_id AS historical_case_id,
    vbh.recency_weight,
    -- Calculate similarity between active auction and vendor's bid history
    (
      -- Asset type match: 40 points
      CASE WHEN aa.asset_type = vbh.asset_type THEN 40 ELSE 0 END +
      
      -- Make/model match: 30 points (vehicles)
      CASE 
        WHEN aa.asset_details->>'make' = vbh.asset_details->>'make' 
         AND aa.asset_details->>'model' = vbh.asset_details->>'model' THEN 30
        WHEN aa.asset_details->>'make' = vbh.asset_details->>'make' THEN 15
        ELSE 0
      END +
      
      -- Damage severity match: 15 points
      CASE 
        WHEN aa.damage_severity = vbh.damage_severity THEN 15
        WHEN (
          (aa.damage_severity = 'minor' AND vbh.damage_severity = 'moderate') OR
          (aa.damage_severity = 'moderate' AND vbh.damage_severity IN ('minor', 'severe')) OR
          (aa.damage_severity = 'severe' AND vbh.damage_severity = 'moderate')
        ) THEN 8
        ELSE 0
      END +
      
      -- Price range match: 15 points (within 30% of vendor's typical bid)
      CASE 
        WHEN ABS(aa.market_value - vbh.bid_amount) / vbh.bid_amount < 0.3 THEN 15
        WHEN ABS(aa.market_value - vbh.bid_amount) / vbh.bid_amount < 0.5 THEN 8
        ELSE 0
      END
    ) AS raw_similarity_score,
    aa.watching_count,
    aa.current_bid,
    aa.reserve_price
  FROM active_auctions aa
  CROSS JOIN vendor_bid_history vbh
)
SELECT 
  auction_id,
  -- Weighted average similarity across all vendor's historical bids
  SUM(raw_similarity_score * recency_weight) / SUM(recency_weight) AS collaborative_score,
  MAX(watching_count) AS popularity,
  MAX(current_bid) AS current_bid,
  MAX(reserve_price) AS reserve_price,
  COUNT(DISTINCT historical_case_id) AS matching_history_count
FROM similarity_scores
GROUP BY auction_id
HAVING SUM(raw_similarity_score * recency_weight) / SUM(recency_weight) >= 30  -- Minimum threshold
ORDER BY collaborative_score DESC;
```

**Collaborative Score Breakdown:**
- Asset type match: 40 points
- Make + Model match: 30 points (Make only: 15)
- Damage severity match: 15 points (±1 level: 8)
- Price range match: 15 points (within 30%: 15, within 50%: 8)
- **Maximum: 100 points**
- **Minimum threshold: 30 points**

#### Content-Based Filtering

Match auction attributes to vendor preferences:

**SQL Query for Content-Based Filtering:**

```sql
WITH vendor_preferences AS (
  -- Extract vendor preferences from profile
  SELECT 
    v.id AS vendor_id,
    v.categories AS preferred_asset_types,
    v.rating,
    v.tier,
    v.performance_stats,
    -- Calculate preferred price range from bid history
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY b.amount) AS price_p25,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY b.amount) AS price_p75,
    AVG(b.amount) AS avg_bid_amount,
    -- Extract preferred makes/models
    ARRAY_AGG(DISTINCT sc.asset_details->>'make') 
      FILTER (WHERE sc.asset_details->>'make' IS NOT NULL) AS preferred_makes,
    -- Extract preferred damage levels
    MODE() WITHIN GROUP (ORDER BY sc.damage_severity) AS preferred_damage_level,
    -- Win rate by asset type
    jsonb_object_agg(
      sc.asset_type,
      COUNT(*) FILTER (WHERE a.current_bidder = v.id)::float / COUNT(*)
    ) AS win_rate_by_type
  FROM vendors v
  LEFT JOIN bids b ON b.vendor_id = v.id
  LEFT JOIN auctions a ON b.auction_id = a.id
  LEFT JOIN salvage_cases sc ON a.case_id = sc.id
  WHERE v.id = $vendor_id
    AND b.created_at > NOW() - INTERVAL '12 months'
  GROUP BY v.id
),
active_auctions AS (
  SELECT 
    a.id AS auction_id,
    sc.asset_type,
    sc.asset_details,
    sc.damage_severity,
    sc.market_value,
    sc.reserve_price,
    a.watching_count
  FROM auctions a
  JOIN salvage_cases sc ON a.case_id = sc.id
  WHERE a.status IN ('active', 'scheduled')
    AND NOT EXISTS (
      SELECT 1 FROM bids b 
      WHERE b.auction_id = a.id AND b.vendor_id = $vendor_id
    )
)
SELECT 
  aa.auction_id,
  (
    -- Category match: 35 points
    CASE 
      WHEN aa.asset_type = ANY(vp.preferred_asset_types) THEN 35
      ELSE 0
    END +
    
    -- Make preference: 25 points
    CASE 
      WHEN aa.asset_details->>'make' = ANY(vp.preferred_makes) THEN 25
      ELSE 0
    END +
    
    -- Price range fit: 25 points
    CASE 
      WHEN aa.market_value BETWEEN vp.price_p25 AND vp.price_p75 THEN 25
      WHEN aa.market_value BETWEEN vp.price_p25 * 0.7 AND vp.price_p75 * 1.3 THEN 15
      ELSE 0
    END +
    
    -- Damage level preference: 15 points
    CASE 
      WHEN aa.damage_severity = vp.preferred_damage_level THEN 15
      ELSE 5
    END
  ) AS content_score,
  -- Boost for categories with high win rate
  COALESCE((vp.win_rate_by_type->>aa.asset_type::text)::float, 0) AS category_win_rate,
  aa.watching_count AS popularity
FROM active_auctions aa
CROSS JOIN vendor_preferences vp
WHERE (
  -- At least one preference match required
  aa.asset_type = ANY(vp.preferred_asset_types)
  OR aa.asset_details->>'make' = ANY(vp.preferred_makes)
  OR aa.market_value BETWEEN vp.price_p25 * 0.5 AND vp.price_p75 * 1.5
);
```

**Content Score Breakdown:**
- Category match: 35 points
- Make preference: 25 points
- Price range fit: 25 points (exact: 25, nearby: 15)
- Damage level preference: 15 points (other: 5)
- **Maximum: 100 points**


#### Hybrid Scoring Formula

Combine collaborative and content-based scores with dynamic weighting:

**Formula:**

```
match_score = (collaborative_score × w_collab) + (content_score × w_content) + popularity_boost + win_rate_boost

where:
  w_collab = weight for collaborative filtering (default: 0.60)
  w_content = weight for content-based filtering (default: 0.40)
  
  popularity_boost = MIN(10, watching_count / 2)  (max 10 points)
  win_rate_boost = category_win_rate × 15  (max 15 points for 100% win rate)

Dynamic weight adjustment:
  IF vendor_bid_count < 3:
    w_collab = 0.20, w_content = 0.80  (cold start)
  ELSE IF vendor_bid_count < 10:
    w_collab = 0.40, w_content = 0.60  (warming up)
  ELSE:
    w_collab = 0.60, w_content = 0.40  (full collaborative)
```

**SQL Implementation:**

```sql
WITH combined_scores AS (
  SELECT 
    COALESCE(cf.auction_id, cbf.auction_id) AS auction_id,
    COALESCE(cf.collaborative_score, 0) AS collaborative_score,
    COALESCE(cbf.content_score, 0) AS content_score,
    COALESCE(cbf.category_win_rate, 0) AS category_win_rate,
    COALESCE(cf.popularity, cbf.popularity, 0) AS popularity,
    -- Dynamic weight calculation
    CASE 
      WHEN $vendor_bid_count < 3 THEN 0.20
      WHEN $vendor_bid_count < 10 THEN 0.40
      ELSE 0.60
    END AS w_collab,
    CASE 
      WHEN $vendor_bid_count < 3 THEN 0.80
      WHEN $vendor_bid_count < 10 THEN 0.60
      ELSE 0.40
    END AS w_content
  FROM collaborative_filtering cf
  FULL OUTER JOIN content_based_filtering cbf 
    ON cf.auction_id = cbf.auction_id
)
SELECT 
  auction_id,
  (collaborative_score * w_collab) + 
  (content_score * w_content) + 
  LEAST(10, popularity / 2.0) +  -- Popularity boost
  (category_win_rate * 15) AS match_score,  -- Win rate boost
  collaborative_score,
  content_score,
  popularity,
  category_win_rate,
  -- Generate reason codes
  ARRAY_REMOVE(ARRAY[
    CASE WHEN collaborative_score >= 60 THEN 'Similar to your previous bids' END,
    CASE WHEN content_score >= 60 THEN 'Matches your preferred categories' END,
    CASE WHEN category_win_rate > 0.5 THEN 'High win rate in this category' END,
    CASE WHEN popularity >= 10 THEN 'Trending auction' END
  ], NULL) AS reason_codes
FROM combined_scores
WHERE (collaborative_score * w_collab) + (content_score * w_content) >= 25  -- Minimum threshold
ORDER BY match_score DESC
LIMIT 50;
```

#### Bidding Pattern Extraction

Extract vendor preferences from historical behavior:

**SQL Query for Pattern Analysis:**

```sql
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
    CASE 
      WHEN a.current_bidder = b.vendor_id THEN 'won'
      WHEN b.amount < a.current_bid THEN 'outbid'
      ELSE 'lost'
    END AS outcome
  FROM bids b
  JOIN auctions a ON b.auction_id = a.id
  JOIN salvage_cases sc ON a.case_id = sc.id
  WHERE b.vendor_id = $vendor_id
    AND a.status = 'closed'
    AND b.created_at > NOW() - INTERVAL '12 months'
),
patterns AS (
  SELECT 
    vendor_id,
    -- Asset type preferences (ranked by frequency)
    jsonb_object_agg(
      asset_type,
      COUNT(*)
    ) AS asset_type_frequency,
    -- Make preferences (top 5)
    ARRAY_AGG(DISTINCT asset_details->>'make' ORDER BY COUNT(*) DESC)
      FILTER (WHERE asset_details->>'make' IS NOT NULL)
      [1:5] AS top_makes,
    -- Model preferences (top 10)
    ARRAY_AGG(DISTINCT asset_details->>'model' ORDER BY COUNT(*) DESC)
      FILTER (WHERE asset_details->>'model' IS NOT NULL)
      [1:10] AS top_models,
    -- Price range analysis
    PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY amount) AS price_p10,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY amount) AS price_p25,
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY amount) AS price_median,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY amount) AS price_p75,
    PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY amount) AS price_p90,
    AVG(amount) AS avg_bid_amount,
    STDDEV(amount) AS bid_amount_stddev,
    -- Damage level preferences
    jsonb_object_agg(
      damage_severity,
      COUNT(*)
    ) AS damage_level_frequency,
    -- Win rate analysis
    COUNT(*) FILTER (WHERE outcome = 'won')::float / COUNT(*) AS overall_win_rate,
    jsonb_object_agg(
      asset_type,
      COUNT(*) FILTER (WHERE outcome = 'won')::float / COUNT(*)
    ) AS win_rate_by_asset_type,
    -- Bidding aggressiveness (bid amount vs market value)
    AVG(amount / market_value) AS avg_bid_to_value_ratio,
    -- Bidding frequency
    COUNT(*) AS total_bids,
    COUNT(DISTINCT DATE_TRUNC('week', created_at)) AS active_weeks,
    COUNT(*) / NULLIF(COUNT(DISTINCT DATE_TRUNC('week', created_at)), 0) AS bids_per_week
  FROM vendor_bids
  GROUP BY vendor_id
)
SELECT * FROM patterns;
```

**Pattern Storage (Materialized View):**

```sql
CREATE MATERIALIZED VIEW vendor_bidding_patterns AS
SELECT 
  v.id AS vendor_id,
  v.tier,
  v.rating,
  v.categories,
  v.performance_stats,
  p.asset_type_frequency,
  p.top_makes,
  p.top_models,
  p.price_p10,
  p.price_p25,
  p.price_median,
  p.price_p75,
  p.price_p90,
  p.avg_bid_amount,
  p.bid_amount_stddev,
  p.damage_level_frequency,
  p.overall_win_rate,
  p.win_rate_by_asset_type,
  p.avg_bid_to_value_ratio,
  p.total_bids,
  p.active_weeks,
  p.bids_per_week,
  -- Vendor segmentation
  CASE 
    WHEN p.avg_bid_to_value_ratio < 0.4 THEN 'bargain_hunter'
    WHEN p.avg_bid_to_value_ratio > 0.7 THEN 'premium_buyer'
    ELSE 'value_seeker'
  END AS price_segment,
  CASE 
    WHEN JSONB_ARRAY_LENGTH(p.asset_type_frequency) <= 2 THEN 'specialist'
    ELSE 'generalist'
  END AS category_segment,
  CASE 
    WHEN p.bids_per_week >= 3 THEN 'active_bidder'
    WHEN p.bids_per_week >= 1 THEN 'regular_bidder'
    ELSE 'selective_bidder'
  END AS activity_segment,
  NOW() AS last_updated
FROM vendors v
LEFT JOIN patterns p ON p.vendor_id = v.id;

-- Refresh every 5 minutes
CREATE INDEX idx_vendor_bidding_patterns_vendor_id ON vendor_bidding_patterns(vendor_id);
CREATE INDEX idx_vendor_bidding_patterns_segments ON vendor_bidding_patterns(price_segment, category_segment, activity_segment);
```


#### Edge Cases for Recommendations

**1. Vendors with No History (Cold Start):**

```typescript
// Pseudocode for new vendor recommendations
if (vendorBidCount === 0) {
  // Use popularity-based ranking
  return await db.query(`
    SELECT 
      a.id AS auction_id,
      a.watching_count AS popularity,
      sc.asset_type,
      -- Match to vendor's selected categories
      CASE 
        WHEN sc.asset_type = ANY($vendor_categories) THEN 50
        ELSE 0
      END AS category_match,
      a.watching_count + category_match AS match_score,
      ARRAY['Popular auction', 'Matches your interests'] AS reason_codes
    FROM auctions a
    JOIN salvage_cases sc ON a.case_id = sc.id
    WHERE a.status IN ('active', 'scheduled')
    ORDER BY match_score DESC
    LIMIT 20
  `);
}
```

**2. Vendors with Only Losing Bids:**

```sql
-- Recommend lower competition auctions
WITH vendor_loss_analysis AS (
  SELECT 
    AVG(a.watching_count) AS avg_competition_faced,
    AVG(b.amount / a.current_bid) AS avg_bid_ratio
  FROM bids b
  JOIN auctions a ON b.auction_id = a.id
  WHERE b.vendor_id = $vendor_id
    AND a.current_bidder != $vendor_id  -- Lost bids only
)
SELECT 
  a.id AS auction_id,
  a.watching_count,
  -- Boost auctions with lower competition
  CASE 
    WHEN a.watching_count < vla.avg_competition_faced * 0.7 THEN 20
    WHEN a.watching_count < vla.avg_competition_faced THEN 10
    ELSE 0
  END AS low_competition_boost,
  ARRAY['Lower competition', 'Better chance to win'] AS reason_codes
FROM auctions a
CROSS JOIN vendor_loss_analysis vla
WHERE a.status IN ('active', 'scheduled')
ORDER BY low_competition_boost DESC;
```

**3. Vendors Consistently Bidding Below Market:**

```sql
-- Recommend auctions with lower reserve prices
WITH vendor_bid_analysis AS (
  SELECT 
    AVG(b.amount / sc.market_value) AS avg_bid_to_market_ratio
  FROM bids b
  JOIN auctions a ON b.auction_id = a.id
  JOIN salvage_cases sc ON a.case_id = sc.id
  WHERE b.vendor_id = $vendor_id
)
SELECT 
  a.id AS auction_id,
  sc.reserve_price,
  sc.market_value,
  -- Boost auctions with lower reserve/market ratio
  CASE 
    WHEN sc.reserve_price / sc.market_value < vba.avg_bid_to_market_ratio THEN 25
    WHEN sc.reserve_price / sc.market_value < vba.avg_bid_to_market_ratio * 1.2 THEN 15
    ELSE 0
  END AS price_fit_boost,
  ARRAY['Fits your budget', 'Lower reserve price'] AS reason_codes
FROM auctions a
JOIN salvage_cases sc ON a.case_id = sc.id
CROSS JOIN vendor_bid_analysis vba
WHERE a.status IN ('active', 'scheduled')
ORDER BY price_fit_boost DESC;
```

**4. Inactive Vendors (No Bids in 30 Days):**

```typescript
// Increase diversity to re-engage
if (daysSinceLastBid > 30) {
  // Reduce similarity threshold to show more variety
  similarityThreshold = 20;  // Down from 30
  
  // Add "New Arrivals" and "Trending" categories
  recommendations = [
    ...similarityBasedRecs.slice(0, 10),
    ...trendingAuctions.slice(0, 5),
    ...newArrivals.slice(0, 5)
  ];
  
  // Add re-engagement reason codes
  recommendations.forEach(rec => {
    rec.reasonCodes.push('New opportunity', 'Trending now');
  });
}
```

**5. Erratic Bidding Patterns (High Variance):**

```sql
-- Use broader matching criteria
WITH vendor_variance AS (
  SELECT 
    STDDEV(amount) / AVG(amount) AS bid_coefficient_of_variation,
    COUNT(DISTINCT sc.asset_type) AS asset_type_diversity
  FROM bids b
  JOIN auctions a ON b.auction_id = a.id
  JOIN salvage_cases sc ON a.case_id = sc.id
  WHERE b.vendor_id = $vendor_id
)
SELECT 
  a.id AS auction_id,
  -- Reduce specificity for erratic bidders
  CASE 
    WHEN vv.bid_coefficient_of_variation > 0.5 THEN
      -- Broader matching: just asset type
      CASE WHEN sc.asset_type = ANY($vendor_categories) THEN 40 ELSE 0 END
    ELSE
      -- Normal matching: make/model/price
      normal_match_score
  END AS match_score
FROM auctions a
JOIN salvage_cases sc ON a.case_id = sc.id
CROSS JOIN vendor_variance vv
WHERE a.status IN ('active', 'scheduled');
```

**6. All Available Auctions Already Bid On:**

```typescript
// Return empty list with helpful message
if (availableAuctions.length === 0) {
  return {
    recommendations: [],
    message: "You've bid on all available auctions! Check back soon for new opportunities.",
    nextAuctionTime: await getNextScheduledAuctionTime()
  };
}
```

#### Cold-Start Strategy for Recommendations

Progressive transition as vendor data accumulates:

**Phase 1: New Vendor (0 bids)**
```
Strategy: Popularity + Category Matching
- Show top 20 most-watched auctions
- Filter by vendor's selected categories
- Reason: "Popular auction", "Matches your interests"
Weight: 100% popularity-based
```

**Phase 2: Early Activity (1-2 bids)**
```
Strategy: Content-Based with Popularity Fallback
- Match asset type and price range from early bids
- Supplement with popular auctions
- Reason: "Similar to your recent bid", "Trending"
Weight: 70% content-based, 30% popularity
```

**Phase 3: Building History (3-9 bids)**
```
Strategy: Hybrid with Content Emphasis
- Begin collaborative filtering with low weight
- Strong content-based matching
- Reason: "Matches your preferences", "Similar to past bids"
Weight: 40% collaborative, 60% content-based
```

**Phase 4: Established Vendor (10+ bids)**
```
Strategy: Full Hybrid Approach
- Strong collaborative filtering
- Content-based for diversity
- Reason: "Similar to your winning bids", "Based on your history"
Weight: 60% collaborative, 40% content-based
```

**Platform Cold-Start (< 10 Active Vendors)**
```
Strategy: Prioritize Content and Popularity
- Insufficient data for collaborative filtering
- Focus on content-based and trending auctions
- Gradually introduce collaborative as vendor base grows
Weight: 20% collaborative, 60% content-based, 20% popularity
```


## 2. Data Structures

### 2.1 Database Schema

#### Predictions Table

```typescript
// Drizzle ORM Schema
import { pgTable, uuid, numeric, timestamp, varchar, jsonb, index } from 'drizzle-orm/pg-core';

export const predictions = pgTable('predictions', {
  id: uuid('id').primaryKey().defaultRandom(),
  auctionId: uuid('auction_id')
    .notNull()
    .references(() => auctions.id, { onDelete: 'cascade' }),
  predictedPrice: numeric('predicted_price', { precision: 12, scale: 2 }).notNull(),
  lowerBound: numeric('lower_bound', { precision: 12, scale: 2 }).notNull(),
  upperBound: numeric('upper_bound', { precision: 12, scale: 2 }).notNull(),
  confidenceScore: numeric('confidence_score', { precision: 5, scale: 4 }).notNull(), // 0.0000 to 1.0000
  confidenceLevel: varchar('confidence_level', { length: 20 }).notNull(), // 'High', 'Medium', 'Low'
  algorithmVersion: varchar('algorithm_version', { length: 50 }).notNull().default('v1.0'),
  method: varchar('method', { length: 50 }).notNull(), // 'historical', 'salvage_value', 'market_value_calc'
  sampleSize: integer('sample_size').notNull().default(0),
  metadata: jsonb('metadata').$type<{
    similarAuctions?: number;
    marketAdjustment?: number;
    competitionLevel?: string;
    seasonalFactor?: number;
    warnings?: string[];
    notes?: string[];
  }>(),
  // Accuracy tracking (filled after auction closes)
  actualPrice: numeric('actual_price', { precision: 12, scale: 2 }),
  accuracy: numeric('accuracy', { precision: 5, scale: 4 }), // Percentage error
  absoluteError: numeric('absolute_error', { precision: 12, scale: 2 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  auctionIdIdx: index('idx_predictions_auction_id').on(table.auctionId),
  createdAtIdx: index('idx_predictions_created_at').on(table.createdAt),
  accuracyIdx: index('idx_predictions_accuracy').on(table.accuracy),
  methodIdx: index('idx_predictions_method').on(table.method),
  confidenceIdx: index('idx_predictions_confidence').on(table.confidenceScore),
}));
```

**SQL Migration:**

```sql
CREATE TABLE predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  predicted_price NUMERIC(12, 2) NOT NULL,
  lower_bound NUMERIC(12, 2) NOT NULL,
  upper_bound NUMERIC(12, 2) NOT NULL,
  confidence_score NUMERIC(5, 4) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  confidence_level VARCHAR(20) NOT NULL CHECK (confidence_level IN ('High', 'Medium', 'Low')),
  algorithm_version VARCHAR(50) NOT NULL DEFAULT 'v1.0',
  method VARCHAR(50) NOT NULL CHECK (method IN ('historical', 'salvage_value', 'market_value_calc', 'no_prediction')),
  sample_size INTEGER NOT NULL DEFAULT 0,
  metadata JSONB,
  actual_price NUMERIC(12, 2),
  accuracy NUMERIC(5, 4),
  absolute_error NUMERIC(12, 2),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_predictions_auction_id ON predictions(auction_id);
CREATE INDEX idx_predictions_created_at ON predictions(created_at DESC);
CREATE INDEX idx_predictions_accuracy ON predictions(accuracy) WHERE accuracy IS NOT NULL;
CREATE INDEX idx_predictions_method ON predictions(method);
CREATE INDEX idx_predictions_confidence ON predictions(confidence_score DESC);
```

#### Recommendations Table

```typescript
export const recommendations = pgTable('recommendations', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id, { onDelete: 'cascade' }),
  auctionId: uuid('auction_id')
    .notNull()
    .references(() => auctions.id, { onDelete: 'cascade' }),
  matchScore: numeric('match_score', { precision: 5, scale: 2 }).notNull(), // 0.00 to 100.00
  collaborativeScore: numeric('collaborative_score', { precision: 5, scale: 2 }),
  contentScore: numeric('content_score', { precision: 5, scale: 2 }),
  popularityBoost: numeric('popularity_boost', { precision: 5, scale: 2 }),
  winRateBoost: numeric('win_rate_boost', { precision: 5, scale: 2 }),
  reasonCodes: jsonb('reason_codes').$type<string[]>().notNull(),
  algorithmVersion: varchar('algorithm_version', { length: 50 }).notNull().default('v1.0'),
  // Interaction tracking
  clicked: boolean('clicked').notNull().default(false),
  clickedAt: timestamp('clicked_at'),
  bidPlaced: boolean('bid_placed').notNull().default(false),
  bidPlacedAt: timestamp('bid_placed_at'),
  bidAmount: numeric('bid_amount', { precision: 12, scale: 2 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  vendorIdIdx: index('idx_recommendations_vendor_id').on(table.vendorId),
  auctionIdIdx: index('idx_recommendations_auction_id').on(table.auctionId),
  matchScoreIdx: index('idx_recommendations_match_score').on(table.matchScore),
  createdAtIdx: index('idx_recommendations_created_at').on(table.createdAt),
  clickedIdx: index('idx_recommendations_clicked').on(table.clicked),
  bidPlacedIdx: index('idx_recommendations_bid_placed').on(table.bidPlaced),
  vendorAuctionIdx: index('idx_recommendations_vendor_auction').on(table.vendorId, table.auctionId),
}));
```

**SQL Migration:**

```sql
CREATE TABLE recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  match_score NUMERIC(5, 2) NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
  collaborative_score NUMERIC(5, 2),
  content_score NUMERIC(5, 2),
  popularity_boost NUMERIC(5, 2),
  win_rate_boost NUMERIC(5, 2),
  reason_codes JSONB NOT NULL,
  algorithm_version VARCHAR(50) NOT NULL DEFAULT 'v1.0',
  clicked BOOLEAN NOT NULL DEFAULT FALSE,
  clicked_at TIMESTAMP,
  bid_placed BOOLEAN NOT NULL DEFAULT FALSE,
  bid_placed_at TIMESTAMP,
  bid_amount NUMERIC(12, 2),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(vendor_id, auction_id, created_at)
);

CREATE INDEX idx_recommendations_vendor_id ON recommendations(vendor_id);
CREATE INDEX idx_recommendations_auction_id ON recommendations(auction_id);
CREATE INDEX idx_recommendations_match_score ON recommendations(match_score DESC);
CREATE INDEX idx_recommendations_created_at ON recommendations(created_at DESC);
CREATE INDEX idx_recommendations_clicked ON recommendations(clicked) WHERE clicked = TRUE;
CREATE INDEX idx_recommendations_bid_placed ON recommendations(bid_placed) WHERE bid_placed = TRUE;
CREATE INDEX idx_recommendations_vendor_auction ON recommendations(vendor_id, auction_id);
```


#### Interactions Table

```typescript
export const interactionTypeEnum = pgEnum('interaction_type', ['view', 'bid', 'win', 'watch', 'unwatch']);

export const interactions = pgTable('interactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id, { onDelete: 'cascade' }),
  auctionId: uuid('auction_id')
    .notNull()
    .references(() => auctions.id, { onDelete: 'cascade' }),
  eventType: interactionTypeEnum('event_type').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  sessionId: varchar('session_id', { length: 100 }),
  metadata: jsonb('metadata').$type<{
    predictionShown?: {
      predictedPrice: number;
      confidenceScore: number;
    };
    bidAmount?: number;
    deviceType?: string;
    referrer?: string;
    timeOnPage?: number;
  }>(),
}, (table) => ({
  vendorIdIdx: index('idx_interactions_vendor_id').on(table.vendorId),
  auctionIdIdx: index('idx_interactions_auction_id').on(table.auctionId),
  eventTypeIdx: index('idx_interactions_event_type').on(table.eventType),
  timestampIdx: index('idx_interactions_timestamp').on(table.timestamp),
  vendorEventIdx: index('idx_interactions_vendor_event').on(table.vendorId, table.eventType),
}));
```

**SQL Migration:**

```sql
CREATE TYPE interaction_type AS ENUM ('view', 'bid', 'win', 'watch', 'unwatch');

CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  event_type interaction_type NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  session_id VARCHAR(100),
  metadata JSONB
);

CREATE INDEX idx_interactions_vendor_id ON interactions(vendor_id);
CREATE INDEX idx_interactions_auction_id ON interactions(auction_id);
CREATE INDEX idx_interactions_event_type ON interactions(event_type);
CREATE INDEX idx_interactions_timestamp ON interactions(timestamp DESC);
CREATE INDEX idx_interactions_vendor_event ON interactions(vendor_id, event_type);

-- Partition by month for scalability
CREATE TABLE interactions_2025_01 PARTITION OF interactions
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
-- Add partitions as needed
```

#### Algorithm Config Table

```typescript
export const algorithmConfig = pgTable('algorithm_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  configKey: varchar('config_key', { length: 100 }).notNull().unique(),
  configValue: jsonb('config_value').notNull(),
  description: text('description'),
  version: varchar('version', { length: 50 }).notNull().default('v1.0'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  configKeyIdx: index('idx_algorithm_config_key').on(table.configKey),
  isActiveIdx: index('idx_algorithm_config_active').on(table.isActive),
}));
```

**SQL Migration:**

```sql
CREATE TABLE algorithm_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key VARCHAR(100) NOT NULL UNIQUE,
  config_value JSONB NOT NULL,
  description TEXT,
  version VARCHAR(50) NOT NULL DEFAULT 'v1.0',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_algorithm_config_key ON algorithm_config(config_key);
CREATE INDEX idx_algorithm_config_active ON algorithm_config(is_active) WHERE is_active = TRUE;

-- Insert default configuration
INSERT INTO algorithm_config (config_key, config_value, description) VALUES
('prediction.similarity_threshold', '60', 'Minimum similarity score for historical matching'),
('prediction.time_decay_months', '6', 'Months for exponential time decay'),
('prediction.min_sample_size', '5', 'Minimum similar auctions for high confidence'),
('prediction.confidence_base', '0.85', 'Base confidence score for good data'),
('recommendation.collab_weight', '0.60', 'Weight for collaborative filtering'),
('recommendation.content_weight', '0.40', 'Weight for content-based filtering'),
('recommendation.min_match_score', '25', 'Minimum match score threshold'),
('recommendation.cold_start_bid_threshold', '3', 'Bids needed to transition from cold start'),
('market.competition_high_threshold', '1.3', 'Multiplier for high competition detection'),
('market.competition_low_threshold', '0.7', 'Multiplier for low competition detection');
```

### 2.2 Materialized Views

#### Vendor Bidding Patterns View

```sql
CREATE MATERIALIZED VIEW vendor_bidding_patterns AS
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
aggregated_patterns AS (
  SELECT 
    vendor_id,
    -- Asset type preferences
    jsonb_object_agg(
      asset_type,
      COUNT(*)
    ) FILTER (WHERE asset_type IS NOT NULL) AS asset_type_frequency,
    -- Top makes
    ARRAY_AGG(DISTINCT asset_details->>'make' ORDER BY COUNT(*) DESC)
      FILTER (WHERE asset_details->>'make' IS NOT NULL)
      [1:5] AS top_makes,
    -- Top models
    ARRAY_AGG(DISTINCT asset_details->>'model' ORDER BY COUNT(*) DESC)
      FILTER (WHERE asset_details->>'model' IS NOT NULL)
      [1:10] AS top_models,
    -- Price statistics
    PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY amount) AS price_p10,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY amount) AS price_p25,
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY amount) AS price_median,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY amount) AS price_p75,
    PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY amount) AS price_p90,
    AVG(amount) AS avg_bid_amount,
    STDDEV(amount) AS bid_amount_stddev,
    -- Damage preferences
    jsonb_object_agg(
      damage_severity,
      COUNT(*)
    ) FILTER (WHERE damage_severity IS NOT NULL) AS damage_level_frequency,
    -- Win rates
    COUNT(*) FILTER (WHERE is_winner)::float / NULLIF(COUNT(*), 0) AS overall_win_rate,
    jsonb_object_agg(
      asset_type,
      COUNT(*) FILTER (WHERE is_winner)::float / NULLIF(COUNT(*), 0)
    ) FILTER (WHERE asset_type IS NOT NULL) AS win_rate_by_asset_type,
    -- Bidding behavior
    AVG(amount / NULLIF(market_value, 0)) AS avg_bid_to_value_ratio,
    COUNT(*) AS total_bids,
    COUNT(DISTINCT DATE_TRUNC('week', created_at)) AS active_weeks,
    COUNT(*) / NULLIF(COUNT(DISTINCT DATE_TRUNC('week', created_at)), 0) AS bids_per_week,
    MAX(created_at) AS last_bid_at
  FROM vendor_bids
  GROUP BY vendor_id
)
SELECT 
  v.id AS vendor_id,
  v.tier,
  v.rating,
  v.categories,
  v.performance_stats,
  ap.*,
  -- Segmentation
  CASE 
    WHEN ap.avg_bid_to_value_ratio < 0.4 THEN 'bargain_hunter'
    WHEN ap.avg_bid_to_value_ratio > 0.7 THEN 'premium_buyer'
    ELSE 'value_seeker'
  END AS price_segment,
  CASE 
    WHEN jsonb_array_length(COALESCE(ap.asset_type_frequency, '{}'::jsonb)) <= 2 THEN 'specialist'
    ELSE 'generalist'
  END AS category_segment,
  CASE 
    WHEN ap.bids_per_week >= 3 THEN 'active_bidder'
    WHEN ap.bids_per_week >= 1 THEN 'regular_bidder'
    ELSE 'selective_bidder'
  END AS activity_segment,
  NOW() AS last_updated
FROM vendors v
LEFT JOIN aggregated_patterns ap ON ap.vendor_id = v.id;

CREATE UNIQUE INDEX idx_vendor_bidding_patterns_vendor_id ON vendor_bidding_patterns(vendor_id);
CREATE INDEX idx_vendor_bidding_patterns_segments ON vendor_bidding_patterns(price_segment, category_segment, activity_segment);
CREATE INDEX idx_vendor_bidding_patterns_last_updated ON vendor_bidding_patterns(last_updated);
```


#### Market Conditions View

```sql
CREATE MATERIALIZED VIEW market_conditions_summary AS
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
)
SELECT 
  -- Overall metrics
  AVG(ra.bid_count) AS avg_bids_per_auction_recent,
  AVG(hb.bid_count) AS avg_bids_per_auction_historical,
  AVG(ra.unique_bidders) AS avg_unique_bidders_recent,
  AVG(ra.current_bid) AS avg_final_price_recent,
  AVG(hb.current_bid) AS avg_final_price_historical,
  
  -- Competition level
  CASE 
    WHEN AVG(ra.bid_count) > AVG(hb.bid_count) * 1.3 THEN 'high'
    WHEN AVG(ra.bid_count) > AVG(hb.bid_count) * 1.1 THEN 'moderate_high'
    WHEN AVG(ra.bid_count) < AVG(hb.bid_count) * 0.7 THEN 'low'
    WHEN AVG(ra.bid_count) < AVG(hb.bid_count) * 0.9 THEN 'moderate_low'
    ELSE 'normal'
  END AS competition_level,
  
  -- Price trend
  CASE 
    WHEN AVG(ra.current_bid) > AVG(hb.current_bid) * 1.2 THEN 'rising'
    WHEN AVG(ra.current_bid) > AVG(hb.current_bid) * 1.05 THEN 'slight_rise'
    WHEN AVG(ra.current_bid) < AVG(hb.current_bid) * 0.8 THEN 'falling'
    WHEN AVG(ra.current_bid) < AVG(hb.current_bid) * 0.95 THEN 'slight_fall'
    ELSE 'stable'
  END AS price_trend,
  
  -- By asset type
  jsonb_object_agg(
    ra.asset_type,
    jsonb_build_object(
      'avg_bids', AVG(ra.bid_count),
      'avg_price', AVG(ra.current_bid),
      'avg_bidders', AVG(ra.unique_bidders)
    )
  ) AS metrics_by_asset_type,
  
  -- Seasonal factor
  EXTRACT(MONTH FROM NOW()) AS current_month,
  CASE 
    WHEN EXTRACT(MONTH FROM NOW()) IN (1, 2, 12) THEN 0.95
    WHEN EXTRACT(MONTH FROM NOW()) IN (4, 5, 6) THEN 1.05
    ELSE 1.0
  END AS seasonal_multiplier,
  
  NOW() AS last_updated
FROM recent_auctions ra
CROSS JOIN historical_baseline hb
GROUP BY ra.asset_type;

CREATE INDEX idx_market_conditions_last_updated ON market_conditions_summary(last_updated);
```

### 2.3 TypeScript Interfaces

```typescript
// Prediction Types
export interface PredictionResult {
  id: string;
  auctionId: string;
  predictedPrice: number;
  lowerBound: number;
  upperBound: number;
  confidenceScore: number;
  confidenceLevel: 'High' | 'Medium' | 'Low';
  algorithmVersion: string;
  method: 'historical' | 'salvage_value' | 'market_value_calc' | 'no_prediction';
  sampleSize: number;
  metadata: {
    similarAuctions?: number;
    marketAdjustment?: number;
    competitionLevel?: string;
    seasonalFactor?: number;
    warnings?: string[];
    notes?: string[];
  };
  createdAt: Date;
}

// Recommendation Types
export interface RecommendationResult {
  id: string;
  auctionId: string;
  matchScore: number;
  collaborativeScore?: number;
  contentScore?: number;
  popularityBoost?: number;
  winRateBoost?: number;
  reasonCodes: string[];
  auction: {
    id: string;
    caseId: string;
    startTime: Date;
    endTime: Date;
    currentBid?: number;
    watchingCount: number;
    case: {
      assetType: string;
      assetDetails: Record<string, any>;
      marketValue: number;
      reservePrice?: number;
      damageSeverity?: string;
      photos: string[];
    };
  };
  prediction?: PredictionResult;
  createdAt: Date;
}

// Interaction Types
export interface InteractionEvent {
  vendorId: string;
  auctionId: string;
  eventType: 'view' | 'bid' | 'win' | 'watch' | 'unwatch';
  sessionId?: string;
  metadata?: {
    predictionShown?: {
      predictedPrice: number;
      confidenceScore: number;
    };
    bidAmount?: number;
    deviceType?: string;
    referrer?: string;
    timeOnPage?: number;
  };
}

// Vendor Pattern Types
export interface VendorBiddingPattern {
  vendorId: string;
  assetTypeFrequency: Record<string, number>;
  topMakes: string[];
  topModels: string[];
  priceP10: number;
  priceP25: number;
  priceMedian: number;
  priceP75: number;
  priceP90: number;
  avgBidAmount: number;
  bidAmountStddev: number;
  damageLevelFrequency: Record<string, number>;
  overallWinRate: number;
  winRateByAssetType: Record<string, number>;
  avgBidToValueRatio: number;
  totalBids: number;
  activeWeeks: number;
  bidsPerWeek: number;
  lastBidAt: Date;
  priceSegment: 'bargain_hunter' | 'premium_buyer' | 'value_seeker';
  categorySegment: 'specialist' | 'generalist';
  activitySegment: 'active_bidder' | 'regular_bidder' | 'selective_bidder';
}

// Market Condition Types
export interface MarketConditions {
  avgBidsPerAuctionRecent: number;
  avgBidsPerAuctionHistorical: number;
  avgUniqueBiddersRecent: number;
  avgFinalPriceRecent: number;
  avgFinalPriceHistorical: number;
  competitionLevel: 'high' | 'moderate_high' | 'normal' | 'moderate_low' | 'low';
  priceTrend: 'rising' | 'slight_rise' | 'stable' | 'slight_fall' | 'falling';
  metricsByAssetType: Record<string, {
    avgBids: number;
    avgPrice: number;
    avgBidders: number;
  }>;
  currentMonth: number;
  seasonalMultiplier: number;
  lastUpdated: Date;
}
```


## 3. API Design

### 3.1 REST API Endpoints

#### GET /api/auctions/:id/prediction

Get price prediction for a specific auction.

**Request:**
```typescript
GET /api/auctions/550e8400-e29b-41d4-a716-446655440000/prediction
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "auctionId": "550e8400-e29b-41d4-a716-446655440000",
    "predictedPrice": 1250000.00,
    "lowerBound": 1125000.00,
    "upperBound": 1375000.00,
    "confidenceScore": 0.8250,
    "confidenceLevel": "High",
    "algorithmVersion": "v1.0",
    "method": "historical",
    "sampleSize": 12,
    "metadata": {
      "similarAuctions": 12,
      "marketAdjustment": 1.08,
      "competitionLevel": "moderate_high",
      "seasonalFactor": 1.05,
      "notes": [
        "Based on 12 similar auctions from the past 6 months",
        "Market showing moderate-high competition"
      ]
    },
    "createdAt": "2025-01-15T10:30:00Z"
  }
}
```

**Response (404 Not Found):**
```json
{
  "success": false,
  "error": {
    "code": "AUCTION_NOT_FOUND",
    "message": "Auction not found"
  }
}
```

**Response (200 OK - No Prediction Available):**
```json
{
  "success": true,
  "data": {
    "auctionId": "550e8400-e29b-41d4-a716-446655440000",
    "method": "no_prediction",
    "message": "Insufficient data for price prediction",
    "fallbackData": {
      "marketValue": 2000000.00,
      "reservePrice": 800000.00,
      "estimatedSalvageValue": 1000000.00
    }
  }
}
```

**Error Codes:**
- `400` - Invalid auction ID format
- `404` - Auction not found
- `500` - Internal server error

**Performance Target:** < 200ms (95th percentile)

---

#### GET /api/vendors/:id/recommendations

Get personalized auction recommendations for a vendor.

**Request:**
```typescript
GET /api/vendors/660e8400-e29b-41d4-a716-446655440001/recommendations?limit=20&offset=0
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (optional): Number of recommendations (default: 20, max: 50)
- `offset` (optional): Pagination offset (default: 0)
- `includeDetails` (optional): Include full auction details (default: true)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "id": "8d9e6679-7425-40de-944b-e07fc1f90ae8",
        "auctionId": "770e8400-e29b-41d4-a716-446655440002",
        "matchScore": 87.50,
        "collaborativeScore": 75.00,
        "contentScore": 85.00,
        "popularityBoost": 8.00,
        "winRateBoost": 12.00,
        "reasonCodes": [
          "Similar to your winning bids",
          "Matches your preferred categories",
          "High win rate in this category"
        ],
        "auction": {
          "id": "770e8400-e29b-41d4-a716-446655440002",
          "startTime": "2025-01-16T09:00:00Z",
          "endTime": "2025-01-17T09:00:00Z",
          "currentBid": 950000.00,
          "watchingCount": 15,
          "case": {
            "assetType": "vehicle",
            "assetDetails": {
              "make": "Toyota",
              "model": "Camry",
              "year": 2020
            },
            "marketValue": 1500000.00,
            "reservePrice": 800000.00,
            "damageSeverity": "moderate",
            "photos": ["url1", "url2"]
          }
        },
        "prediction": {
          "predictedPrice": 1100000.00,
          "confidenceLevel": "High"
        },
        "createdAt": "2025-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 45,
      "limit": 20,
      "offset": 0,
      "hasMore": true
    },
    "metadata": {
      "vendorSegment": {
        "price": "value_seeker",
        "category": "specialist",
        "activity": "active_bidder"
      },
      "algorithmVersion": "v1.0"
    }
  }
}
```

**Response (200 OK - No Recommendations):**
```json
{
  "success": true,
  "data": {
    "recommendations": [],
    "message": "You've bid on all available auctions! Check back soon for new opportunities.",
    "nextAuctionTime": "2025-01-16T14:00:00Z"
  }
}
```

**Error Codes:**
- `400` - Invalid vendor ID or parameters
- `401` - Unauthorized (vendor can only access own recommendations)
- `404` - Vendor not found
- `500` - Internal server error

**Performance Target:** < 200ms (95th percentile)

---

#### POST /api/intelligence/interactions

Record vendor interaction events.

**Request:**
```typescript
POST /api/intelligence/interactions
Authorization: Bearer <token>
Content-Type: application/json

{
  "vendorId": "660e8400-e29b-41d4-a716-446655440001",
  "auctionId": "770e8400-e29b-41d4-a716-446655440002",
  "eventType": "view",
  "sessionId": "sess_abc123xyz",
  "metadata": {
    "predictionShown": {
      "predictedPrice": 1100000.00,
      "confidenceScore": 0.85
    },
    "deviceType": "mobile",
    "referrer": "recommendations",
    "timeOnPage": 45
  }
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "9e9e6679-7425-40de-944b-e07fc1f90ae9",
    "recorded": true,
    "timestamp": "2025-01-15T10:30:15Z"
  }
}
```

**Batch Request:**
```typescript
POST /api/intelligence/interactions/batch
Authorization: Bearer <token>
Content-Type: application/json

{
  "events": [
    {
      "vendorId": "660e8400-e29b-41d4-a716-446655440001",
      "auctionId": "770e8400-e29b-41d4-a716-446655440002",
      "eventType": "view",
      "timestamp": "2025-01-15T10:30:00Z"
    },
    {
      "vendorId": "660e8400-e29b-41d4-a716-446655440001",
      "auctionId": "770e8400-e29b-41d4-a716-446655440002",
      "eventType": "bid",
      "metadata": {
        "bidAmount": 1050000.00
      },
      "timestamp": "2025-01-15T10:32:00Z"
    }
  ]
}
```

**Error Codes:**
- `400` - Invalid event data
- `401` - Unauthorized
- `422` - Validation error
- `500` - Internal server error

---

#### GET /api/intelligence/metrics

Get intelligence system performance metrics (admin only).

**Request:**
```typescript
GET /api/intelligence/metrics?period=7d&assetType=vehicle
Authorization: Bearer <admin_token>
```

**Query Parameters:**
- `period` (optional): Time period (1d, 7d, 30d, 90d) (default: 7d)
- `assetType` (optional): Filter by asset type
- `algorithmVersion` (optional): Filter by algorithm version

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "predictions": {
      "total": 1250,
      "accuracy": {
        "meanAbsoluteError": 125000.00,
        "meanPercentageError": 12.5,
        "confidenceCalibration": 0.87,
        "byConfidenceLevel": {
          "High": { "count": 850, "avgError": 8.2 },
          "Medium": { "count": 300, "avgError": 15.5 },
          "Low": { "count": 100, "avgError": 22.8 }
        }
      },
      "methods": {
        "historical": { "count": 950, "avgConfidence": 0.82 },
        "salvage_value": { "count": 250, "avgConfidence": 0.35 },
        "market_value_calc": { "count": 50, "avgConfidence": 0.22 }
      }
    },
    "recommendations": {
      "total": 5600,
      "clickThroughRate": 0.35,
      "bidConversionRate": 0.18,
      "engagementLift": 0.42,
      "bySegment": {
        "active_bidder": { "ctr": 0.45, "conversion": 0.25 },
        "regular_bidder": { "ctr": 0.32, "conversion": 0.15 },
        "selective_bidder": { "ctr": 0.28, "conversion": 0.12 }
      }
    },
    "performance": {
      "avgResponseTime": 145,
      "p95ResponseTime": 185,
      "p99ResponseTime": 220,
      "cacheHitRate": 0.78
    },
    "period": {
      "start": "2025-01-08T00:00:00Z",
      "end": "2025-01-15T00:00:00Z"
    }
  }
}
```

**Error Codes:**
- `401` - Unauthorized
- `403` - Forbidden (admin only)
- `500` - Internal server error


#### POST /api/intelligence/export

Export intelligence data for ML training (admin only).

**Request:**
```typescript
POST /api/intelligence/export
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "dataType": "predictions",
  "format": "csv",
  "dateRange": {
    "start": "2024-01-01",
    "end": "2025-01-15"
  },
  "anonymize": true,
  "includeFeatures": true
}
```

**Parameters:**
- `dataType`: "predictions" | "recommendations" | "interactions" | "all"
- `format`: "csv" | "json" | "parquet"
- `dateRange`: Start and end dates
- `anonymize`: Remove PII (default: true)
- `includeFeatures`: Include feature vectors (default: true)

**Response (202 Accepted):**
```json
{
  "success": true,
  "data": {
    "exportId": "exp_abc123xyz",
    "status": "processing",
    "estimatedTime": 120,
    "message": "Export job queued. You'll receive a notification when ready."
  }
}
```

**GET /api/intelligence/export/:exportId** (Check Status):
```json
{
  "success": true,
  "data": {
    "exportId": "exp_abc123xyz",
    "status": "completed",
    "downloadUrl": "https://storage.example.com/exports/exp_abc123xyz.csv",
    "expiresAt": "2025-01-16T10:30:00Z",
    "metadata": {
      "recordCount": 125000,
      "fileSize": "45MB",
      "schema": {
        "predictions": ["auction_id", "predicted_price", "actual_price", "confidence_score", "features"]
      }
    }
  }
}
```

---

#### GET /api/admin/intelligence/config

Get and update algorithm configuration (admin only).

**Request:**
```typescript
GET /api/admin/intelligence/config
Authorization: Bearer <admin_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "configs": [
      {
        "id": "cfg_001",
        "configKey": "prediction.similarity_threshold",
        "configValue": 60,
        "description": "Minimum similarity score for historical matching",
        "version": "v1.0",
        "isActive": true,
        "updatedAt": "2025-01-10T08:00:00Z"
      },
      {
        "id": "cfg_002",
        "configKey": "recommendation.collab_weight",
        "configValue": 0.60,
        "description": "Weight for collaborative filtering",
        "version": "v1.0",
        "isActive": true,
        "updatedAt": "2025-01-10T08:00:00Z"
      }
    ]
  }
}
```

**PUT /api/admin/intelligence/config/:key** (Update Config):
```typescript
PUT /api/admin/intelligence/config/prediction.similarity_threshold
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "configValue": 55,
  "version": "v1.1"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "configKey": "prediction.similarity_threshold",
    "oldValue": 60,
    "newValue": 55,
    "version": "v1.1",
    "updatedAt": "2025-01-15T10:30:00Z"
  }
}
```

### 3.2 Real-Time Integration (Socket.IO)

#### Socket.IO Events

**Client → Server Events:**

```typescript
// Subscribe to auction predictions
socket.emit('subscribe:prediction', {
  auctionId: '550e8400-e29b-41d4-a716-446655440000'
});

// Subscribe to vendor recommendations
socket.emit('subscribe:recommendations', {
  vendorId: '660e8400-e29b-41d4-a716-446655440001'
});

// Unsubscribe
socket.emit('unsubscribe:prediction', {
  auctionId: '550e8400-e29b-41d4-a716-446655440000'
});
```

**Server → Client Events:**

```typescript
// Prediction updated (when new bid changes market conditions)
socket.on('prediction:updated', (data) => {
  console.log(data);
  /*
  {
    auctionId: '550e8400-e29b-41d4-a716-446655440000',
    prediction: {
      predictedPrice: 1280000.00,
      lowerBound: 1150000.00,
      upperBound: 1410000.00,
      confidenceScore: 0.83,
      confidenceLevel: 'High',
      metadata: {
        note: 'Updated due to increased bidding activity'
      }
    },
    updatedAt: '2025-01-15T10:35:00Z'
  }
  */
});

// New recommendations available
socket.on('recommendations:refreshed', (data) => {
  console.log(data);
  /*
  {
    vendorId: '660e8400-e29b-41d4-a716-446655440001',
    newRecommendations: 3,
    topRecommendation: {
      auctionId: '880e8400-e29b-41d4-a716-446655440003',
      matchScore: 92.5,
      reasonCodes: ['Similar to your winning bids', 'Trending auction']
    },
    message: '3 new auctions match your interests!'
  }
  */
});

// Auction closed - accuracy calculated
socket.on('auction:closed', (data) => {
  console.log(data);
  /*
  {
    auctionId: '550e8400-e29b-41d4-a716-446655440000',
    finalPrice: 1265000.00,
    prediction: {
      predictedPrice: 1250000.00,
      accuracy: 98.8,
      error: 15000.00
    },
    winner: {
      vendorId: '660e8400-e29b-41d4-a716-446655440001'
    }
  }
  */
});

// High-value recommendation alert
socket.on('recommendation:alert', (data) => {
  console.log(data);
  /*
  {
    vendorId: '660e8400-e29b-41d4-a716-446655440001',
    recommendation: {
      auctionId: '990e8400-e29b-41d4-a716-446655440004',
      matchScore: 95.0,
      reasonCodes: ['Perfect match for your preferences'],
      auction: {
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2021 },
        endTime: '2025-01-16T15:00:00Z'
      }
    },
    priority: 'high',
    message: 'Perfect match found! Auction ends in 24 hours.'
  }
  */
});
```

**Server Implementation:**

```typescript
// src/lib/socket/intelligence-handlers.ts
import { Server as SocketIOServer } from 'socket.io';
import { db } from '@/lib/db';

export function setupIntelligenceHandlers(io: SocketIOServer) {
  io.on('connection', (socket) => {
    // Subscribe to prediction updates
    socket.on('subscribe:prediction', async ({ auctionId }) => {
      socket.join(`prediction:${auctionId}`);
      
      // Send current prediction immediately
      const prediction = await getPrediction(auctionId);
      socket.emit('prediction:current', prediction);
    });

    // Subscribe to recommendations
    socket.on('subscribe:recommendations', async ({ vendorId }) => {
      // Verify vendor owns this session
      if (socket.data.vendorId !== vendorId) {
        socket.emit('error', { message: 'Unauthorized' });
        return;
      }
      
      socket.join(`recommendations:${vendorId}`);
      
      // Send current recommendations immediately
      const recommendations = await getRecommendations(vendorId);
      socket.emit('recommendations:current', recommendations);
    });

    // Unsubscribe handlers
    socket.on('unsubscribe:prediction', ({ auctionId }) => {
      socket.leave(`prediction:${auctionId}`);
    });

    socket.on('unsubscribe:recommendations', ({ vendorId }) => {
      socket.leave(`recommendations:${vendorId}`);
    });
  });
}

// Broadcast prediction update
export function broadcastPredictionUpdate(
  io: SocketIOServer,
  auctionId: string,
  prediction: PredictionResult
) {
  io.to(`prediction:${auctionId}`).emit('prediction:updated', {
    auctionId,
    prediction,
    updatedAt: new Date().toISOString()
  });
}

// Broadcast new recommendations
export function broadcastRecommendationsRefresh(
  io: SocketIOServer,
  vendorId: string,
  recommendations: RecommendationResult[]
) {
  const topRec = recommendations[0];
  io.to(`recommendations:${vendorId}`).emit('recommendations:refreshed', {
    vendorId,
    newRecommendations: recommendations.length,
    topRecommendation: topRec ? {
      auctionId: topRec.auctionId,
      matchScore: topRec.matchScore,
      reasonCodes: topRec.reasonCodes
    } : null,
    message: `${recommendations.length} new auctions match your interests!`
  });
}
```


## 4. Implementation Architecture

### 4.1 Service Layer

#### PredictionService

```typescript
// src/features/intelligence/services/prediction.service.ts
import { db } from '@/lib/db';
import { predictions, auctions, salvageCases } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export class PredictionService {
  /**
   * Generate price prediction for an auction
   */
  async generatePrediction(auctionId: string): Promise<PredictionResult> {
    // 1. Get auction and case details
    const auction = await this.getAuctionDetails(auctionId);
    if (!auction) throw new Error('Auction not found');

    // 2. Try historical prediction
    const historicalPrediction = await this.calculateHistoricalPrediction(auction);
    if (historicalPrediction && historicalPrediction.sampleSize >= 1) {
      return await this.savePrediction(historicalPrediction);
    }

    // 3. Fallback to salvage value
    if (auction.case.estimatedSalvageValue) {
      const salvagePrediction = this.calculateSalvageValuePrediction(auction);
      return await this.savePrediction(salvagePrediction);
    }

    // 4. Fallback to market value calculation
    const marketPrediction = this.calculateMarketValuePrediction(auction);
    return await this.savePrediction(marketPrediction);
  }

  /**
   * Calculate prediction using historical data
   */
  private async calculateHistoricalPrediction(auction: AuctionWithCase) {
    const { make, model, year } = auction.case.assetDetails;
    const { damageSeverity, marketValue, assetType } = auction.case;

    // Execute similarity matching query
    const similarAuctions = await db.execute(sql`
      WITH similar_auctions AS (
        SELECT 
          a.id,
          a.current_bid AS final_price,
          sc.asset_details,
          sc.damage_severity,
          -- Similarity score calculation
          (
            CASE 
              WHEN sc.asset_details->>'make' = ${make} 
               AND sc.asset_details->>'model' = ${model} THEN 100
              WHEN sc.asset_details->>'make' = ${make} THEN 50
              ELSE 0
            END +
            CASE 
              WHEN (sc.asset_details->>'year')::int = ${year} THEN 20
              WHEN ABS((sc.asset_details->>'year')::int - ${year}) = 1 THEN 15
              WHEN ABS((sc.asset_details->>'year')::int - ${year}) = 2 THEN 10
              ELSE 0
            END +
            CASE 
              WHEN sc.damage_severity = ${damageSeverity} THEN 30
              WHEN (
                (sc.damage_severity = 'minor' AND ${damageSeverity} = 'moderate') OR
                (sc.damage_severity = 'moderate' AND ${damageSeverity} IN ('minor', 'severe')) OR
                (sc.damage_severity = 'severe' AND ${damageSeverity} = 'moderate')
              ) THEN 15
              ELSE 0
            END +
            CASE 
              WHEN ABS(sc.market_value - ${marketValue}) / ${marketValue} < 0.2 THEN 10
              ELSE 0
            END
          ) AS similarity_score,
          EXP(-EXTRACT(EPOCH FROM (NOW() - a.end_time)) / (6 * 30 * 24 * 60 * 60)) AS time_weight
        FROM auctions a
        JOIN salvage_cases sc ON a.case_id = sc.id
        WHERE 
          a.status = 'closed'
          AND a.current_bid IS NOT NULL
          AND sc.asset_type = ${assetType}
          AND a.end_time > NOW() - INTERVAL '12 months'
        HAVING similarity_score >= 60
        ORDER BY similarity_score DESC, time_weight DESC
        LIMIT 50
      )
      SELECT 
        COUNT(*) AS sample_size,
        SUM(final_price * similarity_score / 100.0 * time_weight) / 
          SUM(similarity_score / 100.0 * time_weight) AS predicted_price,
        STDDEV(final_price) AS price_variance,
        AVG(time_weight) AS avg_recency
      FROM similar_auctions
    `);

    if (!similarAuctions.rows[0] || similarAuctions.rows[0].sample_size === 0) {
      return null;
    }

    const { sample_size, predicted_price, price_variance, avg_recency } = similarAuctions.rows[0];

    // Get market conditions
    const marketConditions = await this.getMarketConditions(assetType);
    const adjustedPrice = predicted_price * marketConditions.totalAdjustment;

    // Calculate confidence
    const confidence = this.calculateConfidence(
      sample_size,
      avg_recency,
      price_variance,
      predicted_price
    );

    // Calculate bounds
    const { lowerBound, upperBound } = this.calculateBounds(
      adjustedPrice,
      confidence.score,
      price_variance,
      predicted_price
    );

    return {
      auctionId: auction.id,
      predictedPrice: adjustedPrice,
      lowerBound,
      upperBound,
      confidenceScore: confidence.score,
      confidenceLevel: confidence.level,
      method: 'historical',
      sampleSize: sample_size,
      algorithmVersion: 'v1.0',
      metadata: {
        similarAuctions: sample_size,
        marketAdjustment: marketConditions.totalAdjustment,
        competitionLevel: marketConditions.competitionLevel,
        seasonalFactor: marketConditions.seasonalMultiplier,
        notes: [
          `Based on ${sample_size} similar auctions from the past 6 months`,
          `Market showing ${marketConditions.competitionLevel} competition`
        ]
      }
    };
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    sampleSize: number,
    avgRecency: number,
    variance: number,
    mean: number
  ) {
    const baseConfidence = 0.85;
    const sampleSizeFactor = Math.min(1.0, sampleSize / 10);
    const recencyFactor = avgRecency;
    const varianceFactor = 1 / (1 + (variance / mean));

    const score = Math.min(
      1.0,
      baseConfidence * sampleSizeFactor * recencyFactor * varianceFactor
    );

    const level = score >= 0.75 ? 'High' : score >= 0.50 ? 'Medium' : 'Low';

    return { score, level };
  }

  /**
   * Calculate confidence bounds
   */
  private calculateBounds(
    predictedPrice: number,
    confidenceScore: number,
    variance: number,
    mean: number
  ) {
    const coefficientOfVariation = variance / mean;
    const widthMultiplier = coefficientOfVariation > 0.4 ? 0.45 : 0.30;
    const spread = (1 - confidenceScore) * widthMultiplier;

    return {
      lowerBound: predictedPrice * (1 - spread),
      upperBound: predictedPrice * (1 + spread)
    };
  }

  /**
   * Get market conditions and adjustments
   */
  private async getMarketConditions(assetType: string) {
    const conditions = await db.query.marketConditionsSummary.findFirst();
    
    if (!conditions) {
      return {
        competitionLevel: 'normal',
        totalAdjustment: 1.0,
        seasonalMultiplier: 1.0
      };
    }

    const competitionMultiplier = this.getCompetitionMultiplier(conditions.competitionLevel);
    const trendMultiplier = this.getTrendMultiplier(conditions.priceTrend);
    const seasonalMultiplier = conditions.seasonalMultiplier;

    return {
      competitionLevel: conditions.competitionLevel,
      totalAdjustment: competitionMultiplier * trendMultiplier * seasonalMultiplier,
      seasonalMultiplier
    };
  }

  private getCompetitionMultiplier(level: string): number {
    const multipliers = {
      'high': 1.15,
      'moderate_high': 1.08,
      'normal': 1.0,
      'moderate_low': 0.92,
      'low': 0.85
    };
    return multipliers[level] || 1.0;
  }

  private getTrendMultiplier(trend: string): number {
    const multipliers = {
      'rising': 1.10,
      'slight_rise': 1.05,
      'stable': 1.0,
      'slight_fall': 0.95,
      'falling': 0.90
    };
    return multipliers[trend] || 1.0;
  }

  /**
   * Save prediction to database
   */
  private async savePrediction(prediction: Partial<PredictionResult>) {
    const [saved] = await db.insert(predictions)
      .values({
        ...prediction,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return saved;
  }

  /**
   * Update prediction accuracy after auction closes
   */
  async updateAccuracy(auctionId: string, finalPrice: number) {
    const prediction = await db.query.predictions.findFirst({
      where: eq(predictions.auctionId, auctionId),
      orderBy: (predictions, { desc }) => [desc(predictions.createdAt)]
    });

    if (!prediction) return;

    const absoluteError = Math.abs(finalPrice - prediction.predictedPrice);
    const accuracy = 1 - (absoluteError / finalPrice);

    await db.update(predictions)
      .set({
        actualPrice: finalPrice,
        accuracy,
        absoluteError,
        updatedAt: new Date()
      })
      .where(eq(predictions.id, prediction.id));
  }
}
```


#### RecommendationService

```typescript
// src/features/intelligence/services/recommendation.service.ts
export class RecommendationService {
  /**
   * Generate personalized recommendations for a vendor
   */
  async generateRecommendations(
    vendorId: string,
    limit: number = 20
  ): Promise<RecommendationResult[]> {
    // 1. Get vendor bidding pattern
    const vendorPattern = await this.getVendorPattern(vendorId);
    
    // 2. Determine strategy based on bid history
    const strategy = this.determineStrategy(vendorPattern);
    
    // 3. Generate recommendations based on strategy
    let recommendations: RecommendationResult[];
    
    if (strategy === 'cold_start') {
      recommendations = await this.generateColdStartRecommendations(vendorId, vendorPattern, limit);
    } else if (strategy === 'warming_up') {
      recommendations = await this.generateHybridRecommendations(vendorId, vendorPattern, limit, 0.40, 0.60);
    } else {
      recommendations = await this.generateHybridRecommendations(vendorId, vendorPattern, limit, 0.60, 0.40);
    }
    
    // 4. Save recommendations
    await this.saveRecommendations(recommendations);
    
    return recommendations;
  }

  /**
   * Generate hybrid recommendations (collaborative + content-based)
   */
  private async generateHybridRecommendations(
    vendorId: string,
    pattern: VendorBiddingPattern,
    limit: number,
    collabWeight: number,
    contentWeight: number
  ) {
    // Get collaborative scores
    const collaborativeScores = await this.calculateCollaborativeScores(vendorId, pattern);
    
    // Get content-based scores
    const contentScores = await this.calculateContentScores(vendorId, pattern);
    
    // Combine scores
    const combined = this.combineScores(
      collaborativeScores,
      contentScores,
      collabWeight,
      contentWeight
    );
    
    // Rank and return top N
    return combined
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);
  }

  /**
   * Calculate collaborative filtering scores
   */
  private async calculateCollaborativeScores(vendorId: string, pattern: VendorBiddingPattern) {
    const result = await db.execute(sql`
      WITH vendor_bid_history AS (
        SELECT DISTINCT
          sc.id AS case_id,
          sc.asset_type,
          sc.asset_details,
          sc.damage_severity,
          sc.market_value,
          b.amount AS bid_amount,
          EXP(-EXTRACT(EPOCH FROM (NOW() - b.created_at)) / (90 * 24 * 60 * 60)) AS recency_weight
        FROM bids b
        JOIN auctions a ON b.auction_id = a.id
        JOIN salvage_cases sc ON a.case_id = sc.id
        WHERE b.vendor_id = ${vendorId}
          AND b.created_at > NOW() - INTERVAL '12 months'
      ),
      active_auctions AS (
        SELECT 
          a.id AS auction_id,
          sc.id AS case_id,
          sc.asset_type,
          sc.asset_details,
          sc.damage_severity,
          sc.market_value,
          a.watching_count
        FROM auctions a
        JOIN salvage_cases sc ON a.case_id = sc.id
        WHERE a.status IN ('active', 'scheduled')
          AND NOT EXISTS (
            SELECT 1 FROM bids b 
            WHERE b.auction_id = a.id AND b.vendor_id = ${vendorId}
          )
      ),
      similarity_scores AS (
        SELECT 
          aa.auction_id,
          vbh.recency_weight,
          (
            CASE WHEN aa.asset_type = vbh.asset_type THEN 40 ELSE 0 END +
            CASE 
              WHEN aa.asset_details->>'make' = vbh.asset_details->>'make' 
               AND aa.asset_details->>'model' = vbh.asset_details->>'model' THEN 30
              WHEN aa.asset_details->>'make' = vbh.asset_details->>'make' THEN 15
              ELSE 0
            END +
            CASE 
              WHEN aa.damage_severity = vbh.damage_severity THEN 15
              WHEN (
                (aa.damage_severity = 'minor' AND vbh.damage_severity = 'moderate') OR
                (aa.damage_severity = 'moderate' AND vbh.damage_severity IN ('minor', 'severe')) OR
                (aa.damage_severity = 'severe' AND vbh.damage_severity = 'moderate')
              ) THEN 8
              ELSE 0
            END +
            CASE 
              WHEN ABS(aa.market_value - vbh.bid_amount) / vbh.bid_amount < 0.3 THEN 15
              WHEN ABS(aa.market_value - vbh.bid_amount) / vbh.bid_amount < 0.5 THEN 8
              ELSE 0
            END
          ) AS raw_similarity_score,
          aa.watching_count
        FROM active_auctions aa
        CROSS JOIN vendor_bid_history vbh
      )
      SELECT 
        auction_id,
        SUM(raw_similarity_score * recency_weight) / SUM(recency_weight) AS collaborative_score,
        MAX(watching_count) AS popularity
      FROM similarity_scores
      GROUP BY auction_id
      HAVING SUM(raw_similarity_score * recency_weight) / SUM(recency_weight) >= 30
      ORDER BY collaborative_score DESC
    `);

    return result.rows;
  }

  /**
   * Calculate content-based filtering scores
   */
  private async calculateContentScores(vendorId: string, pattern: VendorBiddingPattern) {
    const result = await db.execute(sql`
      WITH active_auctions AS (
        SELECT 
          a.id AS auction_id,
          sc.asset_type,
          sc.asset_details,
          sc.damage_severity,
          sc.market_value,
          a.watching_count
        FROM auctions a
        JOIN salvage_cases sc ON a.case_id = sc.id
        WHERE a.status IN ('active', 'scheduled')
          AND NOT EXISTS (
            SELECT 1 FROM bids b 
            WHERE b.auction_id = a.id AND b.vendor_id = ${vendorId}
          )
      )
      SELECT 
        aa.auction_id,
        (
          CASE 
            WHEN aa.asset_type = ANY(${pattern.categories}) THEN 35
            ELSE 0
          END +
          CASE 
            WHEN aa.asset_details->>'make' = ANY(${pattern.topMakes}) THEN 25
            ELSE 0
          END +
          CASE 
            WHEN aa.market_value BETWEEN ${pattern.priceP25} AND ${pattern.priceP75} THEN 25
            WHEN aa.market_value BETWEEN ${pattern.priceP25 * 0.7} AND ${pattern.priceP75 * 1.3} THEN 15
            ELSE 0
          END +
          CASE 
            WHEN aa.damage_severity = ${pattern.preferredDamageLevel} THEN 15
            ELSE 5
          END
        ) AS content_score,
        aa.watching_count AS popularity
      FROM active_auctions aa
    `);

    return result.rows;
  }

  /**
   * Combine collaborative and content-based scores
   */
  private combineScores(
    collaborative: any[],
    content: any[],
    collabWeight: number,
    contentWeight: number
  ) {
    const scoreMap = new Map();

    // Add collaborative scores
    collaborative.forEach(item => {
      scoreMap.set(item.auction_id, {
        auctionId: item.auction_id,
        collaborativeScore: item.collaborative_score,
        contentScore: 0,
        popularity: item.popularity
      });
    });

    // Add content scores
    content.forEach(item => {
      const existing = scoreMap.get(item.auction_id);
      if (existing) {
        existing.contentScore = item.content_score;
      } else {
        scoreMap.set(item.auction_id, {
          auctionId: item.auction_id,
          collaborativeScore: 0,
          contentScore: item.content_score,
          popularity: item.popularity
        });
      }
    });

    // Calculate final match scores
    return Array.from(scoreMap.values()).map(item => {
      const popularityBoost = Math.min(10, item.popularity / 2);
      const matchScore = 
        (item.collaborativeScore * collabWeight) +
        (item.contentScore * contentWeight) +
        popularityBoost;

      const reasonCodes = [];
      if (item.collaborativeScore >= 60) reasonCodes.push('Similar to your previous bids');
      if (item.contentScore >= 60) reasonCodes.push('Matches your preferred categories');
      if (item.popularity >= 10) reasonCodes.push('Trending auction');

      return {
        auctionId: item.auctionId,
        matchScore,
        collaborativeScore: item.collaborativeScore,
        contentScore: item.contentScore,
        popularityBoost,
        reasonCodes
      };
    });
  }

  /**
   * Determine recommendation strategy based on vendor history
   */
  private determineStrategy(pattern: VendorBiddingPattern | null): string {
    if (!pattern || pattern.totalBids === 0) return 'cold_start';
    if (pattern.totalBids < 3) return 'cold_start';
    if (pattern.totalBids < 10) return 'warming_up';
    return 'full_hybrid';
  }
}
```


### 4.2 Background Jobs

```typescript
// src/features/intelligence/jobs/index.ts
import cron from 'node-cron';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export function setupIntelligenceJobs() {
  // Refresh materialized views every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('[Intelligence] Refreshing materialized views...');
    try {
      await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY vendor_bidding_patterns`);
      await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY market_conditions_summary`);
      console.log('[Intelligence] Materialized views refreshed successfully');
    } catch (error) {
      console.error('[Intelligence] Error refreshing materialized views:', error);
    }
  });

  // Calculate prediction accuracy for closed auctions (hourly)
  cron.schedule('0 * * * *', async () => {
    console.log('[Intelligence] Calculating prediction accuracy...');
    try {
      const accuracyService = new AccuracyTrackingService();
      await accuracyService.calculateAccuracyForClosedAuctions();
      console.log('[Intelligence] Accuracy calculation complete');
    } catch (error) {
      console.error('[Intelligence] Error calculating accuracy:', error);
    }
  });

  // Recalculate algorithm parameters (daily at 2 AM)
  cron.schedule('0 2 * * *', async () => {
    console.log('[Intelligence] Recalculating algorithm parameters...');
    try {
      const parameterService = new ParameterTuningService();
      await parameterService.recalculateParameters();
      console.log('[Intelligence] Parameter recalculation complete');
    } catch (error) {
      console.error('[Intelligence] Error recalculating parameters:', error);
    }
  });

  // Archive old interaction data (weekly on Sunday at 3 AM)
  cron.schedule('0 3 * * 0', async () => {
    console.log('[Intelligence] Archiving old interaction data...');
    try {
      await db.execute(sql`
        DELETE FROM interactions 
        WHERE timestamp < NOW() - INTERVAL '2 years'
      `);
      console.log('[Intelligence] Data archival complete');
    } catch (error) {
      console.error('[Intelligence] Error archiving data:', error);
    }
  });

  // Generate performance reports (daily at 6 AM)
  cron.schedule('0 6 * * *', async () => {
    console.log('[Intelligence] Generating performance reports...');
    try {
      const reportService = new PerformanceReportService();
      await reportService.generateDailyReport();
      console.log('[Intelligence] Performance report generated');
    } catch (error) {
      console.error('[Intelligence] Error generating report:', error);
    }
  });
}
```

### 4.3 Caching Strategy

```typescript
// src/features/intelligence/cache/redis-cache.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export class IntelligenceCache {
  // Prediction cache (5-minute TTL)
  async getPrediction(auctionId: string): Promise<PredictionResult | null> {
    const cached = await redis.get(`prediction:${auctionId}`);
    return cached ? JSON.parse(cached) : null;
  }

  async setPrediction(auctionId: string, prediction: PredictionResult) {
    await redis.setex(
      `prediction:${auctionId}`,
      300, // 5 minutes
      JSON.stringify(prediction)
    );
  }

  async invalidatePrediction(auctionId: string) {
    await redis.del(`prediction:${auctionId}`);
  }

  // Recommendation cache (15-minute TTL)
  async getRecommendations(vendorId: string): Promise<RecommendationResult[] | null> {
    const cached = await redis.get(`recommendations:${vendorId}`);
    return cached ? JSON.parse(cached) : null;
  }

  async setRecommendations(vendorId: string, recommendations: RecommendationResult[]) {
    await redis.setex(
      `recommendations:${vendorId}`,
      900, // 15 minutes
      JSON.stringify(recommendations)
    );
  }

  async invalidateRecommendations(vendorId: string) {
    await redis.del(`recommendations:${vendorId}`);
  }

  // Vendor profile cache (active session)
  async getVendorProfile(vendorId: string): Promise<VendorBiddingPattern | null> {
    const cached = await redis.get(`vendor_profile:${vendorId}`);
    return cached ? JSON.parse(cached) : null;
  }

  async setVendorProfile(vendorId: string, profile: VendorBiddingPattern) {
    await redis.setex(
      `vendor_profile:${vendorId}`,
      3600, // 1 hour
      JSON.stringify(profile)
    );
  }

  // Market conditions cache (1-hour TTL)
  async getMarketConditions(): Promise<MarketConditions | null> {
    const cached = await redis.get('market_conditions');
    return cached ? JSON.parse(cached) : null;
  }

  async setMarketConditions(conditions: MarketConditions) {
    await redis.setex(
      'market_conditions',
      3600, // 1 hour
      JSON.stringify(conditions)
    );
  }
}
```

**Cache Invalidation Strategy:**

```typescript
// Invalidate prediction cache when:
// 1. New bid placed on auction (if significant price change)
// 2. Auction extended
// 3. Market conditions change significantly

export async function handleBidPlaced(auctionId: string, newBid: number) {
  const cache = new IntelligenceCache();
  const currentPrediction = await cache.getPrediction(auctionId);
  
  if (currentPrediction) {
    const priceChange = Math.abs(newBid - currentPrediction.predictedPrice) / currentPrediction.predictedPrice;
    
    // Invalidate if price changed by more than 10%
    if (priceChange > 0.10) {
      await cache.invalidatePrediction(auctionId);
      
      // Trigger recalculation
      const predictionService = new PredictionService();
      const newPrediction = await predictionService.generatePrediction(auctionId);
      
      // Broadcast update via Socket.IO
      io.to(`prediction:${auctionId}`).emit('prediction:updated', newPrediction);
    }
  }
}

// Invalidate recommendation cache when:
// 1. Vendor places a new bid
// 2. New auctions matching vendor preferences are created
// 3. Vendor profile is updated

export async function handleVendorBidPlaced(vendorId: string) {
  const cache = new IntelligenceCache();
  
  // Invalidate caches
  await cache.invalidateRecommendations(vendorId);
  await cache.invalidateVendorProfile(vendorId);
  
  // Trigger recommendation refresh
  const recommendationService = new RecommendationService();
  const newRecommendations = await recommendationService.generateRecommendations(vendorId);
  
  // Broadcast update via Socket.IO
  io.to(`recommendations:${vendorId}`).emit('recommendations:refreshed', {
    newRecommendations: newRecommendations.length,
    topRecommendation: newRecommendations[0]
  });
}
```


## 5. Edge Case Handling (Detailed)

### Empty Database (Day 1)

**Scenario:** Platform launches with zero historical auction data.

**Handling:**
```typescript
// All predictions use fallback methods
if (historicalAuctionCount === 0) {
  // Use salvage value or market value calculation
  prediction = {
    method: 'market_value_calc',
    predictedPrice: marketValue * damageSeverityMultiplier,
    confidenceLevel: 'Low',
    confidenceScore: 0.20,
    metadata: {
      warnings: ['Platform is new - prediction based on market value estimation'],
      notes: ['Accuracy will improve as auction history accumulates']
    }
  };
}

// All recommendations use popularity + category matching
if (totalVendors < 10 || totalClosedAuctions < 50) {
  recommendations = await generatePopularityBasedRecommendations(vendorId);
}
```

### Single Auction Scenario

**Scenario:** Only one historical auction exists for a vehicle type.

**Handling:**
```typescript
if (sampleSize === 1) {
  // Heavily blend with salvage value
  const historicalWeight = 0.30;
  const salvageWeight = 0.70;
  
  predictedPrice = (historicalPrice * historicalWeight) + (salvageValue * salvageWeight);
  confidenceScore = 0.25; // Low confidence
  
  metadata.warnings.push('Limited historical data - prediction may be less accurate');
}
```

### Outlier Prices

**Detection:**
```sql
-- Use IQR method to detect outliers
WITH price_stats AS (
  SELECT 
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY final_price) AS q1,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY final_price) AS q3
  FROM similar_auctions
),
outlier_bounds AS (
  SELECT 
    q1 - 1.5 * (q3 - q1) AS lower_bound,
    q3 + 1.5 * (q3 - q1) AS upper_bound
  FROM price_stats
)
SELECT * FROM similar_auctions
WHERE final_price BETWEEN 
  (SELECT lower_bound FROM outlier_bounds) AND 
  (SELECT upper_bound FROM outlier_bounds);
```

**Handling:**
- Remove outliers from similarity calculation
- Log outliers for manual review
- If too many outliers (>30%), widen confidence intervals instead of removing

### Auction Extensions

**Handling:**
```typescript
if (extensionCount > 0) {
  // Each extension signals high competition
  const competitionBoost = 1 + (extensionCount * 0.05); // 5% per extension
  
  predictedPrice *= competitionBoost;
  upperBound *= competitionBoost;
  
  metadata.notes.push(
    `Auction extended ${extensionCount} time(s)`,
    'Increased competition expected',
    'Final price likely to exceed initial prediction'
  );
  
  // Increase confidence slightly (more data points)
  confidenceScore = Math.min(1.0, confidenceScore * 1.05);
}
```

### Vendor Behavior Changes

**Detection:**
```sql
-- Detect significant pattern shifts
WITH recent_behavior AS (
  SELECT 
    AVG(amount) AS recent_avg_bid,
    ARRAY_AGG(DISTINCT sc.asset_type) AS recent_asset_types
  FROM bids b
  JOIN auctions a ON b.auction_id = a.id
  JOIN salvage_cases sc ON a.case_id = sc.id
  WHERE b.vendor_id = $vendor_id
    AND b.created_at > NOW() - INTERVAL '30 days'
),
historical_behavior AS (
  SELECT 
    AVG(amount) AS historical_avg_bid,
    ARRAY_AGG(DISTINCT sc.asset_type) AS historical_asset_types
  FROM bids b
  JOIN auctions a ON b.auction_id = a.id
  JOIN salvage_cases sc ON a.case_id = sc.id
  WHERE b.vendor_id = $vendor_id
    AND b.created_at BETWEEN NOW() - INTERVAL '12 months' AND NOW() - INTERVAL '30 days'
)
SELECT 
  ABS(rb.recent_avg_bid - hb.historical_avg_bid) / hb.historical_avg_bid AS price_shift,
  ARRAY_LENGTH(rb.recent_asset_types, 1) != ARRAY_LENGTH(hb.historical_asset_types, 1) AS category_shift
FROM recent_behavior rb, historical_behavior hb;
```

**Handling:**
```typescript
if (priceShift > 0.30 || categoryShift) {
  // Weight recent behavior more heavily
  const recentWeight = 0.70;
  const historicalWeight = 0.30;
  
  // Recalculate recommendations with adjusted weights
  recommendations = await generateAdaptiveRecommendations(
    vendorId,
    recentWeight,
    historicalWeight
  );
  
  // Invalidate cached profile
  await cache.invalidateVendorProfile(vendorId);
}
```

### Data Quality Issues

**Missing Fields:**
```typescript
// Handle incomplete asset details
if (!assetDetails.make || !assetDetails.model) {
  // Attempt fuzzy matching on available fields
  similarityThreshold = 40; // Lower threshold
  confidenceScore *= 0.70; // Reduce confidence
  
  metadata.warnings.push('Incomplete asset details - prediction may be less accurate');
}

// Handle missing year
if (!assetDetails.year) {
  // Expand year range
  yearRange = [-5, 5]; // ±5 years instead of ±2
  confidenceScore *= 0.80;
}
```

**Malformed JSON:**
```typescript
try {
  const assetDetails = JSON.parse(case.assetDetails);
} catch (error) {
  // Log error and use fallback
  logger.error('Malformed asset details JSON', { caseId: case.id, error });
  
  return {
    method: 'no_prediction',
    message: 'Unable to process asset details',
    fallbackData: {
      marketValue: case.marketValue,
      reservePrice: case.reservePrice
    }
  };
}
```

### Performance Degradation

**Query Timeout Handling:**
```typescript
const QUERY_TIMEOUT = 200; // ms

try {
  const result = await Promise.race([
    db.query.predictions.findFirst({ where: eq(predictions.auctionId, auctionId) }),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Query timeout')), QUERY_TIMEOUT)
    )
  ]);
  
  return result;
} catch (error) {
  if (error.message === 'Query timeout') {
    // Return cached result
    const cached = await cache.getPrediction(auctionId);
    if (cached) {
      return { ...cached, metadata: { ...cached.metadata, cached: true } };
    }
    
    // Log performance issue
    logger.warn('Prediction query timeout', { auctionId });
    
    // Return fallback
    return generateFallbackPrediction(auctionId);
  }
  throw error;
}
```

### Concurrent Updates

**Race Condition Prevention:**
```typescript
// Use database transactions for atomic updates
await db.transaction(async (tx) => {
  // Lock the auction row
  const auction = await tx.query.auctions.findFirst({
    where: eq(auctions.id, auctionId),
    for: 'update' // Row-level lock
  });
  
  // Update prediction
  await tx.insert(predictions).values({
    auctionId,
    predictedPrice,
    // ... other fields
  });
  
  // Update cache
  await cache.setPrediction(auctionId, prediction);
});
```

## 6. Cold-Start Detailed Strategy

### Platform Launch (Day 1-30)

**Week 1: Popularity-Based Only**
```typescript
// No historical data - use simple popularity ranking
async function getWeek1Recommendations(vendorId: string) {
  return await db.query.auctions.findMany({
    where: eq(auctions.status, 'active'),
    orderBy: (auctions, { desc }) => [desc(auctions.watchingCount)],
    limit: 20,
    with: {
      case: true
    }
  }).then(auctions => auctions.map(a => ({
    auctionId: a.id,
    matchScore: a.watchingCount,
    reasonCodes: ['Popular auction', 'Trending now'],
    method: 'popularity'
  })));
}
```

**Week 2-3: Content-Based Emerges**
```typescript
// Some bid history exists - use category matching
async function getWeek2Recommendations(vendorId: string) {
  const vendorCategories = await getVendorCategories(vendorId);
  const recentBids = await getRecentBids(vendorId, 7); // Last 7 days
  
  if (recentBids.length === 0) {
    return getWeek1Recommendations(vendorId); // Fallback to popularity
  }
  
  // Extract preferences from limited history
  const preferredAssetTypes = [...new Set(recentBids.map(b => b.assetType))];
  const avgBidAmount = recentBids.reduce((sum, b) => sum + b.amount, 0) / recentBids.length;
  
  // Match on categories and price range
  return await db.query.auctions.findMany({
    where: and(
      eq(auctions.status, 'active'),
      inArray(salvageCases.assetType, preferredAssetTypes)
    ),
    orderBy: (auctions, { desc }) => [desc(auctions.watchingCount)],
    limit: 20
  });
}
```

**Week 4+: Hybrid Approach**
```typescript
// Sufficient data for collaborative filtering
async function getWeek4Recommendations(vendorId: string) {
  const bidCount = await getVendorBidCount(vendorId);
  
  if (bidCount < 3) {
    return getWeek2Recommendations(vendorId);
  }
  
  // Use hybrid with low collaborative weight
  return await generateHybridRecommendations(
    vendorId,
    0.30, // 30% collaborative
    0.70  // 70% content-based
  );
}
```

### New Vendor Onboarding

**Progressive Transition:**
```typescript
function getRecommendationStrategy(vendorBidCount: number) {
  if (vendorBidCount === 0) {
    return {
      method: 'popularity',
      collabWeight: 0.0,
      contentWeight: 0.0,
      popularityWeight: 1.0
    };
  } else if (vendorBidCount <= 2) {
    return {
      method: 'content_based',
      collabWeight: 0.0,
      contentWeight: 0.80,
      popularityWeight: 0.20
    };
  } else if (vendorBidCount <= 5) {
    return {
      method: 'hybrid_light',
      collabWeight: 0.20,
      contentWeight: 0.70,
      popularityWeight: 0.10
    };
  } else if (vendorBidCount <= 10) {
    return {
      method: 'hybrid_medium',
      collabWeight: 0.40,
      contentWeight: 0.55,
      popularityWeight: 0.05
    };
  } else {
    return {
      method: 'hybrid_full',
      collabWeight: 0.60,
      contentWeight: 0.40,
      popularityWeight: 0.0
    };
  }
}
```


## 7. Data Collection Pipeline

### Event Tracking Schema

```typescript
// View event
{
  vendorId: "uuid",
  auctionId: "uuid",
  eventType: "view",
  timestamp: "2025-01-15T10:30:00Z",
  sessionId: "sess_abc123",
  metadata: {
    predictionShown: {
      predictedPrice: 1250000,
      confidenceScore: 0.85
    },
    deviceType: "mobile",
    referrer: "recommendations",
    timeOnPage: 45
  }
}

// Bid event
{
  vendorId: "uuid",
  auctionId: "uuid",
  eventType: "bid",
  timestamp: "2025-01-15T10:32:00Z",
  sessionId: "sess_abc123",
  metadata: {
    bidAmount: 1050000,
    predictionShown: {
      predictedPrice: 1250000,
      confidenceScore: 0.85
    },
    timeSinceView: 120 // seconds
  }
}

// Auction close event
{
  auctionId: "uuid",
  eventType: "close",
  timestamp: "2025-01-16T09:00:00Z",
  metadata: {
    finalPrice: 1265000,
    winnerId: "uuid",
    totalBids: 15,
    uniqueBidders: 8,
    duration: 86400 // seconds
  }
}
```

### Data Flow Pipeline

```
1. User Action → API Endpoint
   ├─ View auction: POST /api/intelligence/interactions
   ├─ Place bid: POST /api/intelligence/interactions
   └─ Auction closes: Triggered by cron job

2. Event Validation & Enrichment
   ├─ Validate required fields
   ├─ Enrich with session data
   ├─ Add timestamp if missing
   └─ Sanitize PII

3. Database Insertion
   ├─ Insert into interactions table
   ├─ Update interaction counts
   └─ Trigger materialized view refresh (async)

4. Real-Time Aggregation
   ├─ Update vendor profile cache
   ├─ Recalculate market conditions
   └─ Invalidate affected caches

5. Background Processing
   ├─ Calculate prediction accuracy (hourly)
   ├─ Update recommendation effectiveness (daily)
   └─ Generate performance reports (daily)

6. Export Preparation
   ├─ Anonymize PII
   ├─ Format for ML training
   └─ Generate feature vectors
```

## 8. GDPR Compliance Implementation

### Data Anonymization Process

```typescript
// src/features/intelligence/services/gdpr.service.ts
export class GDPRService {
  /**
   * Anonymize interaction data for export
   */
  async anonymizeInteractions(dateRange: { start: Date; end: Date }) {
    return await db.execute(sql`
      SELECT 
        MD5(vendor_id::text) AS anonymized_vendor_id,
        auction_id,
        event_type,
        timestamp,
        -- Remove PII from metadata
        jsonb_build_object(
          'bidAmount', metadata->>'bidAmount',
          'deviceType', metadata->>'deviceType',
          'timeOnPage', metadata->>'timeOnPage'
          -- Exclude: sessionId, referrer (may contain PII)
        ) AS anonymized_metadata
      FROM interactions
      WHERE timestamp BETWEEN ${dateRange.start} AND ${dateRange.end}
    `);
  }

  /**
   * Handle vendor data deletion request
   */
  async deleteVendorData(vendorId: string) {
    await db.transaction(async (tx) => {
      // 1. Mark vendor as deleted (soft delete)
      await tx.update(vendors)
        .set({ 
          status: 'deleted',
          businessName: 'DELETED',
          bvnEncrypted: null,
          // ... clear other PII fields
        })
        .where(eq(vendors.id, vendorId));

      // 2. Anonymize interaction data
      await tx.execute(sql`
        UPDATE interactions
        SET 
          vendor_id = MD5(vendor_id::text)::uuid,
          metadata = jsonb_build_object(
            'bidAmount', metadata->>'bidAmount',
            'eventType', event_type
          )
        WHERE vendor_id = ${vendorId}
      `);

      // 3. Delete recommendations (contains vendor preferences)
      await tx.delete(recommendations)
        .where(eq(recommendations.vendorId, vendorId));

      // 4. Keep anonymized predictions for algorithm training
      // (predictions don't contain vendor PII)

      // 5. Generate deletion confirmation
      return {
        vendorId,
        deletedAt: new Date(),
        dataRetained: {
          anonymizedInteractions: true,
          predictions: true
        },
        dataDeleted: {
          personalInfo: true,
          recommendations: true,
          biddingPatterns: true
        }
      };
    });
  }

  /**
   * Generate data export for vendor
   */
  async exportVendorData(vendorId: string) {
    const [interactions, recommendations, predictions] = await Promise.all([
      db.query.interactions.findMany({
        where: eq(interactions.vendorId, vendorId)
      }),
      db.query.recommendations.findMany({
        where: eq(recommendations.vendorId, vendorId)
      }),
      db.execute(sql`
        SELECT p.*
        FROM predictions p
        JOIN auctions a ON p.auction_id = a.id
        JOIN bids b ON b.auction_id = a.id
        WHERE b.vendor_id = ${vendorId}
      `)
    ]);

    return {
      vendorId,
      exportedAt: new Date(),
      data: {
        interactions,
        recommendations,
        predictions: predictions.rows
      }
    };
  }
}
```

### Retention Policies

```sql
-- Automatic data retention enforcement
CREATE OR REPLACE FUNCTION enforce_data_retention()
RETURNS void AS $$
BEGIN
  -- Delete interactions older than 2 years
  DELETE FROM interactions
  WHERE timestamp < NOW() - INTERVAL '2 years';

  -- Archive predictions older than 2 years
  INSERT INTO predictions_archive
  SELECT * FROM predictions
  WHERE created_at < NOW() - INTERVAL '2 years';

  DELETE FROM predictions
  WHERE created_at < NOW() - INTERVAL '2 years';

  -- Delete recommendations older than 6 months
  DELETE FROM recommendations
  WHERE created_at < NOW() - INTERVAL '6 months';
END;
$$ LANGUAGE plpgsql;

-- Schedule retention job
SELECT cron.schedule('data-retention', '0 3 * * 0', 'SELECT enforce_data_retention()');
```

## 9. Performance Optimization

### Query Optimization Strategies

**1. Index Selection:**
```sql
-- Predictions table
CREATE INDEX idx_predictions_auction_id ON predictions(auction_id);
CREATE INDEX idx_predictions_created_at ON predictions(created_at DESC);
CREATE INDEX idx_predictions_accuracy ON predictions(accuracy) WHERE accuracy IS NOT NULL;

-- Recommendations table
CREATE INDEX idx_recommendations_vendor_id ON recommendations(vendor_id);
CREATE INDEX idx_recommendations_match_score ON recommendations(match_score DESC);
CREATE INDEX idx_recommendations_vendor_auction ON recommendations(vendor_id, auction_id);

-- Interactions table (partitioned)
CREATE INDEX idx_interactions_vendor_id ON interactions(vendor_id);
CREATE INDEX idx_interactions_timestamp ON interactions(timestamp DESC);
CREATE INDEX idx_interactions_vendor_event ON interactions(vendor_id, event_type);
```

**2. Query Plan Analysis:**
```sql
-- Analyze similarity matching query
EXPLAIN ANALYZE
SELECT 
  a.id,
  a.current_bid,
  -- similarity calculation
FROM auctions a
JOIN salvage_cases sc ON a.case_id = sc.id
WHERE a.status = 'closed'
  AND sc.asset_type = 'vehicle'
  AND sc.asset_details->>'make' = 'Toyota';

-- Expected: Index scan on asset_type, then filter on make
-- If seeing sequential scan, add GIN index on asset_details
CREATE INDEX idx_salvage_cases_asset_details_gin ON salvage_cases USING GIN (asset_details);
```

**3. Batch Processing:**
```typescript
// Generate predictions for multiple auctions in parallel
async function batchGeneratePredictions(auctionIds: string[]) {
  const BATCH_SIZE = 10;
  const results = [];

  for (let i = 0; i < auctionIds.length; i += BATCH_SIZE) {
    const batch = auctionIds.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(id => predictionService.generatePrediction(id))
    );
    results.push(...batchResults);
  }

  return results;
}
```

**4. Parallel Query Execution:**
```typescript
// Execute collaborative and content-based filtering in parallel
async function generateHybridRecommendations(vendorId: string) {
  const [collaborativeScores, contentScores, marketConditions] = await Promise.all([
    calculateCollaborativeScores(vendorId),
    calculateContentScores(vendorId),
    getMarketConditions()
  ]);

  return combineScores(collaborativeScores, contentScores);
}
```

### Multi-Level Caching

```
L1: In-Memory (Node.js process)
├─ Active vendor profiles (LRU cache, 1000 entries)
├─ Algorithm config (refreshed every 5 minutes)
└─ Market conditions (refreshed every hour)

L2: Redis
├─ Predictions (5-minute TTL)
├─ Recommendations (15-minute TTL)
├─ Vendor profiles (1-hour TTL)
└─ Market conditions (1-hour TTL)

L3: Materialized Views (PostgreSQL)
├─ vendor_bidding_patterns (refreshed every 5 minutes)
├─ market_conditions_summary (refreshed every 5 minutes)
└─ item_similarity_matrix (refreshed daily)
```

**Implementation:**
```typescript
// L1: In-memory LRU cache
import LRU from 'lru-cache';

const vendorProfileCache = new LRU<string, VendorBiddingPattern>({
  max: 1000,
  ttl: 1000 * 60 * 60 // 1 hour
});

async function getVendorProfile(vendorId: string) {
  // Check L1
  let profile = vendorProfileCache.get(vendorId);
  if (profile) return profile;

  // Check L2 (Redis)
  profile = await redisCache.getVendorProfile(vendorId);
  if (profile) {
    vendorProfileCache.set(vendorId, profile);
    return profile;
  }

  // Check L3 (Materialized View)
  profile = await db.query.vendorBiddingPatterns.findFirst({
    where: eq(vendorBiddingPatterns.vendorId, vendorId)
  });

  if (profile) {
    vendorProfileCache.set(vendorId, profile);
    await redisCache.setVendorProfile(vendorId, profile);
  }

  return profile;
}
```


## 10. Monitoring and Alerting

### Metrics to Track

```typescript
// src/features/intelligence/services/metrics.service.ts
export class MetricsService {
  /**
   * Calculate prediction accuracy metrics
   */
  async getPredictionMetrics(period: string = '7d') {
    const dateRange = this.parsePeriod(period);

    const metrics = await db.execute(sql`
      WITH prediction_stats AS (
        SELECT 
          COUNT(*) AS total_predictions,
          AVG(ABS(actual_price - predicted_price)) AS mean_absolute_error,
          AVG(ABS(actual_price - predicted_price) / actual_price) * 100 AS mean_percentage_error,
          AVG(CASE 
            WHEN actual_price BETWEEN lower_bound AND upper_bound THEN 1 
            ELSE 0 
          END) AS confidence_calibration,
          method,
          confidence_level
        FROM predictions
        WHERE actual_price IS NOT NULL
          AND created_at BETWEEN ${dateRange.start} AND ${dateRange.end}
        GROUP BY method, confidence_level
      )
      SELECT * FROM prediction_stats
    `);

    return {
      total: metrics.rows.reduce((sum, r) => sum + r.total_predictions, 0),
      accuracy: {
        meanAbsoluteError: this.average(metrics.rows, 'mean_absolute_error'),
        meanPercentageError: this.average(metrics.rows, 'mean_percentage_error'),
        confidenceCalibration: this.average(metrics.rows, 'confidence_calibration'),
        byConfidenceLevel: this.groupBy(metrics.rows, 'confidence_level'),
        byMethod: this.groupBy(metrics.rows, 'method')
      }
    };
  }

  /**
   * Calculate recommendation effectiveness metrics
   */
  async getRecommendationMetrics(period: string = '7d') {
    const dateRange = this.parsePeriod(period);

    const metrics = await db.execute(sql`
      WITH recommendation_stats AS (
        SELECT 
          COUNT(*) AS total_recommendations,
          COUNT(*) FILTER (WHERE clicked = TRUE) AS total_clicks,
          COUNT(*) FILTER (WHERE bid_placed = TRUE) AS total_conversions,
          COUNT(*) FILTER (WHERE clicked = TRUE)::float / COUNT(*) AS ctr,
          COUNT(*) FILTER (WHERE bid_placed = TRUE)::float / COUNT(*) AS conversion_rate,
          vbp.activity_segment
        FROM recommendations r
        LEFT JOIN vendor_bidding_patterns vbp ON r.vendor_id = vbp.vendor_id
        WHERE r.created_at BETWEEN ${dateRange.start} AND ${dateRange.end}
        GROUP BY vbp.activity_segment
      )
      SELECT * FROM recommendation_stats
    `);

    // Calculate engagement lift (vs non-recommended auctions)
    const engagementLift = await this.calculateEngagementLift(dateRange);

    return {
      total: metrics.rows.reduce((sum, r) => sum + r.total_recommendations, 0),
      clickThroughRate: this.average(metrics.rows, 'ctr'),
      bidConversionRate: this.average(metrics.rows, 'conversion_rate'),
      engagementLift,
      bySegment: this.groupBy(metrics.rows, 'activity_segment')
    };
  }

  /**
   * Calculate performance metrics
   */
  async getPerformanceMetrics(period: string = '7d') {
    // This would integrate with application performance monitoring
    return {
      avgResponseTime: 145, // ms
      p95ResponseTime: 185,
      p99ResponseTime: 220,
      cacheHitRate: 0.78,
      queryCount: 125000,
      errorRate: 0.002
    };
  }
}
```

### Alert Conditions

```typescript
// src/features/intelligence/services/alerting.service.ts
export class AlertingService {
  async checkAlerts() {
    const metrics = await metricsService.getPredictionMetrics('24h');

    // Alert 1: Prediction accuracy drops below 85%
    if (metrics.accuracy.meanPercentageError > 15) {
      await this.sendAlert({
        severity: 'high',
        title: 'Prediction Accuracy Below Target',
        message: `Mean percentage error: ${metrics.accuracy.meanPercentageError}% (target: <15%)`,
        action: 'Review algorithm parameters and recent market changes'
      });
    }

    // Alert 2: Recommendation CTR drops below baseline
    const recMetrics = await metricsService.getRecommendationMetrics('24h');
    const baseline = 0.30;
    if (recMetrics.clickThroughRate < baseline * 0.8) {
      await this.sendAlert({
        severity: 'medium',
        title: 'Recommendation CTR Below Baseline',
        message: `CTR: ${recMetrics.clickThroughRate} (baseline: ${baseline})`,
        action: 'Review recommendation algorithm and vendor segments'
      });
    }

    // Alert 3: Response time exceeds 200ms for >5% of requests
    const perfMetrics = await metricsService.getPerformanceMetrics('1h');
    if (perfMetrics.p95ResponseTime > 200) {
      await this.sendAlert({
        severity: 'high',
        title: 'Performance Degradation Detected',
        message: `P95 response time: ${perfMetrics.p95ResponseTime}ms (target: <200ms)`,
        action: 'Check database query performance and cache hit rates'
      });
    }

    // Alert 4: Background job failures
    const jobStatus = await this.checkBackgroundJobs();
    if (jobStatus.failureRate > 0.05) {
      await this.sendAlert({
        severity: 'high',
        title: 'Background Job Failures',
        message: `Failure rate: ${jobStatus.failureRate * 100}%`,
        action: 'Check job logs and database connectivity'
      });
    }

    // Alert 5: Data quality issues
    const dataQuality = await this.checkDataQuality();
    if (dataQuality.completeness < 0.90) {
      await this.sendAlert({
        severity: 'medium',
        title: 'Data Quality Issues Detected',
        message: `Data completeness: ${dataQuality.completeness * 100}%`,
        action: 'Review data ingestion pipeline and validation rules'
      });
    }
  }

  private async sendAlert(alert: Alert) {
    // Send to monitoring system (e.g., Slack, PagerDuty, email)
    console.error('[ALERT]', alert);
    
    // Log to database
    await db.insert(alerts).values({
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      action: alert.action,
      createdAt: new Date()
    });

    // Send notification
    await notificationService.sendAdminNotification(alert);
  }
}
```

### Dashboard Metrics Display

```typescript
// GET /api/intelligence/metrics response structure
{
  "predictions": {
    "total": 1250,
    "accuracy": {
      "meanAbsoluteError": 125000.00,
      "meanPercentageError": 12.5,
      "confidenceCalibration": 0.87,
      "byConfidenceLevel": {
        "High": { "count": 850, "avgError": 8.2, "calibration": 0.92 },
        "Medium": { "count": 300, "avgError": 15.5, "calibration": 0.85 },
        "Low": { "count": 100, "avgError": 22.8, "calibration": 0.70 }
      },
      "byMethod": {
        "historical": { "count": 950, "avgError": 10.5, "avgConfidence": 0.82 },
        "salvage_value": { "count": 250, "avgError": 18.2, "avgConfidence": 0.35 },
        "market_value_calc": { "count": 50, "avgError": 25.5, "avgConfidence": 0.22 }
      }
    },
    "trend": {
      "daily": [
        { "date": "2025-01-08", "avgError": 13.2, "count": 180 },
        { "date": "2025-01-09", "avgError": 12.8, "count": 175 },
        // ... more days
      ]
    }
  },
  "recommendations": {
    "total": 5600,
    "clickThroughRate": 0.35,
    "bidConversionRate": 0.18,
    "engagementLift": 0.42,
    "bySegment": {
      "active_bidder": { "count": 2500, "ctr": 0.45, "conversion": 0.25 },
      "regular_bidder": { "count": 2100, "ctr": 0.32, "conversion": 0.15 },
      "selective_bidder": { "count": 1000, "ctr": 0.28, "conversion": 0.12 }
    },
    "topReasonCodes": [
      { "code": "Similar to your winning bids", "count": 2100, "conversion": 0.28 },
      { "code": "Matches your preferred categories", "count": 1800, "conversion": 0.22 },
      { "code": "High win rate in this category", "count": 1200, "conversion": 0.30 }
    ]
  },
  "performance": {
    "avgResponseTime": 145,
    "p95ResponseTime": 185,
    "p99ResponseTime": 220,
    "cacheHitRate": 0.78,
    "queryCount": 125000,
    "errorRate": 0.002
  },
  "dataQuality": {
    "completeness": 0.95,
    "consistency": 0.98,
    "freshness": 0.92,
    "issues": [
      { "type": "missing_asset_details", "count": 15 },
      { "type": "malformed_json", "count": 3 }
    ]
  }
}
```

## 11. Testing Strategy

### Unit Tests

```typescript
// tests/unit/prediction-service.test.ts
describe('PredictionService', () => {
  describe('calculateConfidence', () => {
    it('should return high confidence for large sample with low variance', () => {
      const service = new PredictionService();
      const result = service.calculateConfidence(15, 0.95, 50000, 1000000);
      
      expect(result.score).toBeGreaterThan(0.75);
      expect(result.level).toBe('High');
    });

    it('should return low confidence for small sample', () => {
      const service = new PredictionService();
      const result = service.calculateConfidence(2, 0.80, 100000, 1000000);
      
      expect(result.score).toBeLessThan(0.50);
      expect(result.level).toBe('Low');
    });

    it('should reduce confidence for high variance', () => {
      const service = new PredictionService();
      const highVariance = service.calculateConfidence(10, 0.90, 500000, 1000000);
      const lowVariance = service.calculateConfidence(10, 0.90, 50000, 1000000);
      
      expect(highVariance.score).toBeLessThan(lowVariance.score);
    });
  });

  describe('calculateBounds', () => {
    it('should widen bounds for low confidence', () => {
      const service = new PredictionService();
      const bounds = service.calculateBounds(1000000, 0.50, 100000, 1000000);
      
      const spread = (bounds.upperBound - bounds.lowerBound) / 1000000;
      expect(spread).toBeGreaterThan(0.20); // >20% spread for low confidence
    });

    it('should narrow bounds for high confidence', () => {
      const service = new PredictionService();
      const bounds = service.calculateBounds(1000000, 0.90, 50000, 1000000);
      
      const spread = (bounds.upperBound - bounds.lowerBound) / 1000000;
      expect(spread).toBeLessThan(0.10); // <10% spread for high confidence
    });
  });
});
```

### Integration Tests

```typescript
// tests/integration/prediction-flow.test.ts
describe('Prediction Flow (End-to-End)', () => {
  it('should generate prediction for auction with historical data', async () => {
    // Setup: Create historical auctions
    const historicalAuctions = await createTestAuctions(10, {
      make: 'Toyota',
      model: 'Camry',
      year: 2020,
      damageSeverity: 'moderate'
    });

    // Create target auction
    const targetAuction = await createTestAuction({
      make: 'Toyota',
      model: 'Camry',
      year: 2021,
      damageSeverity: 'moderate'
    });

    // Generate prediction
    const prediction = await predictionService.generatePrediction(targetAuction.id);

    // Assertions
    expect(prediction).toBeDefined();
    expect(prediction.method).toBe('historical');
    expect(prediction.sampleSize).toBeGreaterThanOrEqual(5);
    expect(prediction.confidenceLevel).toBe('High');
    expect(prediction.predictedPrice).toBeGreaterThan(0);
    expect(prediction.lowerBound).toBeLessThan(prediction.predictedPrice);
    expect(prediction.upperBound).toBeGreaterThan(prediction.predictedPrice);
  });

  it('should fallback to salvage value when no historical data exists', async () => {
    const auction = await createTestAuction({
      make: 'RareVehicle',
      model: 'UniqueModel',
      year: 2023,
      estimatedSalvageValue: 500000
    });

    const prediction = await predictionService.generatePrediction(auction.id);

    expect(prediction.method).toBe('salvage_value');
    expect(prediction.predictedPrice).toBe(500000);
    expect(prediction.confidenceLevel).toBe('Low');
  });
});
```

### Performance Tests

```typescript
// tests/performance/load-test.ts
describe('Performance Tests', () => {
  it('should handle 100 concurrent prediction requests within 200ms', async () => {
    const auctionIds = await createTestAuctions(100);
    
    const startTime = Date.now();
    const predictions = await Promise.all(
      auctionIds.map(id => predictionService.generatePrediction(id))
    );
    const endTime = Date.now();

    const avgResponseTime = (endTime - startTime) / 100;
    expect(avgResponseTime).toBeLessThan(200);
    expect(predictions).toHaveLength(100);
  });

  it('should handle 1000 concurrent recommendation requests within 200ms', async () => {
    const vendorIds = await createTestVendors(1000);
    
    const startTime = Date.now();
    const recommendations = await Promise.all(
      vendorIds.map(id => recommendationService.generateRecommendations(id))
    );
    const endTime = Date.now();

    const avgResponseTime = (endTime - startTime) / 1000;
    expect(avgResponseTime).toBeLessThan(200);
  });

  it('should maintain cache effectiveness under load', async () => {
    const auctionId = await createTestAuction();
    
    // First request (cache miss)
    await predictionService.generatePrediction(auctionId);
    
    // Subsequent requests (cache hits)
    const cacheHits = await Promise.all(
      Array(100).fill(null).map(() => predictionService.generatePrediction(auctionId))
    );

    // Verify all came from cache (should be much faster)
    expect(cacheHits).toHaveLength(100);
  });
});
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Prediction Response Time

*For any* active auction, when a vendor requests a price prediction, the system should return a response within 200ms for 95% of requests.

**Validates: Requirements 1.1, 9.1**

### Property 2: Prediction Completeness

*For any* generated prediction, the response must include predictedPrice, lowerBound, upperBound, confidenceScore, and confidenceLevel fields.

**Validates: Requirements 1.2**

### Property 3: Prediction Persistence

*For any* prediction generated, the system should store a record in the predictions table containing auctionId, predictedPrice, confidence interval, algorithmVersion, and timestamp.

**Validates: Requirements 1.4**

### Property 4: Prediction Audit Trail

*For any* prediction generated, the system should create an audit log entry that can be retrieved for accuracy tracking.

**Validates: Requirements 1.5**

### Property 5: Similarity Matching Correctness

*For any* auction with known make, model, year, and damage severity, the similarity matching algorithm should identify historical auctions with matching attributes and assign higher similarity scores to closer matches.

**Validates: Requirements 2.1**

### Property 6: Weighted Average Calculation

*For any* set of similar historical auctions with known final prices and time weights, the predicted price should equal the weighted average where more recent auctions have higher weights.

**Validates: Requirements 2.2**

### Property 7: Market Adjustment Application

*For any* base prediction, when market conditions indicate high competition, the adjusted prediction should be higher than the base prediction, and when conditions indicate low competition, it should be lower.

**Validates: Requirements 2.3**

### Property 8: Confidence Score Reduction

*For any* prediction with fewer than 5 similar historical auctions, the confidence score should be lower than predictions with 10 or more similar auctions.

**Validates: Requirements 2.4**

### Property 9: Salvage Value Fallback

*For any* auction with zero similar historical auctions, the prediction engine should use estimatedSalvageValue as the predicted price if available.

**Validates: Requirements 3.1**

### Property 10: Low Confidence for Fallback

*For any* prediction using salvage value fallback, the confidence score should be below 0.30 and confidence level should be "Low".

**Validates: Requirements 3.2**

### Property 11: Market Value Calculation Fallback

*For any* auction with no similar historical data and no estimatedSalvageValue, the system should calculate a fallback prediction using marketValue multiplied by a damage severity factor.

**Validates: Requirements 3.3**

### Property 12: Recommendation Response Time

*For any* vendor accessing the marketplace, the recommendation engine should return a ranked list of recommendations within 200ms for 95% of requests.

**Validates: Requirements 4.1, 9.2**

### Property 13: Bidding Pattern Influence

*For any* vendor with bidding history, recommendations should include auctions that match the vendor's historical asset type, price range, and damage level preferences.

**Validates: Requirements 4.2**

### Property 14: Recommendation Ranking

*For any* list of recommendations returned, the auctions should be sorted in descending order by match score.

**Validates: Requirements 4.3**

### Property 15: Recommendation Persistence

*For any* recommendation generated, the system should store a record containing vendorId, auctionId, matchScore, reasonCodes, and algorithmVersion.

**Validates: Requirements 4.5**

### Property 16: Asset Type Preference Extraction

*For any* vendor with bid history, the system should correctly identify which asset types the vendor has bid on most frequently.

**Validates: Requirements 5.1**

### Property 17: Price Range Preference Extraction

*For any* vendor with bid history, the system should calculate the vendor's typical price range using percentiles (P25, P75) of their historical bid amounts.

**Validates: Requirements 5.2**

### Property 18: Damage Level Preference Extraction

*For any* vendor with bid history, the system should identify the damage severity levels the vendor has bid on most frequently.

**Validates: Requirements 5.3**

### Property 19: Cold Start Content-Based Filtering

*For any* vendor with fewer than 3 bids, the recommendation engine should use content-based filtering (category matching) rather than collaborative filtering.

**Validates: Requirements 6.1**

### Property 20: Category Matching

*For any* vendor with specified preferred categories, recommendations should prioritize auctions matching those categories.

**Validates: Requirements 6.2**

### Property 21: Popularity Fallback for New Vendors

*For any* vendor with zero bidding history, the recommendation engine should return auctions ranked by watchingCount (popularity).

**Validates: Requirements 6.3**

### Property 22: View Event Recording

*For any* vendor viewing an auction, the system should record an interaction event with eventType="view", vendorId, auctionId, and timestamp.

**Validates: Requirements 7.1**

### Property 23: Bid Event Recording

*For any* vendor placing a bid, the system should record an interaction event with eventType="bid", vendorId, auctionId, bidAmount, and timestamp.

**Validates: Requirements 7.2**

### Property 24: Auction Close Event Recording

*For any* auction that closes, the system should record the final outcome including finalPrice, winnerId, totalBids, and timestamp.

**Validates: Requirements 7.3**

### Property 25: PII Anonymization

*For any* data export for algorithm training, all personally identifiable information (names, emails, phone numbers, IP addresses) should be anonymized or removed.

**Validates: Requirements 8.1**

### Property 26: Hybrid Score Weighting

*For any* vendor with 10+ bids, the recommendation match score should be calculated as (collaborative_score × 0.60) + (content_score × 0.40) + boosts.

**Validates: Requirements 11.3**

### Property 27: Already-Bid Exclusion

*For any* vendor, recommendations should never include auctions that the vendor has already placed bids on.

**Validates: Requirements 11.4**

### Property 28: Dynamic Prediction Recalculation

*For any* auction where a new bid causes market conditions to change by more than 10%, the prediction should be recalculated.

**Validates: Requirements 12.1**

### Property 29: Bidding Pattern Update

*For any* vendor placing a new bid, the vendor's bidding pattern profile should be updated to reflect the new bid.

**Validates: Requirements 12.2**

### Property 30: Algorithm Versioning

*For any* prediction or recommendation generated, the record should include an algorithmVersion field identifying which algorithm version was used.

**Validates: Requirements 19.1**

### Property 31: Automatic Accuracy Update

*For any* auction that closes, the system should automatically update the corresponding prediction record with actualPrice and calculate the accuracy metric.

**Validates: Requirements 22.1**

### Edge Case Property 1: High Reserve Price Handling

*For any* auction where reservePrice exceeds all similar historical final prices, the prediction lowerBound should be set to reservePrice.

**Validates: Requirements 17.1**

### Edge Case Property 2: High Early Bid Adjustment

*For any* auction with an early bid exceeding the predicted price by more than 50%, the prediction should be recalculated using the current bid as the new baseline.

**Validates: Requirements 17.2**

### Edge Case Property 3: High Variance Interval Widening

*For any* prediction where market variance (coefficient of variation) exceeds 0.40, the confidence intervals should be widened proportionally.

**Validates: Requirements 17.3**

### Edge Case Property 4: Losing Vendor Recommendations

*For any* vendor with only losing bids (zero wins), recommendations should prioritize auctions with lower watchingCount (lower competition).

**Validates: Requirements 18.1**

### Edge Case Property 5: Inactive Vendor Re-engagement

*For any* vendor who has not placed a bid in 30+ days, recommendations should include more diverse auction types to re-engage interest.

**Validates: Requirements 18.2**

### Edge Case Property 6: Prediction Failure Fallback

*For any* auction where the prediction engine fails to generate a prediction, the system should return estimatedSalvageValue with a "Fallback Estimate" label.

**Validates: Requirements 23.1**

### Edge Case Property 7: Recommendation Failure Fallback

*For any* vendor where the recommendation engine fails, the system should return popular auctions sorted by watchingCount.

**Validates: Requirements 23.2**

### Edge Case Property 8: Database Query Failure Recovery

*For any* database query that fails, if cached results exist, the system should return the cached results with a "Cached Data" indicator.

**Validates: Requirements 40.1**

### Edge Case Property 9: No Cache Error Messaging

*For any* database query that fails when no cached results exist, the system should return a user-friendly error message without exposing technical details.

**Validates: Requirements 40.2**


## Error Handling

### Error Classification

**1. Validation Errors (400 Bad Request)**
```typescript
// Invalid auction ID format
{
  "success": false,
  "error": {
    "code": "INVALID_AUCTION_ID",
    "message": "Auction ID must be a valid UUID",
    "field": "auctionId"
  }
}

// Invalid query parameters
{
  "success": false,
  "error": {
    "code": "INVALID_PARAMETERS",
    "message": "Limit must be between 1 and 50",
    "field": "limit"
  }
}
```

**2. Authorization Errors (401/403)**
```typescript
// Unauthorized access
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}

// Forbidden - vendor accessing another vendor's data
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You can only access your own recommendations"
  }
}
```

**3. Not Found Errors (404)**
```typescript
{
  "success": false,
  "error": {
    "code": "AUCTION_NOT_FOUND",
    "message": "Auction not found"
  }
}
```

**4. Rate Limiting (429)**
```typescript
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again in 60 seconds.",
    "retryAfter": 60
  }
}
```

**5. Server Errors (500)**
```typescript
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred. Please try again later.",
    "requestId": "req_abc123xyz" // For support tracking
  }
}
```

### Error Recovery Strategies

**Circuit Breaker Pattern:**
```typescript
class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime: Date | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  private readonly failureThreshold = 5;
  private readonly resetTimeout = 60000; // 1 minute

  async execute<T>(operation: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime!.getTime() > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        return fallback();
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      return fallback();
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = new Date();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
      logger.error('Circuit breaker opened', { failureCount: this.failureCount });
    }
  }
}

// Usage
const predictionCircuitBreaker = new CircuitBreaker();

async function getPredictionWithFallback(auctionId: string) {
  return await predictionCircuitBreaker.execute(
    () => predictionService.generatePrediction(auctionId),
    () => generateFallbackPrediction(auctionId)
  );
}
```

**Retry Logic with Exponential Backoff:**
```typescript
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      
      const delay = baseDelay * Math.pow(2, attempt);
      logger.warn(`Retry attempt ${attempt + 1} after ${delay}ms`, { error });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Max retries exceeded');
}

// Usage
const prediction = await retryWithBackoff(
  () => db.query.predictions.findFirst({ where: eq(predictions.auctionId, auctionId) })
);
```

**Graceful Degradation:**
```typescript
async function getPredictionWithDegradation(auctionId: string) {
  try {
    // Try full prediction with historical data
    return await predictionService.generatePrediction(auctionId);
  } catch (error) {
    logger.error('Full prediction failed, trying salvage value fallback', { error });
    
    try {
      // Fallback to salvage value
      return await predictionService.generateSalvageValuePrediction(auctionId);
    } catch (error) {
      logger.error('Salvage value fallback failed, using market value', { error });
      
      // Final fallback to market value calculation
      return await predictionService.generateMarketValuePrediction(auctionId);
    }
  }
}
```

### Logging Strategy

```typescript
// Structured logging with context
logger.info('Prediction generated', {
  auctionId,
  predictedPrice,
  confidenceScore,
  method,
  sampleSize,
  responseTime: Date.now() - startTime
});

logger.error('Prediction generation failed', {
  auctionId,
  error: error.message,
  stack: error.stack,
  context: {
    assetType,
    make,
    model,
    year
  }
});

// Performance logging
logger.debug('Query performance', {
  query: 'similarity_matching',
  duration: queryDuration,
  rowCount: results.length,
  cacheHit: false
});
```

## Testing Strategy

### Dual Testing Approach

The intelligence system requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests:**
- Specific examples demonstrating correct behavior
- Edge cases (empty data, outliers, extreme values)
- Error conditions (invalid inputs, database failures)
- Integration points between components

**Property-Based Tests:**
- Universal properties that hold for all inputs
- Comprehensive input coverage through randomization
- Minimum 100 iterations per property test
- Each test references its design document property

### Property-Based Testing Configuration

**Library Selection:** fast-check (JavaScript/TypeScript)

**Test Structure:**
```typescript
import fc from 'fast-check';

describe('Prediction Engine Properties', () => {
  /**
   * Feature: ai-marketplace-intelligence
   * Property 2: Prediction Completeness
   * For any generated prediction, the response must include predictedPrice, 
   * lowerBound, upperBound, confidenceScore, and confidenceLevel fields.
   */
  it('should include all required fields in prediction', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          make: fc.string({ minLength: 1, maxLength: 50 }),
          model: fc.string({ minLength: 1, maxLength: 50 }),
          year: fc.integer({ min: 2000, max: 2025 }),
          damageSeverity: fc.constantFrom('none', 'minor', 'moderate', 'severe'),
          marketValue: fc.integer({ min: 100000, max: 10000000 })
        }),
        async (auctionData) => {
          // Create test auction
          const auction = await createTestAuction(auctionData);
          
          // Generate prediction
          const prediction = await predictionService.generatePrediction(auction.id);
          
          // Verify all required fields exist
          expect(prediction).toHaveProperty('predictedPrice');
          expect(prediction).toHaveProperty('lowerBound');
          expect(prediction).toHaveProperty('upperBound');
          expect(prediction).toHaveProperty('confidenceScore');
          expect(prediction).toHaveProperty('confidenceLevel');
          
          // Verify types
          expect(typeof prediction.predictedPrice).toBe('number');
          expect(typeof prediction.confidenceScore).toBe('number');
          expect(['High', 'Medium', 'Low']).toContain(prediction.confidenceLevel);
          
          // Verify bounds relationship
          expect(prediction.lowerBound).toBeLessThan(prediction.predictedPrice);
          expect(prediction.upperBound).toBeGreaterThan(prediction.predictedPrice);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: ai-marketplace-intelligence
   * Property 8: Confidence Score Reduction
   * For any prediction with fewer than 5 similar historical auctions, 
   * the confidence score should be lower than predictions with 10+ similar auctions.
   */
  it('should reduce confidence for small sample sizes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          make: fc.string({ minLength: 1, maxLength: 50 }),
          model: fc.string({ minLength: 1, maxLength: 50 }),
          year: fc.integer({ min: 2000, max: 2025 }),
          smallSampleSize: fc.integer({ min: 1, max: 4 }),
          largeSampleSize: fc.integer({ min: 10, max: 20 })
        }),
        async (testData) => {
          // Create small sample
          await createHistoricalAuctions(testData.smallSampleSize, {
            make: testData.make,
            model: testData.model,
            year: testData.year
          });
          
          const auction1 = await createTestAuction({
            make: testData.make,
            model: testData.model,
            year: testData.year
          });
          
          const predictionSmall = await predictionService.generatePrediction(auction1.id);
          
          // Create large sample
          await createHistoricalAuctions(
            testData.largeSampleSize - testData.smallSampleSize,
            {
              make: testData.make,
              model: testData.model,
              year: testData.year
            }
          );
          
          const auction2 = await createTestAuction({
            make: testData.make,
            model: testData.model,
            year: testData.year
          });
          
          const predictionLarge = await predictionService.generatePrediction(auction2.id);
          
          // Verify confidence is lower for small sample
          expect(predictionSmall.confidenceScore).toBeLessThan(predictionLarge.confidenceScore);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Test Coverage Requirements

**Minimum Coverage Targets:**
- Unit test coverage: 80%
- Property test coverage: All correctness properties
- Integration test coverage: All API endpoints
- Performance test coverage: All critical paths

**Critical Paths to Test:**
1. Prediction generation (historical, salvage value, market value fallbacks)
2. Recommendation generation (collaborative, content-based, hybrid)
3. Interaction tracking (view, bid, win events)
4. Real-time updates (Socket.IO events)
5. Background jobs (materialized view refresh, accuracy calculation)
6. Cache invalidation and refresh
7. Error handling and fallback mechanisms

### Continuous Integration

```yaml
# .github/workflows/intelligence-tests.yml
name: Intelligence System Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run database migrations
        run: npm run db:migrate
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run property-based tests
        run: npm run test:property
      
      - name: Run integration tests
        run: npm run test:integration
      
      - name: Run performance tests
        run: npm run test:performance
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Deployment and Rollout

### Phased Rollout Plan

**Phase 1: Shadow Mode (Week 1-2)**
- Deploy with feature flag disabled
- Run algorithms in background without displaying to users
- Collect metrics and validate accuracy
- Monitor performance and resource usage

**Phase 2: A/B Test (Week 3-4)**
- Enable for 10% of vendors
- Compare engagement metrics vs control group
- Monitor prediction accuracy and recommendation effectiveness
- Gather user feedback

**Phase 3: Gradual Rollout (Week 5-6)**
- Increase to 50% of vendors
- Continue monitoring metrics
- Adjust algorithm parameters based on performance

**Phase 4: Full Rollout (Week 7)**
- Enable for 100% of vendors
- Maintain monitoring and alerting
- Prepare for ongoing optimization

### Rollback Plan

```typescript
// Feature flag configuration
const INTELLIGENCE_FEATURE_FLAGS = {
  predictions: {
    enabled: process.env.ENABLE_PREDICTIONS === 'true',
    rolloutPercentage: parseInt(process.env.PREDICTIONS_ROLLOUT_PERCENTAGE || '100')
  },
  recommendations: {
    enabled: process.env.ENABLE_RECOMMENDATIONS === 'true',
    rolloutPercentage: parseInt(process.env.RECOMMENDATIONS_ROLLOUT_PERCENTAGE || '100')
  }
};

// Rollback procedure
async function rollbackIntelligenceFeatures() {
  // 1. Disable feature flags
  await updateFeatureFlags({
    predictions: { enabled: false },
    recommendations: { enabled: false }
  });

  // 2. Clear caches
  await redisCache.flushAll();

  // 3. Stop background jobs
  await stopIntelligenceJobs();

  // 4. Notify team
  await notificationService.sendAdminNotification({
    title: 'Intelligence Features Rolled Back',
    message: 'All intelligence features have been disabled',
    severity: 'high'
  });
}
```

### Migration Strategy

**Data Backfill:**
```typescript
// Backfill historical auction data for predictions
async function backfillHistoricalData() {
  const closedAuctions = await db.query.auctions.findMany({
    where: eq(auctions.status, 'closed'),
    with: { case: true, bids: true }
  });

  for (const auction of closedAuctions) {
    // Generate prediction retroactively
    const prediction = await predictionService.generatePrediction(auction.id);
    
    // Update with actual price for accuracy tracking
    await predictionService.updateAccuracy(auction.id, auction.currentBid);
  }
}

// Pre-compute materialized views
async function warmUpMaterializedViews() {
  await db.execute(sql`REFRESH MATERIALIZED VIEW vendor_bidding_patterns`);
  await db.execute(sql`REFRESH MATERIALIZED VIEW market_conditions_summary`);
}

// Warm up caches
async function warmUpCaches() {
  const activeVendors = await db.query.vendors.findMany({
    where: eq(vendors.status, 'approved')
  });

  for (const vendor of activeVendors) {
    const profile = await db.query.vendorBiddingPatterns.findFirst({
      where: eq(vendorBiddingPatterns.vendorId, vendor.id)
    });
    
    if (profile) {
      await redisCache.setVendorProfile(vendor.id, profile);
    }
  }
}
```

---

## Summary

This design document provides a comprehensive blueprint for implementing the AI-Powered Marketplace Intelligence system with:

1. **Detailed Algorithms**: SQL-based prediction and recommendation engines with complete formulas and queries
2. **Complete Data Structures**: Database schemas, materialized views, and TypeScript interfaces
3. **Production-Ready APIs**: RESTful endpoints and Socket.IO real-time integration
4. **Robust Architecture**: Service layer, background jobs, multi-level caching, and error handling
5. **Edge Case Handling**: Comprehensive strategies for empty databases, outliers, and data quality issues
6. **Cold-Start Solutions**: Progressive strategies for new platforms and vendors
7. **GDPR Compliance**: Anonymization, deletion workflows, and retention policies
8. **Performance Optimization**: Query optimization, caching strategies, and monitoring
9. **Testing Strategy**: Unit tests, property-based tests, and performance tests
10. **Deployment Plan**: Phased rollout with feature flags and rollback procedures

The system is designed to operate entirely within PostgreSQL, achieve sub-200ms response times, handle cold-start scenarios gracefully, and continuously improve through automated accuracy tracking and parameter tuning.



---

# PART 2: ADVANCED MARKET INTELLIGENCE SYSTEM

## Overview

This section extends the core intelligence system with advanced market analytics, granular asset performance tracking, behavioral segmentation, ML training data pipelines, and comprehensive dashboards. These features enable data-driven decision making, support future ML model training, and provide deep insights into marketplace dynamics.

### Key Additions

1. **Granular Asset Performance Analytics**: Track performance by make/model/year/color/trim/condition
2. **Temporal Pattern Analytics**: Identify peak bidding hours, seasonal trends, and optimal timing
3. **Geographic Pattern Analytics**: Understand regional preferences and price variations
4. **Vendor Behavioral Segmentation**: Classify vendors into personas for personalized strategies
5. **Session and Conversion Analytics**: Track user engagement and identify bottlenecks
6. **Dynamic Schema Evolution**: Automatically adapt to new asset types and attributes
7. **ML Training Data Pipeline**: Export comprehensive datasets with feature engineering
8. **Enhanced Algorithms**: Integrate granular data into prediction and recommendation engines
9. **Comprehensive Logging**: Structured logs for all intelligence operations
10. **Advanced Dashboards**: Vendor and admin interfaces for market intelligence

---

## 2. Advanced Analytics Database Schema

### 2.1 Asset Performance Analytics Table

Tracks granular performance metrics for specific asset configurations.

**Schema Definition:**

```typescript
// src/lib/db/schema/intelligence/asset-performance-analytics.ts
import { pgTable, uuid, varchar, integer, numeric, decimal, timestamp, index, jsonb } from 'drizzle-orm/pg-core';

export const assetPerformanceAnalytics = pgTable('asset_performance_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetType: varchar('asset_type', { length: 50 }).notNull(),
  make: varchar('make', { length: 100 }).notNull(),
  model: varchar('model', { length: 100 }).notNull(),
  year: integer('year').notNull(),
  color: varchar('color', { length: 50 }),
  trim: varchar('trim', { length: 100 }),
  bodyStyle: varchar('body_style', { length: 50 }),
  storage: varchar('storage', { length: 50 }),
  mileageRange: varchar('mileage_range', { length: 50 }),
  condition: varchar('condition', { length: 50 }).notNull(),
  damageSeverity: varchar('damage_severity', { length: 50 }).notNull(),
  conditionScore: integer('condition_score'),
  
  // Performance metrics
  avgFinalPrice: numeric('avg_final_price', { precision: 12, scale: 2 }).notNull(),
  avgBidCount: integer('avg_bid_count').notNull(),
  avgTimeToSell: integer('avg_time_to_sell').notNull(), // seconds
  avgDaysToSell: integer('avg_days_to_sell').notNull(),
  winRate: decimal('win_rate', { precision: 5, scale: 2 }).notNull(), // percentage
  sellThroughRate: decimal('sell_through_rate', { precision: 5, scale: 2 }).notNull(),
  competitionLevel: varchar('competition_level', { length: 20 }).notNull(), // 'low', 'medium', 'high'
  
  // Attribute impact analysis
  pricePerAttribute: jsonb('price_per_attribute').$type<{
    color?: Record<string, number>; // percentage impact
    trim?: Record<string, number>;
    bodyStyle?: Record<string, number>;
    storage?: Record<string, number>;
  }>(),
  
  // Statistical reliability
  sampleSize: integer('sample_size').notNull(),
  lastUpdated: timestamp('last_updated').notNull().defaultNow()
}, (table) => ({
  idxAssetTypeMakeModel: index('idx_asset_perf_type_make_model').on(table.assetType, table.make, table.model),
  idxAvgPrice: index('idx_asset_perf_avg_price').on(table.avgFinalPrice),
  idxLastUpdated: index('idx_asset_perf_last_updated').on(table.lastUpdated),
  idxYearColor: index('idx_asset_perf_year_color').on(table.year, table.color),
  idxSellThroughRate: index('idx_asset_perf_sell_through_rate').on(table.sellThroughRate)
}));
```

**Aggregation Query:**

```sql
-- Daily aggregation job to update asset_performance_analytics
WITH closed_auctions AS (
  SELECT 
    sc.asset_type,
    sc.asset_details->>'make' AS make,
    sc.asset_details->>'model' AS model,
    (sc.asset_details->>'year')::int AS year,
    sc.ai_assessment->'itemDetails'->>'color' AS color,
    sc.ai_assessment->'itemDetails'->>'trim' AS trim,
    sc.ai_assessment->'itemDetails'->>'bodyStyle' AS body_style,
    sc.ai_assessment->'itemDetails'->>'storage' AS storage,
    CASE 
      WHEN sc.vehicle_mileage < 50000 THEN '0-50k'
      WHEN sc.vehicle_mileage < 100000 THEN '50k-100k'
      WHEN sc.vehicle_mileage < 150000 THEN '100k-150k'
      WHEN sc.vehicle_mileage < 200000 THEN '150k-200k'
      ELSE '200k+'
    END AS mileage_range,
    sc.ai_assessment->'itemDetails'->>'overallCondition' AS condition,
    sc.damage_severity,
    a.current_bid AS final_price,
    COUNT(b.id) AS bid_count,
    EXTRACT(EPOCH FROM (a.end_time - a.start_time)) AS time_to_sell,
    CASE WHEN a.current_bidder IS NOT NULL THEN 1 ELSE 0 END AS has_winner
  FROM auctions a
  JOIN salvage_cases sc ON a.case_id = sc.id
  LEFT JOIN bids b ON b.auction_id = a.id
  WHERE a.status = 'closed'
    AND a.end_time > NOW() - INTERVAL '24 hours'
  GROUP BY sc.id, a.id
)
INSERT INTO asset_performance_analytics (
  asset_type, make, model, year, color, trim, body_style, storage, mileage_range,
  condition, damage_severity, avg_final_price, avg_bid_count, avg_time_to_sell,
  avg_days_to_sell, win_rate, sell_through_rate, competition_level, sample_size
)
SELECT 
  asset_type, make, model, year, color, trim, body_style, storage, mileage_range,
  condition, damage_severity,
  AVG(final_price) AS avg_final_price,
  AVG(bid_count)::int AS avg_bid_count,
  AVG(time_to_sell)::int AS avg_time_to_sell,
  (AVG(time_to_sell) / 86400)::int AS avg_days_to_sell,
  (SUM(has_winner)::decimal / COUNT(*) * 100) AS win_rate,
  (COUNT(*) FILTER (WHERE bid_count > 0)::decimal / COUNT(*) * 100) AS sell_through_rate,
  CASE 
    WHEN AVG(bid_count) > 10 THEN 'high'
    WHEN AVG(bid_count) >= 5 THEN 'medium'
    ELSE 'low'
  END AS competition_level,
  COUNT(*) AS sample_size
FROM closed_auctions
GROUP BY asset_type, make, model, year, color, trim, body_style, storage, 
         mileage_range, condition, damage_severity
ON CONFLICT (asset_type, make, model, year, color, trim, condition, damage_severity)
DO UPDATE SET
  avg_final_price = EXCLUDED.avg_final_price,
  avg_bid_count = EXCLUDED.avg_bid_count,
  avg_time_to_sell = EXCLUDED.avg_time_to_sell,
  avg_days_to_sell = EXCLUDED.avg_days_to_sell,
  win_rate = EXCLUDED.win_rate,
  sell_through_rate = EXCLUDED.sell_through_rate,
  competition_level = EXCLUDED.competition_level,
  sample_size = asset_performance_analytics.sample_size + EXCLUDED.sample_size,
  last_updated = NOW();
```


### 2.2 Attribute Performance Analytics Table

Tracks performance of specific attributes (color, trim, storage) across asset types.

**Schema Definition:**

```typescript
// src/lib/db/schema/intelligence/attribute-performance-analytics.ts
export const attributePerformanceAnalytics = pgTable('attribute_performance_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetType: varchar('asset_type', { length: 50 }).notNull(),
  attributeName: varchar('attribute_name', { length: 50 }).notNull(), // 'color', 'trim', 'storage', 'bodyStyle'
  attributeValue: varchar('attribute_value', { length: 100 }).notNull(),
  
  // Performance metrics
  avgFinalPrice: numeric('avg_final_price', { precision: 12, scale: 2 }).notNull(),
  avgBidCount: integer('avg_bid_count').notNull(),
  sellThroughRate: decimal('sell_through_rate', { precision: 5, scale: 2 }).notNull(),
  popularityRank: integer('popularity_rank').notNull(), // 1 = most popular
  priceImpact: decimal('price_impact', { precision: 5, scale: 2 }).notNull(), // percentage vs baseline
  demandScore: integer('demand_score').notNull(), // 0-100
  
  // Statistical reliability
  sampleSize: integer('sample_size').notNull(),
  lastUpdated: timestamp('last_updated').notNull().defaultNow()
}, (table) => ({
  idxAssetTypeAttribute: index('idx_attr_perf_asset_type_attr').on(table.assetType, table.attributeName),
  idxPopularityRank: index('idx_attr_perf_popularity_rank').on(table.popularityRank),
  idxDemandScore: index('idx_attr_perf_demand_score').on(table.demandScore)
}));
```

**Aggregation Query:**

```sql
-- Calculate attribute performance with price impact analysis
WITH attribute_stats AS (
  SELECT 
    sc.asset_type,
    'color' AS attribute_name,
    sc.ai_assessment->'itemDetails'->>'color' AS attribute_value,
    AVG(a.current_bid) AS avg_final_price,
    AVG(bid_counts.bid_count) AS avg_bid_count,
    COUNT(*) FILTER (WHERE a.current_bidder IS NOT NULL)::decimal / COUNT(*) * 100 AS sell_through_rate,
    COUNT(*) AS sample_size
  FROM auctions a
  JOIN salvage_cases sc ON a.case_id = sc.id
  LEFT JOIN (
    SELECT auction_id, COUNT(*) AS bid_count
    FROM bids
    GROUP BY auction_id
  ) bid_counts ON bid_counts.auction_id = a.id
  WHERE a.status = 'closed'
    AND sc.ai_assessment->'itemDetails'->>'color' IS NOT NULL
  GROUP BY sc.asset_type, sc.ai_assessment->'itemDetails'->>'color'
),
baseline_prices AS (
  SELECT 
    asset_type,
    AVG(avg_final_price) AS baseline_price
  FROM attribute_stats
  GROUP BY asset_type
),
ranked_attributes AS (
  SELECT 
    a.*,
    ROW_NUMBER() OVER (PARTITION BY a.asset_type ORDER BY a.sample_size DESC) AS popularity_rank,
    ((a.avg_final_price - b.baseline_price) / b.baseline_price * 100) AS price_impact,
    LEAST(100, (a.sample_size / 10.0 * a.sell_through_rate)::int) AS demand_score
  FROM attribute_stats a
  JOIN baseline_prices b ON a.asset_type = b.asset_type
)
INSERT INTO attribute_performance_analytics (
  asset_type, attribute_name, attribute_value, avg_final_price, avg_bid_count,
  sell_through_rate, popularity_rank, price_impact, demand_score, sample_size
)
SELECT * FROM ranked_attributes
ON CONFLICT (asset_type, attribute_name, attribute_value)
DO UPDATE SET
  avg_final_price = EXCLUDED.avg_final_price,
  avg_bid_count = EXCLUDED.avg_bid_count,
  sell_through_rate = EXCLUDED.sell_through_rate,
  popularity_rank = EXCLUDED.popularity_rank,
  price_impact = EXCLUDED.price_impact,
  demand_score = EXCLUDED.demand_score,
  sample_size = EXCLUDED.sample_size,
  last_updated = NOW();
```

### 2.3 Temporal Patterns Analytics Table

Tracks time-based patterns in bidding and auction outcomes.

**Schema Definition:**

```typescript
// src/lib/db/schema/intelligence/temporal-patterns-analytics.ts
export const temporalPatternsAnalytics = pgTable('temporal_patterns_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  patternType: varchar('pattern_type', { length: 20 }).notNull(), // 'hourly', 'daily', 'weekly', 'monthly', 'seasonal'
  timeSegment: varchar('time_segment', { length: 50 }).notNull(), // '14' (hour), 'Monday', 'January', etc.
  assetType: varchar('asset_type', { length: 50 }),
  
  // Activity metrics
  avgBidCount: integer('avg_bid_count').notNull(),
  avgFinalPrice: numeric('avg_final_price', { precision: 12, scale: 2 }).notNull(),
  avgVendorActivity: integer('avg_vendor_activity').notNull(), // unique vendors
  conversionRate: decimal('conversion_rate', { precision: 5, scale: 2 }).notNull(),
  peakActivityScore: integer('peak_activity_score').notNull(), // 0-100
  
  // Timing metrics
  avgTimeToFirstBid: integer('avg_time_to_first_bid'), // seconds
  avgTimeToFinalBid: integer('avg_time_to_final_bid'), // seconds
  
  // Statistical reliability
  sampleSize: integer('sample_size').notNull(),
  lastUpdated: timestamp('last_updated').notNull().defaultNow()
}, (table) => ({
  idxPatternTypeSegment: index('idx_temporal_pattern_type_segment').on(table.patternType, table.timeSegment),
  idxPeakActivityScore: index('idx_temporal_peak_activity').on(table.peakActivityScore),
  idxAssetType: index('idx_temporal_asset_type').on(table.assetType)
}));
```


**Aggregation Query:**

```sql
-- Hourly pattern analysis
WITH hourly_patterns AS (
  SELECT 
    'hourly' AS pattern_type,
    EXTRACT(HOUR FROM b.created_at)::text AS time_segment,
    sc.asset_type,
    COUNT(DISTINCT b.auction_id) AS auction_count,
    AVG(bid_counts.bid_count) AS avg_bid_count,
    AVG(a.current_bid) AS avg_final_price,
    COUNT(DISTINCT b.vendor_id) AS avg_vendor_activity,
    COUNT(*) FILTER (WHERE a.current_bidder IS NOT NULL)::decimal / COUNT(DISTINCT a.id) * 100 AS conversion_rate,
    AVG(first_bid_times.time_to_first_bid) AS avg_time_to_first_bid,
    AVG(last_bid_times.time_to_final_bid) AS avg_time_to_final_bid,
    COUNT(DISTINCT a.id) AS sample_size
  FROM bids b
  JOIN auctions a ON b.auction_id = a.id
  JOIN salvage_cases sc ON a.case_id = sc.id
  LEFT JOIN (
    SELECT auction_id, COUNT(*) AS bid_count
    FROM bids
    GROUP BY auction_id
  ) bid_counts ON bid_counts.auction_id = a.id
  LEFT JOIN (
    SELECT 
      auction_id,
      EXTRACT(EPOCH FROM (MIN(created_at) - (SELECT start_time FROM auctions WHERE id = auction_id))) AS time_to_first_bid
    FROM bids
    GROUP BY auction_id
  ) first_bid_times ON first_bid_times.auction_id = a.id
  LEFT JOIN (
    SELECT 
      auction_id,
      EXTRACT(EPOCH FROM (MAX(created_at) - (SELECT start_time FROM auctions WHERE id = auction_id))) AS time_to_final_bid
    FROM bids
    GROUP BY auction_id
  ) last_bid_times ON last_bid_times.auction_id = a.id
  WHERE a.status = 'closed'
    AND b.created_at > NOW() - INTERVAL '90 days'
  GROUP BY EXTRACT(HOUR FROM b.created_at), sc.asset_type
),
max_activity AS (
  SELECT 
    asset_type,
    MAX(avg_bid_count) AS max_bid_count
  FROM hourly_patterns
  GROUP BY asset_type
)
INSERT INTO temporal_patterns_analytics (
  pattern_type, time_segment, asset_type, avg_bid_count, avg_final_price,
  avg_vendor_activity, conversion_rate, peak_activity_score, avg_time_to_first_bid,
  avg_time_to_final_bid, sample_size
)
SELECT 
  hp.pattern_type,
  hp.time_segment,
  hp.asset_type,
  hp.avg_bid_count::int,
  hp.avg_final_price,
  hp.avg_vendor_activity::int,
  hp.conversion_rate,
  LEAST(100, (hp.avg_bid_count / ma.max_bid_count * 100)::int) AS peak_activity_score,
  hp.avg_time_to_first_bid::int,
  hp.avg_time_to_final_bid::int,
  hp.sample_size::int
FROM hourly_patterns hp
JOIN max_activity ma ON hp.asset_type = ma.asset_type
ON CONFLICT (pattern_type, time_segment, asset_type)
DO UPDATE SET
  avg_bid_count = EXCLUDED.avg_bid_count,
  avg_final_price = EXCLUDED.avg_final_price,
  avg_vendor_activity = EXCLUDED.avg_vendor_activity,
  conversion_rate = EXCLUDED.conversion_rate,
  peak_activity_score = EXCLUDED.peak_activity_score,
  avg_time_to_first_bid = EXCLUDED.avg_time_to_first_bid,
  avg_time_to_final_bid = EXCLUDED.avg_time_to_final_bid,
  sample_size = EXCLUDED.sample_size,
  last_updated = NOW();
```

### 2.4 Geographic Patterns Analytics Table

Tracks regional preferences and price variations.

**Schema Definition:**

```typescript
// src/lib/db/schema/intelligence/geographic-patterns-analytics.ts
export const geographicPatternsAnalytics = pgTable('geographic_patterns_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  locationId: varchar('location_id', { length: 50 }).notNull(),
  locationName: varchar('location_name', { length: 100 }).notNull(),
  region: varchar('region', { length: 100 }).notNull(), // State/Province
  assetType: varchar('asset_type', { length: 50 }),
  make: varchar('make', { length: 100 }),
  model: varchar('model', { length: 100 }),
  
  // Regional metrics
  caseCount: integer('case_count').notNull(),
  vendorCount: integer('vendor_count').notNull(),
  avgFinalPrice: numeric('avg_final_price', { precision: 12, scale: 2 }).notNull(),
  regionalDemandScore: integer('regional_demand_score').notNull(), // 0-100
  priceVariance: decimal('price_variance', { precision: 5, scale: 2 }).notNull(), // % vs national average
  
  // Asset preferences
  topAssetTypes: jsonb('top_asset_types').$type<Array<{
    assetType: string;
    count: number;
    percentage: number;
  }>>(),
  regionalPreferences: jsonb('regional_preferences').$type<Record<string, number>>(), // assetType -> price variance %
  
  // Distance analysis
  avgDistanceTraveled: numeric('avg_distance_traveled', { precision: 10, scale: 2 }), // km
  distanceImpactScore: decimal('distance_impact_score', { precision: 5, scale: 2 }), // correlation coefficient
  
  lastUpdated: timestamp('last_updated').notNull().defaultNow()
}, (table) => ({
  idxRegionAssetType: index('idx_geo_region_asset_type').on(table.region, table.assetType),
  idxDemandScore: index('idx_geo_demand_score').on(table.regionalDemandScore),
  idxPriceVariance: index('idx_geo_price_variance').on(table.priceVariance)
}));
```


### 2.5 Vendor Segments Table

Classifies vendors into behavioral personas.

**Schema Definition:**

```typescript
// src/lib/db/schema/intelligence/vendor-segments.ts
export const vendorSegments = pgTable('vendor_segments', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  segmentType: varchar('segment_type', { length: 50 }).notNull(), // 'bargain_hunter', 'premium_buyer', etc.
  confidenceScore: integer('confidence_score').notNull(), // 0-100
  segmentScore: integer('segment_score').notNull(), // 0-100, how strongly they match
  
  // Segment characteristics
  segmentAttributes: jsonb('segment_attributes').$type<{
    avgBidAmount: number;
    preferredAssetTypes: string[];
    preferredPriceRange: { min: number; max: number };
    avgDaysBetweenBids: number;
    preferredDamageSeverity: string;
    preferredTimeOfDay: number; // hour
    preferredDayOfWeek: number; // 0-6
    winRateByAssetType: Record<string, number>;
  }>(),
  
  assignedAt: timestamp('assigned_at').notNull().defaultNow(),
  lastUpdated: timestamp('last_updated').notNull().defaultNow()
}, (table) => ({
  idxVendorId: index('idx_vendor_segments_vendor_id').on(table.vendorId),
  idxSegmentType: index('idx_vendor_segments_type').on(table.segmentType),
  idxConfidenceScore: index('idx_vendor_segments_confidence').on(table.confidenceScore)
}));
```

**Segmentation Algorithm:**

```typescript
// src/services/intelligence/vendor-segmentation.service.ts
export class VendorSegmentationService {
  async classifyVendor(vendorId: string): Promise<VendorSegment[]> {
    const vendorStats = await this.getVendorStats(vendorId);
    const marketAverage = await this.getMarketAverage();
    
    const segments: VendorSegment[] = [];
    
    // Bargain Hunter: low avg bid, high win rate
    if (vendorStats.avgBidAmount < marketAverage.avgBidAmount * 0.8 && 
        vendorStats.winRate > 40) {
      segments.push({
        segmentType: 'bargain_hunter',
        confidenceScore: 85,
        segmentScore: Math.min(100, (vendorStats.winRate / 40) * 100)
      });
    }
    
    // Premium Buyer: high avg bid, high market value
    if (vendorStats.avgBidAmount > marketAverage.avgBidAmount * 1.5 && 
        vendorStats.avgMarketValue > 1000000) {
      segments.push({
        segmentType: 'premium_buyer',
        confidenceScore: 90,
        segmentScore: Math.min(100, (vendorStats.avgBidAmount / marketAverage.avgBidAmount) * 50)
      });
    }
    
    // Specialist: >70% bids in single asset type
    const topAssetTypePercentage = vendorStats.assetTypeDistribution[0]?.percentage || 0;
    if (topAssetTypePercentage > 70 && vendorStats.totalBids > 10) {
      segments.push({
        segmentType: 'specialist',
        confidenceScore: 95,
        segmentScore: Math.min(100, topAssetTypePercentage)
      });
    }
    
    // Generalist: bids across 3+ asset types
    if (vendorStats.assetTypeDistribution.length >= 3 && 
        vendorStats.assetTypeDistribution.every(d => d.percentage > 15)) {
      segments.push({
        segmentType: 'generalist',
        confidenceScore: 80,
        segmentScore: vendorStats.assetTypeDistribution.length * 20
      });
    }
    
    // Active Bidder: >20 bids in last 90 days
    if (vendorStats.bidsLast90Days > 20) {
      segments.push({
        segmentType: 'active_bidder',
        confidenceScore: 100,
        segmentScore: Math.min(100, (vendorStats.bidsLast90Days / 20) * 50)
      });
    }
    
    // Selective Bidder: <5 bids in last 90 days, high win rate
    if (vendorStats.bidsLast90Days < 5 && vendorStats.winRate > 60) {
      segments.push({
        segmentType: 'selective_bidder',
        confidenceScore: 75,
        segmentScore: Math.min(100, vendorStats.winRate)
      });
    }
    
    // New Vendor: <30 days old or <3 total bids
    if (vendorStats.accountAgeDays < 30 || vendorStats.totalBids < 3) {
      segments.push({
        segmentType: 'new_vendor',
        confidenceScore: 100,
        segmentScore: 100 - (vendorStats.totalBids * 20)
      });
    }
    
    return segments;
  }
}
```

### 2.6 Session Analytics Table

Tracks vendor browsing sessions and engagement.

**Schema Definition:**

```typescript
// src/lib/db/schema/intelligence/session-analytics.ts
export const sessionAnalytics = pgTable('session_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: varchar('session_id', { length: 100 }).notNull().unique(),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  
  // Session timing
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time'),
  timeOnSite: integer('time_on_site'), // seconds
  
  // Activity metrics
  pageViews: integer('page_views').notNull().default(0),
  auctionsViewed: integer('auctions_viewed').notNull().default(0),
  auctionsBid: integer('auctions_bid').notNull().default(0),
  searchQueries: integer('search_queries').notNull().default(0),
  
  // Engagement metrics
  bounceRate: boolean('bounce_rate').notNull().default(false),
  conversionType: varchar('conversion_type', { length: 20 }), // 'bid_placed', 'auction_won', 'no_conversion'
  
  // Technical details
  deviceType: varchar('device_type', { length: 50 }),
  ipAddress: varchar('ip_address', { length: 100 }), // encrypted
  referrerSource: varchar('referrer_source', { length: 200 }),
  exitPage: varchar('exit_page', { length: 200 }),
  
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => ({
  idxVendorId: index('idx_session_vendor_id').on(table.vendorId),
  idxStartTime: index('idx_session_start_time').on(table.startTime),
  idxConversionType: index('idx_session_conversion_type').on(table.conversionType)
}));
```


### 2.7 Conversion Funnel Analytics Table

Tracks conversion stages and drop-off rates.

**Schema Definition:**

```typescript
// src/lib/db/schema/intelligence/conversion-funnel-analytics.ts
export const conversionFunnelAnalytics = pgTable('conversion_funnel_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetType: varchar('asset_type', { length: 50 }),
  vendorSegment: varchar('vendor_segment', { length: 50 }),
  funnelStage: varchar('funnel_stage', { length: 50 }).notNull(), // 'view', 'watchlist', 'bid', 'win'
  
  // Funnel metrics
  totalUsers: integer('total_users').notNull(),
  conversionRate: decimal('conversion_rate', { precision: 5, scale: 2 }).notNull(), // % to next stage
  avgTimeToNextStage: integer('avg_time_to_next_stage'), // seconds
  dropOffRate: decimal('drop_off_rate', { precision: 5, scale: 2 }).notNull(),
  
  lastUpdated: timestamp('last_updated').notNull().defaultNow()
}, (table) => ({
  idxAssetTypeStage: index('idx_funnel_asset_type_stage').on(table.assetType, table.funnelStage),
  idxVendorSegmentStage: index('idx_funnel_vendor_segment_stage').on(table.vendorSegment, table.funnelStage),
  idxDropOffRate: index('idx_funnel_drop_off_rate').on(table.dropOffRate)
}));
```

### 2.8 Schema Evolution Log Table

Tracks detection of new asset types and attributes.

**Schema Definition:**

```typescript
// src/lib/db/schema/intelligence/schema-evolution-log.ts
export const schemaEvolutionLog = pgTable('schema_evolution_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: varchar('entity_type', { length: 50 }).notNull(), // 'assetType', 'attribute', 'damageType'
  entityName: varchar('entity_name', { length: 100 }).notNull(),
  detectedValue: varchar('detected_value', { length: 200 }).notNull(),
  
  // Detection tracking
  firstSeenAt: timestamp('first_seen_at').notNull().defaultNow(),
  occurrenceCount: integer('occurrence_count').notNull().default(1),
  adoptionRate: decimal('adoption_rate', { precision: 5, scale: 2 }), // % of total cases
  
  // Validation status
  status: varchar('status', { length: 20 }).notNull().default('detected'), // 'detected', 'validated', 'integrated'
  validatedBy: uuid('validated_by').references(() => users.id),
  validatedAt: timestamp('validated_at'),
  integratedAt: timestamp('integrated_at'),
  
  // Sample data
  metadata: jsonb('metadata').$type<{
    sampleCaseIds: string[];
    attributeDataType: string;
    suggestedIndexes: string[];
    sampleValues: any[];
  }>()
}, (table) => ({
  idxEntityType: index('idx_schema_evolution_entity_type').on(table.entityType),
  idxStatus: index('idx_schema_evolution_status').on(table.status),
  idxOccurrenceCount: index('idx_schema_evolution_occurrence').on(table.occurrenceCount)
}));
```

**Auto-Detection Service:**

```typescript
// src/services/intelligence/schema-evolution.service.ts
export class SchemaEvolutionService {
  async detectNewAssetTypes(): Promise<void> {
    const knownAssetTypes = ['vehicle', 'property', 'electronics', 'machinery'];
    
    const newAssetTypes = await db
      .select({ assetType: salvageCases.assetType, count: sql<number>`count(*)` })
      .from(salvageCases)
      .where(sql`${salvageCases.assetType} NOT IN (${knownAssetTypes.join(',')})`)
      .groupBy(salvageCases.assetType)
      .having(sql`count(*) >= 3`);
    
    for (const { assetType, count } of newAssetTypes) {
      await this.logSchemaEvolution({
        entityType: 'assetType',
        entityName: 'assetType',
        detectedValue: assetType,
        occurrenceCount: count,
        status: 'detected'
      });
      
      // Emit Socket.IO event to admins
      getSocketServer().to('role:admin').emit('schema:new_asset_type', {
        assetType,
        occurrenceCount: count,
        message: `New asset type detected: ${assetType} (${count} cases)`
      });
    }
  }
  
  async detectNewAttributes(): Promise<void> {
    const knownAttributes = ['color', 'trim', 'bodyStyle', 'storage', 'make', 'model', 'year'];
    
    const newAttributes = await db.execute(sql`
      SELECT 
        jsonb_object_keys(ai_assessment->'itemDetails') AS attribute_name,
        COUNT(*) AS occurrence_count,
        ARRAY_AGG(DISTINCT id LIMIT 5) AS sample_case_ids
      FROM salvage_cases
      WHERE jsonb_object_keys(ai_assessment->'itemDetails') NOT IN (${knownAttributes.join(',')})
      GROUP BY jsonb_object_keys(ai_assessment->'itemDetails')
      HAVING COUNT(*) >= 5
    `);
    
    for (const attr of newAttributes.rows) {
      await this.logSchemaEvolution({
        entityType: 'attribute',
        entityName: 'itemDetails',
        detectedValue: attr.attribute_name,
        occurrenceCount: attr.occurrence_count,
        status: 'detected',
        metadata: {
          sampleCaseIds: attr.sample_case_ids,
          attributeDataType: 'string',
          suggestedIndexes: [`idx_item_details_${attr.attribute_name}`]
        }
      });
    }
  }
}
```

### 2.9 ML Training Datasets Table

Tracks exported ML training datasets.

**Schema Definition:**

```typescript
// src/lib/db/schema/intelligence/ml-training-datasets.ts
export const mlTrainingDatasets = pgTable('ml_training_datasets', {
  id: uuid('id').primaryKey().defaultRandom(),
  datasetName: varchar('dataset_name', { length: 200 }).notNull(),
  datasetType: varchar('dataset_type', { length: 50 }).notNull(), // 'price_prediction', 'recommendation', 'fraud_detection'
  version: integer('version').notNull().default(1),
  
  // Dataset characteristics
  recordCount: integer('record_count').notNull(),
  featureCount: integer('feature_count').notNull(),
  targetVariable: varchar('target_variable', { length: 100 }).notNull(),
  dateRange: jsonb('date_range').$type<{ start: string; end: string }>(),
  
  // Export details
  exportFormat: varchar('export_format', { length: 20 }).notNull(), // 'csv', 'parquet', 'json'
  fileUrl: varchar('file_url', { length: 500 }),
  fileSize: bigint('file_size', { mode: 'number' }), // bytes
  
  // Metadata
  metadata: jsonb('metadata').$type<{
    featureNames: string[];
    encodingMethods: Record<string, string>;
    normalizationParams: Record<string, { min: number; max: number }>;
    missingValueStrategy: Record<string, string>;
    splitRatio: { train: number; validation: number; test: number };
  }>(),
  
  generatedBy: uuid('generated_by').notNull().references(() => users.id),
  generatedAt: timestamp('generated_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at').notNull() // 7 days from generation
}, (table) => ({
  idxDatasetType: index('idx_ml_datasets_type').on(table.datasetType),
  idxGeneratedAt: index('idx_ml_datasets_generated_at').on(table.generatedAt),
  idxExpiresAt: index('idx_ml_datasets_expires_at').on(table.expiresAt)
}));
```


### 2.10 Feature Vectors Table

Stores pre-computed feature vectors for ML model inference.

**Schema Definition:**

```typescript
// src/lib/db/schema/intelligence/feature-vectors.ts
export const featureVectors = pgTable('feature_vectors', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: varchar('entity_type', { length: 20 }).notNull(), // 'auction', 'vendor'
  entityId: uuid('entity_id').notNull(),
  featureVersion: integer('feature_version').notNull().default(1),
  
  // Feature vector storage
  featureVector: jsonb('feature_vector').$type<Record<string, number>>(), // key-value pairs
  
  // Metadata
  metadata: jsonb('metadata').$type<{
    featureNames: string[];
    featureValues: Record<string, any>;
    computationMethod: string;
    normalizationApplied: boolean;
  }>(),
  
  computedAt: timestamp('computed_at').notNull().defaultNow()
}, (table) => ({
  idxEntityTypeId: index('idx_feature_vectors_entity').on(table.entityType, table.entityId),
  idxFeatureVersion: index('idx_feature_vectors_version').on(table.featureVersion),
  idxComputedAt: index('idx_feature_vectors_computed_at').on(table.computedAt)
}));
```

**Feature Engineering Service:**

```typescript
// src/services/intelligence/feature-engineering.service.ts
export class FeatureEngineeringService {
  async computeAuctionFeatureVector(auctionId: string): Promise<Record<string, number>> {
    const auction = await db.query.auctions.findFirst({
      where: eq(auctions.id, auctionId),
      with: { case: true }
    });
    
    if (!auction) throw new Error('Auction not found');
    
    const features: Record<string, number> = {};
    
    // Asset type encoding (one-hot)
    features['assetType_vehicle'] = auction.case.assetType === 'vehicle' ? 1 : 0;
    features['assetType_electronics'] = auction.case.assetType === 'electronics' ? 1 : 0;
    features['assetType_machinery'] = auction.case.assetType === 'machinery' ? 1 : 0;
    features['assetType_property'] = auction.case.assetType === 'property' ? 1 : 0;
    
    // Damage severity encoding
    features['damageSeverity_minor'] = auction.case.damageSeverity === 'minor' ? 1 : 0;
    features['damageSeverity_moderate'] = auction.case.damageSeverity === 'moderate' ? 1 : 0;
    features['damageSeverity_severe'] = auction.case.damageSeverity === 'severe' ? 1 : 0;
    
    // Numerical features (normalized)
    const normParams = await this.getNormalizationParams();
    features['marketValue_norm'] = this.normalize(auction.case.marketValue, normParams.marketValue);
    features['estimatedSalvageValue_norm'] = this.normalize(auction.case.estimatedSalvageValue, normParams.estimatedSalvageValue);
    features['reservePrice_norm'] = this.normalize(auction.reservePrice, normParams.reservePrice);
    features['damagedPartsCount'] = auction.case.aiAssessment?.damagedParts?.length || 0;
    
    // Temporal features (cyclical encoding)
    const startHour = new Date(auction.startTime).getHours();
    features['startHour_sin'] = Math.sin(2 * Math.PI * startHour / 24);
    features['startHour_cos'] = Math.cos(2 * Math.PI * startHour / 24);
    
    const startDay = new Date(auction.startTime).getDay();
    features['startDay_sin'] = Math.sin(2 * Math.PI * startDay / 7);
    features['startDay_cos'] = Math.cos(2 * Math.PI * startDay / 7);
    
    const startMonth = new Date(auction.startTime).getMonth();
    features['startMonth_sin'] = Math.sin(2 * Math.PI * startMonth / 12);
    features['startMonth_cos'] = Math.cos(2 * Math.PI * startMonth / 12);
    
    // Market condition features
    const marketConditions = await this.getMarketConditions(auction.case.assetType);
    features['competitionLevel'] = marketConditions.competitionLevel === 'high' ? 2 : 
                                   marketConditions.competitionLevel === 'medium' ? 1 : 0;
    features['seasonalityFactor'] = marketConditions.seasonalityFactor;
    
    return features;
  }
  
  private normalize(value: number, params: { min: number; max: number }): number {
    if (params.max === params.min) return 0;
    return (value - params.min) / (params.max - params.min);
  }
  
  private async getNormalizationParams(): Promise<Record<string, { min: number; max: number }>> {
    // Compute from training data or use cached values
    return {
      marketValue: { min: 0, max: 10000000 },
      estimatedSalvageValue: { min: 0, max: 5000000 },
      reservePrice: { min: 0, max: 3000000 }
    };
  }
}
```

### 2.11 Analytics Rollups Table

Stores pre-computed analytics aggregations.

**Schema Definition:**

```typescript
// src/lib/db/schema/intelligence/analytics-rollups.ts
export const analyticsRollups = pgTable('analytics_rollups', {
  id: uuid('id').primaryKey().defaultRandom(),
  rollupType: varchar('rollup_type', { length: 20 }).notNull(), // 'hourly', 'daily', 'weekly', 'monthly'
  rollupPeriod: timestamp('rollup_period').notNull(), // start of period
  assetType: varchar('asset_type', { length: 50 }),
  
  // Aggregated metrics
  metrics: jsonb('metrics').$type<{
    totalAuctions: number;
    totalBids: number;
    avgBidAmount: number;
    avgFinalPrice: number;
    uniqueVendors: number;
    totalRevenue: number;
    newVendors?: number;
    activeVendors?: number;
    avgSessionDuration?: number;
    bounceRate?: number;
    conversionRate?: number;
    topSellingMake?: string;
    topSellingModel?: string;
    topSellingAssets?: Array<{ make: string; model: string; count: number }>;
    marketTrends?: { priceMovement: number }; // percentage
    vendorRetentionRate?: number;
    vendorChurnRate?: number;
    seasonalityFactors?: Record<string, number>;
  }>(),
  
  recordCount: integer('record_count').notNull(), // number of raw records aggregated
  lastUpdated: timestamp('last_updated').notNull().defaultNow()
}, (table) => ({
  idxRollupTypePeriod: index('idx_rollups_type_period').on(table.rollupType, table.rollupPeriod),
  idxAssetType: index('idx_rollups_asset_type').on(table.assetType),
  idxLastUpdated: index('idx_rollups_last_updated').on(table.lastUpdated)
}));
```


### 2.12 Comprehensive Logging Tables

**Prediction Logs:**

```typescript
// src/lib/db/schema/intelligence/prediction-logs.ts
export const predictionLogs = pgTable('prediction_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  auctionId: uuid('auction_id').notNull().references(() => auctions.id, { onDelete: 'cascade' }),
  vendorId: uuid('vendor_id').references(() => vendors.id, { onDelete: 'set null' }),
  
  // Request details
  requestTimestamp: timestamp('request_timestamp').notNull().defaultNow(),
  responseTime: integer('response_time').notNull(), // milliseconds
  
  // Prediction details
  predictedPrice: numeric('predicted_price', { precision: 12, scale: 2 }).notNull(),
  lowerBound: numeric('lower_bound', { precision: 12, scale: 2 }).notNull(),
  upperBound: numeric('upper_bound', { precision: 12, scale: 2 }).notNull(),
  confidenceScore: integer('confidence_score').notNull(),
  algorithmVersion: varchar('algorithm_version', { length: 20 }).notNull(),
  fallbackMethod: varchar('fallback_method', { length: 50 }),
  similarAuctionCount: integer('similar_auction_count').notNull(),
  
  // Contributing factors
  contributingFactors: jsonb('contributing_factors').$type<{
    colorMatch?: boolean;
    trimMatch?: boolean;
    highDemandAsset?: boolean;
    peakHourAuction?: boolean;
    regionalPremium?: number;
    temporalAdjustment?: number;
    marketConditionAdjustment?: number;
  }>(),
  
  // Technical details
  deviceType: varchar('device_type', { length: 50 }),
  sessionId: varchar('session_id', { length: 100 })
}, (table) => ({
  idxAuctionId: index('idx_prediction_logs_auction_id').on(table.auctionId),
  idxVendorId: index('idx_prediction_logs_vendor_id').on(table.vendorId),
  idxRequestTimestamp: index('idx_prediction_logs_timestamp').on(table.requestTimestamp)
}));
```

**Recommendation Logs:**

```typescript
// src/lib/db/schema/intelligence/recommendation-logs.ts
export const recommendationLogs = pgTable('recommendation_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  
  // Request details
  requestTimestamp: timestamp('request_timestamp').notNull().defaultNow(),
  responseTime: integer('response_time').notNull(), // milliseconds
  
  // Recommendation details
  recommendationCount: integer('recommendation_count').notNull(),
  topMatchScore: integer('top_match_score').notNull(),
  avgMatchScore: decimal('avg_match_score', { precision: 5, scale: 2 }).notNull(),
  algorithmVersion: varchar('algorithm_version', { length: 20 }).notNull(),
  vendorSegment: varchar('vendor_segment', { length: 50 }),
  
  // Technical details
  sessionId: varchar('session_id', { length: 100 }),
  deviceType: varchar('device_type', { length: 50 })
}, (table) => ({
  idxVendorId: index('idx_recommendation_logs_vendor_id').on(table.vendorId),
  idxRequestTimestamp: index('idx_recommendation_logs_timestamp').on(table.requestTimestamp)
}));
```

**Fraud Detection Logs:**

```typescript
// src/lib/db/schema/intelligence/fraud-detection-logs.ts
export const fraudDetectionLogs = pgTable('fraud_detection_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: varchar('entity_type', { length: 20 }).notNull(), // 'vendor', 'case', 'auction', 'user'
  entityId: uuid('entity_id').notNull(),
  
  // Analysis details
  analysisTimestamp: timestamp('analysis_timestamp').notNull().defaultNow(),
  riskScore: integer('risk_score').notNull(), // 0-100
  flagReasons: jsonb('flag_reasons').$type<string[]>(),
  detectionMethod: varchar('detection_method', { length: 100 }).notNull(),
  
  // Review status
  falsePositive: boolean('false_positive'),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at')
}, (table) => ({
  idxEntityTypeId: index('idx_fraud_logs_entity').on(table.entityType, table.entityId),
  idxAnalysisTimestamp: index('idx_fraud_logs_timestamp').on(table.analysisTimestamp),
  idxRiskScore: index('idx_fraud_logs_risk_score').on(table.riskScore)
}));
```

**Algorithm Config History:**

```typescript
// src/lib/db/schema/intelligence/algorithm-config-history.ts
export const algorithmConfigHistory = pgTable('algorithm_config_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  configKey: varchar('config_key', { length: 100 }).notNull(),
  oldValue: jsonb('old_value'),
  newValue: jsonb('new_value').notNull(),
  
  // Change tracking
  changedBy: uuid('changed_by').notNull().references(() => users.id),
  changedAt: timestamp('changed_at').notNull().defaultNow(),
  reason: text('reason'),
  
  // Impact metrics
  impactMetrics: jsonb('impact_metrics').$type<{
    beforeAccuracy?: number;
    afterAccuracy?: number;
    beforeCTR?: number;
    afterCTR?: number;
    affectedVendors?: number;
  }>()
}, (table) => ({
  idxConfigKey: index('idx_algo_config_history_key').on(table.configKey),
  idxChangedAt: index('idx_algo_config_history_changed_at').on(table.changedAt)
}));
```

---

## 3. Enhanced Prediction Algorithm with Granular Data

### 3.1 Enhanced Similarity Matching

The prediction algorithm is enhanced to include granular attributes:

**Updated Similarity Scoring:**

```sql
-- Enhanced similarity matching with color, trim, and mileage
WITH similar_auctions AS (
  SELECT 
    a.id AS auction_id,
    a.current_bid AS final_price,
    sc.asset_details,
    sc.damage_severity,
    a.created_at,
    a.end_time,
    COUNT(b.id) AS bid_count,
    -- Enhanced similarity score calculation
    (
      -- Base scoring (make/model/year/damage) = 160 points max
      CASE 
        WHEN sc.asset_details->>'make' = $target_make 
         AND sc.asset_details->>'model' = $target_model THEN 100
        WHEN sc.asset_details->>'make' = $target_make THEN 50
        ELSE 0
      END +
      CASE 
        WHEN (sc.asset_details->>'year')::int = $target_year THEN 20
        WHEN ABS((sc.asset_details->>'year')::int - $target_year) = 1 THEN 15
        WHEN ABS((sc.asset_details->>'year')::int - $target_year) = 2 THEN 10
        ELSE 0
      END +
      CASE 
        WHEN sc.damage_severity = $target_damage THEN 30
        WHEN (
          (sc.damage_severity = 'minor' AND $target_damage = 'moderate') OR
          (sc.damage_severity = 'moderate' AND $target_damage IN ('minor', 'severe')) OR
          (sc.damage_severity = 'severe' AND $target_damage = 'moderate')
        ) THEN 15
        ELSE 0
      END +
      CASE 
        WHEN ABS(sc.market_value - $target_market_value) / $target_market_value < 0.2 THEN 10
        ELSE 0
      END +
      
      -- NEW: Color matching = 10 points
      CASE 
        WHEN sc.ai_assessment->'itemDetails'->>'color' = $target_color THEN 10
        ELSE 0
      END +
      
      -- NEW: Trim matching = 15 points
      CASE 
        WHEN sc.ai_assessment->'itemDetails'->>'trim' = $target_trim THEN 15
        WHEN sc.ai_assessment->'itemDetails'->>'trim' ILIKE '%' || $target_trim || '%' THEN 5
        ELSE 0
      END +
      
      -- NEW: Body style matching = 15 points
      CASE 
        WHEN sc.ai_assessment->'itemDetails'->>'bodyStyle' = $target_body_style THEN 15
        ELSE 0
      END +
      
      -- NEW: Mileage range matching = 20 points
      CASE 
        WHEN ABS(sc.vehicle_mileage - $target_mileage) < 10000 THEN 20
        WHEN ABS(sc.vehicle_mileage - $target_mileage) < 25000 THEN 10
        WHEN ABS(sc.vehicle_mileage - $target_mileage) < 50000 THEN 5
        ELSE 0
      END
    ) AS similarity_score,
    EXP(-EXTRACT(EPOCH FROM (NOW() - a.end_time)) / (6 * 30 * 24 * 60 * 60)) AS time_weight
  FROM auctions a
  JOIN salvage_cases sc ON a.case_id = sc.id
  LEFT JOIN bids b ON b.auction_id = a.id
  WHERE 
    a.status = 'closed'
    AND a.current_bid IS NOT NULL
    AND sc.asset_type = $target_asset_type
    AND a.end_time > NOW() - INTERVAL '12 months'
  GROUP BY a.id, sc.id
  HAVING similarity_score >= 60
  ORDER BY similarity_score DESC, time_weight DESC
  LIMIT 50
)
SELECT * FROM similar_auctions;
```

**New Maximum Similarity Score: 205 points** (up from 160)
- Base scoring: 160 points
- Color: +10 points
- Trim: +15 points
- Body style: +15 points
- Mileage: +20 points (vehicles only)


### 3.2 Granular Data Integration

**Attribute Performance Adjustments:**

```typescript
// src/services/intelligence/enhanced-prediction.service.ts
export class EnhancedPredictionService {
  async generateEnhancedPrediction(auctionId: string): Promise<EnhancedPrediction> {
    // Step 1: Get base prediction from similarity matching
    const basePrediction = await this.getBasePrediction(auctionId);
    
    // Step 2: Apply attribute performance adjustments
    const auction = await this.getAuctionDetails(auctionId);
    const attributeAdjustments = await this.getAttributeAdjustments(auction);
    
    let adjustedPrice = basePrediction.predictedPrice;
    const adjustmentFactors: Record<string, number> = {};
    
    // Color adjustment
    if (auction.color && attributeAdjustments.color) {
      const colorImpact = attributeAdjustments.color.priceImpact / 100;
      adjustedPrice *= (1 + colorImpact);
      adjustmentFactors.colorAdjustment = colorImpact * 100;
    }
    
    // Trim adjustment
    if (auction.trim && attributeAdjustments.trim) {
      const trimImpact = attributeAdjustments.trim.priceImpact / 100;
      adjustedPrice *= (1 + trimImpact);
      adjustmentFactors.trimAdjustment = trimImpact * 100;
    }
    
    // Step 3: Apply temporal pattern adjustments
    const temporalAdjustment = await this.getTemporalAdjustment(auction);
    if (temporalAdjustment.peakActivityScore > 80) {
      adjustedPrice *= 1.08; // +8% for peak hours
      adjustmentFactors.temporalAdjustment = 8;
    } else if (temporalAdjustment.peakActivityScore < 30) {
      adjustedPrice *= 0.92; // -8% for off-peak hours
      adjustmentFactors.temporalAdjustment = -8;
    }
    
    // Step 4: Apply geographic adjustments
    const geographicAdjustment = await this.getGeographicAdjustment(auction);
    if (geographicAdjustment.priceVariance) {
      const geoImpact = geographicAdjustment.priceVariance / 100;
      adjustedPrice *= (1 + geoImpact);
      adjustmentFactors.geographicAdjustment = geographicAdjustment.priceVariance;
    }
    
    // Step 5: Apply asset performance adjustments
    const assetPerformance = await this.getAssetPerformance(auction);
    if (assetPerformance.sellThroughRate > 80) {
      adjustedPrice *= 1.07; // +7% for high-demand assets
      adjustmentFactors.demandAdjustment = 7;
    }
    
    // Step 6: Calculate enhanced confidence score
    const enhancedConfidence = this.calculateEnhancedConfidence(
      basePrediction.confidenceScore,
      auction,
      attributeAdjustments
    );
    
    // Step 7: Recalculate bounds with enhanced confidence
    const lowerBound = adjustedPrice * (1 - (1 - enhancedConfidence / 100) * 0.3);
    const upperBound = adjustedPrice * (1 + (1 - enhancedConfidence / 100) * 0.3);
    
    return {
      predictedPrice: Math.round(adjustedPrice),
      lowerBound: Math.round(lowerBound),
      upperBound: Math.round(upperBound),
      confidenceScore: enhancedConfidence,
      algorithmVersion: 'v2.0-enhanced',
      contributingFactors: {
        basePrediction: basePrediction.predictedPrice,
        adjustmentFactors,
        dataCompleteness: this.calculateDataCompleteness(auction),
        similarAuctionCount: basePrediction.similarAuctionCount
      }
    };
  }
  
  private calculateEnhancedConfidence(
    baseConfidence: number,
    auction: AuctionDetails,
    attributeAdjustments: AttributeAdjustments
  ): number {
    let confidence = baseConfidence;
    
    // +10 points for complete itemDetails
    if (auction.color && auction.trim && auction.bodyStyle) {
      confidence += 10;
    }
    
    // +5 points for high sell-through rate
    if (attributeAdjustments.assetPerformance?.sellThroughRate > 75) {
      confidence += 5;
    }
    
    // +8 points for color/trim matches in similar auctions
    if (attributeAdjustments.color && attributeAdjustments.trim) {
      confidence += 8;
    }
    
    return Math.min(100, confidence);
  }
  
  private calculateDataCompleteness(auction: AuctionDetails): number {
    const requiredFields = ['make', 'model', 'year', 'damageSeverity'];
    const optionalFields = ['color', 'trim', 'bodyStyle', 'mileage'];
    
    const requiredComplete = requiredFields.filter(f => auction[f]).length;
    const optionalComplete = optionalFields.filter(f => auction[f]).length;
    
    return ((requiredComplete / requiredFields.length) * 70 + 
            (optionalComplete / optionalFields.length) * 30);
  }
}
```

### 3.3 Accuracy Tracking by Granular Attributes

```sql
-- Track prediction accuracy by granular attributes
CREATE MATERIALIZED VIEW prediction_accuracy_by_attributes AS
SELECT 
  sc.asset_type,
  sc.asset_details->>'make' AS make,
  sc.asset_details->>'model' AS model,
  (sc.asset_details->>'year')::int AS year,
  sc.ai_assessment->'itemDetails'->>'color' AS color,
  sc.ai_assessment->'itemDetails'->>'trim' AS trim,
  COUNT(*) AS prediction_count,
  AVG(ABS(p.predicted_price - p.actual_price) / p.actual_price * 100) AS mean_percentage_error,
  AVG(p.confidence_score) AS avg_confidence_score,
  STDDEV(ABS(p.predicted_price - p.actual_price) / p.actual_price * 100) AS error_stddev
FROM predictions p
JOIN auctions a ON p.auction_id = a.id
JOIN salvage_cases sc ON a.case_id = sc.id
WHERE p.actual_price IS NOT NULL
GROUP BY sc.asset_type, make, model, year, color, trim
HAVING COUNT(*) >= 5;

-- Refresh daily
REFRESH MATERIALIZED VIEW prediction_accuracy_by_attributes;
```

---

## 4. Enhanced Recommendation Algorithm with Behavioral Data

### 4.1 Segment-Specific Recommendation Strategies

```typescript
// src/services/intelligence/enhanced-recommendation.service.ts
export class EnhancedRecommendationService {
  async generateEnhancedRecommendations(vendorId: string): Promise<Recommendation[]> {
    // Step 1: Get vendor segments
    const vendorSegments = await this.getVendorSegments(vendorId);
    
    // Step 2: Get base recommendations (collaborative + content-based)
    const baseRecommendations = await this.getBaseRecommendations(vendorId);
    
    // Step 3: Apply segment-specific strategies
    const enhancedRecommendations = await Promise.all(
      baseRecommendations.map(async (rec) => {
        let matchScore = rec.matchScore;
        const reasonCodes = [...rec.reasonCodes];
        
        // Bargain Hunter strategy
        if (vendorSegments.includes('bargain_hunter')) {
          const auction = await this.getAuctionDetails(rec.auctionId);
          if (auction.watchingCount < 5 && auction.reservePrice < rec.vendorAvgBid) {
            matchScore += 15;
            reasonCodes.push('Low competition - perfect for bargain hunters');
          }
        }
        
        // Premium Buyer strategy
        if (vendorSegments.includes('premium_buyer')) {
          const auction = await this.getAuctionDetails(rec.auctionId);
          if (auction.marketValue > 1000000) {
            matchScore += 12;
            reasonCodes.push('High-value asset matching your preferences');
          }
        }
        
        // Specialist strategy
        if (vendorSegments.includes('specialist')) {
          const auction = await this.getAuctionDetails(rec.auctionId);
          const vendorStats = await this.getVendorStats(vendorId);
          if (auction.assetType === vendorStats.primaryAssetType) {
            matchScore += 20;
            reasonCodes.push(`Deep match in your specialty: ${auction.assetType}`);
          }
        }
        
        // Step 4: Apply session-based collaborative filtering
        const sessionBoost = await this.getSessionBasedBoost(vendorId, rec.auctionId);
        if (sessionBoost > 0) {
          matchScore += sessionBoost;
          reasonCodes.push('Similar to auctions you viewed recently');
        }
        
        // Step 5: Apply temporal optimization
        const temporalBoost = await this.getTemporalBoost(vendorId, rec.auctionId);
        if (temporalBoost > 0) {
          matchScore += temporalBoost;
          reasonCodes.push(`Ends during your active hours (${temporalBoost > 0 ? 'peak time' : 'off-peak'})`);
        }
        
        // Step 6: Apply geographic prioritization
        const geoBoost = await this.getGeographicBoost(vendorId, rec.auctionId);
        if (geoBoost > 0) {
          matchScore += geoBoost;
          reasonCodes.push('High win rate in this region');
        }
        
        // Step 7: Apply attribute trending
        const trendingBoost = await this.getTrendingAttributeBoost(vendorId, rec.auctionId);
        if (trendingBoost > 0) {
          matchScore += trendingBoost;
          reasonCodes.push('Trending attributes in your preferred category');
        }
        
        return {
          ...rec,
          matchScore: Math.min(100, matchScore),
          reasonCodes: reasonCodes.slice(0, 3), // Top 3 reasons
          algorithmVersion: 'v2.0-enhanced'
        };
      })
    );
    
    // Step 8: Apply diversity optimization
    const diversifiedRecommendations = this.applyDiversityOptimization(
      enhancedRecommendations,
      vendorSegments
    );
    
    // Step 9: Sort by enhanced match score
    return diversifiedRecommendations
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 20);
  }
  
  private applyDiversityOptimization(
    recommendations: Recommendation[],
    vendorSegments: string[]
  ): Recommendation[] {
    if (vendorSegments.includes('generalist')) {
      // Ensure at least 3 different asset types in top 20
      const assetTypeCounts = new Map<string, number>();
      const diversified: Recommendation[] = [];
      
      for (const rec of recommendations) {
        const count = assetTypeCounts.get(rec.assetType) || 0;
        if (count < 7 || diversified.length < 20) {
          diversified.push(rec);
          assetTypeCounts.set(rec.assetType, count + 1);
        }
      }
      
      return diversified;
    }
    
    if (vendorSegments.includes('specialist')) {
      // Ensure at least 5 different makes in top 20
      const makeCounts = new Map<string, number>();
      const diversified: Recommendation[] = [];
      
      for (const rec of recommendations) {
        const count = makeCounts.get(rec.make) || 0;
        if (count < 4 || diversified.length < 20) {
          diversified.push(rec);
          makeCounts.set(rec.make, count + 1);
        }
      }
      
      return diversified;
    }
    
    return recommendations;
  }
}
```


### 4.2 Session-Based Collaborative Filtering

```typescript
// Session-based recommendation boost
async getSessionBasedBoost(vendorId: string, auctionId: string): Promise<number> {
  // Get auctions viewed in current session (last 30 minutes)
  const sessionAuctions = await db
    .select({ auctionId: interactions.auctionId })
    .from(interactions)
    .where(
      and(
        eq(interactions.vendorId, vendorId),
        eq(interactions.eventType, 'view'),
        gte(interactions.timestamp, sql`NOW() - INTERVAL '30 minutes'`)
      )
    )
    .limit(10);
  
  if (sessionAuctions.length === 0) return 0;
  
  // Calculate similarity between target auction and session auctions
  const targetAuction = await this.getAuctionDetails(auctionId);
  let maxSimilarity = 0;
  
  for (const sessionAuction of sessionAuctions) {
    const sessionDetails = await this.getAuctionDetails(sessionAuction.auctionId);
    const similarity = this.calculateAuctionSimilarity(targetAuction, sessionDetails);
    maxSimilarity = Math.max(maxSimilarity, similarity);
  }
  
  // Convert similarity (0-1) to boost (0-15 points)
  return Math.round(maxSimilarity * 15);
}

private calculateAuctionSimilarity(auction1: AuctionDetails, auction2: AuctionDetails): number {
  let similarity = 0;
  let maxScore = 0;
  
  // Asset type match: 40%
  maxScore += 40;
  if (auction1.assetType === auction2.assetType) similarity += 40;
  
  // Make match: 30%
  maxScore += 30;
  if (auction1.make === auction2.make) similarity += 30;
  
  // Model match: 20%
  maxScore += 20;
  if (auction1.model === auction2.model) similarity += 20;
  
  // Price range match: 10%
  maxScore += 10;
  if (Math.abs(auction1.marketValue - auction2.marketValue) / auction1.marketValue < 0.3) {
    similarity += 10;
  }
  
  return similarity / maxScore;
}
```

### 4.3 Feature Vector-Based Similarity

```typescript
// Use pre-computed feature vectors for efficient similarity computation
async getFeatureVectorSimilarity(vendorId: string, auctionId: string): Promise<number> {
  // Load vendor feature vector
  const vendorVector = await db.query.featureVectors.findFirst({
    where: and(
      eq(featureVectors.entityType, 'vendor'),
      eq(featureVectors.entityId, vendorId)
    )
  });
  
  // Load auction feature vector
  const auctionVector = await db.query.featureVectors.findFirst({
    where: and(
      eq(featureVectors.entityType, 'auction'),
      eq(featureVectors.entityId, auctionId)
    )
  });
  
  if (!vendorVector || !auctionVector) return 0;
  
  // Calculate cosine similarity
  const similarity = this.cosineSimilarity(
    vendorVector.featureVector,
    auctionVector.featureVector
  );
  
  // Convert to match score (0-100)
  return Math.round(similarity * 100);
}

private cosineSimilarity(vec1: Record<string, number>, vec2: Record<string, number>): number {
  const keys = new Set([...Object.keys(vec1), ...Object.keys(vec2)]);
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (const key of keys) {
    const v1 = vec1[key] || 0;
    const v2 = vec2[key] || 0;
    
    dotProduct += v1 * v2;
    norm1 += v1 * v1;
    norm2 += v2 * v2;
  }
  
  if (norm1 === 0 || norm2 === 0) return 0;
  
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}
```

---

## 5. ML Training Data Export Pipeline

### 5.1 Dataset Export Service

```typescript
// src/services/intelligence/ml-dataset-export.service.ts
export class MLDatasetExportService {
  async exportPricePredictionDataset(params: {
    dateRange: { start: Date; end: Date };
    format: 'csv' | 'json' | 'parquet';
    splitRatio: { train: number; validation: number; test: number };
  }): Promise<MLDataset> {
    // Step 1: Extract raw data
    const rawData = await this.extractPricePredictionData(params.dateRange);
    
    // Step 2: Apply feature engineering
    const engineeredData = await this.applyFeatureEngineering(rawData);
    
    // Step 3: Split into train/validation/test
    const splits = this.stratifiedSplit(engineeredData, params.splitRatio);
    
    // Step 4: Anonymize PII
    const anonymizedData = this.anonymizePII(splits);
    
    // Step 5: Export to specified format
    const fileUrl = await this.exportToFormat(anonymizedData, params.format);
    
    // Step 6: Generate data dictionary
    const dataDictionary = this.generateDataDictionary(engineeredData);
    
    // Step 7: Store dataset metadata
    const dataset = await db.insert(mlTrainingDatasets).values({
      datasetName: `price_prediction_${params.dateRange.start.toISOString().split('T')[0]}`,
      datasetType: 'price_prediction',
      recordCount: engineeredData.length,
      featureCount: Object.keys(engineeredData[0]).length - 1, // exclude target
      targetVariable: 'finalPrice',
      dateRange: {
        start: params.dateRange.start.toISOString(),
        end: params.dateRange.end.toISOString()
      },
      exportFormat: params.format,
      fileUrl,
      fileSize: await this.getFileSize(fileUrl),
      metadata: {
        featureNames: Object.keys(engineeredData[0]).filter(k => k !== 'finalPrice'),
        encodingMethods: dataDictionary.encodingMethods,
        normalizationParams: dataDictionary.normalizationParams,
        missingValueStrategy: dataDictionary.missingValueStrategy,
        splitRatio: params.splitRatio
      },
      generatedBy: 'system', // or actual user ID
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    }).returning();
    
    return dataset[0];
  }
  
  private async extractPricePredictionData(dateRange: { start: Date; end: Date }) {
    return await db
      .select({
        auctionId: auctions.id,
        assetType: salvageCases.assetType,
        make: sql<string>`${salvageCases.assetDetails}->>'make'`,
        model: sql<string>`${salvageCases.assetDetails}->>'model'`,
        year: sql<number>`(${salvageCases.assetDetails}->>'year')::int`,
        color: sql<string>`${salvageCases.aiAssessment}->'itemDetails'->>'color'`,
        trim: sql<string>`${salvageCases.aiAssessment}->'itemDetails'->>'trim'`,
        bodyStyle: sql<string>`${salvageCases.aiAssessment}->'itemDetails'->>'bodyStyle'`,
        mileage: salvageCases.vehicleMileage,
        damageSeverity: salvageCases.damageSeverity,
        damagedPartsCount: sql<number>`jsonb_array_length(${salvageCases.aiAssessment}->'damagedParts')`,
        marketValue: salvageCases.marketValue,
        estimatedSalvageValue: salvageCases.estimatedSalvageValue,
        reservePrice: auctions.reservePrice,
        bidCount: sql<number>`(SELECT COUNT(*) FROM bids WHERE auction_id = ${auctions.id})`,
        watchingCount: auctions.watchingCount,
        startHour: sql<number>`EXTRACT(HOUR FROM ${auctions.startTime})`,
        startDayOfWeek: sql<number>`EXTRACT(DOW FROM ${auctions.startTime})`,
        startMonth: sql<number>`EXTRACT(MONTH FROM ${auctions.startTime})`,
        region: sql<string>`'Lagos'`, // TODO: extract from gpsLocation
        finalPrice: auctions.currentBid // TARGET VARIABLE
      })
      .from(auctions)
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .where(
        and(
          eq(auctions.status, 'closed'),
          isNotNull(auctions.currentBid),
          gte(auctions.endTime, dateRange.start),
          lte(auctions.endTime, dateRange.end)
        )
      );
  }
  
  private async applyFeatureEngineering(rawData: any[]): Promise<any[]> {
    return rawData.map(row => {
      const engineered: any = { ...row };
      
      // One-hot encoding for asset type
      engineered.assetType_vehicle = row.assetType === 'vehicle' ? 1 : 0;
      engineered.assetType_electronics = row.assetType === 'electronics' ? 1 : 0;
      engineered.assetType_machinery = row.assetType === 'machinery' ? 1 : 0;
      engineered.assetType_property = row.assetType === 'property' ? 1 : 0;
      delete engineered.assetType;
      
      // One-hot encoding for damage severity
      engineered.damageSeverity_minor = row.damageSeverity === 'minor' ? 1 : 0;
      engineered.damageSeverity_moderate = row.damageSeverity === 'moderate' ? 1 : 0;
      engineered.damageSeverity_severe = row.damageSeverity === 'severe' ? 1 : 0;
      delete engineered.damageSeverity;
      
      // Cyclical encoding for temporal features
      engineered.startHour_sin = Math.sin(2 * Math.PI * row.startHour / 24);
      engineered.startHour_cos = Math.cos(2 * Math.PI * row.startHour / 24);
      delete engineered.startHour;
      
      engineered.startDayOfWeek_sin = Math.sin(2 * Math.PI * row.startDayOfWeek / 7);
      engineered.startDayOfWeek_cos = Math.cos(2 * Math.PI * row.startDayOfWeek / 7);
      delete engineered.startDayOfWeek;
      
      engineered.startMonth_sin = Math.sin(2 * Math.PI * row.startMonth / 12);
      engineered.startMonth_cos = Math.cos(2 * Math.PI * row.startMonth / 12);
      delete engineered.startMonth;
      
      // Normalization for numerical features (min-max)
      engineered.marketValue_norm = this.normalize(row.marketValue, 0, 10000000);
      engineered.estimatedSalvageValue_norm = this.normalize(row.estimatedSalvageValue, 0, 5000000);
      engineered.reservePrice_norm = this.normalize(row.reservePrice, 0, 3000000);
      
      // Interaction features
      engineered.marketValue_x_damageSeverity = row.marketValue * (
        row.damageSeverity === 'minor' ? 0.3 :
        row.damageSeverity === 'moderate' ? 0.5 :
        row.damageSeverity === 'severe' ? 0.7 : 0.5
      );
      
      engineered.bidCount_x_watchingCount = row.bidCount * row.watchingCount;
      
      return engineered;
    });
  }
  
  private normalize(value: number, min: number, max: number): number {
    if (max === min) return 0;
    return (value - min) / (max - min);
  }
  
  private stratifiedSplit(data: any[], splitRatio: { train: number; validation: number; test: number }) {
    // Shuffle data
    const shuffled = [...data].sort(() => Math.random() - 0.5);
    
    const trainSize = Math.floor(shuffled.length * splitRatio.train);
    const validationSize = Math.floor(shuffled.length * splitRatio.validation);
    
    return {
      train: shuffled.slice(0, trainSize).map(r => ({ ...r, split: 'train' })),
      validation: shuffled.slice(trainSize, trainSize + validationSize).map(r => ({ ...r, split: 'validation' })),
      test: shuffled.slice(trainSize + validationSize).map(r => ({ ...r, split: 'test' }))
    };
  }
  
  private anonymizePII(splits: any) {
    // Replace vendor IDs with hashed versions, remove PII fields
    const anonymize = (record: any) => {
      const anonymized = { ...record };
      if (anonymized.vendorId) {
        anonymized.anonymousVendorId = this.hashVendorId(anonymized.vendorId);
        delete anonymized.vendorId;
      }
      delete anonymized.ipAddress;
      delete anonymized.email;
      delete anonymized.phoneNumber;
      return anonymized;
    };
    
    return {
      train: splits.train.map(anonymize),
      validation: splits.validation.map(anonymize),
      test: splits.test.map(anonymize)
    };
  }
  
  private hashVendorId(vendorId: string): string {
    return crypto.createHash('sha256').update(vendorId).digest('hex').substring(0, 16);
  }
}
```


---

## 6. Vendor Market Intelligence Dashboard

### 6.1 Dashboard Page Structure

```typescript
// src/app/(dashboard)/vendor/market-insights/page.tsx
export default async function VendorMarketInsightsPage() {
  const session = await getServerSession();
  const vendorId = session.user.id;
  
  // Fetch dashboard data
  const [
    trendingAssets,
    temporalPatterns,
    geographicInsights,
    vendorPerformance,
    competitionLevels,
    priceTrends,
    popularAttributes
  ] = await Promise.all([
    getTrendingAssets(),
    getTemporalPatterns(),
    getGeographicInsights(),
    getVendorPerformance(vendorId),
    getCompetitionLevels(),
    getPriceTrends(),
    getPopularAttributes()
  ]);
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Market Intelligence</h1>
      
      {/* Trending Assets Section */}
      <Card>
        <CardHeader>
          <CardTitle>Trending Assets</CardTitle>
          <CardDescription>Top performing assets by sell-through rate</CardDescription>
        </CardHeader>
        <CardContent>
          <TrendingAssetsTable data={trendingAssets} />
        </CardContent>
      </Card>
      
      {/* Best Time to Bid Section */}
      <Card>
        <CardHeader>
          <CardTitle>Best Time to Bid</CardTitle>
          <CardDescription>Peak bidding activity by hour and day</CardDescription>
        </CardHeader>
        <CardContent>
          <BiddingHeatmap data={temporalPatterns} />
        </CardContent>
      </Card>
      
      {/* Regional Insights Section */}
      <Card>
        <CardHeader>
          <CardTitle>Regional Price Variations</CardTitle>
          <CardDescription>Price premiums and discounts by region</CardDescription>
        </CardHeader>
        <CardContent>
          <RegionalInsightsMap data={geographicInsights} />
        </CardContent>
      </Card>
      
      {/* Your Performance Section */}
      <Card>
        <CardHeader>
          <CardTitle>Your Performance vs Market</CardTitle>
        </CardHeader>
        <CardContent>
          <PerformanceComparison 
            vendorStats={vendorPerformance.vendor}
            marketStats={vendorPerformance.market}
          />
        </CardContent>
      </Card>
      
      {/* Competition Levels Section */}
      <Card>
        <CardHeader>
          <CardTitle>Competition Levels</CardTitle>
          <CardDescription>Current market competition by asset type</CardDescription>
        </CardHeader>
        <CardContent>
          <CompetitionLevelsChart data={competitionLevels} />
        </CardContent>
      </Card>
      
      {/* Price Trends Section */}
      <Card>
        <CardHeader>
          <CardTitle>30-Day Price Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <PriceTrendsChart data={priceTrends} />
        </CardContent>
      </Card>
      
      {/* Popular Attributes Section */}
      <Card>
        <CardHeader>
          <CardTitle>Popular Attributes</CardTitle>
          <CardDescription>Top-performing colors, trims, and features</CardDescription>
        </CardHeader>
        <CardContent>
          <PopularAttributesCharts data={popularAttributes} />
        </CardContent>
      </Card>
      
      {/* Download Report Button */}
      <div className="flex justify-end">
        <Button onClick={() => downloadReport()}>
          <Download className="mr-2 h-4 w-4" />
          Download Report (PDF)
        </Button>
      </div>
    </div>
  );
}
```

### 6.2 Dashboard Components

**Trending Assets Table:**

```typescript
// src/components/intelligence/trending-assets-table.tsx
export function TrendingAssetsTable({ data }: { data: TrendingAsset[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Make/Model</TableHead>
          <TableHead>Avg Final Price</TableHead>
          <TableHead>Sell-Through Rate</TableHead>
          <TableHead>Price Trend</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((asset) => (
          <TableRow key={asset.id}>
            <TableCell className="font-medium">
              {asset.make} {asset.model}
            </TableCell>
            <TableCell>₦{asset.avgFinalPrice.toLocaleString()}</TableCell>
            <TableCell>
              <Badge variant={asset.sellThroughRate > 75 ? 'success' : 'default'}>
                {asset.sellThroughRate}%
              </Badge>
            </TableCell>
            <TableCell>
              {asset.priceAppreciation > 0 ? (
                <TrendingUp className="text-green-500" />
              ) : (
                <TrendingDown className="text-red-500" />
              )}
              <span className={asset.priceAppreciation > 0 ? 'text-green-500' : 'text-red-500'}>
                {Math.abs(asset.priceAppreciation)}%
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

**Bidding Heatmap:**

```typescript
// src/components/intelligence/bidding-heatmap.tsx
export function BiddingHeatmap({ data }: { data: TemporalPattern[] }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  const getActivityScore = (hour: number, day: number) => {
    const pattern = data.find(p => 
      p.timeSegment === hour.toString() && 
      p.patternType === 'hourly'
    );
    return pattern?.peakActivityScore || 0;
  };
  
  return (
    <div className="grid grid-cols-8 gap-1">
      <div></div>
      {days.map(day => (
        <div key={day} className="text-center text-sm font-medium">{day}</div>
      ))}
      
      {hours.map(hour => (
        <>
          <div key={`hour-${hour}`} className="text-sm">{hour}:00</div>
          {days.map((_, dayIndex) => {
            const score = getActivityScore(hour, dayIndex);
            return (
              <div
                key={`${hour}-${dayIndex}`}
                className="aspect-s

---

## 6. Vendor Market Intelligence Dashboard

### 6.1 Dashboard Page Structure

```typescript
// src/app/(dashboard)/vendor/market-insights/page.tsx
export default async function VendorMarketInsightsPage() {
  const session = await getServerSession();
  const vendorId = session.user.id;
  
  // Fetch dashboard data
  const [
    trendingAssets,
    temporalPatterns,
    geographicInsights,
    vendorPerformance,
    competitionLevels,
    priceTrends,
    popularAttributes
  ] = await Promise.all([
    getTrendingAssets(),
    getTemporalPatterns(),
    getGeographicInsights(),
    getVendorPerformance(vendorId),
    getCompetitionLevels(),
    getPriceTrends(),
    getPopularAttributes()
  ]);
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Market Intelligence</h1>
      
      {/* Trending Assets Section */}
      <Card>
        <CardHeader>
          <CardTitle>Trending Assets</CardTitle>
          <CardDescription>Top performing assets by sell-through rate</CardDescription>
        </CardHeader>
        <CardContent>
          <TrendingAssetsTable data={trendingAssets} />
        </CardContent>
      </Card>
      
      {/* Best Time to Bid Section */}
      <Card>
        <CardHeader>
          <CardTitle>Best Time to Bid</CardTitle>
          <CardDescription>Peak bidding activity by hour and day</CardDescription>
        </CardHeader>
        <CardContent>
          <BiddingHeatmap data={temporalPatterns} />
        </CardContent>
      </Card>
    </div>
  );
}
```

### 6.2 Dashboard Components

**Trending Assets Table:**

```typescript
// src/components/intelligence/trending-assets-table.tsx
export function TrendingAssetsTable({ data }: { data: TrendingAsset[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Make/Model</TableHead>
          <TableHead>Avg Final Price</TableHead>
          <TableHead>Sell-Through Rate</TableHead>
          <TableHead>Price Trend</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((asset) => (
          <TableRow key={asset.id}>
            <TableCell className="font-medium">
              {asset.make} {asset.model}
            </TableCell>
            <TableCell>₦{asset.avgFinalPrice.toLocaleString()}</TableCell>
            <TableCell>
              <Badge variant={asset.sellThroughRate > 75 ? 'success' : 'default'}>
                {asset.sellThroughRate}%
              </Badge>
            </TableCell>
            <TableCell>
              {asset.priceAppreciation > 0 ? (
                <TrendingUp className="text-green-500" />
              ) : (
                <TrendingDown className="text-red-500" />
              )}
              <span className={asset.priceAppreciation > 0 ? 'text-green-500' : 'text-red-500'}>
                {Math.abs(asset.priceAppreciation)}%
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

**Bidding Heatmap:**

```typescript
// src/components/intelligence/bidding-heatmap.tsx
export function BiddingHeatmap({ data }: { data: TemporalPattern[] }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  const getActivityScore = (hour: number, day: number) => {
    const pattern = data.find(p => 
      p.timeSegment === hour.toString() && 
      p.patternType === 'hourly'
    );
    return pattern?.peakActivityScore || 0;
  };
  
  return (
    <div className="grid grid-cols-8 gap-1">
      <div></div>
      {days.map(day => (
        <div key={day} className="text-center text-sm font-medium">{day}</div>
      ))}
      
      {hours.map(hour => (
        <>
          <div key={`hour-${hour}`} className="text-sm">{hour}:00</div>
          {days.map((_, dayIndex) => {
            const score = getActivityScore(hour, dayIndex);
            return (
              <div
                key={`${hour}-${dayIndex}`}
                className="aspect-square rounded"
                style={{
                  backgroundColor: `rgba(34, 197, 94, ${score / 100})`
                }}
                title={`${hour}:00 on ${days[dayIndex]}: ${score}% activity`}
              />
            );
          })}
        </>
      ))}
    </div>
  );
}
```

**Regional Insights Map:**

```typescript
// src/components/intelligence/regional-insights-map.tsx
export function RegionalInsightsMap({ data }: { data: GeographicPattern[] }) {
  return (
    <div className="space-y-4">
      {data.map((region) => (
        <div key={region.region} className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <h4 className="font-medium">{region.region}</h4>
            <p className="text-sm text-muted-foreground">
              {region.totalAuctions} auctions
            </p>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold">
              {region.priceVariance > 0 ? '+' : ''}{region.priceVariance}%
            </div>
            <p className="text-sm text-muted-foreground">vs national avg</p>
          </div>
          <Badge variant={region.regionalDemandScore > 70 ? 'success' : 'default'}>
            Demand: {region.regionalDemandScore}/100
          </Badge>
        </div>
      ))}
    </div>
  );
}
```

**Performance Comparison:**

```typescript
// src/components/intelligence/performance-comparison.tsx
export function PerformanceComparison({ 
  vendorStats, 
  marketStats 
}: { 
  vendorStats: VendorStats; 
  marketStats: MarketStats;
}) {
  const metrics = [
    {
      label: 'Win Rate',
      vendor: vendorStats.winRate,
      market: marketStats.avgWinRate,
      format: (v: number) => `${v}%`
    },
    {
      label: 'Avg Bid Amount',
      vendor: vendorStats.avgBidAmount,
      market: marketStats.avgBidAmount,
      format: (v: number) => `₦${v.toLocaleString()}`
    },
    {
      label: 'Bids Per Week',
      vendor: vendorStats.bidsPerWeek,
      market: marketStats.avgBidsPerWeek,
      format: (v: number) => v.toFixed(1)
    }
  ];
  
  return (
    <div className="space-y-4">
      {metrics.map((metric) => (
        <div key={metric.label} className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{metric.label}</span>
            <span className="font-medium">
              {metric.format(metric.vendor)} 
              <span className="text-muted-foreground ml-2">
                (Market: {metric.format(metric.market)})
              </span>
            </span>
          </div>
          <Progress 
            value={(metric.vendor / metric.market) * 50} 
            className="h-2"
          />
        </div>
      ))}
    </div>
  );
}
```

---

## 7. Admin Intelligence Dashboard

### 7.1 Admin Dashboard Structure

```typescript
// src/app/(dashboard)/admin/intelligence/page.tsx
export default async function AdminIntelligenceDashboard() {
  const [
    systemMetrics,
    accuracyMetrics,
    vendorSegments,
    schemaEvolution,
    mlDatasets
  ] = await Promise.all([
    getSystemMetrics(),
    getAccuracyMetrics(),
    getVendorSegmentDistribution(),
    getSchemaEvolutionLog(),
    getMLDatasets()
  ]);
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Intelligence System Dashboard</h1>
      
      {/* System Health Section */}
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <SystemHealthMetrics data={systemMetrics} />
        </CardContent>
      </Card>
      
      {/* Prediction Accuracy Section */}
      <Card>
        <CardHeader>
          <CardTitle>Prediction Accuracy</CardTitle>
          <CardDescription>Last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <AccuracyChart data={accuracyMetrics} />
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 8. Background Jobs

### 8.1 Materialized View Refresh Job

```typescript
// src/lib/jobs/refresh-materialized-views.ts
import cron from 'node-cron';
import { db } from '@/lib/db';

export function scheduleMatViewRefresh() {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('[Job] Refreshing materialized views...');
    
    try {
      await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY vendor_bidding_patterns`);
      await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY market_conditions_summary`);
      
      console.log('[Job] Materialized views refreshed successfully');
    } catch (error) {
      console.error('[Job] Error refreshing materialized views:', error);
    }
  });
}
```

### 8.2 Accuracy Calculation Job

```typescript
// src/lib/jobs/calculate-accuracy.ts
export function scheduleAccuracyCalculation() {
  // Run every hour
  cron.schedule('0 * * * *', async () => {
    console.log('[Job] Calculating prediction accuracy...');
    
    try {
      const closedAuctions = await db
        .select()
        .from(predictions)
        .innerJoin(auctions, eq(predictions.auctionId, auctions.id))
        .where(
          and(
            eq(auctions.status, 'closed'),
            isNull(predictions.actualPrice),
            gte(auctions.endTime, sql`NOW() - INTERVAL '1 hour'`)
          )
        );
      
      for (const { prediction, auction } of closedAuctions) {
        const actualPrice = auction.currentBid;
        const absoluteError = Math.abs(actualPrice - prediction.predictedPrice);
        const accuracy = 1 - (absoluteError / actualPrice);
        
        await db
          .update(predictions)
          .set({
            actualPrice,
            accuracy,
            absoluteError,
            updatedAt: new Date()
          })
          .where(eq(predictions.id, prediction.id));
      }
      
      console.log(`[Job] Updated accuracy for ${closedAuctions.length} predictions`);
    } catch (error) {
      console.error('[Job] Error calculating accuracy:', error);
    }
  });
}
```

---

## 9. Deployment Checklist

### 9.1 Database Migrations

- [ ] Run all schema migrations in order
- [ ] Create materialized views
- [ ] Insert default algorithm configuration
- [ ] Create database indexes
- [ ] Set up table partitioning for interactions and logs

### 9.2 Environment Variables

```env
# Redis Configuration
REDIS_URL=redis://localhost:6379

# Background Jobs
ENABLE_CRON_JOBS=true

# Intelligence System
INTELLIGENCE_ENABLED=true
PREDICTION_CACHE_TTL=300
RECOMMENDATION_CACHE_TTL=900
```

### 9.3 Performance Tuning

- [ ] Configure PostgreSQL shared_buffers (25% of RAM)
- [ ] Enable query plan caching
- [ ] Set up Redis connection pooling
- [ ] Configure materialized view refresh schedule
- [ ] Enable query logging for slow queries (> 1s)

### 9.4 Monitoring Setup

- [ ] Set up Prometheus metrics export
- [ ] Configure Grafana dashboards
- [ ] Set up alerting for:
  - Prediction accuracy drops below 75%
  - API response time exceeds 500ms
  - Cache hit rate drops below 80%
  - Background job failures

---

## 10. Future Enhancements

### 10.1 Machine Learning Integration

Once sufficient data is collected (6-12 months), replace SQL-based algorithms with ML models:

- **Gradient Boosting (XGBoost/LightGBM)** for price prediction
- **Neural Collaborative Filtering** for recommendations
- **Anomaly Detection (Isolation Forest)** for fraud detection

### 10.2 Real-Time Streaming

Implement real-time event streaming with Apache Kafka for:
- Live prediction updates as bids come in
- Real-time recommendation adjustments
- Instant fraud detection alerts

### 10.3 A/B Testing Framework

Build experimentation framework to test:
- Different recommendation algorithms
- Prediction confidence thresholds
- UI variations for intelligence features

### 10.4 Advanced Analytics

- Cohort analysis for vendor retention
- Churn prediction for inactive vendors
- Lifetime value (LTV) prediction
- Market basket analysis for cross-selling

---

## Conclusion

This design document provides a comprehensive blueprint for implementing the AI-Powered Marketplace Intelligence system. The system is designed to be:

- **Performant**: Sub-200ms response times through aggressive caching and query optimization
- **Scalable**: Handles growing data volumes through partitioning and materialized views
- **Privacy-Compliant**: GDPR-ready with anonymization and data deletion workflows
- **ML-Ready**: Collects structured data for future machine learning model training
- **Maintainable**: Clear separation of concerns with service layer architecture

The implementation follows a phased approach, starting with SQL-based algorithms and progressively enhancing with machine learning as data accumulates.
