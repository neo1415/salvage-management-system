# Gemini Damage Detection Monitoring

This directory contains monitoring and metrics tracking for the Gemini damage detection service.

## Overview

The monitoring system tracks key metrics for Gemini API usage and performance, enabling proactive alerting and capacity planning.

## Components

### 1. Metrics Collector (`gemini-metrics.ts`)

In-memory metrics collector that tracks:

**Success Rates**:
- Gemini success count
- Gemini failure count  
- Vision API fallback count
- Neutral response count

**Response Times**:
- Gemini response times (milliseconds)
- Vision API response times (milliseconds)

**API Usage**:
- Daily API calls
- Daily quota limit (1,500 requests/day)

**Error Tracking**:
- Errors by type
- Error counts and percentages

### 2. Metrics API (`/api/admin/gemini-metrics`)

Admin-only API endpoint for accessing metrics:

**GET /api/admin/gemini-metrics**
- Returns current metrics summary
- Includes rate limiter status
- Includes active alerts
- Requires admin authentication

**POST /api/admin/gemini-metrics/reset**
- Resets metrics collector (for testing)
- Requires admin authentication

## Metrics Summary

The metrics summary includes calculated statistics:

```typescript
{
  // Success rates (percentages)
  geminiSuccessRate: number;
  visionFallbackRate: number;
  neutralFallbackRate: number;
  
  // Average response times (milliseconds)
  avgGeminiResponseTime: number;
  avgVisionResponseTime: number;
  
  // Quota usage
  dailyQuotaUsagePercent: number;
  dailyQuotaRemaining: number;
  
  // Error rate
  overallErrorRate: number;
  topErrors: Array<{ type: string; count: number; percentage: number }>;
  
  // Period
  periodStart: Date;
  periodEnd: Date;
  totalAssessments: number;
}
```

## Alerting Thresholds

The system automatically checks for threshold violations:

| Metric | Warning Threshold | Critical Threshold |
|--------|------------------|-------------------|
| Gemini failure rate | - | >20% |
| Daily quota usage | >1,200 requests (80%) | >1,350 requests (90%) |
| Average response time | >15 seconds | - |
| Overall error rate | >5% | - |

## Usage

### Recording Metrics

Metrics are automatically recorded by the AI assessment service. To manually record metrics:

```typescript
import { getGeminiMetricsCollector } from '@/lib/monitoring/gemini-metrics';

const collector = getGeminiMetricsCollector();

// Record successful Gemini assessment
collector.recordGeminiSuccess(responseTimeMs);

// Record Gemini failure
collector.recordGeminiFailure('timeout');

// Record Vision API fallback
collector.recordVisionFallback(responseTimeMs);

// Record neutral response
collector.recordNeutralFallback();
```

### Accessing Metrics

**Via API** (requires admin auth):
```bash
curl -X GET https://your-domain.com/api/admin/gemini-metrics \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Via Code**:
```typescript
import { getGeminiMetricsCollector } from '@/lib/monitoring/gemini-metrics';

const collector = getGeminiMetricsCollector();
const summary = collector.getSummary();
const alerts = collector.checkAlerts();
```

### Checking Alerts

```typescript
import { getGeminiMetricsCollector } from '@/lib/monitoring/gemini-metrics';

const collector = getGeminiMetricsCollector();
const alerts = collector.checkAlerts();

alerts.forEach(alert => {
  console.log(`[${alert.severity.toUpperCase()}] ${alert.message}`);
});
```

## Monitoring Dashboard

### Recommended Metrics to Display

1. **Success Rate Chart** (line chart over time)
   - Gemini success rate
   - Vision fallback rate
   - Neutral fallback rate

2. **Response Time Chart** (line chart over time)
   - Average Gemini response time
   - Average Vision response time
   - 95th percentile response times

3. **Quota Usage Gauge**
   - Current daily usage
   - Percentage of quota used
   - Estimated time until quota exhaustion

4. **Error Rate Chart** (bar chart)
   - Top 5 error types
   - Error counts and percentages

5. **Active Alerts Panel**
   - List of current warnings and critical alerts
   - Alert severity and messages

### Dashboard Access

The monitoring dashboard should be accessible at:
- `/admin/monitoring/gemini` (admin-only page)

Or integrate metrics into existing admin dashboard.

## Weekly Usage Report

To generate a weekly usage report:

```typescript
import { getGeminiMetricsCollector } from '@/lib/monitoring/gemini-metrics';

