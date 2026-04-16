# Comprehensive Reporting System - Deployment Guide

**Version**: 1.0  
**Date**: 2026-04-14  
**Status**: Production-Ready

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Setup](#environment-setup)
3. [Database Migration](#database-migration)
4. [Application Deployment](#application-deployment)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Rollback Procedures](#rollback-procedures)
7. [Monitoring Setup](#monitoring-setup)
8. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

### Database
- [ ] Database backup completed
- [ ] Migrations tested on staging
- [ ] Indexes created and tested
- [ ] Connection pool configured
- [ ] Rollback plan documented

### Application
- [ ] All tests passing (unit, integration, E2E)
- [ ] Build successful (`npm run build`)
- [ ] Environment variables configured
- [ ] Dependencies updated and audited
- [ ] Security audit completed
- [ ] Performance benchmarks met

### Infrastructure
- [ ] Redis cache configured and tested
- [ ] Database connection pool sized appropriately
- [ ] CDN configured (if applicable)
- [ ] SSL certificates valid
- [ ] Load balancer configured (if applicable)

### Monitoring
- [ ] Application monitoring configured (Sentry/DataDog)
- [ ] Database monitoring configured
- [ ] Cache monitoring configured
- [ ] Alert rules configured
- [ ] On-call rotation updated

### Documentation
- [ ] User guide updated
- [ ] API documentation current
- [ ] Runbook prepared
- [ ] Team trained on new features
- [ ] Changelog updated

### Security
- [ ] Security audit completed
- [ ] API keys rotated
- [ ] Access controls verified
- [ ] Audit logging tested
- [ ] Rate limiting configured

---

## Environment Setup

### Environment Variables

Create `.env.production` file:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/neminsurance
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Redis Cache
REDIS_URL=redis://user:password@host:6379
REDIS_TTL_DEFAULT=900

# Authentication
NEXTAUTH_URL=https://neminsurance.com
NEXTAUTH_SECRET=your-secret-key-here
JWT_SECRET=your-jwt-secret-here

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@neminsurance.com
SMTP_PASSWORD=your-smtp-password

# Monitoring
SENTRY_DSN=https://your-sentry-dsn
DATADOG_API_KEY=your-datadog-key

# Feature Flags
ENABLE_REPORT_SCHEDULING=true
ENABLE_AI_MAGAZINE=false
ENABLE_RATE_LIMITING=true

# Performance
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
```

### System Requirements

**Minimum**:
- Node.js 20.x
- PostgreSQL 15.x
- Redis 7.x
- 2 CPU cores
- 4 GB RAM
- 20 GB storage

**Recommended**:
- Node.js 20.x
- PostgreSQL 15.x
- Redis 7.x
- 4 CPU cores
- 8 GB RAM
- 50 GB storage

---

## Database Migration

### Step 1: Backup Database

```bash
# Create backup
pg_dump neminsurance > backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
pg_restore --list backup_*.sql

# Store backup securely
aws s3 cp backup_*.sql s3://neminsurance-backups/
```

### Step 2: Test Migrations on Staging

```bash
# Connect to staging database
export DATABASE_URL=postgresql://staging-db-url

# Run migrations
npm run db:migrate

# Verify migrations
npm run db:verify

# Test application
npm run test:integration
```

### Step 3: Run Migrations on Production

```bash
# Connect to production database
export DATABASE_URL=postgresql://production-db-url

# Run migrations
npm run db:migrate

# Verify migrations
npm run db:verify

# Check table structure
psql $DATABASE_URL -c "\d report_templates"
psql $DATABASE_URL -c "\d scheduled_reports"
psql $DATABASE_URL -c "\d report_cache"
psql $DATABASE_URL -c "\d report_audit_log"
```

### Migration Files

```sql
-- 0029_add_reporting_tables.sql
CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  description TEXT,
  config JSONB NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  report_type VARCHAR(100) NOT NULL,
  frequency VARCHAR(50) NOT NULL,
  schedule_config JSONB NOT NULL,
  recipients JSONB NOT NULL,
  filters JSONB,
  format VARCHAR(20) NOT NULL,
  last_run TIMESTAMP,
  next_run TIMESTAMP,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_key VARCHAR(255) UNIQUE NOT NULL,
  report_data JSONB NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  report_type VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  filters JSONB,
  export_format VARCHAR(20),
  ip_address VARCHAR(45),
  user_agent TEXT,
  execution_time_ms INTEGER,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_report_cache_key ON report_cache(report_key);
CREATE INDEX idx_report_cache_expires ON report_cache(expires_at);
CREATE INDEX idx_report_audit_user ON report_audit_log(user_id);
CREATE INDEX idx_report_audit_created ON report_audit_log(created_at);
CREATE INDEX idx_scheduled_reports_next_run ON scheduled_reports(next_run);
CREATE INDEX idx_scheduled_reports_status ON scheduled_reports(status);

-- Performance indexes on existing tables
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_amount ON payments(amount);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON salvage_cases(created_at);
CREATE INDEX IF NOT EXISTS idx_cases_status ON salvage_cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_adjuster ON salvage_cases(adjuster_id);
CREATE INDEX IF NOT EXISTS idx_auctions_created_at ON auctions(created_at);
CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status);
CREATE INDEX IF NOT EXISTS idx_auctions_winner ON auctions(winner_id);
```

---

## Application Deployment

### Option 1: Vercel Deployment (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod

# Verify deployment
vercel inspect https://neminsurance.com
```

### Option 2: Docker Deployment

```bash
# Build Docker image
docker build -t neminsurance-reports:latest .

# Tag image
docker tag neminsurance-reports:latest registry.neminsurance.com/reports:latest

# Push to registry
docker push registry.neminsurance.com/reports:latest

# Deploy to production
kubectl apply -f k8s/production/deployment.yaml

# Verify deployment
kubectl get pods -n production
kubectl logs -f deployment/neminsurance-reports -n production
```

### Option 3: Traditional Server Deployment

```bash
# SSH to production server
ssh user@production-server

# Pull latest code
cd /var/www/neminsurance
git pull origin main

# Install dependencies
npm ci --production

# Build application
npm run build

# Restart application
pm2 restart neminsurance

# Verify
pm2 status
pm2 logs neminsurance
```

---

## Post-Deployment Verification

### Smoke Tests

```bash
# Run automated smoke tests
npm run test:smoke

# Or manual verification:

# 1. Check application health
curl https://neminsurance.com/api/health

# 2. Test authentication
curl -X POST https://neminsurance.com/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@neminsurance.com","password":"test"}'

# 3. Test report generation
curl https://neminsurance.com/api/reports/financial/revenue-analysis?startDate=2026-01-01&endDate=2026-03-31 \
  -H "Authorization: Bearer TOKEN"

# 4. Test caching
curl https://neminsurance.com/api/reports/financial/revenue-analysis?startDate=2026-01-01&endDate=2026-03-31 \
  -H "Authorization: Bearer TOKEN" \
  -w "\nTime: %{time_total}s\n"

# 5. Test export
curl -X POST https://neminsurance.com/api/reports/export/pdf \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reportType":"revenue-analysis","filters":{}}'

# 6. Test scheduling
curl -X POST https://neminsurance.com/api/reports/schedule \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reportType":"revenue-analysis","frequency":"monthly"}'
```

### Manual Verification Checklist

- [ ] Homepage loads correctly
- [ ] Login works
- [ ] Reports hub displays
- [ ] Can generate financial report
- [ ] Can generate operational report
- [ ] Can generate user performance report
- [ ] Charts render correctly
- [ ] Filters work
- [ ] Export to PDF works
- [ ] Export to Excel works
- [ ] Export to CSV works
- [ ] Scheduling works
- [ ] Email delivery works
- [ ] Mobile view works
- [ ] No console errors
- [ ] Performance acceptable

### Performance Verification

```bash
# Run performance tests
npm run test:performance

# Check metrics:
# - Report generation time < 5s
# - API response time < 2s
# - Cache hit rate > 70%
# - Database query time < 1s
```

---

## Rollback Procedures

### When to Rollback

- Critical bugs discovered
- Performance degradation
- Data integrity issues
- Security vulnerabilities
- User-facing errors

### Rollback Steps

#### 1. Application Rollback

```bash
# Vercel
vercel rollback

# Docker/Kubernetes
kubectl rollout undo deployment/neminsurance-reports -n production

# Traditional
pm2 stop neminsurance
git checkout previous-stable-tag
npm ci --production
npm run build
pm2 start neminsurance
```

#### 2. Database Rollback

```bash
# Restore from backup
pg_restore -d neminsurance backup_YYYYMMDD_HHMMSS.sql

# Or run rollback migration
npm run db:rollback
```

#### 3. Verify Rollback

```bash
# Check application version
curl https://neminsurance.com/api/version

# Run smoke tests
npm run test:smoke

# Monitor logs
tail -f /var/log/neminsurance/app.log
```

---

## Monitoring Setup

### Application Monitoring (Sentry)

```typescript
// sentry.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  beforeSend(event) {
    // Filter sensitive data
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers?.Authorization;
    }
    return event;
  },
});
```

### Database Monitoring

```sql
-- Create monitoring views
CREATE VIEW report_performance AS
SELECT 
  report_type,
  AVG(execution_time_ms) as avg_time,
  MAX(execution_time_ms) as max_time,
  COUNT(*) as total_requests,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed
FROM report_audit_log
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY report_type;

-- Query slow reports
SELECT * FROM report_audit_log
WHERE execution_time_ms > 5000
ORDER BY created_at DESC
LIMIT 100;
```

### Cache Monitoring

```bash
# Redis monitoring
redis-cli INFO stats
redis-cli INFO memory

# Check cache hit rate
redis-cli INFO stats | grep keyspace_hits
redis-cli INFO stats | grep keyspace_misses
```

### Alert Configuration

```yaml
# alerts.yaml
alerts:
  - name: slow_report_generation
    condition: avg(execution_time_ms) > 5000
    duration: 5m
    severity: warning
    
  - name: high_error_rate
    condition: error_rate > 5%
    duration: 5m
    severity: critical
    
  - name: cache_failure
    condition: cache_hit_rate < 50%
    duration: 10m
    severity: warning
    
  - name: database_slow_queries
    condition: query_time > 1000ms
    duration: 5m
    severity: warning
```

---

## Troubleshooting

### Issue: Reports Not Generating

**Symptoms**: API returns 500 error

**Diagnosis**:
```bash
# Check application logs
pm2 logs neminsurance --lines 100

# Check database connection
psql $DATABASE_URL -c "SELECT 1"

# Check Redis connection
redis-cli ping
```

**Solutions**:
1. Restart application
2. Check database connectivity
3. Check Redis connectivity
4. Review error logs

---

### Issue: Slow Performance

**Symptoms**: Reports take >10 seconds

**Diagnosis**:
```bash
# Check database queries
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity WHERE state = 'active'"

# Check cache hit rate
redis-cli INFO stats | grep keyspace_hits

# Check system resources
top
df -h
```

**Solutions**:
1. Clear cache
2. Optimize queries
3. Add indexes
4. Scale resources

---

### Issue: Scheduled Reports Not Running

**Symptoms**: No emails received

**Diagnosis**:
```bash
# Check cron job
crontab -l

# Check scheduled reports
psql $DATABASE_URL -c "SELECT * FROM scheduled_reports WHERE status = 'active'"

# Check email logs
tail -f /var/log/mail.log
```

**Solutions**:
1. Verify cron job running
2. Check email configuration
3. Review schedule configuration
4. Check recipient emails

---

## Maintenance Procedures

### Daily
- Monitor error rates
- Check performance metrics
- Review alert notifications

### Weekly
- Review audit logs
- Check cache hit rates
- Analyze slow queries
- Update documentation

### Monthly
- Database maintenance (VACUUM, ANALYZE)
- Clear old audit logs
- Review and optimize indexes
- Security updates

### Quarterly
- Full system audit
- Performance optimization
- Capacity planning
- Disaster recovery test

---

## Support Contacts

### On-Call Rotation
- **Primary**: DevOps Team (+234-XXX-XXXX)
- **Secondary**: Backend Team (+234-XXX-XXXX)
- **Escalation**: CTO (+234-XXX-XXXX)

### External Support
- **Vercel Support**: support@vercel.com
- **Database Support**: support@postgresql.org
- **Redis Support**: support@redis.io

---

## Conclusion

This deployment guide provides comprehensive instructions for deploying the Comprehensive Reporting System to production. Follow all steps carefully and verify each stage before proceeding.

**Key Reminders**:
- Always backup before deployment
- Test on staging first
- Have rollback plan ready
- Monitor closely after deployment
- Document any issues

---

**Document Version**: 1.0  
**Last Updated**: 2026-04-14  
**Maintained By**: DevOps Team
