# Migration 0010: Internet Search Analytics Tables

## Overview

This migration adds database tables for the Universal AI Internet Search System analytics and monitoring. These tables support the 24-hour Redis cache strategy with persistent analytics storage for long-term insights and performance monitoring.

## Purpose

The Universal AI Internet Search System replaces the current market data scraping system with real-time Google searches via Serper.dev API. While the system uses Redis for 24-hour caching, these database tables provide:

- **Long-term Analytics**: Track search performance over time
- **Cost Monitoring**: Monitor API usage and costs to stay within limits
- **Performance Optimization**: Identify slow queries and optimization opportunities
- **Cache Optimization**: Track popular queries for preemptive caching
- **Debugging Support**: Detailed logs for troubleshooting search issues

## Tables Created

### 1. `internet_search_logs`
**Purpose**: Detailed logging of all search operations

**Key Fields**:
- `search_hash`: Unique identifier for search parameters
- `query`: The actual search query sent to Serper.dev
- `item_type`: Type of item searched (vehicle, electronics, etc.)
- `item_details`: JSON details of the searched item
- `status`: Search result status (success, error, timeout, rate_limited)
- `response_time_ms`: API response time for performance monitoring
- `data_source`: Where the result came from (internet, cache, database)
- `api_cost`: Cost of the API call in USD

**Use Cases**:
- Performance monitoring and optimization
- Debugging failed searches
- Cost tracking and budget management
- Search pattern analysis

### 2. `internet_search_results`
**Purpose**: Individual search results for detailed analysis

**Key Fields**:
- `search_log_id`: Links to the parent search operation
- `title`, `snippet`, `url`: Raw search result data
- `extracted_price`: Price extracted from the result
- `price_confidence`: Confidence score for price extraction
- `position`: Position in search results (for relevance analysis)

**Use Cases**:
- Price extraction accuracy analysis
- Source reliability assessment
- Search result quality evaluation
- Algorithm improvement insights

### 3. `internet_search_metrics`
**Purpose**: Aggregated performance metrics by time period

**Key Fields**:
- `period_type`: Time period (hour, day, week, month)
- `total_searches`, `successful_searches`, `failed_searches`
- `avg_response_time`, `avg_confidence`
- `total_api_cost`: Cost tracking by period
- `cache_hit_rate`: Cache performance metrics

**Use Cases**:
- Dashboard reporting
- Performance trend analysis
- Cost forecasting
- SLA monitoring

### 4. `popular_search_queries`
**Purpose**: Track frequently searched queries for optimization

**Key Fields**:
- `query_hash`: Unique identifier for the query
- `search_count`: Number of times searched
- `avg_response_time`: Average performance
- `should_pre_cache`: Flag for cache warming
- `success_rate`: Query reliability score

**Use Cases**:
- Cache warming strategies
- Query optimization
- Popular item identification
- Preemptive data loading

### 5. `api_usage_tracking`
**Purpose**: Daily API usage monitoring for cost control

**Key Fields**:
- `provider`: API provider (serper, fallback)
- `request_count`, `success_count`, `error_count`
- `total_cost`: Daily cost tracking
- `quota_used`, `quota_limit`: Rate limit monitoring
- `tracking_date`: Daily tracking period

**Use Cases**:
- Cost monitoring and alerts
- Rate limit management
- Budget forecasting
- Usage optimization

## Integration with Existing System

### Redis Cache Strategy
- **Primary Cache**: Redis with 24-hour TTL for fast access
- **Analytics Storage**: Database tables for persistent tracking
- **Fallback Chain**: Internet → Cache → Database → Manual entry

### Compatibility
- **Existing Tables**: Works alongside `market_data_cache` and `scraping_logs`
- **API Integration**: Designed for Serper.dev but extensible to other providers
- **Monitoring**: Integrates with existing audit and logging systems

## Performance Considerations

### Indexes Created
- **Search Performance**: Indexes on search_hash, item_type, status
- **Analytics Queries**: Indexes on created_at, response_time, confidence
- **Reporting**: Indexes on period_type, tracking_date
- **Optimization**: Indexes on popular queries and cache flags

### Data Retention
- **Search Logs**: Recommend 90-day retention for detailed analysis
- **Metrics**: Keep aggregated data for 1+ years
- **Popular Queries**: Ongoing tracking with periodic cleanup
- **API Usage**: Keep for billing and compliance (1+ years)

## Usage Examples

### Track Search Performance
```sql
-- Daily search success rate
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_searches,
  COUNT(*) FILTER (WHERE status = 'success') as successful,
  ROUND(AVG(response_time_ms)) as avg_response_time
FROM internet_search_logs 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Monitor API Costs
```sql
-- Monthly API cost tracking
SELECT 
  DATE_TRUNC('month', tracking_date) as month,
  SUM(total_cost) as monthly_cost,
  SUM(request_count) as total_requests,
  AVG(avg_cost_per_request) as avg_cost_per_request
FROM api_usage_tracking 
WHERE provider = 'serper'
GROUP BY DATE_TRUNC('month', tracking_date)
ORDER BY month DESC;
```

### Identify Popular Queries
```sql
-- Top 10 most searched queries
SELECT 
  query,
  item_type,
  search_count,
  avg_response_time,
  success_rate
FROM popular_search_queries 
ORDER BY search_count DESC 
LIMIT 10;
```

## Migration Steps

### 1. Run Migration
```bash
npm run tsx scripts/run-migration-0010.ts
```

### 2. Verify Migration
```bash
npm run tsx scripts/verify-migration-0010.ts
```

### 3. Update Services
After migration, update the internet search services to use the new analytics tables:
- Enable logging in `InternetSearchService`
- Update cache integration to track popular queries
- Add cost tracking to API client
- Set up monitoring dashboards

## Monitoring and Alerts

### Recommended Alerts
- **API Cost**: Alert when monthly cost > 80% of budget
- **Rate Limits**: Alert when quota usage > 90%
- **Performance**: Alert when avg response time > 5 seconds
- **Error Rate**: Alert when error rate > 5%
- **Cache Hit Rate**: Alert when cache hit rate < 70%

### Dashboard Metrics
- Search volume trends
- Performance metrics (response time, success rate)
- Cost tracking and forecasting
- Popular search patterns
- Cache performance

## Rollback Plan

If rollback is needed:

```sql
-- Drop all internet search tables
DROP TABLE IF EXISTS internet_search_results CASCADE;
DROP TABLE IF EXISTS internet_search_logs CASCADE;
DROP TABLE IF EXISTS internet_search_metrics CASCADE;
DROP TABLE IF EXISTS popular_search_queries CASCADE;
DROP TABLE IF EXISTS api_usage_tracking CASCADE;

-- Remove audit log entry
DELETE FROM valuation_audit_logs 
WHERE entity_type = 'migration' 
AND changed_fields->'migration'->>'name' = '0010_add_internet_search_tables';
```

## Next Steps

1. **Service Integration**: Update internet search services to use analytics tables
2. **Monitoring Setup**: Configure dashboards and alerts
3. **Data Retention**: Set up automated cleanup jobs
4. **Performance Tuning**: Monitor and optimize based on usage patterns
5. **Cost Management**: Implement budget alerts and usage optimization

## Support

For issues with this migration:
1. Check database connection and permissions
2. Verify previous migrations (0000-0009) are completed
3. Ensure super admin user exists for audit logging
4. Review migration logs for specific error details