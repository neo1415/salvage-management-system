# Migration 0012: Search Metrics and Analytics Tables

## Overview

This migration adds comprehensive analytics tables for the Universal AI Internet Search System to support real-time monitoring, performance tracking, cost management, and business intelligence.

## Tables Created

### 1. search_performance_metrics
**Purpose**: Real-time tracking of search performance for monitoring and alerting

**Key Fields**:
- `period_type`: Time period granularity ('minute', 'hour', 'day')
- `total_searches`, `successful_searches`, `failed_searches`: Search volume metrics
- `avg_response_time_ms`, `p95_response_time_ms`, `p99_response_time_ms`: Performance metrics
- `cache_hit_rate`: Cache performance tracking
- `api_errors`, `rate_limit_errors`: Error tracking

**Use Cases**:
- Real-time performance dashboards
- SLA monitoring and alerting
- Performance regression detection
- System health monitoring

### 2. search_usage_analytics
**Purpose**: Track user behavior patterns and search usage for business intelligence

**Key Fields**:
- `analytics_date`, `hour_of_day`: Time-based analytics
- `vehicle_searches`, `electronics_searches`, etc.: Item type breakdown
- `unique_queries`, `repeat_queries`: Search pattern analysis
- `most_common_brands`, `most_common_models`: Popular item tracking
- `search_abandonment_rate`: User behavior metrics

**Use Cases**:
- Business intelligence dashboards
- User behavior analysis
- Product popularity tracking
- Market trend identification

### 3. search_quality_metrics
**Purpose**: Track search result quality, confidence scores, and accuracy metrics

**Key Fields**:
- `high_confidence_searches`, `medium_confidence_searches`, `low_confidence_searches`: Quality distribution
- `avg_confidence_score`: Overall quality tracking
- `price_extraction_success_rate`: Data extraction performance
- `reliable_sources_count`: Source quality tracking
- `user_feedback_count`, `accuracy_score`: User satisfaction metrics

**Use Cases**:
- Search quality monitoring
- Algorithm performance tracking
- Source reliability analysis
- User satisfaction measurement

### 4. api_cost_analytics
**Purpose**: Detailed tracking of API usage, costs, and rate limiting for budget management

**Key Fields**:
- `total_requests`, `successful_requests`: Usage volume
- `total_cost_usd`, `projected_monthly_cost`: Cost tracking
- `quota_used`, `quota_utilization_rate`: Quota management
- `budget_alert_triggered`: Automated alerting
- `cost_savings_from_cache`: Efficiency metrics

**Use Cases**:
- Budget monitoring and alerts
- Cost optimization analysis
- Quota management
- ROI calculation for caching

### 5. search_trend_analytics
**Purpose**: Business intelligence data for market trends and popular items

**Key Fields**:
- `trending_vehicles`, `trending_electronics`: Popular item tracking
- `price_trends`: Market price movement analysis
- `search_volume_change_pct`: Trend analysis
- `conversion_rate`: Business metrics
- `regional_search_patterns`: Geographic insights

**Use Cases**:
- Market trend analysis
- Business intelligence reporting
- Strategic planning insights
- Geographic market analysis

## Dashboard Views Created

### search_performance_dashboard
Real-time performance monitoring view showing:
- Success rates and response times
- Cache performance metrics
- Error rates and types
- 24-hour rolling performance data

### daily_search_summary
Daily analytics summary combining:
- Search volume by item type
- Quality and confidence metrics
- Cost and quota utilization
- Comprehensive daily overview

### cost_monitoring_dashboard
Cost and budget monitoring view showing:
- Daily API usage and costs
- Quota utilization trends
- Budget alerts and projections
- Cost savings from caching

## Analytics Functions Created

### calculate_search_performance_metrics()
Aggregates performance data from internet_search_logs into time-based metrics:
- Calculates success rates and response times
- Tracks cache performance
- Monitors error rates by type
- Supports minute, hour, and day aggregations

### update_popular_queries()
Maintains popular search queries for cache optimization:
- Identifies frequently searched queries
- Calculates query performance metrics
- Updates cache warming recommendations
- Tracks query success rates