const collector = getGeminiMetricsCollector();
const summary = collector.getSummary();

const report = {
  period: {
    start: summary.periodStart,
    end: summary.periodEnd,
  },
  totalAssessments: summary.totalAssessments,
  successRates: {
    gemini: `${summary.geminiSuccessRate.toFixed(1)}%`,
    visionFallback: `${summary.visionFallbackRate.toFixed(1)}%`,
    neutralFallback: `${summary.neutralFallbackRate.toFixed(1)}%`,
  },
  performance: {
    avgGeminiResponseTime: `${(summary.avgGeminiResponseTime / 1000).toFixed(2)}s`,
    avgVisionResponseTime: `${(summary.avgVisionResponseTime / 1000).toFixed(2)}s`,
  },
  quotaUsage: {
    dailyUsage: `${summary.dailyQuotaUsagePercent.toFixed(1)}%`,
    remaining: summary.dailyQuotaRemaining,
  },
  errors: {
    overallRate: `${summary.overallErrorRate.toFixed(1)}%`,
    topErrors: summary.topErrors,
  },
};

console.log('Weekly Gemini Usage Report:', JSON.stringify(report, null, 2));
```

## External Monitoring

For production environments, consider integrating with:

### Google AI Studio
- Monitor quota usage: https://aistudio.google.com/usage
- View API key usage and limits
- Track daily request counts

### Application Performance Monitoring (APM)
- **Datadog**: Custom metrics and dashboards
- **New Relic**: Application monitoring and alerting
- **Prometheus + Grafana**: Self-hosted metrics and visualization

### Log Aggregation
- **Splunk**: Log analysis and alerting
- **ELK Stack**: Elasticsearch, Logstash, Kibana
- **CloudWatch Logs**: AWS log aggregation

## Production Considerations

### Metrics Persistence

The current implementation uses in-memory metrics storage. For production:

1. **Store metrics in database** (PostgreSQL, MongoDB)
2. **Use time-series database** (InfluxDB, TimescaleDB)
3. **Export to metrics backend** (Prometheus, Datadog)

### Metrics Retention

Configure retention policies:
- **Real-time metrics**: Last 24 hours (in-memory)
- **Daily aggregates**: Last 30 days (database)
- **Weekly aggregates**: Last 12 months (database)

### Alerting Integration

Integrate with alerting systems:
- **Email alerts**: Send to admin team
- **Slack/Teams**: Post to monitoring channel
- **PagerDuty**: For critical alerts
- **SMS**: For quota exhaustion

## Testing

To test the monitoring system:

```typescript
import { getGeminiMetricsCollector, resetGeminiMetricsCollector } from '@/lib/monitoring/gemini-metrics';

// Reset metrics
resetGeminiMetricsCollector();

// Get fresh collector
const collector = getGeminiMetricsCollector();

// Simulate assessments
collector.recordGeminiSuccess(2500);
collector.recordGeminiSuccess(3000);
collector.recordGeminiFailure('timeout');
collector.recordVisionFallback(5000);

// Check summary
const summary = collector.getSummary();
console.log('Gemini success rate:', summary.geminiSuccessRate);

// Check alerts
const alerts = collector.checkAlerts();
console.log('Active alerts:', alerts);
```

## Requirements Satisfied

- ✅ 10.1: Metrics tracking (success rate, fallback rate, response time, daily usage, error rates)
- ✅ 10.4: Alerting thresholds (failure rate >20%, quota >1,200, response time >15s, error rate >5%)
- ✅ 10.5: Weekly usage report generation (via getSummary())
