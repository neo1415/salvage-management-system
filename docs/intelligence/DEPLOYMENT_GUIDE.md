# AI Marketplace Intelligence - Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the AI-Powered Marketplace Intelligence system to production. Follow all steps carefully to ensure a smooth deployment.

**Estimated Time**: 2-3 hours  
**Downtime Required**: None (zero-downtime deployment)  
**Team Required**: DevOps Engineer, Database Administrator, QA Engineer

---

## Pre-Deployment Checklist

### 1. Environment Variables

Verify all required environment variables are set:

```bash
# Core Intelligence
✓ INTELLIGENCE_ENABLED=true
✓ INTELLIGENCE_ALGORITHM_VERSION=v1.2.0

# Redis Configuration
✓ REDIS_URL=<your-redis-url>
✓ INTELLIGENCE_REDIS_TTL_PREDICTIONS=300
✓ INTELLIGENCE_REDIS_TTL_RECOMMENDATIONS=900

# Database
✓ DATABASE_URL=<your-database-url>
✓ POSTGIS_ENABLED=false  # Set to true if PostGIS is installed

# Existing Required Variables
✓ NEXTAUTH_URL
✓ NEXTAUTH_SECRET
✓ GOOGLE_CLOUD_PROJECT_ID
✓ GEMINI_API_KEY
```

**Verification Command**:
```bash
npm run check-env
```

### 2. Database Migrations

Verify all intelligence migrations are ready:

```bash
# Check migration files exist
ls -la src/lib/db/migrations/0021_add_intelligence_core_tables.sql
ls -la src/lib/db/migrations/0022_add_intelligence_analytics_tables.sql
ls -la src/lib/db/migrations/0023_add_intelligence_ml_training_tables.sql
ls -la src/lib/db/migrations/0024_add_intelligence_fraud_detection_tables.sql
ls -la src/lib/db/migrations/0025_add_intelligence_materialized_views.sql
```

**Expected Output**: All 5 migration files should exist

### 3. Dependencies

Verify all npm packages are installed:

```bash
npm install
npm audit fix
```

**Check for Intelligence Dependencies**:
- `drizzle-orm`: Database ORM
- `socket.io`: Real-time updates
- `ioredis`: Redis client
- `node-cron`: Background jobs

### 4. Build Verification

Test build locally:

```bash
npm run build
```

**Expected Output**: Build completes without errors

### 5. Test Suite

Run all tests:

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Performance tests
npm run test:performance

# Accuracy tests
npm run test:accuracy
```

**Required Pass Rate**: 100% for unit/integration, 95% for E2E

### 6. Code Quality

Run linting and type checking:

```bash
npm run lint
npm run type-check
```

**Expected Output**: No errors

---

## Deployment Steps

### Step 1: Database Backup

**CRITICAL**: Always backup database before migrations

```bash
# Production backup
pg_dump -h <host> -U <user> -d <database> -F c -b -v -f intelligence_pre_deploy_backup_$(date +%Y%m%d_%H%M%S).dump

# Verify backup
pg_restore --list intelligence_pre_deploy_backup_*.dump | head -20
```

**Backup Location**: Store in secure S3 bucket or backup server

### Step 2: Run Database Migrations

```bash
# Dry run (verify migrations)
npm run db:migrate:dry-run

# Apply migrations
npm run db:migrate

# Verify tables created
npm run db:verify-intelligence-tables
```

**Expected Output**:
```
✓ predictions table created
✓ recommendations table created
✓ interactions table created
✓ fraud_alerts table created
✓ algorithm_config table created
✓ asset_performance_analytics table created
✓ attribute_performance_analytics table created
✓ temporal_patterns_analytics table created
✓ geographic_patterns_analytics table created
✓ vendor_segments table created
✓ session_analytics table created
✓ conversion_funnel_analytics table created
✓ schema_evolution_log table created
✓ ml_training_datasets table created
✓ feature_vectors table created
✓ analytics_rollups table created
✓ prediction_logs table created
✓ recommendation_logs table created
✓ fraud_detection_logs table created
✓ algorithm_config_history table created
✓ photo_hashes table created
✓ photo_hash_index table created
✓ vendor_bidding_patterns_mv materialized view created
✓ market_conditions_mv materialized view created
✓ All indexes created successfully
```

### Step 3: Verify Database Schema

```bash
# Check table counts
npm run db:check-intelligence-schema

# Verify indexes
npm run db:verify-indexes

# Test materialized views
npm run db:test-materialized-views
```

### Step 4: Deploy Application Code

#### Option A: Vercel Deployment

```bash
# Set environment variables in Vercel dashboard
vercel env add INTELLIGENCE_ENABLED production
vercel env add INTELLIGENCE_ALGORITHM_VERSION production
vercel env add INTELLIGENCE_REDIS_TTL_PREDICTIONS production
vercel env add INTELLIGENCE_REDIS_TTL_RECOMMENDATIONS production

