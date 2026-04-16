# Admin User Guide: Intelligence Dashboard

## Overview

The Intelligence Dashboard provides comprehensive monitoring and management tools for the AI-Powered Marketplace Intelligence system. This guide covers all admin features including fraud detection, analytics, algorithm configuration, and data export.

**Access**: Admin role required  
**URL**: `/admin/intelligence`

---

## Table of Contents

1. [Dashboard Overview](#dashboard-overview)
2. [Fraud Alert Management](#fraud-alert-management)
3. [Analytics Dashboard](#analytics-dashboard)
4. [Algorithm Configuration](#algorithm-configuration)
5. [Data Export](#data-export)
6. [System Monitoring](#system-monitoring)

---

## Dashboard Overview

### Main Metrics

The dashboard displays four key metric cards:

#### 1. Prediction Accuracy
- **Current Accuracy**: Percentage accuracy of price predictions
- **Change**: Trend compared to previous period (green = improving, red = declining)
- **Total Predictions**: Number of predictions generated in the period

**What to Monitor**:
- Accuracy should stay above 85%
- Declining trends may indicate market changes or data quality issues
- Low prediction counts may indicate system issues

#### 2. Recommendation Effectiveness
- **Bid Conversion Rate**: Percentage of clicked recommendations that led to bids
- **Change**: Trend compared to previous period
- **Total Recommendations**: Number of recommendations generated

**What to Monitor**:
- Conversion rate should stay above 15%
- Declining trends may indicate poor recommendation quality
- Very high rates (>40%) may indicate overfitting

#### 3. Fraud Alerts
- **Pending**: Alerts awaiting review
- **Confirmed**: Verified fraud cases
- **Dismissed**: False positives
- **Total**: All alerts in the period

**What to Monitor**:
- Pending alerts should be reviewed within 24 hours
- High confirmed rates may indicate systemic fraud
- High dismissed rates may indicate algorithm tuning needed

#### 4. System Health
- **Cache Hit Rate**: Percentage of requests served from cache
- **Avg Response Time**: Average API response time in milliseconds
- **Jobs Running**: Number of active background jobs
- **Last Refresh**: Timestamp of last materialized view refresh

**What to Monitor**:
- Cache hit rate should be above 80%
- Response time should be below 200ms
- All jobs should be running (6 total)

### Charts

#### Prediction Accuracy Trend (30 Days)
Line chart showing daily prediction accuracy over the past 30 days.

**How to Use**:
- Identify accuracy drops and correlate with system changes
- Look for seasonal patterns
- Compare with market volatility

#### Match Score Distribution
Bar chart showing distribution of recommendation match scores.

**How to Use**:
- Healthy distribution should be bell-curved around 60-80
- Too many low scores (<40) indicates poor matching
- Too many high scores (>90) may indicate overfitting

---

## Fraud Alert Management

### Viewing Alerts

The Fraud Alerts table displays all alerts with:
- **Entity Type**: vendor, case, auction, or user
- **Risk Score**: 0-100 (higher = more suspicious)
- **Status**: pending, confirmed, or dismissed
- **Created**: Timestamp of alert generation

**Sorting**: Click column headers to sort  
**Filtering**: Use status filter to show only pending alerts

### Reviewing an Alert

1. Click "Review" button on any alert
2. Modal opens with detailed information:
   - **Summary**: Entity details and risk score
   - **Flag Reasons**: Specific fraud patterns detected
   - **Evidence**: Supporting data (photos, bid patterns, etc.)
   - **Recommendations**: Suggested actions

### Alert Types

#### Photo Authenticity Issues
- **Evidence**: Duplicate photo hashes, EXIF mismatches
- **Actions**: Request new photos, flag case for manual review

#### Shill Bidding
- **Evidence**: Consecutive bids, timing patterns, vendor-adjuster relationships
- **Actions**: Suspend vendor, investigate adjuster, review auction

#### Claim Pattern Fraud
- **Evidence**: Repeat claimants, similar damage patterns, geographic clustering
- **Actions**: Flag user account, review all cases from user

#### Vendor-Adjuster Collusion
- **Evidence**: Win rate patterns, bid timing, price manipulation
- **Actions**: Suspend both parties, review all related auctions

### Taking Action

Three action buttons available:

#### 1. Dismiss
- Use for false positives
- Requires reason in notes field
- Alert status changes to "dismissed"
- No action taken on entity

#### 2. Confirm
- Use when fraud is verified
- Requires notes documenting evidence
- Alert status changes to "confirmed"
- Entity is flagged in system

#### 3. Suspend
- Use for serious fraud cases
- Immediately suspends entity (vendor/user)
- Requires detailed notes
- Triggers notification to entity
- Can be reversed by system admin

### Best Practices

1. **Review Promptly**: Address pending alerts within 24 hours
2. **Document Thoroughly**: Add detailed notes for all decisions
3. **Investigate Context**: Review entity history before taking action
4. **Escalate When Needed**: Contact system admin for complex cases
5. **Monitor Patterns**: Look for related alerts across entities

---

## Analytics Dashboard

**Access**: `/admin/intelligence/analytics`

### Asset Performance Matrix

Table showing performance metrics for each asset type/make/model:
- **Avg Final Price**: Average winning bid
- **Avg Bid Count**: Average number of bids per auction
- **Sell-Through Rate**: Percentage of auctions that sold
- **Demand Score**: 0-100 indicating market demand

**Features**:
- Sort by any column
- Export to Excel
- Drill down to specific models

**Use Cases**:
- Identify trending assets
- Spot pricing anomalies
- Forecast demand

### Attribute Performance

Tabs for Color, Trim, and Storage attributes showing:
- **Avg Price Premium**: Price difference vs base
- **Demand Score**: Popularity metric
- **Total Auctions**: Sample size

**Use Cases**:
- Understand attribute value
- Guide pricing recommendations
- Identify market preferences

### Temporal Patterns

Heatmaps showing bidding activity by:
- **Hour of Day**: 0-23
- **Day of Week**: Sunday-Saturday
- **Month of Year**: January-December

**Color Coding**:
- Green: High activity
- Yellow: Medium activity
- Red: Low activity

**Use Cases**:
- Optimize auction scheduling
- Identify peak bidding times
- Plan marketing campaigns

### Geographic Distribution

Map visualization showing:
- **Regional Prices**: Average by region
- **Demand Levels**: Color-coded intensity
- **Top Asset Types**: Per region

**Use Cases**:
- Understand regional markets
- Target marketing by location
- Adjust pricing strategies

### Vendor Segments

Pie chart and table showing vendor classifications:
- **Premium Buyers**: High-value, frequent bidders
- **Bargain Hunters**: Low-price, opportunistic bidders
- **Specialists**: Focus on specific asset types
- **Casual Browsers**: Low engagement

**Metrics Per Segment**:
- Vendor count
- Avg bid amount
- Win rate
- Session duration

**Use Cases**:
- Tailor recommendations
- Segment marketing
- Understand user behavior

### Conversion Funnel

Sankey diagram showing:
1. **View**: Auction page views
2. **Watch**: Added to watchlist
3. **Bid**: Placed bid
4. **Win**: Won auction

**Metrics**:
- Count at each stage
- Conversion rate between stages
- Drop-off points

**Use Cases**:
- Identify friction points
- Optimize user experience
- Improve conversion rates

### Session Analytics

Metrics about vendor browsing behavior:
- **Avg Session Duration**: Time on site
- **Avg Pages Per Session**: Engagement level
- **Bounce Rate**: Single-page visits
- **Return Rate**: Repeat visitors
- **Conversion Rate**: Bid placement rate

**Use Cases**:
- Measure engagement
- Identify UX issues
- Track improvements

### Top Performers

Lists showing:
- **Top Assets**: By auction count and revenue
- **Top Vendors**: By bid count and win rate
- **Top Regions**: By activity and revenue

**Use Cases**:
- Recognize trends
- Reward top performers
- Focus resources

### Exporting Analytics

Click "Export All Analytics" to download Excel workbook with all data.

**Workbook Contains**:
- Asset Performance (sheet 1)
- Attribute Performance (sheet 2)
- Temporal Patterns (sheet 3)
- Geographic Distribution (sheet 4)
- Vendor Segments (sheet 5)
- Conversion Funnel (sheet 6)
- Session Analytics (sheet 7)

---

## Algorithm Configuration

**Access**: `/admin/intelligence/config`

### Configuration Parameters

#### Prediction Algorithm

**Similarity Threshold** (0-100)
- Minimum similarity score for historical matching
- Default: 60
- Lower = more matches, less accurate
- Higher = fewer matches, more accurate

**Time Decay Factor** (0-1)
- Weight reduction for older data
- Default: 0.5 (50% weight at 6 months)
- Lower = faster decay
- Higher = slower decay

**Market Adjustment Range** (0-0.3)
- Maximum price adjustment from market conditions
- Default: 0.15 (±15%)
- Lower = more conservative
- Higher = more responsive

**Confidence Threshold** (0-1)
- Minimum confidence to show prediction
- Default: 0.3 (30%)
- Lower = show more predictions
- Higher = show only high-confidence

#### Recommendation Algorithm

**Match Score Threshold** (0-100)
- Minimum match score to recommend
- Default: 30
- Lower = more recommendations
- Higher = fewer, better recommendations

**Collaborative Weight** (0-1)
- Weight of collaborative filtering
- Default: 0.6 (60%)
- Remaining weight goes to content-based

**Diversity Factor** (0-1)
- Encourages variety in recommendations
- Default: 0.3 (30%)
- Lower = more similar items
- Higher = more diverse items

**Recency Bias** (0-1)
- Preference for recent vendor activity
- Default: 0.7 (70%)
- Lower = consider all history equally
- Higher = focus on recent behavior

#### Fraud Detection

**Risk Score Threshold** (0-100)
- Minimum score to generate alert
- Default: 70
- Lower = more alerts (sensitive)
- Higher = fewer alerts (specific)

**Photo Hash Threshold** (0-64)
- Hamming distance for duplicate detection
- Default: 8
- Lower = stricter matching
- Higher = looser matching

**Collusion Win Rate Threshold** (0-1)
- Win rate to flag vendor-adjuster pairs
- Default: 0.6 (60%)
- Lower = more sensitive
- Higher = less sensitive

### Changing Configuration

1. Adjust sliders or input values
2. Click "Preview Impact" to see estimated effects
3. Review comparison table:
   - Current values
   - New values
   - Expected impact
4. Click "Save Changes"
5. Confirm in modal
6. Changes take effect immediately

### Configuration History

Table showing all past changes:
- **Parameter**: What was changed
- **Old Value**: Previous setting
- **New Value**: New setting
- **Changed By**: Admin who made change
- **Changed At**: Timestamp
- **Reason**: Notes about why

**Use Cases**:
- Audit configuration changes
- Revert problematic changes
- Understand system evolution

### Reset to Defaults

Click "Reset to Defaults" to restore all parameters to recommended values.

**Warning**: This cannot be undone. Current configuration will be lost.

---

## Data Export

**Access**: `/admin/intelligence/export`

### Export Types

#### Predictions Dataset
- All prediction records
- Includes actual outcomes
- Feature vectors included
- Useful for model training

#### Recommendations Dataset
- All recommendation records
- Includes click/bid data
- Effectiveness metrics
- Useful for algorithm tuning

#### Interactions Dataset
- All vendor interaction events
- Session data included
- Behavioral patterns
- Useful for analytics

#### Fraud Detection Dataset
- All fraud alerts
- Evidence data
- Review outcomes
- Useful for fraud model training

### Export Configuration

**Date Range**:
- Start Date: Beginning of export period
- End Date: End of export period
- Max range: 1 year

**Format**:
- CSV: Standard comma-separated
- JSON: Structured data
- Parquet: Columnar format (for big data)

**Options**:
- **Anonymize PII**: Remove personal information (recommended)
- **Include Metadata**: Add schema and documentation
- **Split Dataset**: Divide into train/validation/test sets

**Split Ratios** (if enabled):
- Train: 70%
- Validation: 15%
- Test: 15%

### Exporting Data

1. Select dataset type
2. Choose date range
3. Select format
4. Configure options
5. Click "Export Dataset"
6. Progress bar shows status
7. Download link appears when complete
8. File expires after 24 hours

### Export History

Table showing past exports:
- **Dataset Type**: What was exported
- **Format**: File format
- **Record Count**: Number of records
- **Created At**: Export timestamp
- **Status**: completed, processing, or failed
- **Actions**: Download (if available)

**Note**: Export files are automatically deleted after 24 hours for security.

---

## System Monitoring

### Health Checks

**Endpoint**: `/api/intelligence/health`

**Checks**:
- Database connectivity
- Redis cache availability
- Background job status
- API response times
- Error rates

**Status Codes**:
- 200: All systems operational
- 503: Degraded performance or outages

### Performance Monitoring

**Metrics Tracked**:
- API response times (p50, p95, p99)
- Cache hit rates
- Database query performance
- Background job execution times
- Error rates by endpoint

**Dashboards**:
- Real-time metrics in admin dashboard
- Historical trends in analytics
- Alerts for degraded performance

### Accuracy Monitoring

**Prediction Accuracy**:
- Tracked automatically when auctions close
- Daily aggregation
- Alerts if accuracy drops below 85%

**Recommendation Effectiveness**:
- Tracked via click and bid events
- Hourly aggregation
- Alerts if conversion drops below 10%

### Alerting

**Alert Types**:
- Accuracy degradation
- High error rates
- System outages
- Fraud spikes
- Job failures

**Notification Channels**:
- Email to admin team
- Socket.IO events to admin dashboard
- System logs

**Alert Thresholds**:
- Prediction accuracy < 85%
- Recommendation conversion < 10%
- Error rate > 1%
- Response time > 500ms
- Cache hit rate < 70%

### Troubleshooting

#### Prediction Accuracy Declining

**Possible Causes**:
- Market volatility increased
- Data quality issues
- Algorithm parameters need tuning
- Insufficient historical data

**Actions**:
1. Check market conditions in analytics
2. Review recent predictions for patterns
3. Inspect prediction calculation details
4. Adjust similarity threshold if needed
5. Verify data quality in database

#### Recommendation Conversion Low

**Possible Causes**:
- Poor match quality
- Vendor preferences changed
- Algorithm parameters too loose
- Insufficient vendor data

**Actions**:
1. Review match score distribution
2. Check vendor segment changes
3. Inspect recommendation reasons
4. Adjust match score threshold
5. Verify vendor bidding patterns

#### High Fraud Alert Rate

**Possible Causes**:
- Actual fraud increase
- Algorithm too sensitive
- Data quality issues
- False positive patterns

**Actions**:
1. Review confirmed vs dismissed ratio
2. Check alert patterns by type
3. Adjust risk score threshold if needed
4. Investigate common false positives
5. Update fraud detection rules

#### System Performance Issues

**Possible Causes**:
- Database query slowness
- Redis cache issues
- High traffic load
- Background job backlog

**Actions**:
1. Check database query performance
2. Verify Redis connectivity
3. Review API response times
4. Check background job status
5. Scale resources if needed

---

## Best Practices

### Daily Tasks

1. **Review Pending Fraud Alerts**: Address within 24 hours
2. **Check System Health**: Verify all metrics are green
3. **Monitor Accuracy Trends**: Look for declining patterns
4. **Review High-Risk Alerts**: Prioritize serious fraud cases

### Weekly Tasks

1. **Analyze Performance Trends**: Review 7-day accuracy and conversion
2. **Export Analytics Report**: Share with stakeholders
3. **Review Configuration Changes**: Verify impact of recent changes
4. **Check Vendor Segments**: Monitor segment distribution changes

### Monthly Tasks

1. **Comprehensive Analytics Review**: Deep dive into all metrics
2. **Algorithm Performance Audit**: Assess prediction and recommendation quality
3. **Fraud Pattern Analysis**: Identify emerging fraud trends
4. **Export ML Training Data**: Update datasets for model training
5. **Configuration Optimization**: Fine-tune parameters based on performance

### Security

1. **Access Control**: Only grant admin access to trusted personnel
2. **Audit Logging**: All actions are logged for compliance
3. **Data Privacy**: Always anonymize PII in exports
4. **Fraud Alerts**: Treat as confidential, do not share externally
5. **Configuration Changes**: Document reasons for all changes

---

## Support

For technical issues or questions:
- **Email**: support@neminsurance.com
- **Documentation**: /docs/intelligence/
- **API Reference**: /docs/intelligence/API_DOCUMENTATION.md

For urgent fraud cases:
- **Escalation**: Contact system administrator immediately
- **Emergency**: Use fraud hotline (24/7)

---

## Appendix

### Glossary

- **Prediction Accuracy**: Percentage difference between predicted and actual prices
- **Match Score**: 0-100 value indicating recommendation relevance
- **Risk Score**: 0-100 value indicating fraud likelihood
- **Confidence Score**: 0-100 value indicating prediction reliability
- **Sell-Through Rate**: Percentage of auctions that resulted in sales
- **Demand Score**: 0-100 value indicating market demand
- **Conversion Rate**: Percentage of views that led to bids

### Keyboard Shortcuts

- `Ctrl+F`: Search alerts table
- `Ctrl+E`: Export current view
- `Ctrl+R`: Refresh dashboard
- `Esc`: Close modal

### FAQ

**Q: How often is the dashboard updated?**  
A: Real-time for fraud alerts, every 5 minutes for predictions/recommendations, hourly for analytics.

**Q: Can I revert a fraud alert decision?**  
A: Yes, contact system administrator to revert confirmed or dismissed alerts.

**Q: How long is exported data retained?**  
A: Export files are automatically deleted after 24 hours for security.

**Q: What happens when I change algorithm configuration?**  
A: Changes take effect immediately for new predictions/recommendations. Existing cached data expires within 15 minutes.

**Q: How do I know if the system is working correctly?**  
A: Check System Health card on dashboard. All metrics should be green. Set up email alerts for automatic monitoring.

