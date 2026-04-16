# Requirements Document

## Introduction

The AI-Powered Marketplace Intelligence system enhances the salvage auction marketplace with three core capabilities: (1) Auction Price Prediction Engine that forecasts final bid prices using historical auction data, (2) Vendor Recommendation Engine that delivers personalized "For You" auction feeds, and (3) Fraud Detection System that identifies suspicious patterns in bidding, claims, and vendor behavior. All engines use SQL-based algorithms within PostgreSQL (no external ML services), integrate with existing infrastructure (Socket.IO, auditLogs, Drizzle ORM), handle cold-start scenarios, comply with GDPR requirements, and are optimized for mobile PWA usage.

## Glossary

- **Prediction_Engine**: The Auction Price Prediction Engine component that forecasts final bid prices
- **Recommendation_Engine**: The Vendor Recommendation Engine component that generates personalized auction feeds
- **Fraud_Detection_System**: The Fraud Detection System component that identifies suspicious patterns
- **Intelligence_System**: The combined AI-Powered Marketplace Intelligence system (all three engines)
- **Vendor**: A registered user who participates in auctions by placing bids (vendors table)
- **Auction**: A time-bound bidding process for a salvage case (auctions table)
- **Salvage_Case**: An insurance case containing a damaged asset available for auction (salvageCases table)
- **Historical_Data**: Past auction outcomes, bids, and vendor interactions stored in auctions and bids tables
- **Cold_Start**: The scenario where insufficient historical data exists for predictions or recommendations
- **Confidence_Score**: A 0-100 value representing prediction reliability
- **Match_Score**: A 0-100 value representing how relevant an auction is to a vendor
- **Materialized_View**: A pre-computed database view that caches query results for performance
- **Interaction_Event**: Vendor actions including auction views, bids placed, and auction wins
- **Damaged_Part**: A specific damaged component from aiAssessment.damagedParts (e.g., "driver front door", "front bumper")
- **Performance_Stats**: Vendor metrics from vendors.performanceStats (totalBids, totalWins, winRate, avgPaymentTimeHours)
- **Asset_Details**: Item information from salvageCases.assetDetails (make, model, year for vehicles)
- **Bidding_Pattern**: A vendor's historical preferences for asset types, price ranges, and damage levels
- **Content_Based_Filtering**: Recommendation approach using item and vendor attributes
- **Collaborative_Filtering**: Recommendation approach using patterns from similar vendors
- **Socket_IO_Server**: The existing WebSocket server for real-time updates (src/lib/socket/server.ts)
- **Audit_Log**: Existing audit trail system (auditLogs table) for tracking all user actions
- **PII**: Personally Identifiable Information subject to GDPR protection
- **PWA**: Progressive Web App with offline support and mobile optimization
- **Market_Intelligence**: Analytics data about asset performance, pricing trends, and market conditions
- **Behavioral_Analytics**: Data about vendor behavior patterns, session analytics, and engagement metrics
- **Asset_Performance_Metrics**: Aggregated statistics for specific asset types, makes, models, and conditions
- **Temporal_Pattern**: Time-based patterns in bidding, auction closures, and vendor activity
- **Geographic_Pattern**: Location-based patterns in vendor behavior, asset preferences, and pricing
- **Vendor_Segment**: Behavioral classification of vendors (Bargain Hunters, Premium Buyers, Specialists, etc.)
- **Session_Analytics**: Tracking of vendor browsing sessions including time on site, pages viewed, and conversion funnel
- **Engagement_Metric**: Measurements of vendor interaction quality (bounce rate, return rate, auction watch patterns)
- **Dynamic_Schema**: Self-evolving database structure that automatically adapts to new asset types and attributes
- **Analytics_Aggregation**: Pre-computed rollups of analytics data at hourly, daily, weekly, and monthly levels
- **Feature_Vector**: Set of numerical attributes used for ML model training (asset attributes, market conditions, vendor behavior)
- **ML_Training_Dataset**: Exported data formatted for machine learning model training with feature engineering applied

## Requirements

### Requirement 1: Auction Price Prediction

**User Story:** As a vendor, I want to see predicted final auction prices with confidence scores, so that I can make informed bidding decisions and avoid overbidding.

#### Acceptance Criteria

1. WHEN a Vendor views an active Auction, THE Prediction_Engine SHALL generate a predicted final bid price within 200ms
2. THE Prediction_Engine SHALL provide a prediction with predictedPrice, lowerBound, upperBound, and confidenceScore (0-100)
3. THE Prediction_Engine SHALL calculate predictions using only PostgreSQL queries without external ML services
4. THE Prediction_Engine SHALL store each prediction in the predictions table with auctionId, predictedPrice, lowerBound, upperBound, confidenceScore, algorithmVersion, and createdAt
5. WHEN the Prediction_Engine generates a prediction, THE Intelligence_System SHALL log the event to the existing auditLogs table with actionType='prediction_generated'
6. THE Prediction_Engine SHALL achieve ±15% accuracy on final bid price for auctions with sufficient historical data
7. WHEN an Auction closes, THE Prediction_Engine SHALL update the predictions table with actualPrice and calculate accuracy

### Requirement 2: Historical Data Analysis for Price Prediction

**User Story:** As the Prediction Engine, I want to analyze historical auction data, so that I can identify similar auctions and calculate accurate price predictions.

#### Acceptance Criteria

1. THE Prediction_Engine SHALL identify similar historical auctions by matching salvageCases.assetDetails.make, salvageCases.assetDetails.model, salvageCases.assetDetails.year (±2 years), and salvageCases.damageSeverity
2. THE Prediction_Engine SHALL calculate a weighted average of auctions.currentBid (final prices) from similar historical auctions with status='closed'
3. THE Prediction_Engine SHALL adjust predictions based on market conditions including average bids.amount per auction over the past 30 days and auctions.watchingCount trends
4. WHEN fewer than 5 similar historical auctions exist, THE Prediction_Engine SHALL reduce the confidenceScore proportionally (confidenceScore = (similarCount / 5) * 100)
5. THE Prediction_Engine SHALL use salvageCases.aiAssessment.damagedParts array to improve similarity matching by comparing specific damaged components
6. THE Prediction_Engine SHALL weight recent auctions higher using exponential decay (auctions from last 30 days get 100% weight, 6 months get 50% weight)

### Requirement 3: Cold-Start Handling for Price Prediction

**User Story:** As a vendor viewing an auction for a new item type with no historical data, I want to receive a price estimate, so that I can still make informed bidding decisions.

#### Acceptance Criteria

1. WHEN no similar historical auctions exist for an item type, THE Prediction_Engine SHALL fallback to salvageCases.estimatedSalvageValue as the predictedPrice
2. WHEN using salvage value fallback, THE Prediction_Engine SHALL set confidenceScore to 30 and calculate bounds as ±20% of estimatedSalvageValue
3. WHEN salvageCases.estimatedSalvageValue is NULL, THE Prediction_Engine SHALL calculate fallback as (salvageCases.marketValue * (1 - damageSeverityMultiplier)) where minor=0.3, moderate=0.5, severe=0.7
4. THE Prediction_Engine SHALL use salvageCases.reservePrice as the lowerBound when salvage value fallback is active
5. WHEN fewer than 3 similar auctions exist, THE Prediction_Engine SHALL blend historical average (60% weight) with estimatedSalvageValue (40% weight)
6. THE Prediction_Engine SHALL include a fallbackMethod field in the response indicating 'historical', 'salvage_value', or 'market_value_calculation'

### Requirement 4: Smart Vendor Recommendations

**User Story:** As a vendor, I want to see a personalized "For You" feed of relevant auctions, so that I can discover opportunities matching my interests and increase my bidding activity.

#### Acceptance Criteria

1. WHEN a Vendor accesses the auction marketplace, THE Recommendation_Engine SHALL generate a ranked list of recommended auctions within 200ms
2. THE Recommendation_Engine SHALL calculate matchScore (0-100) for each auction based on the Vendor's bidding patterns from the bids table
3. THE Recommendation_Engine SHALL rank auctions by matchScore in descending order with top 20 results returned
4. THE Recommendation_Engine SHALL use item-based collaborative filtering by finding auctions similar to those the Vendor previously bid on
5. THE Recommendation_Engine SHALL store each recommendation in the recommendations table with vendorId, auctionId, matchScore, reasonCodes (jsonb array), algorithmVersion, and createdAt
6. THE Recommendation_Engine SHALL track clicked (boolean) and bidPlaced (boolean) fields in recommendations table for effectiveness measurement
7. THE Recommendation_Engine SHALL exclude auctions where the Vendor is already the currentBidder

### Requirement 5: Vendor Bidding Pattern Analysis

**User Story:** As the Recommendation Engine, I want to analyze vendor bidding patterns, so that I can identify their preferences and generate relevant recommendations.

#### Acceptance Criteria

1. THE Recommendation_Engine SHALL track preferred asset types by analyzing salvageCases.assetDetails.make, salvageCases.assetDetails.model, and salvageCases.assetType from auctions the Vendor bid on
2. THE Recommendation_Engine SHALL identify preferred price ranges by analyzing bids.amount distribution (min, max, average, median) from the Vendor's bid history
3. THE Recommendation_Engine SHALL determine preferred damage levels by analyzing salvageCases.damageSeverity from cases the Vendor bid on
4. THE Recommendation_Engine SHALL calculate recency weights giving higher importance to bids.createdAt within the last 90 days (100% weight) vs older bids (50% weight for 90-180 days, 25% for 180+ days)
5. THE Recommendation_Engine SHALL use vendors.categories array to supplement bidding pattern analysis when bid history is limited
6. THE Recommendation_Engine SHALL use vendors.performanceStats.totalBids, vendors.performanceStats.totalWins, and vendors.performanceStats.winRate to adjust recommendation strategies (e.g., recommend lower competition auctions for vendors with low winRate)

### Requirement 6: Cold-Start Handling for Vendor Recommendations

**User Story:** As a new vendor with no bidding history, I want to receive relevant auction recommendations, so that I can start participating in the marketplace immediately.

#### Acceptance Criteria

1. WHEN a Vendor has fewer than 3 bids in the bids table, THE Recommendation_Engine SHALL use content-based filtering based on vendors.categories array
2. THE Recommendation_Engine SHALL match auctions where salvageCases.assetType is in the Vendor's vendors.categories array
3. THE Recommendation_Engine SHALL use vendors.tier field to adjust recommendation complexity (tier1_bvn gets simpler, lower-value auctions; tier2_full gets full range)
4. WHEN a Vendor has zero bidding history, THE Recommendation_Engine SHALL fallback to popularity-based rankings using auctions.watchingCount in descending order
5. THE Recommendation_Engine SHALL blend content-based (70% weight) and collaborative filtering (30% weight) when the Vendor has 3-20 bids
6. WHEN the platform has fewer than 10 active vendors with bids, THE Recommendation_Engine SHALL prioritize popularity-based (auctions.watchingCount) and content-based approaches over collaborative filtering

### Requirement 7: Interaction Data Collection

**User Story:** As the Intelligence System, I want to collect vendor interaction data, so that I can improve predictions and recommendations over time and prepare datasets for future ML training.

#### Acceptance Criteria

1. WHEN a Vendor views an Auction, THE Intelligence_System SHALL record the view event in the interactions table with vendorId, auctionId, eventType='view', timestamp, sessionId, and metadata (jsonb with deviceType, ipAddress)
2. WHEN a Vendor places a bid, THE Intelligence_System SHALL record the bid event in the interactions table with eventType='bid' and metadata containing the prediction shown (if any)
3. WHEN an Auction closes, THE Intelligence_System SHALL record the outcome in the interactions table with eventType='win' for the winning vendor
4. THE Intelligence_System SHALL use the existing auditLogs table to track all prediction and recommendation API calls with actionType='prediction_viewed' or 'recommendation_viewed'
5. THE Intelligence_System SHALL calculate prediction accuracy by comparing predictions.predictedPrice to predictions.actualPrice when auctions.status='closed'
6. THE Intelligence_System SHALL calculate recommendation effectiveness by tracking recommendations.clicked and recommendations.bidPlaced conversion rates

### Requirement 8: GDPR Compliance and Data Privacy

**User Story:** As a vendor, I want my personal data to be protected and my privacy respected, so that I can trust the platform with my information.

#### Acceptance Criteria

1. THE Intelligence_System SHALL anonymize all PII (users.name, users.email, users.phoneNumber, auditLogs.ipAddress) before using data for algorithm training
2. WHEN a Vendor requests data deletion, THE Intelligence_System SHALL delete all records from predictions, recommendations, and interactions tables where vendorId matches, while retaining anonymized aggregates
3. THE Intelligence_System SHALL provide a GET endpoint /api/intelligence/privacy/export that returns all Intelligence_System data for the requesting Vendor in JSON format
4. THE Intelligence_System SHALL provide a POST endpoint /api/intelligence/privacy/opt-out that disables personalized recommendations while maintaining access to standard auction listings
5. THE Intelligence_System SHALL store interactions.metadata with encrypted ipAddress fields using AES-256 encryption
6. THE Intelligence_System SHALL log all data access to the auditLogs table with actionType='intelligence_data_accessed' for compliance verification
7. THE Intelligence_System SHALL automatically delete interactions table records older than 2 years using a daily background job

### Requirement 9: Performance Optimization with Materialized Views

**User Story:** As a vendor, I want predictions and recommendations to load instantly, so that my browsing experience is seamless and responsive.

#### Acceptance Criteria

1. THE Prediction_Engine SHALL return predictions within 200ms for 95% of requests
2. THE Recommendation_Engine SHALL return ranked recommendations within 200ms for 95% of requests
3. THE Intelligence_System SHALL create a materialized view vendor_bidding_patterns_mv with columns: vendorId, preferredAssetTypes (jsonb), preferredPriceRange (jsonb with min/max), preferredDamageLevel (varchar), recentActivityScore (integer), lastUpdated (timestamp)
4. THE Intelligence_System SHALL create a materialized view market_conditions_mv with columns: assetType, avgBidCount (decimal), avgFinalPrice (decimal), competitionLevel (varchar: 'low'/'medium'/'high'), lastUpdated (timestamp)
5. THE Intelligence_System SHALL refresh materialized views every 5 minutes using a background job without blocking user requests
6. WHEN response time exceeds 200ms, THE Intelligence_System SHALL log performance metrics to auditLogs with actionType='intelligence_performance_slow' and metadata containing query execution time

### Requirement 10: Prediction Algorithm Implementation

**User Story:** As the Prediction Engine, I want to implement a SQL-based prediction algorithm, so that I can generate accurate price forecasts without external ML dependencies.

#### Acceptance Criteria

1. THE Prediction_Engine SHALL query auctions, bids, and salvageCases tables using Drizzle ORM to find similar historical auctions with status='closed'
2. THE Prediction_Engine SHALL define similarity using exact matches on assetDetails.make and assetDetails.model, fuzzy matches on assetDetails.year (±2 years), and exact match on damageSeverity
3. THE Prediction_Engine SHALL calculate weighted average of auctions.currentBid (final prices) with higher weights for more recent auctions using formula: weight = exp(-daysSinceClosed / 180)
4. THE Prediction_Engine SHALL adjust predictions for market conditions by analyzing average COUNT(bids) per auction and average auctions.watchingCount over the past 30 days
5. THE Prediction_Engine SHALL calculate confidenceScore based on sample size: confidenceScore = min(100, (similarAuctionCount / 10) * 100) with penalty for old data (reduce by 10% if oldest auction is >6 months)
6. WHEN sample size is below 5 auctions, THE Prediction_Engine SHALL reduce confidenceScore by 50%
7. THE Prediction_Engine SHALL use salvageCases.aiAssessment.damagedParts array to improve similarity by comparing specific damaged components (e.g., "front bumper" vs "rear bumper")

### Requirement 11: Recommendation Algorithm Implementation

**User Story:** As the Recommendation Engine, I want to implement SQL-based collaborative and content-based filtering, so that I can generate personalized auction feeds without external ML dependencies.

#### Acceptance Criteria

1. THE Recommendation_Engine SHALL implement item-based collaborative filtering by finding auctions similar to those the Vendor previously bid on using bids table history
2. THE Recommendation_Engine SHALL calculate item similarity using salvageCases.assetDetails (make, model, year), salvageCases.assetType, salvageCases.damageSeverity, and auctions.currentBid price range (±30%)
3. THE Recommendation_Engine SHALL implement content-based filtering by matching salvageCases.assetType to vendors.categories array
4. THE Recommendation_Engine SHALL calculate matchScore by combining collaborative filtering score (60% weight) and content-based score (40% weight)
5. WHEN collaborative filtering data is insufficient (fewer than 5 similar vendors), THE Recommendation_Engine SHALL increase content-based filtering weight to 80%
6. THE Recommendation_Engine SHALL exclude auctions where bids.vendorId matches the requesting Vendor
7. THE Recommendation_Engine SHALL boost matchScore by 20 points for auctions in asset categories where vendors.performanceStats.winRate > 50%
8. THE Recommendation_Engine SHALL incorporate vendors.rating and ratings table data to filter out low-quality vendors from collaborative filtering

### Requirement 12: Real-Time Integration with Socket.IO

**User Story:** As a vendor, I want predictions and recommendations to update in real-time as auction conditions change, so that I always have current information.

#### Acceptance Criteria

1. WHEN a new bid is placed on an Auction, THE Prediction_Engine SHALL recalculate the prediction if auctions.currentBid changes by >10% and emit 'prediction:updated' event via the existing Socket_IO_Server
2. WHEN a Vendor places a bid, THE Recommendation_Engine SHALL update the vendor_bidding_patterns_mv materialized view asynchronously
3. THE Intelligence_System SHALL integrate with the existing Socket_IO_Server (src/lib/socket/server.ts) using getSocketServer() function to push real-time updates
4. WHEN an Auction closes (status='closed'), THE Intelligence_System SHALL update predictions.actualPrice within 5 seconds using a database trigger or background job
5. THE Intelligence_System SHALL emit 'recommendation:new' Socket.IO event when new auctions matching a Vendor's preferences are created
6. THE Intelligence_System SHALL use the existing Socket.IO room pattern (socket.join(`vendor:${vendorId}`)) to send targeted updates to specific vendors

### Requirement 13: API Endpoints

**User Story:** As a frontend developer, I want RESTful API endpoints for predictions and recommendations, so that I can integrate intelligence features into the user interface.

#### Acceptance Criteria

1. THE Intelligence_System SHALL provide a GET endpoint /api/auctions/{id}/prediction that returns price prediction with predictedPrice, lowerBound, upperBound, confidenceScore, algorithmVersion, fallbackMethod, similarAuctionCount, and timestamp
2. THE Intelligence_System SHALL provide a GET endpoint /api/vendors/{id}/recommendations that returns ranked auction recommendations with auctionId, matchScore, reasonCodes (array of strings), caseDetails (nested object), and timestamp
3. THE Intelligence_System SHALL provide a POST endpoint /api/intelligence/interactions that records vendor interaction events with vendorId, auctionId, eventType, sessionId, and metadata
4. THE Intelligence_System SHALL provide a POST endpoint /api/intelligence/fraud/analyze that accepts entityType, entityId and returns riskScore, flagReasons (array), and recommendations
5. THE Intelligence_System SHALL follow the existing Next.js App Router pattern (src/app/api/) for all API routes
6. THE Intelligence_System SHALL use the existing authentication middleware to verify JWT tokens and extract userId from the session
7. THE Intelligence_System SHALL return 200 for success, 404 for not found, 400 for invalid inputs, 401 for unauthorized, and 500 for server errors