# Deploy
vercel --prod
```

#### Option B: Docker Deployment

```bash
# Build Docker image
docker build -t nem-insurance-intelligence:v1.2.0 .

# Tag for registry
docker tag nem-insurance-intelligence:v1.2.0 <registry>/nem-insurance-intelligence:v1.2.0

# Push to registry
docker push <registry>/nem-insurance-intelligence:v1.2.0

# Deploy to production
kubectl apply -f k8s/intelligence-deployment.yaml
kubectl rollout status deployment/nem-insurance-intelligence
```

#### Option C: Traditional Server

```bash
# Pull latest code
git pull origin main

# Install dependencies
npm ci --production

# Build application
npm run build

# Restart application
pm2 restart nem-insurance
pm2 save
```

### Step 5: Start Background Jobs

```bash
# Verify cron jobs are scheduled
npm run jobs:list

# Start job manager
npm run jobs:start

# Verify jobs running
npm run jobs:status
```

**Expected Jobs**:
- Materialized view refresh (every 5 min)
- Analytics aggregation (hourly)
- Accuracy tracking (hourly)
- Data maintenance (daily)
- Schema evolution (daily)

### Step 6: Warm Up Caches

```bash
# Pre-populate Redis cache
npm run cache:warmup

# Verify cache hit rate
npm run cache:stats
```

**Expected Cache Hit Rate**: 0% initially, should reach 80%+ within 1 hour

### Step 7: Smoke Tests

Run post-deployment smoke tests:

```bash
# Health check
curl https://your-domain.com/api/health

# Intelligence health check
curl https://your-domain.com/api/intelligence/health

# Test prediction endpoint
curl -H "Authorization: Bearer <token>" \
  https://your-domain.com/api/auctions/<auction-id>/prediction

# Test recommendation endpoint
curl -H "Authorization: Bearer <token>" \
  https://your-domain.com/api/vendors/<vendor-id>/recommendations

# Test admin dashboard
curl -H "Authorization: Bearer <admin-token>" \
  https://your-domain.com/api/intelligence/admin/dashboard
```

**Expected Response**: All endpoints return 200 OK

### Step 8: Monitor Initial Performance

Monitor for 30 minutes after deployment:

```bash
# Watch logs
tail -f logs/intelligence.log

# Monitor response times
npm run monitor:response-times

# Check error rates
npm run monitor:errors

# Verify background jobs
npm run jobs:monitor
```

**Acceptable Metrics**:
- Response time < 200ms (p95)
- Error rate < 0.1%
- All jobs running
- No critical errors in logs

### Step 9: Enable Feature Flags

Gradually enable intelligence features:

```bash
# Enable for 10% of users
npm run feature:enable intelligence --percentage 10

# Wait 1 hour, monitor metrics

# Enable for 50% of users
npm run feature:enable intelligence --percentage 50

# Wait 1 hour, monitor metrics

# Enable for 100% of users
npm run feature:enable intelligence --percentage 100
```

### Step 10: Verify End-to-End Functionality

Manual testing checklist:

**Vendor Tests**:
- [ ] View auction with prediction
- [ ] Check "For You" recommendations
- [ ] Place bid on recommended auction
- [ ] View market intelligence dashboard
- [ ] Download market report

**Admin Tests**:
- [ ] View intelligence dashboard
- [ ] Review fraud alert
- [ ] Check analytics dashboard
- [ ] Export ML dataset
- [ ] Update algorithm configuration

---

## Post-Deployment Verification

### Performance Metrics

Monitor these metrics for 24 hours:

**Prediction Performance**:
- Response time < 200ms (p95)
- Accuracy > 85%
- Confidence score distribution healthy
- Cache hit rate > 80%

**Recommendation Performance**:
- Response time < 200ms (p95)
- Click-through rate > 20%
- Bid conversion rate > 15%
- Match score distribution healthy

**System Health**:
- Error rate < 0.1%
- All background jobs running
- Database query performance < 100ms
- Redis latency < 10ms

### Data Quality Checks

```bash
# Verify predictions being generated
npm run verify:predictions

# Verify recommendations being generated
npm run verify:recommendations

# Check interaction tracking
npm run verify:interactions

# Verify analytics aggregation
npm run verify:analytics
```

### User Feedback

Monitor user feedback channels:
- Support tickets
- In-app feedback
- Social media mentions
- User surveys

---

## Rollback Plan

If critical issues are detected, follow this rollback procedure:

### Step 1: Disable Intelligence Features

```bash
# Disable via environment variable
vercel env add INTELLIGENCE_ENABLED=false production