## Migration Scripts

### run-migration-0012.ts
Executes the migration with comprehensive logging:
```bash
npm run tsx scripts/run-migration-0012.ts
```

### verify-migration-0012.ts
Verifies migration success with detailed checks:
```bash
npm run tsx scripts/verify-migration-0012.ts
```

## Integration Points

### Existing Systems
- **internet_search_logs**: Source data for analytics aggregation
- **market_data_cache**: Cache performance integration
- **valuation_audit_logs**: Migration tracking and audit trail

### Future Integrations
- **Dashboard APIs**: Real-time monitoring endpoints
- **Alert Systems**: Automated notifications for performance/cost issues
- **Analytics Services**: Data processing and reporting services
- **Business Intelligence**: Strategic insights and reporting

## Performance Considerations

### Indexing Strategy
- Time-based indexes for efficient date range queries
- Item type indexes for category-specific analytics
- Composite indexes for common query patterns
- GIN indexes for JSONB fields

### Data Retention
- Performance metrics: 90 days detailed, 1 year aggregated
- Usage analytics: 1 year detailed, 3 years aggregated
- Quality metrics: 6 months detailed, 2 years aggregated
- Cost analytics: 2 years (regulatory compliance)
- Trend analytics: 3 years (business intelligence)

### Optimization Features
- Partial indexes for frequently queried conditions
- Materialized views for complex aggregations (future)
- Automated data archiving (future)
- Query performance monitoring

## Security and Compliance

### Data Privacy
- No personally identifiable information stored
- Search queries sanitized and anonymized
- Geographic data aggregated only
- User behavior tracked at system level only

### Access Control
- Analytics tables read-only for most users
- Admin-only access for cost and performance data
- Audit logging for all analytics access
- Role-based permissions for different analytics levels

## Monitoring and Alerting

### Key Metrics to Monitor
- Search success rate < 95%
- Average response time > 3 seconds
- API quota utilization > 80%
- Daily cost > budget threshold
- Cache hit rate < 70%

### Alert Thresholds
- Performance degradation: 5% drop in success rate
- Cost overrun: 80% of monthly budget used
- Quota warning: 90% of monthly quota used
- Quality issues: Confidence score < 60%

## Business Value

### Cost Optimization
- Track API usage to stay within free tier
- Identify opportunities for cache optimization
- Monitor ROI of search system investment
- Predict and prevent cost overruns

### Performance Monitoring
- Ensure SLA compliance for search response times
- Identify and resolve performance bottlenecks
- Track system reliability and availability
- Monitor user experience metrics

### Business Intelligence
- Understand market trends and popular items
- Identify growth opportunities
- Track user behavior and preferences
- Support strategic business decisions

### Quality Assurance
- Monitor search result quality and accuracy
- Track confidence scores and user satisfaction
- Identify areas for algorithm improvement
- Ensure consistent service quality

## Next Steps

1. **Service Integration**: Update analytics services to populate new tables
2. **Dashboard Development**: Create real-time monitoring dashboards
3. **Alert Configuration**: Set up automated monitoring and alerting
4. **Data Processing**: Implement automated analytics data processing jobs
5. **Business Reporting**: Create business intelligence reports and insights

## Troubleshooting

### Common Issues
- **Migration fails**: Check database permissions and connection
- **Views not working**: Verify dependent tables exist
- **Functions not created**: Check PostgreSQL version compatibility
- **Performance issues**: Review index usage and query patterns

### Rollback Procedure
If rollback is needed:
1. Drop created views: `DROP VIEW IF EXISTS search_performance_dashboard, daily_search_summary, cost_monitoring_dashboard;`
2. Drop created functions: `DROP FUNCTION IF EXISTS calculate_search_performance_metrics, update_popular_queries;`
3. Drop created tables in reverse order
4. Remove audit log entries

### Support
For issues with this migration:
1. Check migration logs for specific error messages
2. Verify database permissions and connectivity
3. Review PostgreSQL logs for detailed error information
4. Contact development team with specific error details