### Requirement 14: Fraud Detection System

**User Story:** As a platform operator, I want to detect fraudulent patterns in bidding, claims, and vendor behavior, so that I can protect the marketplace integrity and prevent financial losses.

#### Acceptance Criteria

1. THE Fraud_Detection_System SHALL analyze auditLogs table for suspicious patterns including rapid bid sequences, IP address anomalies, and device fingerprint mismatches
2. THE Fraud_Detection_System SHALL detect shill bidding by identifying vendors who consistently bid on auctions from the same adjuster (createdBy in salvageCases) using auditLogs correlation
3. THE Fraud_Detection_System SHALL detect photo authenticity issues by comparing salvageCases.photos URLs for duplicates across multiple cases using perceptual hashing
4. THE Fraud_Detection_System SHALL detect claim pattern fraud by identifying users who submit multiple similar cases (same assetDetails.make/model, similar aiAssessment.damagedParts) within short time periods
5. THE Fraud_Detection_System SHALL detect vendor-adjuster collusion by analyzing bid timing patterns and win rates between specific vendor-adjuster pairs
6. THE Fraud_Detection_System SHALL store fraud alerts in fraud_alerts table with entityType ('vendor'/'case'/'auction'), entityId, riskScore (0-100), flagReasons (jsonb array), status ('pending'/'reviewed'/'dismissed'), and reviewedBy
7. THE Fraud_Detection_System SHALL emit 'fraud:alert' Socket.IO event to admin users when riskScore > 75

### Requirement 15: Data Export for ML Training

**User Story:** As a data scientist, I want to export collected interaction data and algorithm performance metrics, so that I can train advanced ML models in the future.

#### Acceptance Criteria

1. THE Intelligence_System SHALL provide a GET endpoint /api/intelligence/export that generates datasets in CSV and JSON formats with query parameters for dateRange, dataType ('predictions'/'recommendations'/'interactions'), and format
2. THE Intelligence_System SHALL export anonymized interaction data from interactions table with vendorId replaced by anonymousVendorId (UUID hash)
3. THE Intelligence_System SHALL export prediction accuracy data from predictions table including predictedPrice, actualPrice, confidenceScore, accuracy, and algorithmVersion
4. THE Intelligence_System SHALL export recommendation effectiveness data from recommendations table including matchScore, clicked, bidPlaced, and reasonCodes
5. THE Intelligence_System SHALL include feature vectors in exports: assetDetails (make/model/year), damageSeverity, damagedParts count, marketValue, estimatedSalvageValue, and market conditions
6. WHEN exporting data, THE Intelligence_System SHALL remove users.email, users.phoneNumber, users.name, and auditLogs.ipAddress, replacing with anonymized identifiers
7. THE Intelligence_System SHALL include a JSON schema file with each export describing the data structure and field definitions

### Requirement 16: Monitoring and Accuracy Tracking

**User Story:** As a product manager, I want to monitor prediction accuracy and recommendation effectiveness, so that I can measure system performance and identify areas for improvement.

#### Acceptance Criteria

1. THE Intelligence_System SHALL provide a GET endpoint /api/intelligence/metrics that returns current performance metrics including prediction accuracy, recommendation CTR, and system health
2. THE Intelligence_System SHALL calculate prediction accuracy metrics: meanAbsoluteError = AVG(ABS(predictedPrice - actualPrice)), meanPercentageError = AVG(ABS((predictedPrice - actualPrice) / actualPrice) * 100), and confidenceCalibration (correlation between confidenceScore and actual accuracy)
3. THE Intelligence_System SHALL calculate recommendation metrics: clickThroughRate = (COUNT(clicked=true) / COUNT(*)) * 100, bidConversionRate = (COUNT(bidPlaced=true) / COUNT(clicked=true)) * 100, and engagementLift (comparison to non-recommended auctions)
4. THE Intelligence_System SHALL track algorithm performance over time with daily, weekly, and monthly aggregations stored in algorithm_performance table
5. THE Intelligence_System SHALL provide breakdown metrics by salvageCases.assetType, salvageCases.damageSeverity, and price range (low: <100k, medium: 100k-500k, high: >500k)
6. WHEN prediction meanPercentageError exceeds 15%, THE Intelligence_System SHALL create an auditLog entry with actionType='intelligence_accuracy_alert' and emit 'intelligence:alert' Socket.IO event to admin users
7. WHEN recommendation bidConversionRate falls below 10%, THE Intelligence_System SHALL create an auditLog entry with actionType='intelligence_engagement_alert'

### Requirement 17: Database Schema for Intelligence Data

**User Story:** As the Intelligence System, I want dedicated database tables for storing predictions, recommendations, interactions, and fraud alerts, so that I can maintain audit trails and support continuous learning.

#### Acceptance Criteria

1. THE Intelligence_System SHALL create a predictions table using Drizzle ORM with columns: id (uuid), auctionId (uuid, foreign key to auctions.id), predictedPrice (numeric), lowerBound (numeric), upperBound (numeric), confidenceScore (integer 0-100), algorithmVersion (varchar), createdAt (timestamp), actualPrice (numeric nullable), accuracy (numeric nullable), fallbackMethod (varchar nullable)
2. THE Intelligence_System SHALL create a recommendations table using Drizzle ORM with columns: id (uuid), vendorId (uuid, foreign key to vendors.id), auctionId (uuid, foreign key to auctions.id), matchScore (integer 0-100), reasonCodes (jsonb array of strings), algorithmVersion (varchar), createdAt (timestamp), clicked (boolean default false), bidPlaced (boolean default false), clickedAt (timestamp nullable)
3. THE Intelligence_System SHALL create an interactions table using Drizzle ORM with columns: id (uuid), vendorId (uuid, foreign key to vendors.id), auctionId (uuid, foreign key to auctions.id), eventType (enum: 'view'/'bid'/'win'), timestamp (timestamp), sessionId (varchar), metadata (jsonb with deviceType, ipAddress, predictionShown)
4. THE Intelligence_System SHALL create a fraud_alerts table using Drizzle ORM with columns: id (uuid), entityType (enum: 'vendor'/'case'/'auction'/'user'), entityId (uuid), riskScore (integer 0-100), flagReasons (jsonb array), status (enum: 'pending'/'reviewed'/'dismissed'/'confirmed'), reviewedBy (uuid nullable, foreign key to users.id), reviewedAt (timestamp nullable), createdAt (timestamp)
5. THE Intelligence_System SHALL create an algorithm_config table using Drizzle ORM with columns: id (uuid), configKey (varchar unique), configValue (jsonb), version (integer), updatedBy (uuid, foreign key to users.id), updatedAt (timestamp), description (text)
6. THE Intelligence_System SHALL create indexes: idx_predictions_auction_id, idx_recommendations_vendor_id, idx_recommendations_auction_id, idx_interactions_vendor_id, idx_interactions_event_type, idx_interactions_timestamp, idx_fraud_alerts_entity, idx_fraud_alerts_status
7. THE Intelligence_System SHALL implement automatic cleanup of interactions table records older than 2 years using a daily cron job

### Requirement 18: Edge Case Handling for Predictions

**User Story:** As the Prediction Engine, I want to handle edge cases gracefully, so that I provide reliable predictions even in unusual scenarios.

#### Acceptance Criteria

1. WHEN auctions.currentBid is NULL (no bids yet), THE Prediction_Engine SHALL use salvageCases.reservePrice as the baseline for prediction calculation
2. WHEN salvageCases.reservePrice is higher than all similar historical auctions.currentBid values, THE Prediction_Engine SHALL use reservePrice as lowerBound and extrapolate upperBound as reservePrice * 1.3
3. WHEN an Auction receives unusually high early bids (currentBid > predictedPrice * 1.5), THE Prediction_Engine SHALL recalculate using currentBid as the new baseline
4. WHEN market data shows extreme volatility (standard deviation > 40% of mean final prices), THE Prediction_Engine SHALL widen confidence intervals by multiplying (upperBound - lowerBound) by 1.5
5. WHEN auctions.extensionCount > 2, THE Prediction_Engine SHALL adjust predictedPrice upward by 10% to reflect increased competition
6. IF an Auction has zero similar historical data AND salvageCases.estimatedSalvageValue is NULL, THEN THE Prediction_Engine SHALL return status='no_prediction_available' with explanation in metadata
7. WHEN salvageCases.assetDetails is incomplete (missing make or model), THE Prediction_Engine SHALL attempt fuzzy matching on available fields before falling back to salvage value

### Requirement 19: Edge Case Handling for Recommendations

**User Story:** As the Recommendation Engine, I want to handle edge cases gracefully, so that I provide useful recommendations even in unusual scenarios.

#### Acceptance Criteria

1. WHEN a Vendor has only lost bids (vendors.performanceStats.winRate = 0), THE Recommendation_Engine SHALL recommend auctions with lower auctions.watchingCount (competition level) and lower salvageCases.reservePrice
2. WHEN a Vendor consistently bids below market value (AVG(bids.amount) < AVG(auctions.currentBid) * 0.8), THE Recommendation_Engine SHALL recommend auctions with lower reservePrice and estimatedSalvageValue
3. WHEN a Vendor has not placed bids in 30 days (MAX(bids.createdAt) < NOW() - INTERVAL '30 days'), THE Recommendation_Engine SHALL increase diversity by including auctions from asset types outside their usual preferences
4. WHEN no active auctions match a Vendor's preferences (matchScore < 40 for all), THE Recommendation_Engine SHALL recommend the top 5 auctions by watchingCount with reasonCode='trending'
5. IF a Vendor's bidding pattern is erratic (standard deviation of bids.amount > 50% of mean), THEN THE Recommendation_Engine SHALL use broader matching criteria (±50% price range instead of ±30%)
6. WHEN a Vendor has bid on all available auctions (EXISTS check in bids table), THE Recommendation_Engine SHALL return empty array with message='no_new_recommendations'

### Requirement 19: Algorithm Versioning and A/B Testing

**User Story:** As a product manager, I want to version algorithms and run A/B tests, so that I can measure improvements and roll back if needed.

#### Acceptance Criteria

1. THE Intelligence_System SHALL tag each prediction and recommendation with algorithmVersion identifier stored in predictions.algorithmVersion and recommendations.algorithmVersion
2. THE Intelligence_System SHALL support running multiple algorithm versions simultaneously by reading active versions from algorithm_config table where configKey='active_versions'
3. THE Intelligence_System SHALL randomly assign vendors to algorithm variants using MOD(HASHTEXT(vendorId), 100) for deterministic assignment (e.g., 0-79 = control, 80-99 = experimental)
4. THE Intelligence_System SHALL track performance metrics separately for each algorithmVersion by grouping predictions.accuracy and recommendations.bidPlaced by algorithmVersion
5. THE Intelligence_System SHALL provide a POST endpoint /api/intelligence/admin/algorithm-config that allows admins to activate, deactivate, or adjust traffic allocation for algorithm versions
6. WHEN a new algorithmVersion is deployed, THE Intelligence_System SHALL maintain backward compatibility by supporting queries against predictions and recommendations tables with any algorithmVersion value

### Requirement 20: Integration with Existing Codebase

**User Story:** As a developer, I want the Intelligence System to integrate seamlessly with the existing Next.js and Drizzle ORM architecture, so that I can maintain code consistency and avoid technical debt.

#### Acceptance Criteria

1. THE Intelligence_System SHALL use Drizzle ORM (src/lib/db/drizzle.ts) for all database queries and schema definitions following the existing pattern in src/lib/db/schema/
2. THE Intelligence_System SHALL follow the existing Next.js App Router pattern (src/app/api/) for API routes with route.ts files
3. THE Intelligence_System SHALL use TypeScript with strict type checking for all intelligence components and export type definitions
4. THE Intelligence_System SHALL integrate with the existing Socket_IO_Server (src/lib/socket/server.ts) using getSocketServer() function for real-time updates
5. THE Intelligence_System SHALL use the existing auditLogs table and logging patterns for all intelligence events
6. THE Intelligence_System SHALL use the existing authentication middleware from NextAuth for API endpoint protection
7. THE Intelligence_System SHALL store configuration in environment variables following the existing .env pattern (e.g., INTELLIGENCE_ENABLED, INTELLIGENCE_ALGORITHM_VERSION)

### Requirement 21: Vendor Rating Integration

**User Story:** As the Recommendation Engine, I want to incorporate vendor ratings and reputation, so that I can recommend auctions appropriate for the vendor's experience level and trustworthiness.

#### Acceptance Criteria

1. THE Recommendation_Engine SHALL use vendors.rating field (numeric 0.00-5.00) to adjust recommendation complexity
2. WHEN vendors.rating < 3.0, THE Recommendation_Engine SHALL prioritize auctions where salvageCases.marketValue < 500000 to limit risk exposure
3. WHEN vendors.rating > 4.5, THE Recommendation_Engine SHALL include high-value auctions (marketValue > 1000000) in recommendations
4. THE Recommendation_Engine SHALL query the ratings table to analyze vendor performance in specific asset categories using ratings.categoryRatings.paymentSpeed, ratings.categoryRatings.communication, and ratings.categoryRatings.pickupPunctuality
5. THE Recommendation_Engine SHALL boost matchScore by 15 points for asset categories where the Vendor has AVG(ratings.overallRating) > 4.0
6. THE Recommendation_Engine SHALL use vendors.tier ('tier1_bvn' or 'tier2_full') to filter auctions requiring specific KYC levels
7. THE Recommendation_Engine SHALL exclude vendors with vendors.status='suspended' from receiving recommendations

### Requirement 22: Continuous Learning Pipeline

**User Story:** As the Intelligence System, I want to continuously learn from new auction outcomes and vendor interactions, so that predictions and recommendations improve over time without manual intervention.

#### Acceptance Criteria

1. WHEN auctions.status changes to 'closed', THE Intelligence_System SHALL automatically update predictions.actualPrice with auctions.currentBid and calculate predictions.accuracy = 100 - ABS((predictedPrice - actualPrice) / actualPrice) * 100
2. THE Intelligence_System SHALL recalculate algorithm parameters (similarity weights, confidence thresholds) daily using a background job that analyzes predictions.accuracy trends
3. THE Intelligence_System SHALL identify prediction errors where predictions.accuracy < 80% and log them to auditLogs with actionType='prediction_error' for algorithm refinement
4. THE Intelligence_System SHALL track recommendations.clicked and recommendations.bidPlaced rates and adjust matchScore calculation weights to optimize for bidPlaced conversion
5. THE Intelligence_System SHALL maintain a rolling window of 12 months of historical data in auctions and bids tables for algorithm calculations
6. THE Intelligence_System SHALL archive interactions table records older than 12 months to interactions_archive table for long-term trend analysis
7. THE Intelligence_System SHALL generate weekly performance reports stored in algorithm_performance table with metrics: avgPredictionAccuracy, avgRecommendationCTR, totalPredictions, totalRecommendations, algorithmVersion

### Requirement 23: Fallback and Degradation Strategies

**User Story:** As a vendor, I want the system to remain functional even when intelligence features encounter errors, so that I can continue using the marketplace without disruption.

#### Acceptance Criteria

1. IF the Prediction_Engine fails to generate a prediction, THEN THE Intelligence_System SHALL return salvageCases.estimatedSalvageValue with fallbackMethod='error_fallback' and confidenceScore=20
2. IF the Recommendation_Engine fails to generate recommendations, THEN THE Intelligence_System SHALL return a default list of auctions sorted by watchingCount DESC with reasonCode='popular'
3. WHEN database queries exceed the 200ms timeout, THE Intelligence_System SHALL return cached results from Redis with cacheAge timestamp and isCached=true flag
4. THE Intelligence_System SHALL log all fallback activations to auditLogs with actionType='intelligence_fallback' and metadata containing error details
5. THE Intelligence_System SHALL continue normal marketplace operations (auction viewing, bidding) even if Intelligence_System endpoints return 500 errors
6. THE Intelligence_System SHALL provide an environment variable INTELLIGENCE_ENABLED (boolean) for emergency rollback without code deployment

### Requirement 24: Market Condition Analysis

**User Story:** As the Prediction Engine, I want to analyze market conditions, so that I can adjust predictions based on temporal patterns and competition dynamics.

#### Acceptance Criteria

1. THE Prediction_Engine SHALL calculate average competition level by analyzing COUNT(bids) per auction grouped by salvageCases.assetType over the past 30 days
2. THE Prediction_Engine SHALL identify seasonal patterns by comparing AVG(auctions.currentBid) grouped by EXTRACT(MONTH FROM auctions.endTime) for the same assetType
3. THE Prediction_Engine SHALL detect market trends by calculating price movement direction using linear regression on auctions.currentBid over the past 90 days (slope > 0 = increasing, slope < 0 = decreasing, else stable)
4. THE Prediction_Engine SHALL adjust predictedPrice upward by 5-15% when AVG(COUNT(bids)) per auction is above historical average for the assetType
5. THE Prediction_Engine SHALL adjust predictedPrice downward by 5-15% when AVG(COUNT(bids)) per auction is below historical average for the assetType
6. THE Prediction_Engine SHALL use vendor activity patterns (COUNT(DISTINCT vendors.id) with bids in last 30 days, AVG(bids.amount) per vendor) as market condition indicators
7. THE Prediction_Engine SHALL store market condition calculations in market_conditions_mv materialized view for performance optimization

### Requirement 25: Explainability and Transparency

**User Story:** As a vendor, I want to understand why specific auctions are recommended and how price predictions are calculated, so that I can trust the system and make informed decisions.

#### Acceptance Criteria

1. THE Recommendation_Engine SHALL provide reasonCodes explaining why each auction is recommended (e.g., "Similar to your previous bids", "Matches your preferred categories", "Trending in your price range")
2. THE Prediction_Engine SHALL provide a breakdown showing the components of the prediction (historical average, market adjustment, confidence factors)
3. THE Intelligence_System SHALL display the number of similar historical auctions used for each prediction
4. THE Intelligence_System SHALL indicate when predictions are based on limited data or fallback methods
5. THE Intelligence_System SHALL provide a "How this works" explanation page accessible from prediction and recommendation displays
6. THE Intelligence_System SHALL show confidence scores visually (e.g., color-coded indicators: green for high confidence, yellow for medium, red for low)

### Requirement 26: Background Job Processing

**User Story:** As the Intelligence System, I want to use background jobs for computationally intensive tasks, so that user-facing requests remain fast and responsive.

#### Acceptance Criteria

1. THE Intelligence_System SHALL use background jobs to refresh materialized views for vendor bidding patterns
2. THE Intelligence_System SHALL use background jobs to recalculate algorithm parameters based on new data
3. THE Intelligence_System SHALL use background jobs to generate batch predictions for all active auctions
4. THE Intelligence_System SHALL schedule background jobs to run during low-traffic periods (e.g., 2-4 AM local time)
5. THE Intelligence_System SHALL implement job retry logic with exponential backoff for failed background tasks
6. THE Intelligence_System SHALL log background job execution times and success rates for monitoring
7. THE Intelligence_System SHALL use database locks to prevent concurrent background jobs from conflicting

### Requirement 27: Multi-Asset Type Support

**User Story:** As a vendor interested in different asset types (vehicles, electronics, machinery), I want predictions and recommendations to work across all asset categories, so that I can participate in diverse auctions.

#### Acceptance Criteria