# Or via feature flag
npm run feature:disable intelligence
```

### Step 2: Stop Background Jobs

```bash
npm run jobs:stop
```

### Step 3: Restore Database (if needed)

**ONLY if database corruption detected**:

```bash
# Stop application
pm2 stop nem-insurance

# Restore from backup
pg_restore -h <host> -U <user> -d <database> -c intelligence_pre_deploy_backup_*.dump

# Restart application
pm2 start nem-insurance
```

### Step 4: Revert Application Code

```bash
# Revert to previous version
git revert <commit-hash>
git push origin main

# Or rollback deployment
vercel rollback
```

### Step 5: Verify Rollback

```bash
# Check application is running
curl https://your-domain.com/api/health

# Verify intelligence disabled
curl https://your-domain.com/api/intelligence/health
# Expected: 503 Service Unavailable or feature disabled message
```

### Step 6: Investigate Issues

- Review error logs
- Check database queries
- Analyze performance metrics
- Gather user feedback
- Identify root cause

### Step 7: Fix and Redeploy

- Fix identified issues
- Test thoroughly in staging
- Follow deployment steps again

---

## Monitoring and Alerting Setup

### Application Monitoring

**Tools**: New Relic, Datadog, or similar

**Metrics to Track**:
- API response times (p50, p95, p99)
- Error rates by endpoint
- Database query performance
- Redis cache hit rates
- Background job execution times

**Alerts**:
- Response time > 500ms (p95)
- Error rate > 1%
- Cache hit rate < 70%
- Job failure

### Database Monitoring

**Metrics to Track**:
- Query execution times
- Connection pool usage
- Table sizes
- Index usage
- Materialized view refresh times

**Alerts**:
- Query time > 1s
- Connection pool exhausted
- Table size > 10GB (investigate)
- Index not being used

### Intelligence-Specific Monitoring

**Metrics to Track**:
- Prediction accuracy (daily)
- Recommendation effectiveness (daily)
- Fraud alert rate
- Algorithm performance

**Alerts**:
- Prediction accuracy < 85%
- Recommendation conversion < 10%
- Fraud alert spike (>50% increase)
- Algorithm performance degradation

### Log Aggregation

**Tools**: ELK Stack, Splunk, or CloudWatch

**Logs to Collect**:
- Application logs
- Error logs
- Audit logs
- Performance logs
- Background job logs

**Alerts**:
- Critical errors
- Repeated warnings
- Unusual patterns

---

## Troubleshooting

### Issue: Predictions Not Generating

**Symptoms**:
- Prediction endpoint returns 404 or empty
- No predictions in database

**Diagnosis**:
```bash
# Check if service is running
npm run service:status prediction

# Check database for historical data
npm run db:check-historical-auctions

# Check logs
tail -f logs/prediction.log
```

**Solutions**:
- Verify historical auction data exists
- Check algorithm configuration
- Restart prediction service
- Review error logs for specific issues

### Issue: Recommendations Not Showing

**Symptoms**:
- "For You" feed empty
- Recommendation endpoint returns empty array

**Diagnosis**:
```bash
# Check vendor bidding history
npm run db:check-vendor-bids <vendor-id>

# Check materialized views
npm run db:check-materialized-views

# Check logs
tail -f logs/recommendation.log
```

**Solutions**:
- Verify vendor has bidding history
- Refresh materialized views manually
- Check cold-start fallback logic
- Review error logs

### Issue: High Response Times

**Symptoms**:
- API responses > 500ms
- Slow page loads

**Diagnosis**:
```bash
# Check database query performance
npm run db:analyze-slow-queries

# Check Redis latency
npm run cache:latency-test

# Check server resources
top
df -h
```

**Solutions**:
- Optimize slow queries
- Add missing indexes
- Scale Redis instance
- Increase server resources
- Enable query caching

### Issue: Background Jobs Not Running

**Symptoms**:
- Materialized views not refreshing
- Analytics not updating
- Accuracy not being tracked

**Diagnosis**:
```bash
# Check job status
npm run jobs:status

# Check job logs
tail -f logs/jobs.log

# Check cron schedule
crontab -l
```

**Solutions**:
- Restart job manager
- Check cron configuration
- Verify database connectivity
- Review job error logs

### Issue: Fraud Alerts Not Generating

**Symptoms**:
- No fraud alerts in dashboard
- Known fraud not detected

**Diagnosis**:
```bash
# Check fraud detection service
npm run service:status fraud-detection

# Test fraud detection manually
npm run fraud:test-detection

# Check logs
tail -f logs/fraud-detection.log
```

**Solutions**:
- Verify fraud detection thresholds
- Check photo hash computation
- Review detection algorithms
- Restart fraud detection service

---

## Performance Optimization

### Database Optimization

```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM predictions WHERE auction_id = 'uuid';