1. THE Prediction_Engine SHALL support price predictions for all asset types in the salvageCases.assetType field (vehicle, electronics, machinery, property)
2. THE Prediction_Engine SHALL use asset-type-specific similarity criteria (e.g., make/model/year for vehicles, brand/category for electronics)
3. THE Recommendation_Engine SHALL track vendor preferences separately for each asset type
4. THE Recommendation_Engine SHALL allow vendors to receive recommendations across multiple asset types based on their categories preferences
5. THE Intelligence_System SHALL maintain separate accuracy metrics for each asset type
6. WHEN an asset type has insufficient data, THE Intelligence_System SHALL use cross-asset patterns (e.g., damage severity impact) as supplementary signals

### Requirement 28: AI Assessment Integration with Damaged Parts

**User Story:** As the Prediction Engine, I want to leverage existing AI damage assessments with specific damaged parts, so that I can incorporate detailed damage analysis into price predictions.

#### Acceptance Criteria

1. THE Prediction_Engine SHALL use salvageCases.aiAssessment.damagedParts array to extract specific damaged components (e.g., "driver front door", "front bumper", "windscreen")
2. THE Prediction_Engine SHALL parse each damagedPart object with fields: part (string), severity ('minor'/'moderate'/'severe'), confidence (0-100)
3. THE Prediction_Engine SHALL weight predictions based on specific damage types by calculating damageImpactScore = SUM(severityWeight * confidence / 100) where minor=10, moderate=30, severe=60
4. WHEN salvageCases.aiAssessment.totalLoss = true, THE Prediction_Engine SHALL cap predictedPrice at salvageCases.marketValue * 0.3
5. THE Prediction_Engine SHALL improve similarity matching by comparing damagedParts arrays between auctions using Jaccard similarity on part names
6. WHEN salvageCases.aiAssessment is NULL or aiAssessment.damagedParts is empty, THE Prediction_Engine SHALL fallback to salvageCases.damageSeverity field only
7. THE Prediction_Engine SHALL use salvageCases.aiAssessment.itemDetails (detectedMake, detectedModel, detectedYear) to supplement assetDetails when assetDetails is incomplete

### Requirement 29: Vendor Segmentation

**User Story:** As the Recommendation Engine, I want to segment vendors into behavioral groups, so that I can apply specialized recommendation strategies for different vendor types.

#### Acceptance Criteria

1. THE Recommendation_Engine SHALL segment vendors into categories: "Bargain Hunters" (AVG(bids.amount) < market average), "Premium Buyers" (AVG(bids.amount) > market average * 1.5), "Specialists" (>70% of bids in single assetType), "Generalists" (bids across 3+ assetTypes)
2. THE Recommendation_Engine SHALL calculate segment membership based on analysis of bids table history over the past 6 months
3. THE Recommendation_Engine SHALL apply segment-specific recommendation strategies: Bargain Hunters get auctions with low watchingCount, Premium Buyers get high marketValue auctions, Specialists get deep matches in their category, Generalists get diverse recommendations
4. THE Recommendation_Engine SHALL update vendor segments monthly using a background job that recalculates based on recent bids.createdAt
5. THE Recommendation_Engine SHALL use vendors.performanceStats.totalBids to identify "Active Bidders" (totalBids > 20 in last 3 months) vs "Selective Bidders" (totalBids < 5 in last 3 months)
6. THE Recommendation_Engine SHALL adjust recommendation frequency: Active Bidders get 20 recommendations, Selective Bidders get 10 recommendations
7. THE Recommendation_Engine SHALL store vendor segment in vendor_bidding_patterns_mv.metadata jsonb field for performance optimization

### Requirement 30: Fraud Detection - Shill Bidding Patterns

**User Story:** As a platform operator, I want to detect shill bidding patterns, so that I can prevent artificial price inflation and maintain marketplace integrity.

#### Acceptance Criteria

1. THE Fraud_Detection_System SHALL detect shill bidding by identifying vendors who place multiple consecutive bids on the same auction (SELECT auctionId, vendorId, COUNT(*) FROM bids WHERE consecutive bids without other bidders)
2. THE Fraud_Detection_System SHALL analyze auditLogs for suspicious bid timing patterns (multiple bids from same vendorId within 60 seconds with actionType='bid_placed')
3. THE Fraud_Detection_System SHALL detect collusion by identifying vendor pairs who consistently bid against each other across multiple auctions (>5 auctions with same 2 vendors as top 2 bidders)
4. THE Fraud_Detection_System SHALL analyze bids.ipAddress and bids.deviceType to detect multiple vendors bidding from the same device or IP address
5. WHEN shill bidding is detected (riskScore > 70), THE Fraud_Detection_System SHALL create a fraud_alerts record with entityType='vendor', flagReasons=['shill_bidding', 'consecutive_bids'], and status='pending'
6. THE Fraud_Detection_System SHALL use auditLogs.beforeState and auditLogs.afterState to detect bid manipulation attempts (e.g., bid amount changes after submission)
7. THE Fraud_Detection_System SHALL increment vendors.performanceStats.fraudFlags when fraud_alerts are confirmed

### Requirement 31: Fraud Detection - Photo Authenticity with Perceptual Hashing

**User Story:** As a platform operator, I want to detect fraudulent or duplicate photos in case submissions using scalable perceptual hashing, so that I can prevent fake claims while avoiding false positives from legitimate duplicate vehicles.

#### Acceptance Criteria

1. THE Fraud_Detection_System SHALL compute perceptual hashes (pHash) for each photo in salvageCases.photos array when a case is created and store them in photo_hashes table with columns: id, caseId, photoUrl, pHash (64-character hex string), createdAt
2. THE Fraud_Detection_System SHALL use multi-index hashing by splitting each pHash into 4 segments (16 characters each) and storing each segment as a separate partition key in photo_hash_index table for O(1) lookup performance
3. THE Fraud_Detection_System SHALL detect duplicate photos by querying photo_hash_index for matches within Hamming distance ≤ 3 (allowing for minor image modifications like watermarks, compression, crops)
4. WHEN duplicate photos are detected, THE Fraud_Detection_System SHALL apply contextual analysis to reduce false positives: flag as fraud ONLY IF (same salvageCases.createdBy user AND different salvageCases.assetDetails.make/model/year) OR (different users AND photos submitted within 7 days)
5. THE Fraud_Detection_System SHALL skip perceptual hashing for low-complexity images (pHash with >90% same character like "AAAAAAAAAA") to avoid false matches on simple backgrounds
6. THE Fraud_Detection_System SHALL use Gemini AI to analyze photo authenticity by detecting: AI-generated artifacts, stock photo watermarks, inconsistent lighting/shadows, and mismatched damage descriptions
7. THE Fraud_Detection_System SHALL extract EXIF metadata (timestamp, GPS, camera model) from photos and flag cases where photo timestamp is >30 days before salvageCases.createdAt OR GPS location differs from salvageCases.gpsLocation by >50km
8. WHEN duplicate photos are detected with high confidence (Hamming distance ≤ 1 AND same user), THE Fraud_Detection_System SHALL create fraud_alerts with entityType='case', flagReasons=['duplicate_photos_same_user'], riskScore=85
9. WHEN duplicate photos are detected across different users (Hamming distance ≤ 2 AND different createdBy), THE Fraud_Detection_System SHALL create fraud_alerts with entityType='case', flagReasons=['duplicate_photos_different_users'], riskScore=95
10. THE Fraud_Detection_System SHALL analyze photo count (array_length(salvageCases.photos, 1)) and flag cases with unusually few photos (<3) with riskScore=30 or many photos (>20) with riskScore=20 as potential fraud indicators

### Requirement 32: Fraud Detection - Claim Pattern Analysis

**User Story:** As a platform operator, I want to detect suspicious claim patterns, so that I can identify repeat fraudsters and organized fraud rings.

#### Acceptance Criteria

1. THE Fraud_Detection_System SHALL detect repeat claimants by analyzing salvageCases.createdBy and identifying users with COUNT(*) > 3 cases in 6 months
2. THE Fraud_Detection_System SHALL detect similar damage patterns by comparing salvageCases.aiAssessment.damagedParts arrays across cases from the same user using Jaccard similarity > 80% on part names
3. THE Fraud_Detection_System SHALL detect geographic clustering by analyzing salvageCases.gpsLocation and identifying multiple cases from the same location (ST_Distance < 100 meters) from different users within 30 days
4. THE Fraud_Detection_System SHALL analyze salvageCases.assetDetails to detect suspiciously similar assets (same make/model/year) from the same user within 90 days
5. WHEN claim pattern fraud is detected, THE Fraud_Detection_System SHALL create fraud_alerts with entityType='user', flagReasons=['repeat_claimant', 'similar_damage_pattern'], and riskScore calculated as (patternMatchCount * 20)
6. THE Fraud_Detection_System SHALL use auditLogs to track case creation velocity (COUNT(*) WHERE actionType='case_created' per day per user) and flag users creating >2 cases per day with riskScore=60

### Requirement 33: Fraud Detection - Vendor-Adjuster Collusion

**User Story:** As a platform operator, I want to detect collusion between vendors and adjusters, so that I can prevent insider fraud and maintain fair auction processes.

#### Acceptance Criteria

1. THE Fraud_Detection_System SHALL detect vendor-adjuster collusion by analyzing win patterns: identify vendor-adjuster pairs where vendors.id wins >60% of auctions from specific salvageCases.createdBy adjusters (using auctions.currentBidder and salvageCases.createdBy join)
2. THE Fraud_Detection_System SHALL analyze bid timing patterns: flag cases where a specific vendor consistently places the winning bid within the last 5 minutes (auctions.endTime - bids.createdAt < INTERVAL '5 minutes') of auctions from the same adjuster
3. THE Fraud_Detection_System SHALL detect price manipulation by comparing auctions.currentBid to salvageCases.estimatedSalvageValue: flag when winning bid is <50% of estimated value for cases from the same adjuster
4. THE Fraud_Detection_System SHALL analyze auditLogs to detect communication patterns between vendors and adjusters (e.g., case views by vendor with actionType='case_viewed' before auction starts)
5. WHEN collusion is detected (riskScore > 75), THE Fraud_Detection_System SHALL create fraud_alerts with entityType='vendor' and separate alert with entityType='user' (adjuster), flagReasons=['vendor_adjuster_collusion', 'suspicious_win_rate']
6. THE Fraud_Detection_System SHALL use vendors.performanceStats.fraudFlags counter to track repeat offenders and increase riskScore by 20 points for vendors with fraudFlags > 2
7. THE Fraud_Detection_System SHALL emit 'fraud:alert' Socket.IO event to admin users (using getSocketServer().to('role:admin').emit()) when collusion riskScore > 75

### Requirement 34: Notification Integration with Socket.IO

**User Story:** As a vendor, I want to receive real-time notifications about highly relevant auction recommendations, so that I don't miss opportunities matching my interests.

#### Acceptance Criteria

1. WHEN the Recommendation_Engine generates a recommendation with matchScore > 90, THE Intelligence_System SHALL emit 'recommendation:new' Socket.IO event to the Vendor using getSocketServer().to(`vendor:${vendorId}`).emit()
2. THE Intelligence_System SHALL integrate with the existing Socket_IO_Server (src/lib/socket/server.ts) for all real-time notifications
3. THE Intelligence_System SHALL respect vendor notification preferences stored in users table or vendor_preferences table
4. THE Intelligence_System SHALL include predictedPrice, lowerBound, upperBound in recommendation notification payload
5. WHEN a recommended auction is about to close (auctions.endTime - NOW() < INTERVAL '1 hour'), THE Intelligence_System SHALL emit 'recommendation:closing_soon' event if NOT EXISTS(SELECT 1 FROM bids WHERE vendorId = ? AND auctionId = ?)
6. THE Intelligence_System SHALL limit recommendation notifications to maximum 5 per day per vendor by tracking notification count in Redis with 24-hour TTL

### Requirement 35: Admin Dashboard and Controls

**User Story:** As an administrator, I want a dashboard to monitor intelligence system performance and manually adjust parameters, so that I can ensure optimal operation and troubleshoot issues.

#### Acceptance Criteria

1. THE Intelligence_System SHALL provide a GET endpoint /api/intelligence/admin/dashboard displaying real-time metrics: prediction accuracy, recommendation CTR, fraud alerts count, system health
2. THE Intelligence_System SHALL provide a POST endpoint /api/intelligence/admin/config that allows administrators to manually adjust algorithm parameters stored in algorithm_config table (similarity thresholds, weight distributions, confidence calculations)
3. THE Intelligence_System SHALL provide a GET endpoint /api/intelligence/admin/inspect/{predictionId} that returns full calculation breakdown including similar auctions found, weights applied, and confidence factors
4. THE Intelligence_System SHALL display alerts for anomalies: sudden accuracy drops (>10% decrease in 24 hours), unusual bidding patterns (bid velocity >3x normal), system errors (>5% error rate)
5. THE Intelligence_System SHALL provide a POST endpoint /api/intelligence/admin/exclusions that allows administrators to flag specific auctions or vendors for exclusion from intelligence features using exclusion_list table
6. THE Intelligence_System SHALL provide a GET endpoint /api/intelligence/admin/data-quality that returns completeness metrics: % of salvageCases with aiAssessment, % with complete assetDetails, % with damagedParts data
7. THE Intelligence_System SHALL restrict all /api/intelligence/admin/* endpoints to users where users.role='admin' or users.role='manager'

### Requirement 36: Testing and Validation

**User Story:** As a developer, I want comprehensive testing capabilities for the Intelligence System, so that I can verify algorithm correctness and prevent regressions.

#### Acceptance Criteria

1. THE Intelligence_System SHALL provide a POST endpoint /api/intelligence/test/predict that accepts synthetic auction data (assetDetails, damageSeverity, damagedParts) and returns prediction without storing to database
2. THE Intelligence_System SHALL include unit tests for all SQL-based algorithm functions using Vitest and test database fixtures
3. THE Intelligence_System SHALL include integration tests verifying end-to-end prediction and recommendation flows using Playwright
4. THE Intelligence_System SHALL provide test fixtures in scripts/test-intelligence-fixtures.ts with known auction outcomes for accuracy validation
5. THE Intelligence_System SHALL support running algorithms against historical data using a POST endpoint /api/intelligence/test/backtest with dateRange parameter
6. THE Intelligence_System SHALL validate that all predictions and recommendations complete within the 200ms performance requirement using performance.now() timing in tests

### Requirement 37: Security and Access Control

**User Story:** As a security-conscious platform operator, I want intelligence features to respect access controls and prevent data leakage, so that vendor privacy and competitive information remain protected.

#### Acceptance Criteria

1. THE Intelligence_System SHALL ensure vendors can only access their own recommendations by verifying session.user.id matches the requested vendorId through NextAuth middleware
2. THE Intelligence_System SHALL prevent vendors from accessing other vendors' bidding patterns by filtering all queries with WHERE vendorId = session.vendor.id
3. THE Intelligence_System SHALL anonymize vendor identifiers in collaborative filtering by using HASH(vendorId) instead of actual vendorId in similarity calculations
4. THE Intelligence_System SHALL rate-limit intelligence API endpoints using Redis to prevent abuse: maximum 100 requests per minute per vendorId with 429 Too Many Requests response
5. THE Intelligence_System SHALL log all API access to auditLogs table with actionType='intelligence_api_accessed', entityType='prediction' or 'recommendation', and metadata containing endpoint and parameters
6. THE Intelligence_System SHALL restrict /api/intelligence/admin/*, /api/intelligence/export, and /api/intelligence/fraud/* endpoints to users where users.role IN ('admin', 'manager')

### Requirement 38: Scalability and Data Growth

**User Story:** As the platform grows, I want the Intelligence System to scale efficiently, so that performance remains consistent as data volume increases.

#### Acceptance Criteria

1. THE Intelligence_System SHALL maintain sub-200ms response times as the auctions table grows to 100,000+ records using proper indexing
2. THE Intelligence_System SHALL use database partitioning for interactions table by month using PostgreSQL table partitioning (PARTITION BY RANGE (timestamp))
3. THE Intelligence_System SHALL implement query optimization strategies including indexes on: auctions(status, endTime), bids(auctionId, amount DESC), salvageCases(assetType, damageSeverity), predictions(auctionId), recommendations(vendorId, matchScore DESC)
4. THE Intelligence_System SHALL archive completed auction data older than 12 months to auctions_archive table to reduce active dataset size
5. THE Intelligence_System SHALL use connection pooling configured in src/lib/db/drizzle.ts to manage database connections efficiently
6. WHEN query performance degrades (execution time > 200ms), THE Intelligence_System SHALL automatically reduce similarity search parameters (e.g., reduce year range from ±2 to ±1, reduce historical window from 12 months to 6 months)

### Requirement 39: Bias Detection and Fairness

**User Story:** As a platform operator, I want to ensure the Intelligence System treats all vendors fairly, so that recommendations and predictions are not biased against specific vendor groups.

#### Acceptance Criteria

1. THE Intelligence_System SHALL monitor recommendation distribution across vendor segments by calculating AVG(matchScore) grouped by vendor segment and flagging if variance > 20%
2. THE Intelligence_System SHALL ensure new vendors (vendors.createdAt < 30 days) receive comparable recommendation quality (AVG(matchScore) within 10% of established vendors)
3. THE Intelligence_System SHALL avoid creating feedback loops where low-rated vendors receive only low-value recommendations by ensuring vendors with rating < 3.0 still receive at least 30% of recommendations with marketValue > 300000
4. THE Intelligence_System SHALL provide equal prediction quality regardless of vendors.tier or vendors.rating by using the same algorithm for all vendors
5. THE Intelligence_System SHALL track and report recommendation diversity metrics: COUNT(DISTINCT assetType) per vendor, price range variance, and damage severity distribution
6. WHEN bias is detected (>20% disparity in AVG(matchScore) across vendor segments), THE Intelligence_System SHALL create an auditLog entry with actionType='intelligence_bias_detected' and emit 'intelligence:alert' to admin users

### Requirement 40: Mobile PWA and Offline Support

**User Story:** As a vendor using the mobile PWA, I want intelligence features to work on mobile devices and handle offline scenarios, so that I can access predictions and recommendations anywhere.

#### Acceptance Criteria

1. THE Intelligence_System SHALL provide mobile-optimized API responses with reduced payload sizes by excluding verbose metadata fields and limiting recommendations to top 10 results
2. THE Intelligence_System SHALL support caching of recent predictions in the service worker (public/sw.js) with 5-minute TTL using Cache API
3. THE Intelligence_System SHALL support caching of recommendations in the service worker with 15-minute TTL
4. WHEN a Vendor is offline, THE Intelligence_System SHALL display the most recent cached predictions with a "Last Updated: {timestamp}" indicator and "Offline Mode" badge
5. THE Intelligence_System SHALL sync interactions table data (views, bids) when the Vendor reconnects using Background Sync API
6. THE Intelligence_System SHALL prioritize essential data in API responses: predictedPrice, confidenceScore, matchScore, reasonCodes (exclude verbose calculation breakdowns for mobile)
7. THE Intelligence_System SHALL provide progressive loading for recommendation lists on mobile devices using pagination (10 results per page) instead of loading all 20 at once

### Requirement 37: Algorithm Configuration Management

**User Story:** As a developer, I want algorithm parameters to be configurable without code changes, so that I can tune the system based on performance metrics.

#### Acceptance Criteria

1. THE Intelligence_System SHALL store algorithm configuration parameters in a database table (similarity_thresholds, weight_distributions, confidence_calculations, time_windows)
2. THE Intelligence_System SHALL load configuration parameters at runtime without requiring application restart
3. THE Intelligence_System SHALL validate configuration changes to prevent invalid parameter values
4. THE Intelligence_System SHALL maintain a history of configuration changes with timestamps and user identifiers
5. THE Intelligence_System SHALL allow A/B testing by supporting multiple active configurations simultaneously
6. THE Intelligence_System SHALL provide default configuration values that work for cold-start scenarios

### Requirement 38: Feedback Loop and Model Improvement

**User Story:** As the Intelligence System, I want to learn from prediction errors and recommendation misses, so that I can automatically improve algorithm accuracy over time.

#### Acceptance Criteria

1. WHEN a prediction error exceeds 20%, THE Intelligence_System SHALL analyze the error to identify contributing factors (missing features, outlier auction, market shift)
2. THE Intelligence_System SHALL adjust similarity matching weights based on which features correlate most strongly with accurate predictions
3. THE Intelligence_System SHALL track which recommendation reason codes lead to highest bid conversion rates
4. THE Intelligence_System SHALL automatically adjust match score calculations to emphasize high-performing signals
5. THE Intelligence_System SHALL identify and flag outlier auctions that consistently produce prediction errors for manual review
6. THE Intelligence_System SHALL generate weekly reports summarizing algorithm improvements and accuracy trends

### Requirement 39: Geographic and Regional Considerations

**User Story:** As a vendor operating in a specific region, I want predictions and recommendations to account for regional market differences, so that I receive locally relevant intelligence.

#### Acceptance Criteria

1. THE Prediction_Engine SHALL filter historical data to prioritize auctions from the same geographic region when available
2. THE Prediction_Engine SHALL adjust predictions based on regional market conditions (currency, local demand patterns)
3. THE Recommendation_Engine SHALL consider vendor location when calculating match scores for auctions with location-specific logistics
4. WHEN regional data is insufficient (fewer than 10 auctions), THE Prediction_Engine SHALL expand to national or global data with appropriate adjustments
5. THE Intelligence_System SHALL support multiple currency formats for international expansion
6. THE Intelligence_System SHALL account for regional seasonality patterns (e.g., rainy season impact on vehicle damage)

### Requirement 40: Error Handling and Resilience

**User Story:** As a vendor, I want the Intelligence System to handle errors gracefully, so that temporary issues don't disrupt my auction experience.

#### Acceptance Criteria

1. IF a database query fails, THEN THE Intelligence_System SHALL return cached results when available
2. IF no cached results exist, THEN THE Intelligence_System SHALL return a user-friendly error message without exposing technical details
3. THE Intelligence_System SHALL implement circuit breaker patterns to prevent cascading failures
4. WHEN the Intelligence_System detects repeated failures, THE Intelligence_System SHALL temporarily disable the failing component and alert administrators
5. THE Intelligence_System SHALL log all errors with full context (query parameters, stack traces, timing) for debugging
6. THE Intelligence_System SHALL implement health check endpoints for monitoring system availability
7. THE Intelligence_System SHALL recover automatically from transient database connection issues using retry logic



### Requirement 41: Vendor UI - Auction Price Prediction Display

**User Story:** As a vendor viewing an auction, I want to see the predicted final price with visual confidence indicators, so that I can quickly assess if the auction is worth bidding on.

#### Acceptance Criteria

1. WHEN a Vendor views an auction details page, THE Intelligence_System SHALL display the price prediction in a prominent card with predictedPrice, lowerBound, upperBound, and confidenceScore
2. THE Intelligence_System SHALL use color-coded confidence indicators: green badge for confidenceScore ≥ 75 ("High Confidence"), yellow badge for 50-74 ("Medium Confidence"), red badge for <50 ("Low Confidence")
3. THE Intelligence_System SHALL display the prediction as a range: "Predicted Final Price: ₦{lowerBound} - ₦{upperBound}" with the predictedPrice shown as the midpoint
4. THE Intelligence_System SHALL show the number of similar historical auctions used: "Based on {similarAuctionCount} similar auctions"
5. WHEN fallbackMethod is 'salvage_value' or 'market_value_calculation', THE Intelligence_System SHALL display a warning badge: "Limited Data - Estimate Only"
6. THE Intelligence_System SHALL provide a "How is this calculated?" expandable section explaining the prediction methodology in simple terms
7. THE Intelligence_System SHALL update the prediction in real-time via Socket.IO when auctions.currentBid changes significantly (>10%) without page refresh
8. THE Intelligence_System SHALL optimize for mobile PWA with responsive design: prediction card collapses to compact view on screens <768px width

### Requirement 42: Vendor UI - Personalized Recommendation Feed

**User Story:** As a vendor, I want to see a "For You" feed of personalized auction recommendations, so that I can quickly find auctions matching my interests without browsing all listings.

#### Acceptance Criteria

1. THE Intelligence_System SHALL add a new tab "For You" on the vendor auctions page (src/app/(dashboard)/vendor/auctions/page.tsx) alongside the existing "All Auctions" tab
2. THE Intelligence_System SHALL display recommended auctions in a vertical scrollable list with each card showing: auction thumbnail, asset details (make/model/year), matchScore as a percentage, reasonCodes as tags, and predictedPrice range
3. THE Intelligence_System SHALL display matchScore visually using a progress bar or percentage badge: "95% Match" with color gradient (green for >80%, yellow for 60-80%, gray for <60%)
4. THE Intelligence_System SHALL display reasonCodes as small tags below the auction title: "Similar to your bids", "Matches your categories", "Trending"
5. THE Intelligence_System SHALL implement infinite scroll or pagination (10 recommendations per page) for mobile PWA performance
6. WHEN a Vendor clicks on a recommended auction, THE Intelligence_System SHALL record recommendations.clicked=true and recommendations.clickedAt=NOW()
7. WHEN a Vendor places a bid on a recommended auction, THE Intelligence_System SHALL record recommendations.bidPlaced=true
8. THE Intelligence_System SHALL show a "No recommendations yet" empty state for new vendors with message: "Start bidding to get personalized recommendations" and a link to "All Auctions"
9. THE Intelligence_System SHALL update the "For You" feed in real-time via Socket.IO when new high-match auctions (matchScore > 90) are created
10. THE Intelligence_System SHALL provide a "Refresh Recommendations" button that calls GET /api/vendors/{id}/recommendations to regenerate the feed

### Requirement 43: Admin UI - Intelligence Dashboard

**User Story:** As an administrator, I want a dashboard to monitor intelligence system performance, fraud alerts, and algorithm accuracy, so that I can ensure the system is operating correctly and take action on fraud.

#### Acceptance Criteria

1. THE Intelligence_System SHALL create a new admin page at src/app/(dashboard)/admin/intelligence/page.tsx displaying real-time intelligence metrics
2. THE Intelligence_System SHALL display prediction accuracy metrics in a card: meanPercentageError, totalPredictions (last 7 days), accuracyTrend (up/down arrow with percentage change)
3. THE Intelligence_System SHALL display recommendation effectiveness metrics in a card: clickThroughRate, bidConversionRate, totalRecommendations (last 7 days), engagementTrend
4. THE Intelligence_System SHALL display fraud alerts in a table with columns: entityType, entityId (clickable link to entity), riskScore (color-coded: red >75, yellow 50-75, gray <50), flagReasons (comma-separated), status, createdAt
5. THE Intelligence_System SHALL provide action buttons on each fraud alert: "Review" (opens detail modal), "Dismiss" (sets status='dismissed'), "Confirm Fraud" (sets status='confirmed' and increments vendors.performanceStats.fraudFlags)
6. THE Intelligence_System SHALL display system health indicators: API response times (p50, p95, p99), error rate (last hour), cache hit rate, materialized view last refresh time
7. THE Intelligence_System SHALL provide a "Configure Algorithms" button that opens a modal for editing algorithm_config table parameters with validation
8. THE Intelligence_System SHALL display a line chart showing prediction accuracy trend over the past 30 days grouped by salvageCases.assetType
9. THE Intelligence_System SHALL display a bar chart showing recommendation matchScore distribution (0-20, 20-40, 40-60, 60-80, 80-100) to detect bias
10. THE Intelligence_System SHALL restrict access to /admin/intelligence page to users where users.role IN ('admin', 'manager') using NextAuth middleware

### Requirement 44: Admin UI - Fraud Alert Detail Modal

**User Story:** As an administrator reviewing a fraud alert, I want to see detailed evidence and context, so that I can make an informed decision about whether fraud occurred.

#### Acceptance Criteria

1. WHEN an administrator clicks "Review" on a fraud alert, THE Intelligence_System SHALL open a modal displaying full fraud alert details
2. THE Intelligence_System SHALL display the fraud alert summary: entityType, entityId, riskScore (large number with color), flagReasons (bulleted list), createdAt
3. WHEN entityType='vendor', THE Intelligence_System SHALL display vendor details: vendors.businessName, vendors.rating, vendors.performanceStats (totalBids, totalWins, winRate, fraudFlags), vendors.tier, vendors.status
4. WHEN entityType='case', THE Intelligence_System SHALL display case details: salvageCases.claimReference, salvageCases.assetDetails, salvageCases.photos (thumbnail gallery), salvageCases.createdBy (adjuster name), salvageCases.aiAssessment.damagedParts
5. WHEN flagReasons includes 'duplicate_photos', THE Intelligence_System SHALL display side-by-side comparison of the duplicate photos with Hamming distance and matching case references
6. WHEN flagReasons includes 'vendor_adjuster_collusion', THE Intelligence_System SHALL display a table of auctions won by this vendor from the specific adjuster with columns: auctionId, finalPrice, estimatedSalvageValue, priceDeviation (percentage), bidTiming (minutes before close)
7. THE Intelligence_System SHALL provide action buttons in the modal: "Dismiss Alert" (sets status='dismissed'), "Confirm Fraud" (sets status='confirmed'), "Suspend Vendor" (sets vendors.status='suspended'), "Flag for Investigation" (creates task for fraud team)
8. THE Intelligence_System SHALL log all fraud alert actions to auditLogs with actionType='fraud_alert_reviewed', entityType='fraud_alert', entityId=fraud_alerts.id, and metadata containing the action taken and reviewedBy userId

### Requirement 45: Vendor UI - Prediction Explanation Modal

**User Story:** As a vendor, I want to understand how the price prediction was calculated, so that I can trust the system and make informed bidding decisions.

#### Acceptance Criteria

1. WHEN a Vendor clicks "How is this calculated?" on a prediction card, THE Intelligence_System SHALL open a modal displaying the prediction calculation breakdown
2. THE Intelligence_System SHALL display the prediction methodology: "We analyzed {similarAuctionCount} similar auctions from the past {timeWindow} months"
3. THE Intelligence_System SHALL display the similarity criteria used: "Matched on: Make ({assetDetails.make}), Model ({assetDetails.model}), Year (±2 years), Damage Severity ({damageSeverity})"
4. THE Intelligence_System SHALL display market condition adjustments: "Market Adjustment: +{adjustmentPercentage}% (High competition detected)" or "Market Adjustment: -{adjustmentPercentage}% (Low competition detected)"
5. THE Intelligence_System SHALL display confidence factors: "Confidence Score: {confidenceScore}/100 based on: Sample size ({similarAuctionCount} auctions), Data recency (average {avgDaysAgo} days old), Price variance ({variancePercentage}%)"
6. WHEN fallbackMethod is not 'historical', THE Intelligence_System SHALL display fallback explanation: "Insufficient historical data. Prediction based on {fallbackMethod}" with description of the fallback method used
7. THE Intelligence_System SHALL provide a "View Similar Auctions" button that displays a list of the similar historical auctions used (limited to top 5) with their finalPrice, endTime, and assetDetails
8. THE Intelligence_System SHALL optimize the modal for mobile PWA with scrollable content and touch-friendly close button

### Requirement 46: Mobile PWA - Offline Prediction Caching

**User Story:** As a vendor using the mobile PWA offline, I want to access recently viewed predictions, so that I can review auction information without an internet connection.

#### Acceptance Criteria

1. THE Intelligence_System SHALL cache prediction responses in the service worker (public/sw.js) using Cache API with cache name 'intelligence-predictions-v1'
2. THE Intelligence_System SHALL set cache TTL to 5 minutes by storing cacheTimestamp in the cached response and validating on retrieval
3. WHEN a Vendor is offline and requests a prediction, THE Intelligence_System SHALL return the cached prediction with an "Offline Mode" badge and "Last Updated: {timestamp}" indicator
4. THE Intelligence_System SHALL cache up to 50 most recent predictions per vendor to limit storage usage (approximately 50KB total)
5. THE Intelligence_System SHALL implement cache eviction using LRU (Least Recently Used) strategy when cache size exceeds 50 predictions
6. WHEN the Vendor reconnects to the network, THE Intelligence_System SHALL automatically refresh cached predictions that are older than 5 minutes using Background Sync API
7. THE Intelligence_System SHALL display a "Refresh" button on cached predictions allowing manual refresh when online

### Requirement 47: Mobile PWA - Recommendation Feed Optimization

**User Story:** As a vendor using the mobile PWA, I want the "For You" feed to load quickly and work offline, so that I can browse recommendations on slow networks or without connectivity.

#### Acceptance Criteria

1. THE Intelligence_System SHALL implement progressive loading for the "For You" feed: load first 5 recommendations immediately, then load remaining 15 in background
2. THE Intelligence_System SHALL cache the recommendation feed in the service worker with cache name 'intelligence-recommendations-v1' and 15-minute TTL
3. THE Intelligence_System SHALL reduce API payload size for mobile by excluding verbose fields: remove calculation breakdowns, limit reasonCodes to top 3, exclude metadata
4. THE Intelligence_System SHALL use lazy loading for auction thumbnail images in the recommendation feed with placeholder images while loading
5. WHEN a Vendor is offline, THE Intelligence_System SHALL display cached recommendations with "Offline Mode" badge and disable the "Refresh Recommendations" button
6. THE Intelligence_System SHALL implement pull-to-refresh gesture on mobile for manually refreshing the recommendation feed
7. THE Intelligence_System SHALL show loading skeleton UI while fetching recommendations (3 skeleton cards) instead of blank screen
8. THE Intelligence_System SHALL optimize recommendation card rendering for 60fps scrolling on mobile devices by using CSS transforms and avoiding layout thrashing

### Requirement 48: Admin UI - Algorithm Configuration Panel

**User Story:** As an administrator, I want to adjust algorithm parameters through a UI, so that I can tune the system without code changes or database access.

#### Acceptance Criteria

1. THE Intelligence_System SHALL create an admin page at src/app/(dashboard)/admin/intelligence/config/page.tsx for algorithm configuration management
2. THE Intelligence_System SHALL display current algorithm_config values in a form with fields: similarityThreshold (slider 0-100), collaborativeFilteringWeight (slider 0-100), contentBasedFilteringWeight (slider 0-100), confidenceBaseScore (slider 0-100), timeDecayDays (number input)
3. THE Intelligence_System SHALL validate configuration changes: collaborativeFilteringWeight + contentBasedFilteringWeight must equal 100, all values must be within valid ranges
4. THE Intelligence_System SHALL display a "Preview Impact" button that calls POST /api/intelligence/test/predict with current config vs new config and shows side-by-side comparison
5. THE Intelligence_System SHALL require confirmation modal before saving config changes with warning: "This will affect all predictions and recommendations. Continue?"
6. THE Intelligence_System SHALL log all config changes to auditLogs with actionType='intelligence_config_updated', beforeState (old config), afterState (new config), and userId
7. THE Intelligence_System SHALL display config change history table showing: configKey, oldValue, newValue, updatedBy (user name), updatedAt, with pagination (20 records per page)
8. THE Intelligence_System SHALL provide "Reset to Defaults" button that restores algorithm_config to default values with confirmation prompt

### Requirement 49: Vendor UI - Real-Time Prediction Updates

**User Story:** As a vendor watching an active auction, I want the price prediction to update automatically when new bids are placed, so that I have current information without refreshing the page.

#### Acceptance Criteria

1. WHEN a Vendor is viewing an auction details page, THE Intelligence_System SHALL subscribe to Socket.IO room 'auction:{auctionId}' using the existing useSocket hook
2. WHEN a new bid is placed and auctions.currentBid changes by >10%, THE Intelligence_System SHALL emit 'prediction:updated' Socket.IO event with new prediction data
3. THE Intelligence_System SHALL update the prediction card UI automatically when 'prediction:updated' event is received without page refresh
4. THE Intelligence_System SHALL animate the prediction update with a subtle fade transition (300ms) to draw attention to the change
5. THE Intelligence_System SHALL display a "Updated just now" timestamp indicator that fades after 5 seconds
6. THE Intelligence_System SHALL throttle prediction recalculations to maximum once per minute per auction to avoid excessive database queries
7. THE Intelligence_System SHALL show a loading spinner on the prediction card while recalculation is in progress (typically <200ms)

### Requirement 50: Admin UI - Fraud Alert Notifications

**User Story:** As an administrator, I want to receive real-time notifications when high-risk fraud is detected, so that I can take immediate action to prevent losses.

#### Acceptance Criteria

1. WHEN fraud_alerts.riskScore > 75 is created, THE Intelligence_System SHALL emit 'fraud:alert' Socket.IO event to all connected admin users using getSocketServer().to('role:admin').emit()
2. THE Intelligence_System SHALL display a toast notification in the admin UI with message: "High-risk fraud detected: {entityType} {entityId}" and "Review Now" button
3. THE Intelligence_System SHALL play a notification sound (optional, user can disable in settings) when fraud alert is received
4. THE Intelligence_System SHALL display a red badge on the admin navigation menu item "Intelligence" showing the count of unreviewed fraud alerts (status='pending')
5. THE Intelligence_System SHALL persist fraud alert notifications in browser localStorage so they remain visible after page refresh until reviewed
6. THE Intelligence_System SHALL provide a "Mark All as Reviewed" button on the intelligence dashboard that sets all pending fraud_alerts to status='reviewed'
7. THE Intelligence_System SHALL limit toast notifications to maximum 3 visible at once, queuing additional notifications with 5-second delay between each

### Requirement 51: Vendor UI - Recommendation Reason Explanation

**User Story:** As a vendor, I want to understand why specific auctions are recommended to me, so that I can trust the recommendations and discover new opportunities.

#### Acceptance Criteria

1. THE Intelligence_System SHALL display reasonCodes as small colored tags on each recommendation card: blue for "Similar to your bids", green for "Matches your categories", orange for "Trending", purple for "High win rate in this category"
2. WHEN a Vendor hovers over or taps a reasonCode tag, THE Intelligence_System SHALL display a tooltip explaining the reason in detail: "You've bid on 5 similar {assetType} auctions in the past 3 months"
3. THE Intelligence_System SHALL limit reasonCodes display to top 3 reasons per recommendation to avoid UI clutter
4. THE Intelligence_System SHALL provide a "Why this recommendation?" link that opens a modal with full explanation including: matchScore breakdown (collaborative: X%, content-based: Y%), similar auctions you've bid on (list of 3), and your bidding pattern summary
5. THE Intelligence_System SHALL display the recommendation freshness: "Recommended {timeAgo}" (e.g., "2 minutes ago", "1 hour ago")
6. THE Intelligence_System SHALL show a "Not Interested" button on each recommendation that removes it from the feed and records negative feedback for algorithm improvement

### Requirement 52: Admin UI - Data Export Interface

**User Story:** As an administrator, I want to export intelligence data through a UI, so that I can analyze algorithm performance and prepare datasets for ML training without using API endpoints directly.

#### Acceptance Criteria

1. THE Intelligence_System SHALL create an admin page at src/app/(dashboard)/admin/intelligence/export/page.tsx for data export management
2. THE Intelligence_System SHALL provide a form with fields: dataType (dropdown: 'predictions'/'recommendations'/'interactions'/'fraud_alerts'), dateRange (date picker: start and end dates), format (radio: 'CSV'/'JSON'), includeAnonymized (checkbox: default true)
3. THE Intelligence_System SHALL validate date range: endDate must be after startDate, maximum range is 90 days to prevent excessive data exports
4. WHEN the administrator clicks "Generate Export", THE Intelligence_System SHALL call GET /api/intelligence/export with query parameters and display a loading spinner
5. THE Intelligence_System SHALL display export progress: "Generating export... {recordCount} records processed" with progress bar
6. WHEN export is complete, THE Intelligence_System SHALL provide a "Download" button that triggers browser download of the generated file with filename: intelligence-{dataType}-{startDate}-{endDate}.{format}
7. THE Intelligence_System SHALL display export history table showing: dataType, dateRange, recordCount, fileSize, generatedBy (user name), generatedAt, with "Download Again" button for recent exports (last 7 days)
8. THE Intelligence_System SHALL log all export operations to auditLogs with actionType='intelligence_data_exported', metadata containing dataType, dateRange, recordCount, and userId

### Requirement 53: Vendor UI - Prediction Accuracy Feedback

**User Story:** As a vendor who won an auction, I want to provide feedback on prediction accuracy, so that the system can learn and improve over time.

#### Acceptance Criteria

1. WHEN an auction closes and a Vendor was the winner (auctions.currentBidder = vendorId), THE Intelligence_System SHALL display a feedback prompt on the auction details page: "Was the price prediction accurate?"
2. THE Intelligence_System SHALL provide feedback options: "Very Accurate" (±5%), "Somewhat Accurate" (±15%), "Not Accurate" (>15%), "I didn't use the prediction"
3. WHEN a Vendor submits feedback, THE Intelligence_System SHALL store it in prediction_feedback table with columns: id, predictionId, vendorId, feedbackType, actualPrice, predictedPrice, deviation, comments (optional text), createdAt
4. THE Intelligence_System SHALL use prediction_feedback data to calibrate confidence scores: if "Not Accurate" feedback rate >20% for a specific assetType, reduce confidenceScore by 10% for that assetType
5. THE Intelligence_System SHALL display aggregate feedback stats on the admin intelligence dashboard: "Vendor Feedback: 75% found predictions accurate"
6. THE Intelligence_System SHALL send a thank you message after feedback submission: "Thanks for your feedback! This helps us improve predictions for everyone."

### Requirement 54: Mobile PWA - Touch-Optimized Interactions

**User Story:** As a vendor using the mobile PWA, I want touch-friendly interactions for intelligence features, so that I can easily navigate predictions and recommendations on my phone.

#### Acceptance Criteria

1. THE Intelligence_System SHALL implement swipe gestures on recommendation cards: swipe left to dismiss ("Not Interested"), swipe right to save for later
2. THE Intelligence_System SHALL use minimum touch target size of 44x44px for all interactive elements (buttons, links, tags) following mobile accessibility guidelines
3. THE Intelligence_System SHALL implement pull-to-refresh gesture on the "For You" feed to reload recommendations
4. THE Intelligence_System SHALL use bottom sheet modals instead of center modals on mobile for better thumb reachability (prediction explanation, recommendation details)
5. THE Intelligence_System SHALL implement haptic feedback (vibration) when swipe gestures are completed successfully (requires Vibration API)
6. THE Intelligence_System SHALL use large, readable font sizes: prediction price (24px), confidence score (16px), reason codes (14px) for mobile readability
7. THE Intelligence_System SHALL implement sticky header on the "For You" feed showing filter options (All/Vehicles/Electronics/Machinery) that remains visible while scrolling

### Requirement 55: Admin UI - Algorithm Performance Comparison

**User Story:** As an administrator running A/B tests, I want to compare performance between algorithm versions, so that I can determine which version to promote to production.

#### Acceptance Criteria

1. THE Intelligence_System SHALL create an admin page at src/app/(dashboard)/admin/intelligence/ab-testing/page.tsx for algorithm version comparison
2. THE Intelligence_System SHALL display a dropdown to select two algorithm versions to compare from algorithm_config.version
3. THE Intelligence_System SHALL display side-by-side comparison metrics: prediction accuracy (meanPercentageError), recommendation CTR, recommendation bidConversionRate, avgResponseTime, errorRate
4. THE Intelligence_System SHALL display a line chart comparing prediction accuracy over time for both versions with different colored lines
5. THE Intelligence_System SHALL display vendor distribution: "Version A: {vendorCount} vendors ({percentage}%), Version B: {vendorCount} vendors ({percentage}%)"
6. THE Intelligence_System SHALL provide a "Promote to Production" button that updates algorithm_config to set the selected version as the default for all vendors
7. THE Intelligence_System SHALL display statistical significance indicator: "Results are statistically significant (p < 0.05)" or "More data needed for significance" based on sample size and variance
8. THE Intelligence_System SHALL log all version promotions to auditLogs with actionType='algorithm_version_promoted', metadata containing oldVersion, newVersion, performanceMetrics, and userId

### Requirement 56: Asset Performance Analytics Collection

**User Story:** As a data analyst, I want granular asset performance data collected automatically, so that I can identify which makes, models, years, and conditions sell best and train ML models for price prediction.

#### Acceptance Criteria

1. THE Intelligence_System SHALL create an asset_performance_analytics table with columns: id (uuid), assetType (varchar), make (varchar), model (varchar), year (integer), color (varchar nullable), condition (varchar), damageSeverity (varchar), avgFinalPrice (numeric), avgBidCount (integer), avgTimeToSell (interval), winRate (decimal), competitionLevel (varchar), sampleSize (integer), lastUpdated (timestamp)
2. WHEN an auction closes (status='closed'), THE Intelligence_System SHALL update asset_performance_analytics by aggregating data from auctions, salvageCases, and bids tables grouped by assetType → make → model → year → condition → damageSeverity
3. THE Intelligence_System SHALL calculate avgFinalPrice as AVG(auctions.currentBid) for closed auctions matching the asset attributes
4. THE Intelligence_System SHALL calculate avgBidCount as AVG(COUNT(bids)) per auction for the asset group
5. THE Intelligence_System SHALL calculate avgTimeToSell as AVG(auctions.endTime - auctions.startTime) for closed auctions
6. THE Intelligence_System SHALL calculate winRate as (COUNT(auctions with bids) / COUNT(all auctions)) * 100 for the asset group
7. THE Intelligence_System SHALL calculate competitionLevel as 'high' (avgBidCount > 10), 'medium' (5-10), or 'low' (<5)
8. THE Intelligence_System SHALL track sampleSize (number of closed auctions) to indicate statistical reliability
9. THE Intelligence_System SHALL create indexes: idx_asset_performance_type_make_model, idx_asset_performance_avg_price, idx_asset_performance_last_updated
10. THE Intelligence_System SHALL update asset_performance_analytics daily using a background job that processes auctions closed in the last 24 hours

### Requirement 57: Temporal Pattern Analytics Collection

**User Story:** As a data scientist, I want detailed temporal pattern data, so that I can identify when vendors bid most, when auctions close with highest prices, and train ML models to predict optimal auction timing.

#### Acceptance Criteria

1. THE Intelligence_System SHALL create a temporal_patterns table with columns: id (uuid), patternType (enum: 'hourly'/'daily'/'weekly'/'monthly'/'seasonal'), timeSegment (varchar), assetType (varchar nullable), avgBidCount (integer), avgFinalPrice (numeric), avgVendorActivity (integer), conversionRate (decimal), peakActivityScore (integer 0-100), sampleSize (integer), lastUpdated (timestamp)
2. THE Intelligence_System SHALL track hourly patterns by analyzing EXTRACT(HOUR FROM bids.createdAt) to identify when vendors bid most actively
3. THE Intelligence_System SHALL track daily patterns by analyzing EXTRACT(DOW FROM auctions.endTime) to identify which days have highest final prices
4. THE Intelligence_System SHALL track monthly patterns by analyzing EXTRACT(MONTH FROM auctions.endTime) to identify seasonal trends per assetType
5. THE Intelligence_System SHALL calculate avgVendorActivity as COUNT(DISTINCT vendors.id) with bids during the time segment
6. THE Intelligence_System SHALL calculate conversionRate as (COUNT(auctions with winner) / COUNT(all auctions)) * 100 for the time segment
7. THE Intelligence_System SHALL calculate peakActivityScore by comparing activity in the time segment to overall average: score = min(100, (segmentActivity / avgActivity) * 50)
8. THE Intelligence_System SHALL track time_to_first_bid as AVG(MIN(bids.createdAt) - auctions.startTime) per auction
9. THE Intelligence_System SHALL track time_to_final_bid as AVG(MAX(bids.createdAt) - auctions.startTime) per auction
10. THE Intelligence_System SHALL update temporal_patterns daily using a background job that analyzes the past 90 days of auction and bid data

### Requirement 58: Geographic Pattern Analytics Collection

**User Story:** As a business analyst, I want geographic pattern data, so that I can identify regional preferences, understand distance impact on bidding, and optimize marketplace operations by location.

#### Acceptance Criteria

1. THE Intelligence_System SHALL create a geographic_patterns table with columns: id (uuid), locationId (varchar), locationName (varchar), region (varchar), caseCount (integer), vendorCount (integer), avgFinalPrice (numeric), topAssetTypes (jsonb array), regionalPreferences (jsonb), avgDistanceTraveled (numeric), distanceImpactScore (decimal), lastUpdated (timestamp)
2. THE Intelligence_System SHALL extract location data from salvageCases.gpsLocation (latitude, longitude) and group by city/region using reverse geocoding or predefined location mapping
3. THE Intelligence_System SHALL calculate caseCount as COUNT(salvageCases) per location
4. THE Intelligence_System SHALL calculate vendorCount as COUNT(DISTINCT vendors.id) who bid on auctions in the location
5. THE Intelligence_System SHALL identify topAssetTypes as the top 5 assetTypes by auction volume in the location stored as jsonb array: [{"assetType": "vehicle", "count": 150, "percentage": 45}]
6. THE Intelligence_System SHALL calculate regionalPreferences by comparing local avgFinalPrice to national average per assetType: {"vehicle": +15%, "electronics": -5%}
7. THE Intelligence_System SHALL calculate avgDistanceTraveled by computing ST_Distance(salvageCases.gpsLocation, vendors.location) for winning bids
8. THE Intelligence_System SHALL calculate distanceImpactScore by analyzing correlation between distance and bid amount: negative score indicates distance reduces bids
9. THE Intelligence_System SHALL track cross-region bidding patterns: vendors from Region A bidding on auctions in Region B
10. THE Intelligence_System SHALL update geographic_patterns weekly using a background job that analyzes closed auctions from the past 6 months


### Requirement 59: Vendor Behavioral Segmentation Analytics

**User Story:** As a data scientist, I want detailed vendor behavioral segmentation data, so that I can identify distinct vendor personas, understand their preferences, and train ML models for personalized recommendations.

#### Acceptance Criteria

1. THE Intelligence_System SHALL create a vendor_segments table with columns: id (uuid), vendorId (uuid), segmentType (enum: 'bargain_hunter'/'premium_buyer'/'specialist'/'generalist'/'active_bidder'/'selective_bidder'/'new_vendor'/'dormant_vendor'), confidenceScore (integer 0-100), segmentAttributes (jsonb), assignedAt (timestamp), lastUpdated (timestamp)
2. THE Intelligence_System SHALL calculate Bargain Hunter segment: vendors where AVG(bids.amount) < market average for their preferred assetType AND vendors.performanceStats.winRate > 40%
3. THE Intelligence_System SHALL calculate Premium Buyer segment: vendors where AVG(bids.amount) > market average * 1.5 AND AVG(auctions.currentBid for won auctions) > 500000
4. THE Intelligence_System SHALL calculate Specialist segment: vendors where >70% of bids are in a single assetType AND vendors.performanceStats.totalBids > 10
5. THE Intelligence_System SHALL calculate Generalist segment: vendors with bids across 3+ assetTypes AND relatively even distribution (no single assetType > 50% of bids)
6. THE Intelligence_System SHALL calculate Active Bidder segment: vendors with totalBids > 20 in last 90 days AND AVG(days between bids) < 7
7. THE Intelligence_System SHALL calculate Selective Bidder segment: vendors with totalBids < 5 in last 90 days AND AVG(bids.amount) > market average (indicating careful selection)
8. THE Intelligence_System SHALL store segmentAttributes as jsonb containing: avgBidAmount, preferredAssetTypes (array), preferredPriceRange (min/max), avgDaysBetweenBids, preferredDamageSeverity, preferredTimeOfDay (hour), preferredDayOfWeek
9. THE Intelligence_System SHALL update vendor_segments weekly using a background job that recalculates segments based on the past 6 months of bidding data
10. THE Intelligence_System SHALL allow vendors to belong to multiple segments simultaneously (e.g., both "Specialist" and "Premium Buyer")


### Requirement 60: Session Analytics and Engagement Tracking

**User Story:** As a product manager, I want detailed session analytics data, so that I can understand vendor engagement patterns, identify conversion bottlenecks, and optimize the user experience.

#### Acceptance Criteria

1. THE Intelligence_System SHALL create a session_analytics table with columns: id (uuid), sessionId (varchar unique), vendorId (uuid), startTime (timestamp), endTime (timestamp nullable), pageViews (integer), auctionsViewed (integer), auctionsBid (integer), searchQueries (integer), timeOnSite (interval), bounceRate (boolean), conversionType (enum: 'bid_placed'/'auction_won'/'no_conversion'), deviceType (varchar), ipAddress (varchar encrypted), referrerSource (varchar), exitPage (varchar), createdAt (timestamp)
2. THE Intelligence_System SHALL track session start when a vendor logs in or visits the marketplace, generating a unique sessionId using UUID
3. THE Intelligence_System SHALL track pageViews by incrementing the counter each time the vendor navigates to a new page within the session
4. THE Intelligence_System SHALL track auctionsViewed by recording each unique auction the vendor views during the session
5. THE Intelligence_System SHALL track auctionsBid by counting the number of distinct auctions the vendor placed bids on during the session
6. THE Intelligence_System SHALL calculate timeOnSite as (endTime - startTime) when the session ends (user logs out, session timeout after 30 minutes of inactivity, or browser close)
7. THE Intelligence_System SHALL calculate bounceRate as true if pageViews = 1 AND timeOnSite < 30 seconds, indicating the vendor left immediately
8. THE Intelligence_System SHALL determine conversionType: 'bid_placed' if auctionsBid > 0, 'auction_won' if vendor won an auction during session, 'no_conversion' otherwise
9. THE Intelligence_System SHALL track referrerSource from HTTP Referer header to identify traffic sources (direct, search engine, social media, email campaign)
10. THE Intelligence_System SHALL create indexes: idx_session_analytics_vendor_id, idx_session_analytics_start_time, idx_session_analytics_conversion_type


### Requirement 61: Conversion Funnel Analytics

**User Story:** As a product manager, I want conversion funnel analytics, so that I can identify where vendors drop off in the bidding process and optimize conversion rates.

#### Acceptance Criteria

1. THE Intelligence_System SHALL create a conversion_funnel table with columns: id (uuid), sessionId (varchar), vendorId (uuid), funnelStage (enum: 'marketplace_visit'/'auction_view'/'auction_watch'/'bid_intent'/'bid_placed'/'bid_won'), stageTimestamp (timestamp), timeInStage (interval nullable), nextStage (varchar nullable), dropped (boolean), dropReason (varchar nullable), metadata (jsonb), createdAt (timestamp)
2. THE Intelligence_System SHALL track marketplace_visit stage when vendor accesses the auctions page (src/app/(dashboard)/vendor/auctions/page.tsx)
3. THE Intelligence_System SHALL track auction_view stage when vendor clicks on an auction to view details
4. THE Intelligence_System SHALL track auction_watch stage when vendor adds an auction to their watchlist (auctions.watchingCount increment)
5. THE Intelligence_System SHALL track bid_intent stage when vendor clicks "Place Bid" button or opens bid modal
6. THE Intelligence_System SHALL track bid_placed stage when vendor successfully submits a bid (bids.createdAt)
7. THE Intelligence_System SHALL track bid_won stage when auction closes and vendor is the winner (auctions.currentBidder = vendorId AND status='closed')
8. THE Intelligence_System SHALL calculate timeInStage as the duration between current stage and next stage timestamps
9. THE Intelligence_System SHALL set dropped=true if vendor exits the funnel before bid_placed stage, with dropReason indicating the exit point
10. THE Intelligence_System SHALL calculate conversion rates: marketplace_visit → auction_view (%), auction_view → bid_placed (%), bid_placed → bid_won (%)


### Requirement 62: Granular Asset Attribute Performance Tracking

**User Story:** As a data scientist, I want granular asset attribute performance data (color, trim, storage, condition), so that I can train ML models that predict prices based on specific attributes beyond just make/model/year.

#### Acceptance Criteria

1. THE Intelligence_System SHALL extend asset_performance_analytics table with additional columns: trim (varchar nullable), color (varchar nullable), storage (varchar nullable), bodyStyle (varchar nullable), mileageRange (varchar nullable), conditionScore (integer nullable), avgDaysToSell (integer), pricePerAttribute (jsonb)
2. THE Intelligence_System SHALL extract trim from salvageCases.aiAssessment.itemDetails.trim when available (e.g., "LX", "EX", "Touring", "Limited")
3. THE Intelligence_System SHALL extract color from salvageCases.aiAssessment.itemDetails.color when available (e.g., "Black", "White", "Silver", "Red")
4. THE Intelligence_System SHALL extract storage from salvageCases.aiAssessment.itemDetails.storage for electronics (e.g., "64GB", "128GB", "256GB", "512GB")
5. THE Intelligence_System SHALL extract bodyStyle from salvageCases.aiAssessment.itemDetails.bodyStyle for vehicles (e.g., "Sedan", "SUV", "Truck", "Coupe")
6. THE Intelligence_System SHALL calculate mileageRange by grouping salvageCases.vehicleMileage into ranges: "0-50k", "50k-100k", "100k-150k", "150k-200k", "200k+"
7. THE Intelligence_System SHALL calculate conditionScore from salvageCases.aiAssessment.itemDetails.overallCondition mapped to numeric: "Excellent"=90, "Good"=75, "Fair"=50, "Poor"=25
8. THE Intelligence_System SHALL calculate avgDaysToSell as AVG(auctions.endTime - auctions.startTime) for closed auctions with the specific attribute combination
9. THE Intelligence_System SHALL store pricePerAttribute as jsonb containing price impact analysis: {"color": {"Black": +5%, "White": +3%, "Red": -2%}, "trim": {"Limited": +15%, "LX": 0%}}
10. THE Intelligence_System SHALL aggregate data at multiple granularity levels: make-only, make+model, make+model+year, make+model+year+trim, make+model+year+trim+color for flexible querying


### Requirement 63: Dynamic Schema Evolution for New Asset Types

**User Story:** As the platform evolves, I want the analytics system to automatically detect and track new asset types and attributes, so that data collection adapts without manual schema changes.

#### Acceptance Criteria

1. THE Intelligence_System SHALL create a schema_evolution_log table with columns: id (uuid), entityType (enum: 'asset_type'/'asset_attribute'/'damage_type'), detectedValue (varchar), firstSeenAt (timestamp), occurrenceCount (integer), adoptionRate (decimal), status (enum: 'detected'/'validated'/'integrated'), integratedAt (timestamp nullable), metadata (jsonb)
2. THE Intelligence_System SHALL monitor salvageCases.assetType for new values not in the existing assetTypeEnum ('vehicle', 'property', 'electronics', 'machinery')
3. WHEN a new assetType is detected (e.g., "jewelry", "artwork", "industrial_equipment"), THE Intelligence_System SHALL create a schema_evolution_log entry with status='detected'
4. THE Intelligence_System SHALL monitor salvageCases.aiAssessment.itemDetails for new attribute keys not previously tracked (e.g., "gemType" for jewelry, "artistName" for artwork)
5. WHEN a new attribute appears in >10 cases within 30 days, THE Intelligence_System SHALL update status='validated' and calculate adoptionRate = (casesWithAttribute / totalCases) * 100
6. THE Intelligence_System SHALL automatically create new columns in asset_performance_analytics for validated attributes using ALTER TABLE with nullable columns
7. THE Intelligence_System SHALL emit 'schema:evolution_detected' Socket.IO event to admin users when new asset types or attributes reach validation threshold
8. THE Intelligence_System SHALL provide a POST endpoint /api/intelligence/admin/schema/approve that allows admins to manually approve or reject detected schema changes
9. THE Intelligence_System SHALL track occurrenceCount by incrementing each time the new value appears in salvageCases
10. THE Intelligence_System SHALL store metadata as jsonb containing: sampleCaseIds (array of 5 example cases), attributeDataType (string/number/boolean), suggestedIndexes (array)


### Requirement 64: ML Training Dataset Export with Feature Engineering

**User Story:** As a data scientist, I want to export comprehensive ML training datasets with engineered features, so that I can train advanced machine learning models for price prediction, recommendation, and fraud detection.

#### Acceptance Criteria

1. THE Intelligence_System SHALL create an ml_datasets table with columns: id (uuid), datasetName (varchar), datasetType (enum: 'price_prediction'/'recommendation'/'fraud_detection'/'vendor_segmentation'), recordCount (integer), featureCount (integer), targetVariable (varchar), dateRange (jsonb), exportFormat (enum: 'csv'/'parquet'/'json'), fileUrl (varchar), fileSize (bigint), generatedBy (uuid), generatedAt (timestamp), expiresAt (timestamp)
2. THE Intelligence_System SHALL provide a POST endpoint /api/intelligence/ml/export that accepts parameters: datasetType, dateRange (start/end), includeFeatures (array), targetVariable, format, samplingRate (0.0-1.0)
3. FOR price_prediction datasets, THE Intelligence_System SHALL include features: assetType, make, model, year, trim, color, mileageRange, damageSeverity, damagedPartsCount, structuralDamageScore, cosmeticDamageScore, marketValue, estimatedSalvageValue, reservePrice, auctionDuration, startHour, startDayOfWeek, competitionLevel, seasonalityIndex, regionalPriceIndex, vendorActivityScore, TARGET: finalPrice (auctions.currentBid)
4. FOR recommendation datasets, THE Intelligence_System SHALL include features: vendorSegment, avgBidAmount, preferredAssetTypes, bidFrequency, winRate, avgTimeOnSite, sessionCount, auctionViewsPerSession, assetType, make, model, priceRange, damageSeverity, matchScore, reasonCodes, TARGET: clicked (boolean), bidPlaced (boolean)
5. FOR fraud_detection datasets, THE Intelligence_System SHALL include features: vendorAge (days since registration), bidVelocity (bids per hour), consecutiveBids, ipAddressChanges, deviceTypeChanges, bidTimingPattern, winRateDeviation, priceDeviationFromMarket, adjusterCollaborationScore, photoHashSimilarity, TARGET: fraudConfirmed (boolean from fraud_alerts)
6. THE Intelligence_System SHALL perform feature engineering: one-hot encoding for categorical variables (assetType, damageSeverity), normalization for numeric variables (prices, scores), temporal features (hour, dayOfWeek, month, isWeekend), interaction features (make_model, year_mileage)
7. THE Intelligence_System SHALL split datasets into train/validation/test sets with 70/15/15 ratio and include split indicator column
8. THE Intelligence_System SHALL include a data dictionary JSON file with each export containing: feature names, data types, descriptions, value ranges, encoding mappings, missing value handling strategy
9. THE Intelligence_System SHALL anonymize PII: replace vendorId with anonymousVendorId (SHA256 hash), remove ipAddress, remove users.email/phone, replace users.fullName with "Vendor_{hash}"
10. THE Intelligence_System SHALL store exported datasets in cloud storage (Google Cloud Storage) with signed URLs valid for 7 days, then automatically delete files


### Requirement 65: Enhanced Prediction Algorithm with Granular Attributes

**User Story:** As a vendor, I want price predictions that consider specific attributes like color, trim, and mileage, so that I receive more accurate estimates tailored to the exact asset configuration.

#### Acceptance Criteria

1. THE Prediction_Engine SHALL enhance similarity matching to include salvageCases.aiAssessment.itemDetails.trim with exact match weight=15%, fuzzy match weight=5%
2. THE Prediction_Engine SHALL enhance similarity matching to include salvageCases.aiAssessment.itemDetails.color with exact match weight=10%
3. THE Prediction_Engine SHALL enhance similarity matching to include salvageCases.vehicleMileage with range matching: ±10k miles weight=20%, ±25k miles weight=10%, ±50k miles weight=5%
4. THE Prediction_Engine SHALL enhance similarity matching to include salvageCases.aiAssessment.itemDetails.bodyStyle with exact match weight=15%
5. THE Prediction_Engine SHALL query asset_performance_analytics.pricePerAttribute to apply attribute-specific price adjustments: if color="Black" and pricePerAttribute.color.Black=+5%, adjust predictedPrice upward by 5%
6. THE Prediction_Engine SHALL calculate attribute completeness score: (number of available attributes / total possible attributes) * 100, and adjust confidenceScore proportionally
7. THE Prediction_Engine SHALL use multi-level fallback: first try exact match on all attributes, then relax trim requirement, then relax color requirement, then relax mileage range, finally fallback to make+model+year only
8. THE Prediction_Engine SHALL store attributeMatchLevel in predictions table metadata: "exact_match", "partial_match_trim", "partial_match_color", "basic_match", "fallback"
9. THE Prediction_Engine SHALL display attribute-specific insights in prediction explanation: "Similar Black Toyota Camry 2020 Limited with 50k-75k miles sold for ₦X-Y"
10. THE Prediction_Engine SHALL prioritize recent auctions with matching attributes: auctions with exact trim+color match from last 60 days get 2x weight vs older auctions


### Requirement 66: Enhanced Recommendation Algorithm with Behavioral Analytics

**User Story:** As a vendor, I want recommendations that consider my browsing behavior, session patterns, and engagement metrics, so that I receive highly personalized auction suggestions.

#### Acceptance Criteria

1. THE Recommendation_Engine SHALL incorporate session_analytics data: vendors with high avgTimeOnSite (>5 minutes) and low bounceRate get recommendations with higher complexity (more attributes to consider)
2. THE Recommendation_Engine SHALL incorporate conversion_funnel data: vendors who frequently reach bid_intent stage but don't complete (dropped=true at bid_intent) get recommendations for lower-competition auctions (watchingCount < 5)
3. THE Recommendation_Engine SHALL use vendor_segments.segmentAttributes.preferredTimeOfDay to boost matchScore by 10 points for auctions ending during vendor's preferred bidding hours
4. THE Recommendation_Engine SHALL use vendor_segments.segmentAttributes.preferredDayOfWeek to boost matchScore by 5 points for auctions ending on vendor's preferred days
5. THE Recommendation_Engine SHALL analyze interactions table to identify "view-but-not-bid" patterns: if vendor viewed similar auctions 3+ times without bidding, reduce matchScore for similar auctions by 15 points
6. THE Recommendation_Engine SHALL use session_analytics.searchQueries to extract search intent: if vendor searched for "Toyota Camry 2020", boost matchScore by 25 points for matching auctions
7. THE Recommendation_Engine SHALL calculate engagement_score = (auctionsViewed * 1) + (auctionsBid * 5) + (auctionWon * 10) from session_analytics, and use it to adjust recommendation diversity: high engagement gets more diverse recommendations
8. THE Recommendation_Engine SHALL track recommendation_feedback: when vendor clicks "Not Interested" on a recommendation, store negative feedback and reduce matchScore for similar auctions by 20 points
9. THE Recommendation_Engine SHALL use temporal_patterns data: if vendor typically bids during evening hours (18:00-22:00), prioritize auctions ending during those hours
10. THE Recommendation_Engine SHALL incorporate geographic_patterns: if vendor consistently bids on auctions within 50km radius, boost matchScore by 15 points for nearby auctions


### Requirement 67: Real-Time Analytics Aggregation Pipeline

**User Story:** As a data analyst, I want real-time analytics aggregations at multiple time granularities, so that I can analyze trends at hourly, daily, weekly, and monthly levels without expensive queries.

#### Acceptance Criteria

1. THE Intelligence_System SHALL create an analytics_aggregations table with columns: id (uuid), aggregationType (enum: 'hourly'/'daily'/'weekly'/'monthly'), aggregationKey (varchar), timeWindow (timestamp), metrics (jsonb), dimensionBreakdown (jsonb), sampleSize (integer), computedAt (timestamp), expiresAt (timestamp)
2. THE Intelligence_System SHALL compute hourly aggregations every hour using a background job that processes data from the past hour
3. THE Intelligence_System SHALL compute daily aggregations at 00:00 UTC using a background job that processes data from the previous day
4. THE Intelligence_System SHALL compute weekly aggregations every Monday at 00:00 UTC processing data from the previous week (Monday-Sunday)
5. THE Intelligence_System SHALL compute monthly aggregations on the 1st of each month at 00:00 UTC processing data from the previous month
6. THE Intelligence_System SHALL store metrics as jsonb containing: totalAuctions, totalBids, avgFinalPrice, avgBidCount, totalVendors, activeVendors, conversionRate, avgTimeToSell, competitionLevel
7. THE Intelligence_System SHALL store dimensionBreakdown as jsonb containing breakdowns by: assetType, damageSeverity, priceRange, region, vendorSegment
8. THE Intelligence_System SHALL set expiresAt to 90 days for hourly aggregations, 365 days for daily, 730 days for weekly, never expire for monthly
9. THE Intelligence_System SHALL create materialized views for common aggregation queries: mv_daily_asset_performance, mv_weekly_vendor_activity, mv_monthly_market_trends
10. THE Intelligence_System SHALL provide a GET endpoint /api/intelligence/analytics/aggregations that accepts parameters: aggregationType, dateRange, dimensions (array), metrics (array) and returns pre-computed aggregations


### Requirement 68: Vendor Engagement Metrics and Retention Analytics

**User Story:** As a product manager, I want detailed vendor engagement and retention metrics, so that I can identify at-risk vendors, measure platform stickiness, and optimize retention strategies.

#### Acceptance Criteria

1. THE Intelligence_System SHALL create a vendor_engagement_metrics table with columns: id (uuid), vendorId (uuid), weekNumber (integer), year (integer), sessionsCount (integer), avgSessionDuration (interval), totalPageViews (integer), totalAuctionsViewed (integer), totalBids (integer), totalWins (integer), returnRate (decimal), daysSinceLastVisit (integer), engagementScore (integer 0-100), retentionRisk (enum: 'low'/'medium'/'high'), lastUpdated (timestamp)
2. THE Intelligence_System SHALL calculate sessionsCount as COUNT(DISTINCT sessionId) from session_analytics per vendor per week
3. THE Intelligence_System SHALL calculate avgSessionDuration as AVG(timeOnSite) from session_analytics per vendor per week
4. THE Intelligence_System SHALL calculate returnRate as (number of weeks with activity / total weeks since registration) * 100
5. THE Intelligence_System SHALL calculate daysSinceLastVisit as (NOW() - MAX(session_analytics.startTime))
6. THE Intelligence_System SHALL calculate engagementScore using weighted formula: (sessionsCount * 10) + (totalBids * 20) + (totalWins * 30) + (returnRate * 0.4), capped at 100
7. THE Intelligence_System SHALL determine retentionRisk: 'high' if daysSinceLastVisit > 30 OR engagementScore < 20, 'medium' if daysSinceLastVisit 15-30 OR engagementScore 20-50, 'low' if daysSinceLastVisit < 15 AND engagementScore > 50
8. THE Intelligence_System SHALL track cohort retention: group vendors by registration month and calculate retention rates at 1 week, 1 month, 3 months, 6 months, 12 months
9. THE Intelligence_System SHALL emit 'vendor:retention_risk' Socket.IO event to admin users when a previously active vendor (engagementScore > 70) drops to retentionRisk='high'
10. THE Intelligence_System SHALL provide a GET endpoint /api/intelligence/admin/retention that returns cohort analysis, churn predictions, and at-risk vendor lists


### Requirement 69: Search and Discovery Analytics

**User Story:** As a product manager, I want search and discovery analytics, so that I can understand what vendors are looking for, optimize search functionality, and identify content gaps.

#### Acceptance Criteria

1. THE Intelligence_System SHALL create a search_analytics table with columns: id (uuid), sessionId (varchar), vendorId (uuid), searchQuery (varchar), searchType (enum: 'keyword'/'filter'/'category'), resultsCount (integer), clickedResults (jsonb array), clickPosition (integer nullable), timeToClick (interval nullable), refinedSearch (boolean), refinementQuery (varchar nullable), convertedToBid (boolean), createdAt (timestamp)
2. THE Intelligence_System SHALL track searchQuery when vendor uses the search bar on the auctions page, storing the exact search terms
3. THE Intelligence_System SHALL track searchType: 'keyword' for text search, 'filter' for using filters (assetType, priceRange, damageSeverity), 'category' for clicking category links
4. THE Intelligence_System SHALL track resultsCount as the number of auctions returned by the search query
5. THE Intelligence_System SHALL track clickedResults as jsonb array containing auctionIds that the vendor clicked from search results
6. THE Intelligence_System SHALL track clickPosition as the position (1-based index) of the clicked auction in the search results list
7. THE Intelligence_System SHALL track timeToClick as the duration between search execution and first result click
8. THE Intelligence_System SHALL track refinedSearch=true if vendor modifies the search query within 60 seconds, storing the new query in refinementQuery
9. THE Intelligence_System SHALL track convertedToBid=true if vendor places a bid on any auction from the search results within the same session
10. THE Intelligence_System SHALL aggregate popular search terms: COUNT(*) GROUP BY searchQuery to identify trending searches and content gaps (high search volume but low resultsCount)


### Requirement 70: Mobile PWA Analytics and Performance Tracking

**User Story:** As a mobile product manager, I want mobile-specific analytics, so that I can optimize the PWA experience, track offline usage, and ensure feature parity with desktop.

#### Acceptance Criteria

1. THE Intelligence_System SHALL create a mobile_analytics table with columns: id (uuid), sessionId (varchar), vendorId (uuid), deviceType (varchar), osVersion (varchar), browserVersion (varchar), screenResolution (varchar), connectionType (enum: 'wifi'/'4g'/'3g'/'offline'), offlineMode (boolean), pwaInstalled (boolean), pushNotificationsEnabled (boolean), avgPageLoadTime (integer ms), avgApiResponseTime (integer ms), errorCount (integer), featureUsage (jsonb), createdAt (timestamp)
2. THE Intelligence_System SHALL track deviceType from navigator.userAgent: 'iOS', 'Android', 'mobile_web', 'tablet'
3. THE Intelligence_System SHALL track connectionType from navigator.connection.effectiveType API: 'wifi', '4g', '3g', 'slow-2g', 'offline'
4. THE Intelligence_System SHALL track offlineMode=true when service worker serves cached content (detected via navigator.onLine = false)
5. THE Intelligence_System SHALL track pwaInstalled=true when app is launched in standalone mode (window.matchMedia('(display-mode: standalone)').matches)
6. THE Intelligence_System SHALL track pushNotificationsEnabled=true when Notification.permission === 'granted'
7. THE Intelligence_System SHALL track avgPageLoadTime using Performance API: performance.timing.loadEventEnd - performance.timing.navigationStart
8. THE Intelligence_System SHALL track avgApiResponseTime by measuring time between fetch() call and response for intelligence API endpoints
9. THE Intelligence_System SHALL track errorCount as the number of JavaScript errors, failed API calls, and service worker errors during the session
10. THE Intelligence_System SHALL track featureUsage as jsonb containing: predictionsViewed, recommendationsViewed, offlinePredictionsAccessed, swipeGesturesUsed, pullToRefreshUsed, bottomSheetOpened
11. THE Intelligence_System SHALL calculate mobile conversion rate: (bids placed on mobile / total mobile sessions) * 100 and compare to desktop conversion rate
12. THE Intelligence_System SHALL identify mobile-specific issues: if avgPageLoadTime > 3000ms OR errorCount > 5 per session, create alert for mobile optimization
13. THE Intelligence_System SHALL track PWA installation funnel: prompt shown → prompt accepted → app installed → app launched, with drop-off rates at each stage
14. THE Intelligence_System SHALL provide a GET endpoint /api/intelligence/admin/mobile-analytics that returns mobile performance metrics, device breakdown, and feature adoption rates
15. THE Intelligence_System SHALL ensure all new intelligence features (predictions, recommendations, analytics) are fully functional on mobile PWA with touch-optimized UI and offline support


### Requirement 55: Granular Asset Performance Analytics

**User Story:** As a platform operator, I want detailed analytics on which specific asset attributes sell best (make, model, year, color, trim), so that I can provide market insights to vendors and optimize inventory recommendations.

#### Acceptance Criteria

1. THE Intelligence_System SHALL create an asset_performance_analytics table with columns: id, assetType, make, model, year, color, trim, bodyStyle, avgFinalPrice, avgBidCount, avgTimeToSell (hours), totalAuctions, totalSold, sellThroughRate (percentage), priceAppreciation (percentage change over time), lastUpdated
2. THE Intelligence_System SHALL extract granular attributes from salvageCases.aiAssessment.itemDetails (detectedMake, detectedModel, detectedYear, color, trim, bodyStyle) and salvageCases.assetDetails (make, model, year) for vehicles
3. THE Intelligence_System SHALL extract granular attributes for electronics from salvageCases.assetDetails (brand, serialNumber) and salvageCases.aiAssessment.itemDetails (storage, overallCondition)
4. THE Intelligence_System SHALL calculate performance metrics by grouping auctions by (assetType, make, model, year) and computing: AVG(auctions.currentBid) as avgFinalPrice, AVG(COUNT(bids)) as avgBidCount, AVG(EXTRACT(EPOCH FROM (auctions.endTime - auctions.startTime)) / 3600) as avgTimeToSell
5. THE Intelligence_System SHALL calculate sellThroughRate = (COUNT(*) WHERE status='closed' AND currentBid IS NOT NULL) / COUNT(*) * 100 for each asset combination
6. THE Intelligence_System SHALL track priceAppreciation by comparing AVG(currentBid) for auctions closed in last 30 days vs 90-120 days ago: ((recent - historical) / historical) * 100
7. THE Intelligence_System SHALL update asset_performance_analytics daily using a background job that aggregates data from closed auctions
8. THE Intelligence_System SHALL provide a GET endpoint /api/intelligence/analytics/asset-performance with query parameters: assetType, make, model, year, sortBy ('avgFinalPrice'/'sellThroughRate'/'avgBidCount'), limit (default 50)
9. THE Intelligence_System SHALL use asset_performance_analytics data to enhance predictions by adjusting confidenceScore +10 points for assets with sellThroughRate > 80% and avgBidCount > 5
10. THE Intelligence_System SHALL use asset_performance_analytics data to enhance recommendations by boosting matchScore +15 points for assets with high sellThroughRate in the vendor's preferred categories


### Requirement 56: Color and Trim Level Performance Tracking

**User Story:** As a market analyst, I want to know which vehicle colors and trim levels sell best, so that I can advise vendors on high-demand attributes and optimize pricing strategies.

#### Acceptance Criteria

1. THE Intelligence_System SHALL create an attribute_performance_analytics table with columns: id, assetType, attributeName (e.g., 'color', 'trim', 'storage'), attributeValue (e.g., 'black', 'limited', '256GB'), avgFinalPrice, totalAuctions, sellThroughRate, avgDaysToSell, popularityRank, lastUpdated
2. THE Intelligence_System SHALL extract color from salvageCases.aiAssessment.itemDetails.color for vehicles and track performance by color (e.g., 'black', 'white', 'silver', 'red', 'blue')
3. THE Intelligence_System SHALL extract trim level from salvageCases.aiAssessment.itemDetails.trim for vehicles and track performance by trim (e.g., 'base', 'limited', 'premium', 'sport')
4. THE Intelligence_System SHALL extract storage capacity from salvageCases.aiAssessment.itemDetails.storage for electronics and track performance by storage (e.g., '64GB', '128GB', '256GB', '512GB')
5. THE Intelligence_System SHALL calculate popularityRank by ordering attributes within each assetType by totalAuctions DESC and assigning rank 1 to most popular
6. THE Intelligence_System SHALL calculate avgDaysToSell = AVG(EXTRACT(DAY FROM (auctions.endTime - auctions.createdAt))) for each attribute value
7. THE Intelligence_System SHALL provide a GET endpoint /api/intelligence/analytics/attribute-performance with query parameters: assetType, attributeName, sortBy ('avgFinalPrice'/'sellThroughRate'/'popularityRank'), limit (default 20)
8. THE Intelligence_System SHALL display attribute performance insights on admin dashboard: "Top Selling Colors: Black (45%), White (30%), Silver (15%)" with bar chart visualization
9. THE Intelligence_System SHALL use attribute_performance_analytics to enhance predictions: adjust predictedPrice +5% for high-demand colors (popularityRank ≤ 3) and -5% for low-demand colors (popularityRank > 10)
10. THE Intelligence_System SHALL use attribute_performance_analytics to enhance recommendations: boost matchScore +10 points for auctions with attributes that have high sellThroughRate (>75%) in vendor's preferred assetType


### Requirement 57: Temporal Pattern Analytics

**User Story:** As a vendor, I want to know when auctions typically get the most bids and highest prices, so that I can time my bidding strategy and identify optimal auction participation windows.

#### Acceptance Criteria

1. THE Intelligence_System SHALL create a temporal_patterns_analytics table with columns: id, assetType, hourOfDay (0-23), dayOfWeek (0-6, 0=Sunday), monthOfYear (1-12), avgBidCount, avgFinalPrice, avgVendorActivity (unique vendors), peakActivityScore (0-100), lastUpdated
2. THE Intelligence_System SHALL analyze bids.createdAt to identify peak bidding hours by calculating COUNT(bids) grouped by EXTRACT(HOUR FROM createdAt) for each assetType
3. THE Intelligence_System SHALL analyze auctions.endTime to identify which days of week have highest final prices by calculating AVG(currentBid) grouped by EXTRACT(DOW FROM endTime) for each assetType
4. THE Intelligence_System SHALL analyze seasonal patterns by calculating AVG(currentBid) grouped by EXTRACT(MONTH FROM endTime) for each assetType to identify high-demand months
5. THE Intelligence_System SHALL calculate peakActivityScore = (bidCount / maxBidCount) * 100 where maxBidCount is the highest bid count across all time periods for that assetType
6. THE Intelligence_System SHALL calculate avgVendorActivity = COUNT(DISTINCT bids.vendorId) for each time period to measure market competition
7. THE Intelligence_System SHALL provide a GET endpoint /api/intelligence/analytics/temporal-patterns with query parameters: assetType, granularity ('hourly'/'daily'/'monthly'), dateRange
8. THE Intelligence_System SHALL display temporal insights on vendor UI: "Best time to bid: Weekdays 2-4 PM (30% less competition)" with heatmap visualization
9. THE Intelligence_System SHALL use temporal_patterns_analytics to enhance predictions: adjust predictedPrice +8% for auctions ending during peak hours (peakActivityScore > 80) and -8% for off-peak hours (peakActivityScore < 30)
10. THE Intelligence_System SHALL use temporal_patterns_analytics to enhance recommendations: prioritize auctions ending during vendor's historically active hours (extracted from bids.createdAt patterns)


### Requirement 58: Geographic Pattern Analytics

**User Story:** As a platform operator, I want to understand regional preferences and pricing variations, so that I can provide location-based insights and optimize regional marketing strategies.

#### Acceptance Criteria

1. THE Intelligence_System SHALL create a geographic_patterns_analytics table with columns: id, region (derived from salvageCases.gpsLocation), assetType, make, model, avgFinalPrice, totalAuctions, avgBidCount, regionalDemandScore (0-100), priceVariance (percentage difference from national average), lastUpdated
2. THE Intelligence_System SHALL extract region from salvageCases.gpsLocation by reverse geocoding coordinates to state/province level using PostGIS ST_Within function with Nigeria state boundaries
3. THE Intelligence_System SHALL calculate avgFinalPrice by region and assetType: AVG(auctions.currentBid) grouped by (region, assetType, make, model)
4. THE Intelligence_System SHALL calculate regionalDemandScore = (regionalAuctions / totalAuctions) * 100 to measure relative demand in each region
5. THE Intelligence_System SHALL calculate priceVariance = ((regionalAvgPrice - nationalAvgPrice) / nationalAvgPrice) * 100 to identify regional price premiums or discounts
6. THE Intelligence_System SHALL analyze vendor distribution by region: COUNT(DISTINCT vendors.id) grouped by vendor location (derived from users.metadata or vendor registration data)
7. THE Intelligence_System SHALL provide a GET endpoint /api/intelligence/analytics/geographic-patterns with query parameters: region, assetType, make, sortBy ('avgFinalPrice'/'regionalDemandScore'/'priceVariance')
8. THE Intelligence_System SHALL display geographic insights on admin dashboard: "Lagos: +15% price premium for vehicles, Abuja: +8% for electronics" with map visualization
9. THE Intelligence_System SHALL use geographic_patterns_analytics to enhance predictions: adjust predictedPrice based on regional priceVariance (e.g., +15% for Lagos vehicles, -5% for rural areas)
10. THE Intelligence_System SHALL use geographic_patterns_analytics to enhance recommendations: boost matchScore +12 points for auctions in regions where vendor has high win rate (vendors.performanceStats analyzed by region)


### Requirement 59: Vendor Behavioral Segmentation

**User Story:** As the Recommendation Engine, I want to classify vendors into behavioral segments (Bargain Hunters, Premium Buyers, Specialists, etc.), so that I can apply segment-specific recommendation strategies and improve conversion rates.

#### Acceptance Criteria

1. THE Intelligence_System SHALL create a vendor_segments table with columns: id, vendorId, segmentType ('bargain_hunter'/'premium_buyer'/'specialist'/'generalist'/'active_bidder'/'selective_bidder'/'new_vendor'), segmentScore (0-100), segmentCharacteristics (jsonb with metrics), assignedAt, lastUpdated
2. THE Intelligence_System SHALL classify "Bargain Hunters" as vendors where AVG(bids.amount) < (SELECT AVG(amount) FROM bids) * 0.8 AND vendors.performanceStats.winRate > 40%
3. THE Intelligence_System SHALL classify "Premium Buyers" as vendors where AVG(bids.amount) > (SELECT AVG(amount) FROM bids) * 1.5 AND AVG(salvageCases.marketValue) > 1000000
4. THE Intelligence_System SHALL classify "Specialists" as vendors where (COUNT(DISTINCT salvageCases.assetType) = 1 OR (COUNT(*) WHERE assetType = mostFrequentType) / COUNT(*) > 0.7) AND vendors.performanceStats.totalBids > 10
5. THE Intelligence_System SHALL classify "Generalists" as vendors where COUNT(DISTINCT salvageCases.assetType) >= 3 AND each assetType represents >15% of total bids
6. THE Intelligence_System SHALL classify "Active Bidders" as vendors where vendors.performanceStats.totalBids > 20 in last 90 days
7. THE Intelligence_System SHALL classify "Selective Bidders" as vendors where vendors.performanceStats.totalBids < 5 in last 90 days AND vendors.performanceStats.winRate > 60%
8. THE Intelligence_System SHALL classify "New Vendors" as vendors where vendors.createdAt > NOW() - INTERVAL '30 days' OR vendors.performanceStats.totalBids < 3
9. THE Intelligence_System SHALL calculate segmentScore based on how strongly the vendor matches segment characteristics (0-100 scale)
10. THE Intelligence_System SHALL store segmentCharacteristics as jsonb containing: avgBidAmount, preferredAssetTypes (array), avgMarketValue, winRate, bidFrequency, priceRange (min/max)
11. THE Intelligence_System SHALL update vendor_segments weekly using a background job that recalculates based on recent bids and auction outcomes
12. THE Intelligence_System SHALL apply segment-specific recommendation strategies: Bargain Hunters get low-competition auctions (watchingCount < 5), Premium Buyers get high-value auctions (marketValue > 1M), Specialists get deep matches in their category, Generalists get diverse recommendations
13. THE Intelligence_System SHALL provide a GET endpoint /api/intelligence/analytics/vendor-segments with query parameters: segmentType, sortBy ('segmentScore'/'totalBids'/'winRate'), limit (default 100)
14. THE Intelligence_System SHALL display segment distribution on admin dashboard: "Bargain Hunters: 35%, Premium Buyers: 15%, Specialists: 25%, Generalists: 25%" with pie chart visualization


### Requirement 60: Session Analytics and Engagement Tracking

**User Story:** As a product manager, I want detailed session analytics (time on site, pages viewed, conversion funnel), so that I can identify drop-off points and optimize the user experience.

#### Acceptance Criteria

1. THE Intelligence_System SHALL create a session_analytics table with columns: id, vendorId, sessionId, startTime, endTime, duration (seconds), pagesViewed (integer), auctionsViewed (integer), bidsPlaced (integer), bounceRate (boolean), conversionType ('bid'/'win'/'none'), deviceType, metadata (jsonb with page sequence, timestamps)
2. THE Intelligence_System SHALL track session start when a vendor logs in or first interacts with the platform, generating unique sessionId using UUID
3. THE Intelligence_System SHALL track pagesViewed by counting distinct page URLs visited during the session from interactions table where eventType='view'
4. THE Intelligence_System SHALL track auctionsViewed by counting distinct auctionId from interactions table where eventType='view' AND entityType='auction'
5. THE Intelligence_System SHALL track bidsPlaced by counting bids.id where bids.createdAt is within session timeframe (startTime to endTime)
6. THE Intelligence_System SHALL calculate duration = EXTRACT(EPOCH FROM (endTime - startTime)) in seconds
7. THE Intelligence_System SHALL mark bounceRate=true if duration < 30 seconds AND pagesViewed = 1
8. THE Intelligence_System SHALL determine conversionType: 'win' if vendor won an auction during session, 'bid' if vendor placed at least one bid, 'none' otherwise
9. THE Intelligence_System SHALL store page sequence in metadata.pageSequence as array of {page: string, timestamp: timestamp, duration: number} for funnel analysis
10. THE Intelligence_System SHALL end session after 30 minutes of inactivity (no interactions recorded) or when vendor logs out
11. THE Intelligence_System SHALL calculate engagement metrics: avgSessionDuration = AVG(duration), avgPagesPerSession = AVG(pagesViewed), bounceRate = (COUNT(*) WHERE bounceRate=true) / COUNT(*) * 100, conversionRate = (COUNT(*) WHERE conversionType IN ('bid', 'win')) / COUNT(*) * 100
12. THE Intelligence_System SHALL provide a GET endpoint /api/intelligence/analytics/session-metrics with query parameters: vendorId, dateRange, groupBy ('hour'/'day'/'week')
13. THE Intelligence_System SHALL display session analytics on admin dashboard: "Avg Session Duration: 8m 32s, Bounce Rate: 35%, Conversion Rate: 12%" with trend charts
14. THE Intelligence_System SHALL use session_analytics to enhance recommendations: boost matchScore +8 points for auctions similar to those viewed in current session (session-based collaborative filtering)


### Requirement 61: Conversion Funnel Analysis

**User Story:** As a product manager, I want to analyze the conversion funnel from auction view to bid to win, so that I can identify bottlenecks and optimize conversion rates at each stage.

#### Acceptance Criteria

1. THE Intelligence_System SHALL create a conversion_funnel_analytics table with columns: id, assetType, funnelStage ('view'/'watchlist'/'bid'/'win'), totalUsers, conversionRate (percentage to next stage), avgTimeToNextStage (seconds), dropOffRate (percentage), lastUpdated
2. THE Intelligence_System SHALL define funnel stages: Stage 1 (View) = interactions WHERE eventType='view', Stage 2 (Watchlist) = auctions WHERE watchingCount incremented, Stage 3 (Bid) = bids placed, Stage 4 (Win) = auctions WHERE currentBidder = vendorId AND status='closed'
3. THE Intelligence_System SHALL calculate totalUsers for each stage: COUNT(DISTINCT vendorId) at each funnel stage
4. THE Intelligence_System SHALL calculate conversionRate = (usersAtNextStage / usersAtCurrentStage) * 100 for each stage transition
5. THE Intelligence_System SHALL calculate avgTimeToNextStage = AVG(nextStageTimestamp - currentStageTimestamp) in seconds for users who progressed
6. THE Intelligence_System SHALL calculate dropOffRate = ((usersAtCurrentStage - usersAtNextStage) / usersAtCurrentStage) * 100 for each stage
7. THE Intelligence_System SHALL segment funnel analysis by assetType to identify which asset categories have best/worst conversion rates
8. THE Intelligence_System SHALL segment funnel analysis by vendor segment (from vendor_segments table) to identify which segments convert best
9. THE Intelligence_System SHALL provide a GET endpoint /api/intelligence/analytics/conversion-funnel with query parameters: assetType, vendorSegment, dateRange
10. THE Intelligence_System SHALL display funnel visualization on admin dashboard: "View (1000) → Watchlist (400, 40%) → Bid (120, 30%) → Win (30, 25%)" with Sankey diagram
11. THE Intelligence_System SHALL identify bottlenecks: flag stages where dropOffRate > 70% with actionType='funnel_bottleneck_detected' in auditLogs
12. THE Intelligence_System SHALL use conversion_funnel_analytics to enhance recommendations: prioritize auctions with high view-to-bid conversion rates (>25%) for vendors who frequently view but rarely bid


### Requirement 62: Dynamic Schema Evolution and Auto-Detection

**User Story:** As the Intelligence System, I want to automatically detect new asset types and attributes, so that analytics and algorithms adapt to evolving marketplace inventory without manual configuration.

#### Acceptance Criteria

1. THE Intelligence_System SHALL create a schema_evolution_log table with columns: id, entityType ('assetType'/'attribute'), entityName (e.g., 'boat', 'color'), detectedAt, occurrenceCount, status ('detected'/'validated'/'active'), validatedBy (userId), validatedAt, metadata (jsonb with sample values)
2. THE Intelligence_System SHALL monitor salvageCases.assetType for new values not in the existing assetTypeEnum ('vehicle', 'property', 'electronics', 'machinery') by querying SELECT DISTINCT assetType FROM salvage_cases WHERE assetType NOT IN (...)
3. WHEN a new assetType is detected (occurrenceCount >= 3 cases), THE Intelligence_System SHALL create schema_evolution_log entry with status='detected' and emit 'schema:new_asset_type' Socket.IO event to admin users
4. THE Intelligence_System SHALL monitor salvageCases.assetDetails for new attribute keys by extracting jsonb_object_keys(assetDetails) and comparing against known attributes
5. WHEN a new attribute is detected (occurrenceCount >= 5 cases), THE Intelligence_System SHALL create schema_evolution_log entry with status='detected' and store sample values in metadata.sampleValues
6. THE Intelligence_System SHALL monitor salvageCases.aiAssessment.itemDetails for new attributes (color, trim, bodyStyle, storage, etc.) and track their frequency
7. WHEN an admin validates a new schema element (POST /api/intelligence/admin/schema/validate), THE Intelligence_System SHALL update status='validated' and automatically create corresponding entries in asset_performance_analytics and attribute_performance_analytics tables
8. THE Intelligence_System SHALL automatically start tracking performance metrics for validated new asset types and attributes without code changes
9. THE Intelligence_System SHALL provide a GET endpoint /api/intelligence/admin/schema/pending that returns all schema_evolution_log entries with status='detected' for admin review
10. THE Intelligence_System SHALL display pending schema changes on admin dashboard: "New Asset Types Detected: Boat (5 cases), Jewelry (3 cases)" with "Validate" buttons
11. THE Intelligence_System SHALL use schema_evolution_log to enhance predictions: apply generic fallback algorithms for new asset types until sufficient historical data (>10 closed auctions) is available
12. THE Intelligence_System SHALL automatically expand similarity matching to include new validated attributes in prediction and recommendation algorithms


### Requirement 63: ML Training Dataset Preparation and Export

**User Story:** As a data scientist, I want to export comprehensive ML training datasets with feature engineering applied, so that I can train advanced machine learning models for price prediction and recommendation.

#### Acceptance Criteria

1. THE Intelligence_System SHALL create an ml_training_datasets table with columns: id, datasetType ('price_prediction'/'recommendation'/'fraud_detection'), version, recordCount, featureCount, dateRange (start/end), exportFormat ('CSV'/'JSON'/'Parquet'), filePath, fileSize, generatedBy (userId), generatedAt, metadata (jsonb with schema description)
2. THE Intelligence_System SHALL provide a POST endpoint /api/intelligence/ml/export-dataset with parameters: datasetType, dateRange, includeFeatures (array of feature names), format ('CSV'/'JSON'/'Parquet'), splitRatio (train/validation/test percentages)
3. FOR price_prediction datasets, THE Intelligence_System SHALL export features: assetType, make, model, year, damageSeverity, damagedPartsCount, marketValue, estimatedSalvageValue, reservePrice, bidCount, watchingCount, hourOfDay, dayOfWeek, monthOfYear, region, competitionLevel, seasonalityFactor, AND target variable: finalPrice (auctions.currentBid)
4. FOR price_prediction datasets, THE Intelligence_System SHALL apply feature engineering: one-hot encoding for categorical variables (assetType, make, damageSeverity), normalization for numerical variables (marketValue, reservePrice), temporal features (hourOfDay, dayOfWeek, monthOfYear), interaction features (marketValue * damageSeverity, bidCount * competitionLevel)
5. FOR recommendation datasets, THE Intelligence_System SHALL export features: vendorId (anonymized), vendorSegment, preferredAssetTypes, avgBidAmount, winRate, auctionId, assetType, make, model, marketValue, damageSeverity, matchScore, AND target variable: bidPlaced (boolean from recommendations table)
6. FOR recommendation datasets, THE Intelligence_System SHALL apply feature engineering: vendor embedding vectors (learned from bidding history), auction embedding vectors (learned from asset attributes), temporal features, collaborative filtering features (similar vendor preferences)
7. FOR fraud_detection datasets, THE Intelligence_System SHALL export features: vendorId (anonymized), bidVelocity, ipAddressChanges, deviceTypeChanges, bidTimingPatterns, winRateByAdjuster, photoHashSimilarity, AND target variable: fraudConfirmed (boolean from fraud_alerts table)
8. THE Intelligence_System SHALL split datasets into train/validation/test sets using stratified sampling to maintain class distribution (e.g., 70%/15%/15%)
9. THE Intelligence_System SHALL include a JSON schema file with each export describing: feature names, data types, encoding methods, normalization parameters, missing value handling, and target variable definition
10. THE Intelligence_System SHALL anonymize PII in exports: replace vendorId with anonymousVendorId (UUID hash), remove users.email/phoneNumber/name, encrypt ipAddress
11. THE Intelligence_System SHALL provide a GET endpoint /api/intelligence/ml/datasets that lists all generated datasets with download links (valid for 7 days)
12. THE Intelligence_System SHALL log all dataset exports to auditLogs with actionType='ml_dataset_exported', metadata containing datasetType, recordCount, dateRange, and userId


### Requirement 64: Feature Vector Storage for ML Training

**User Story:** As a data scientist, I want pre-computed feature vectors stored for efficient ML model training, so that I can iterate quickly on model development without recomputing features each time.

#### Acceptance Criteria

1. THE Intelligence_System SHALL create a feature_vectors table with columns: id, entityType ('auction'/'vendor'), entityId, featureVector (jsonb or vector type), featureVersion, computedAt, metadata (jsonb with feature names and values)
2. FOR auction feature vectors, THE Intelligence_System SHALL compute and store: assetTypeEncoded (one-hot), makeEncoded (one-hot or embedding), modelEncoded (one-hot or embedding), yearNormalized, damageSeverityEncoded, damagedPartsCountNormalized, marketValueNormalized, estimatedSalvageValueNormalized, reservePriceNormalized, temporalFeatures (hourOfDay, dayOfWeek, monthOfYear as cyclical encoding), geographicFeatures (region encoded), marketConditionFeatures (competitionLevel, seasonalityFactor)
3. FOR vendor feature vectors, THE Intelligence_System SHALL compute and store: vendorSegmentEncoded, preferredAssetTypesEncoded (multi-hot), avgBidAmountNormalized, winRateNormalized, totalBidsNormalized, avgPaymentTimeNormalized, biddingFrequencyNormalized, priceRangeFeatures (min/max/avg normalized), temporalPreferences (preferred hours/days encoded), geographicPreferences (preferred regions encoded)
4. THE Intelligence_System SHALL use cyclical encoding for temporal features: hourOfDay → (sin(2π * hour/24), cos(2π * hour/24)), dayOfWeek → (sin(2π * day/7), cos(2π * day/7)), monthOfYear → (sin(2π * month/12), cos(2π * month/12))
5. THE Intelligence_System SHALL normalize numerical features using min-max normalization: normalized = (value - min) / (max - min) where min/max are computed from training data
6. THE Intelligence_System SHALL handle missing values: use median imputation for numerical features, mode imputation for categorical features, and store imputation strategy in metadata
7. THE Intelligence_System SHALL compute feature vectors for new auctions and vendors in real-time when they are created using a background job
8. THE Intelligence_System SHALL update vendor feature vectors weekly to reflect recent bidding behavior changes
9. THE Intelligence_System SHALL version feature vectors (featureVersion) to track changes in feature engineering over time
10. THE Intelligence_System SHALL provide a GET endpoint /api/intelligence/ml/feature-vectors with query parameters: entityType, entityId, featureVersion that returns pre-computed feature vectors
11. THE Intelligence_System SHALL use feature_vectors table to accelerate ML model inference: load pre-computed vectors instead of recomputing features on each prediction
12. THE Intelligence_System SHALL store feature computation metadata including: feature names, normalization parameters, encoding mappings, imputation strategies for reproducibility


### Requirement 65: Analytics Aggregation and Rollups

**User Story:** As a platform operator, I want pre-computed analytics rollups at hourly, daily, weekly, and monthly levels, so that I can quickly generate reports and dashboards without expensive real-time queries.

#### Acceptance Criteria

1. THE Intelligence_System SHALL create an analytics_rollups table with columns: id, rollupType ('hourly'/'daily'/'weekly'/'monthly'), rollupPeriod (timestamp), assetType, metrics (jsonb with aggregated values), recordCount, lastUpdated
2. THE Intelligence_System SHALL compute hourly rollups: totalAuctions, totalBids, avgBidAmount, avgFinalPrice, uniqueVendors, totalRevenue, avgSessionDuration, bounceRate, conversionRate grouped by (EXTRACT(HOUR FROM timestamp), assetType)
3. THE Intelligence_System SHALL compute daily rollups: totalAuctions, totalBids, avgBidAmount, avgFinalPrice, uniqueVendors, totalRevenue, newVendors, activeVendors, avgSessionDuration, bounceRate, conversionRate, topSellingMake, topSellingModel grouped by (DATE(timestamp), assetType)
4. THE Intelligence_System SHALL compute weekly rollups: totalAuctions, totalBids, avgBidAmount, avgFinalPrice, uniqueVendors, totalRevenue, newVendors, activeVendors, vendorRetentionRate, avgSessionDuration, bounceRate, conversionRate, topSellingAssets (array of top 10), marketTrends (price movement percentage) grouped by (EXTRACT(WEEK FROM timestamp), assetType)
5. THE Intelligence_System SHALL compute monthly rollups: totalAuctions, totalBids, avgBidAmount, avgFinalPrice, uniqueVendors, totalRevenue, newVendors, activeVendors, vendorRetentionRate, vendorChurnRate, avgSessionDuration, bounceRate, conversionRate, topSellingAssets (array of top 20), marketTrends, seasonalityFactors grouped by (EXTRACT(MONTH FROM timestamp), assetType)
6. THE Intelligence_System SHALL run hourly rollup jobs every hour using a background cron job that aggregates data from the past hour
7. THE Intelligence_System SHALL run daily rollup jobs at 1 AM daily that aggregates data from the previous day
8. THE Intelligence_System SHALL run weekly rollup jobs on Mondays at 2 AM that aggregates data from the previous week
9. THE Intelligence_System SHALL run monthly rollup jobs on the 1st of each month at 3 AM that aggregates data from the previous month
10. THE Intelligence_System SHALL provide a GET endpoint /api/intelligence/analytics/rollups with query parameters: rollupType, dateRange, assetType that returns pre-computed rollups
11. THE Intelligence_System SHALL use analytics_rollups to power admin dashboard charts and reports with sub-second query times
12. THE Intelligence_System SHALL store rollup computation metadata: recordCount (number of raw records aggregated), computationTime (milliseconds), dataQuality (percentage of complete records) in the metrics jsonb field


### Requirement 66: Enhanced Prediction Algorithm with Granular Data

**User Story:** As the Prediction Engine, I want to use granular asset performance data (make/model/year/color/trim) to improve prediction accuracy, so that vendors receive more precise price forecasts.

#### Acceptance Criteria

1. THE Prediction_Engine SHALL enhance similarity matching to include color matching: +5 points for exact color match (from salvageCases.aiAssessment.itemDetails.color)
2. THE Prediction_Engine SHALL enhance similarity matching to include trim level matching: +8 points for exact trim match (from salvageCases.aiAssessment.itemDetails.trim)
3. THE Prediction_Engine SHALL use asset_performance_analytics to adjust predictions: if target asset has sellThroughRate > 80%, increase predictedPrice by 5-10% based on demand
4. THE Prediction_Engine SHALL use attribute_performance_analytics to adjust predictions: if target asset has high-demand color (popularityRank ≤ 3), increase predictedPrice by 3-7%
5. THE Prediction_Engine SHALL use temporal_patterns_analytics to adjust predictions: if auction ends during peak hours (peakActivityScore > 80), increase predictedPrice by 5-12%
6. THE Prediction_Engine SHALL use geographic_patterns_analytics to adjust predictions: apply regional priceVariance multiplier (e.g., +15% for Lagos, -5% for rural areas)
7. THE Prediction_Engine SHALL calculate enhanced confidenceScore incorporating data quality factors: +10 points if asset has complete itemDetails (color, trim, bodyStyle), +5 points if asset has high sellThroughRate (>75%), +8 points if similar auctions include color/trim matches
8. THE Prediction_Engine SHALL use vendor_segments data to personalize predictions: for "Bargain Hunters", show lowerBound more prominently; for "Premium Buyers", show upperBound more prominently
9. THE Prediction_Engine SHALL track prediction accuracy by granular attributes: calculate meanPercentageError grouped by (assetType, make, model, year, color, trim) to identify which attributes improve accuracy
10. THE Prediction_Engine SHALL automatically adjust similarity weights based on accuracy tracking: if color matching improves accuracy by >5%, increase color weight from +5 to +8 points
11. THE Prediction_Engine SHALL provide enhanced prediction breakdown in API response: include contributingFactors (jsonb) with {colorMatch: true, trimMatch: true, highDemandAsset: true, peakHourAuction: true, regionalPremium: 15%}
12. THE Prediction_Engine SHALL achieve improved accuracy target: ±12% (down from ±15%) for auctions with complete granular data (color, trim, temporal, geographic)


### Requirement 67: Enhanced Recommendation Algorithm with Behavioral Data

**User Story:** As the Recommendation Engine, I want to use behavioral analytics (session data, temporal patterns, vendor segments) to improve recommendation relevance, so that vendors receive more personalized auction suggestions.

#### Acceptance Criteria

1. THE Recommendation_Engine SHALL use vendor_segments to apply segment-specific strategies: "Bargain Hunters" get auctions with watchingCount < 5 and reservePrice < vendor's avgBidAmount, "Premium Buyers" get auctions with marketValue > 1M, "Specialists" get deep matches in their category with +20 matchScore boost
2. THE Recommendation_Engine SHALL use session_analytics to implement session-based collaborative filtering: boost matchScore +15 points for auctions similar to those viewed in current session (last 30 minutes)
3. THE Recommendation_Engine SHALL use temporal_patterns_analytics to time recommendations: prioritize auctions ending during vendor's historically active hours (extracted from bids.createdAt patterns) with +10 matchScore boost
4. THE Recommendation_Engine SHALL use geographic_patterns_analytics to prioritize local auctions: boost matchScore +12 points for auctions in regions where vendor has high win rate
5. THE Recommendation_Engine SHALL use conversion_funnel_analytics to optimize recommendations: prioritize auctions with high view-to-bid conversion rates (>25%) for vendors who frequently view but rarely bid
6. THE Recommendation_Engine SHALL use attribute_performance_analytics to recommend trending attributes: boost matchScore +10 points for auctions with high-demand colors/trims (popularityRank ≤ 3) in vendor's preferred assetType
7. THE Recommendation_Engine SHALL implement diversity optimization: ensure top 20 recommendations include at least 3 different assetTypes (if vendor is "Generalist") or at least 5 different makes (if vendor is "Specialist")
8. THE Recommendation_Engine SHALL use feature_vectors for efficient similarity computation: load pre-computed vendor and auction feature vectors and calculate cosine similarity instead of complex SQL queries
9. THE Recommendation_Engine SHALL track recommendation effectiveness by behavioral segment: calculate bidConversionRate grouped by vendorSegment to identify which segments respond best to recommendations
10. THE Recommendation_Engine SHALL automatically adjust recommendation weights based on effectiveness tracking: if session-based filtering improves bidConversionRate by >10%, increase session-based weight from +15 to +20 points
11. THE Recommendation_Engine SHALL provide enhanced recommendation explanation in API response: include reasonCodes with specific details like "Matches your preferred color (black)", "Ends during your active hours (2-4 PM)", "High demand in your region (Lagos)"
12. THE Recommendation_Engine SHALL achieve improved effectiveness target: bidConversionRate > 15% (up from 10%) for vendors with sufficient behavioral data (>20 bids, >10 sessions)


### Requirement 68: Comprehensive Data Logging for ML Training

**User Story:** As a data scientist, I want all intelligence system data logged in structured formats, so that I can easily access and download complete datasets for ML model training.

#### Acceptance Criteria

1. THE Intelligence_System SHALL log all prediction requests to prediction_logs table with columns: id, auctionId, vendorId, requestTimestamp, responseTime (milliseconds), predictedPrice, lowerBound, upperBound, confidenceScore, algorithmVersion, fallbackMethod, similarAuctionCount, contributingFactors (jsonb), deviceType, sessionId
2. THE Intelligence_System SHALL log all recommendation requests to recommendation_logs table with columns: id, vendorId, requestTimestamp, responseTime (milliseconds), recommendationCount, topMatchScore, avgMatchScore, algorithmVersion, vendorSegment, sessionId, deviceType
3. THE Intelligence_System SHALL log all interaction events to interactions table (already defined in Requirement 7) with complete metadata: deviceType, ipAddress (encrypted), sessionId, predictionShown (jsonb), recommendationShown (jsonb), pageReferrer, userAgent
4. THE Intelligence_System SHALL log all algorithm parameter changes to algorithm_config_history table with columns: id, configKey, oldValue (jsonb), newValue (jsonb), changedBy (userId), changedAt, reason (text), impactMetrics (jsonb with before/after accuracy)
5. THE Intelligence_System SHALL log all schema evolution events to schema_evolution_log table (already defined in Requirement 62) with complete sample data
6. THE Intelligence_System SHALL log all fraud detection events to fraud_detection_logs table with columns: id, entityType, entityId, analysisTimestamp, riskScore, flagReasons (jsonb), detectionMethod, falsePositive (boolean nullable), reviewedBy (userId nullable), reviewedAt (timestamp nullable)
7. THE Intelligence_System SHALL provide a GET endpoint /api/intelligence/logs/export with query parameters: logType ('predictions'/'recommendations'/'interactions'/'fraud'), dateRange, format ('CSV'/'JSON'/'Parquet'), anonymize (boolean)
8. THE Intelligence_System SHALL implement log rotation: archive logs older than 90 days to cold storage (S3 or equivalent) and delete logs older than 2 years (except anonymized aggregates)
9. THE Intelligence_System SHALL provide log search functionality: POST /api/intelligence/logs/search with query parameters: logType, filters (jsonb with field-value pairs), sortBy, limit (default 100)
10. THE Intelligence_System SHALL display log statistics on admin dashboard: "Total Predictions Logged: 1.2M, Total Recommendations Logged: 850K, Total Interactions Logged: 5.3M" with growth trends
11. THE Intelligence_System SHALL ensure all logs are structured JSON for easy parsing and analysis
12. THE Intelligence_System SHALL include correlation IDs across related logs: predictionId in interactions table links to predictions table, recommendationId in interactions table links to recommendations table


### Requirement 69: Market Intelligence Dashboard for Vendors

**User Story:** As a vendor, I want to see market intelligence insights (trending assets, price trends, competition levels), so that I can make data-driven decisions about which auctions to participate in.

#### Acceptance Criteria

1. THE Intelligence_System SHALL create a vendor-facing market intelligence page at src/app/(dashboard)/vendor/market-insights/page.tsx displaying actionable market data
2. THE Intelligence_System SHALL display "Trending Assets" section showing top 10 assets by sellThroughRate and avgBidCount from asset_performance_analytics with columns: make/model, avgFinalPrice, sellThroughRate, priceAppreciation (trend arrow up/down)
3. THE Intelligence_System SHALL display "Best Time to Bid" section showing peak bidding hours from temporal_patterns_analytics with heatmap visualization: hourOfDay vs dayOfWeek with color intensity representing avgBidCount
4. THE Intelligence_System SHALL display "Regional Insights" section showing price variations by region from geographic_patterns_analytics with map visualization and price premium/discount percentages
5. THE Intelligence_System SHALL display "Your Performance" section comparing vendor's metrics to market averages: vendor's avgBidAmount vs market avgBidAmount, vendor's winRate vs market avgWinRate, vendor's avgPaymentTime vs market avgPaymentTime
6. THE Intelligence_System SHALL display "Competition Levels" section showing current market competition from market_conditions_mv: competitionLevel ('low'/'medium'/'high') by assetType with trend indicators
7. THE Intelligence_System SHALL display "Price Trends" section showing 30-day price movement from analytics_rollups: line chart of avgFinalPrice over time grouped by assetType
8. THE Intelligence_System SHALL display "Popular Attributes" section showing top-performing colors, trims, and other attributes from attribute_performance_analytics with bar charts
9. THE Intelligence_System SHALL provide filters: assetType dropdown, dateRange picker, region selector to customize insights
10. THE Intelligence_System SHALL update market intelligence data every 15 minutes using cached data from materialized views and analytics_rollups
11. THE Intelligence_System SHALL optimize for mobile PWA: responsive design with collapsible sections, touch-friendly charts, progressive loading
12. THE Intelligence_System SHALL provide "Download Report" button that generates PDF report of current market insights using query parameters from filters


### Requirement 70: Admin Analytics Dashboard with Granular Insights

**User Story:** As an administrator, I want a comprehensive analytics dashboard with granular insights (make/model/year/color performance, behavioral segments, temporal patterns), so that I can monitor marketplace health and make strategic decisions.

#### Acceptance Criteria

1. THE Intelligence_System SHALL create an admin analytics page at src/app/(dashboard)/admin/intelligence/analytics/page.tsx displaying comprehensive market analytics
2. THE Intelligence_System SHALL display "Asset Performance Matrix" showing asset_performance_analytics data in a sortable table with columns: assetType, make, model, year, avgFinalPrice, avgBidCount, sellThroughRate, totalAuctions, priceAppreciation with export to CSV functionality
3. THE Intelligence_System SHALL display "Attribute Performance" showing attribute_performance_analytics data with tabs for Color, Trim, Storage, and other attributes, displaying bar charts of avgFinalPrice and sellThroughRate by attribute value
4. THE Intelligence_System SHALL display "Temporal Patterns" showing temporal_patterns_analytics data with interactive heatmaps: hourOfDay vs dayOfWeek, monthOfYear trends, seasonal patterns with drill-down by assetType
5. THE Intelligence_System SHALL display "Geographic Distribution" showing geographic_patterns_analytics data with map visualization: regions colored by avgFinalPrice, bubble size representing totalAuctions, tooltips showing priceVariance and regionalDemandScore
6. THE Intelligence_System SHALL display "Vendor Segments" showing vendor_segments distribution with pie chart and detailed table: segmentType, vendorCount, avgWinRate, avgBidAmount, totalRevenue contribution
7. THE Intelligence_System SHALL display "Conversion Funnel" showing conversion_funnel_analytics data with Sankey diagram: View → Watchlist → Bid → Win with conversion rates and drop-off rates at each stage, segmented by assetType
8. THE Intelligence_System SHALL display "Session Analytics" showing session_analytics metrics: avgSessionDuration, avgPagesPerSession, bounceRate, conversionRate with trend lines over time
9. THE Intelligence_System SHALL display "Top Performers" showing: top 10 vendors by totalWins, top 10 assets by avgFinalPrice, top 10 makes by sellThroughRate, top 10 regions by totalAuctions
10. THE Intelligence_System SHALL provide advanced filters: dateRange picker, assetType multi-select, region multi-select, vendorSegment multi-select, priceRange slider
11. THE Intelligence_System SHALL provide "Export All Analytics" button that generates comprehensive Excel workbook with multiple sheets for each analytics category
12. THE Intelligence_System SHALL update dashboard data every 5 minutes using cached data from materialized views and analytics_rollups for sub-second load times
13. THE Intelligence_System SHALL provide drill-down functionality: clicking on any chart element (e.g., specific make/model) opens detailed view with historical trends and related metrics
14. THE Intelligence_System SHALL display data quality indicators: completeness percentage for aiAssessment data, assetDetails data, and itemDetails data with alerts for low quality (<80%)