-- Update statistics
ANALYZE predictions;
ANALYZE recommendations;
ANALYZE interactions;

-- Reindex if needed
REINDEX TABLE predictions;
REINDEX TABLE recommendations;

-- Vacuum to reclaim space
VACUUM ANALYZE predictions;
VACUUM ANALYZE recommendations;
```

### Cache Optimization

```bash
# Monitor cache hit rate
redis-cli INFO stats | grep hit_rate

# Check cache memory usage
redis-cli INFO memory

# Flush cache if needed (use with caution)
redis-cli FLUSHDB
```

### Application Optimization

- Enable gzip compression
- Implement CDN for static assets
- Use connection pooling
- Enable HTTP/2
- Implement request batching

---

## Security Checklist

- [ ] All environment variables secured
- [ ] Database credentials rotated
- [ ] API rate limiting enabled
- [ ] CORS configured correctly
- [ ] SQL injection prevention verified
- [ ] XSS protection enabled
- [ ] CSRF tokens implemented
- [ ] Audit logging enabled
- [ ] PII anonymization working
- [ ] GDPR compliance verified

---

## Compliance Verification

### GDPR Compliance

- [ ] Data export functionality working
- [ ] Data deletion workflow tested
- [ ] Opt-out mechanism functional
- [ ] PII anonymization verified
- [ ] Consent tracking implemented
- [ ] Privacy policy updated

### Audit Trail

- [ ] All admin actions logged
- [ ] Fraud alert reviews tracked
- [ ] Configuration changes recorded
- [ ] Data exports logged
- [ ] User data access logged

---

## Success Criteria

Deployment is considered successful when:

- [ ] All migrations applied successfully
- [ ] All tests passing
- [ ] Zero critical errors in logs
- [ ] Response times < 200ms (p95)
- [ ] Error rate < 0.1%
- [ ] All background jobs running
- [ ] Cache hit rate > 80%
- [ ] Prediction accuracy > 85%
- [ ] Recommendation conversion > 15%
- [ ] No user-reported critical issues
- [ ] Admin dashboard accessible
- [ ] Vendor features working
- [ ] Fraud detection active
- [ ] Analytics updating
- [ ] Monitoring and alerting configured

---

## Support Contacts

**DevOps Team**: devops@neminsurance.com  
**Database Team**: dba@neminsurance.com  
**Development Team**: dev@neminsurance.com  
**On-Call Engineer**: +234-XXX-XXX-XXXX

**Escalation Path**:
1. On-call engineer
2. Team lead
3. CTO

---

## Appendix

### Environment Variable Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| INTELLIGENCE_ENABLED | Yes | false | Enable/disable intelligence features |
| INTELLIGENCE_ALGORITHM_VERSION | Yes | v1.2.0 | Algorithm version for tracking |
| REDIS_URL | Yes | - | Redis connection string |
| INTELLIGENCE_REDIS_TTL_PREDICTIONS | No | 300 | Prediction cache TTL (seconds) |
| INTELLIGENCE_REDIS_TTL_RECOMMENDATIONS | No | 900 | Recommendation cache TTL (seconds) |
| POSTGIS_ENABLED | No | false | Enable PostGIS for geographic analytics |

### Database Table Reference

| Table | Purpose | Estimated Size |
|-------|---------|----------------|
| predictions | Store price predictions | 10MB per 10k records |
| recommendations | Store recommendations | 15MB per 10k records |
| interactions | Track vendor interactions | 5MB per 10k records |
| fraud_alerts | Store fraud alerts | 2MB per 1k records |
| asset_performance_analytics | Asset performance metrics | 50MB per year |
| vendor_bidding_patterns_mv | Materialized view | 20MB |
| market_conditions_mv | Materialized view | 5MB |

### API Endpoint Reference

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| /api/auctions/[id]/prediction | GET | Vendor | Get price prediction |
| /api/vendors/[id]/recommendations | GET | Vendor | Get recommendations |
| /api/intelligence/interactions | POST | Vendor | Track interaction |
| /api/intelligence/admin/dashboard | GET | Admin | Admin dashboard data |
| /api/intelligence/fraud/analyze | POST | Admin | Analyze for fraud |
| /api/intelligence/export | GET | Admin | Export data |

### Background Job Reference

| Job | Schedule | Duration | Purpose |
|-----|----------|----------|---------|
| Materialized view refresh | Every 5 min | 30s | Refresh vendor patterns |
| Analytics aggregation | Hourly | 2 min | Aggregate analytics data |
| Accuracy tracking | Hourly | 1 min | Calculate prediction accuracy |
| Data maintenance | Daily at 2 AM | 10 min | Clean old data |
| Schema evolution | Daily at 3 AM | 5 min | Detect new asset types |

