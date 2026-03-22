# Gemini 2.0 Flash Deployment Guide

## Overview

This guide covers the deployment process for the Gemini 2.0 Flash damage detection migration (Tasks 27-31). The deployment follows a gradual rollout strategy to ensure stability and minimize risk.

## Deployment Phases

### Phase 7: Deployment and Gradual Rollout

1. **Task 27**: Deploy to staging environment
2. **Task 28**: Run staging validation tests
3. **Task 29**: Deploy to production with feature flag
4. **Task 30**: Execute gradual rollout (10% → 50% → 100%)
5. **Task 31**: Final validation and migration completion

## Prerequisites

Before starting deployment:

- [ ] All 26 previous tasks completed
- [ ] All tests passing (unit, integration, property-based)
- [ ] Documentation complete (migration guide, troubleshooting)
- [ ] Monitoring dashboard configured
- [ ] Rollback procedure documented
- [ ] Team trained on new features

## Task 27: Deploy to Staging Environment

### Objective
Deploy all Gemini changes to staging environment and verify configuration.

### Steps

1. **Prepare Staging Environment**

```bash
# Ensure staging environment is clean
git checkout main
git pull origin main

# Verify all changes are committed
git status
```

2. **Configure Environment Variables**

```bash
# Add to staging .env
GEMINI_API_KEY=your_staging_api_key_here

# Verify other required variables
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
GOOGLE_CLOUD_VISION_API_KEY=your_vision_api_key
```

3. **Deploy to Staging**

```bash
# Build application
npm run build

# Deploy to staging (adjust for your deployment method)
# Example for Vercel:
vercel --prod --env GEMINI_API_KEY=your_key

# Example for custom server:
pm2 restart salvage-staging
```

4. **Verify Environment Variables**

```bash
# Run validation script
npm run ts-node scripts/validate-gemini-config.ts

# Expected output:
# ✓ GEMINI_API_KEY is set
# ✓ API key format is valid
# ✓ Gemini service initialized successfully
```

5. **Run Smoke Tests**

```bash
# Test basic functionality
curl -X POST https://staging.example.com/api/cases \
  -H "Content-Type: application/json" \
  -d '{
    "photos": ["https://example.com/photo1.jpg"],
    "estimatedValue": 1000000,
    "vehicleContext": {
      "make": "Toyota",
      "model": "Camry",
      "year": 2021
    }
  }'

# Verify response includes method='gemini'
```

### Success Criteria

- [ ] Staging deployment successful
- [ ] GEMINI_API_KEY configured correctly
- [ ] Validation script passes
- [ ] Smoke tests pass
- [ ] No errors in staging logs

### Rollback

If deployment fails:

```bash
# Revert to previous version
git revert HEAD
vercel --prod

# Or rollback via deployment platform
```

---

## Task 28: Run Staging Validation Tests

### Objective
Thoroughly test Gemini integration in staging with real API calls and simulated failures.

### Steps

1. **Test with Real Gemini API**

```bash
# Run integration tests against staging
STAGING_URL=https://staging.example.com npm run test:integration

# Test with real photos
npm run ts-node scripts/test-gemini-with-real-photos.ts --env=staging
```

2. **Test Fallback Chain with Simulated Failures**

```bash
# Test Gemini failure → Vision fallback
# Temporarily remove API key
unset GEMINI_API_KEY

# Make request - should fall back to Vision
curl -X POST https://staging.example.com/api/cases/assess-damage \
  -H "Content-Type: application/json" \
  -d '{"photos": [...], "estimatedValue": 1000000}'

# Verify response has method='vision'

# Restore API key
export GEMINI_API_KEY=your_key
```

3. **Test Rate Limiting Under Load**

```bash
# Simulate burst requests
npm run ts-node scripts/test-rate-limiting.ts --requests=20 --duration=60

# Expected: First 10 succeed, rest fall back to Vision
# Verify logs show rate limit warnings
```

4. **Verify Monitoring and Logging**

```bash
# Check metrics endpoint
curl https://staging.example.com/api/admin/gemini-metrics

# Expected response:
# {
#   "geminiSuccessRate": 0.85,
#   "visionFallbackRate": 0.15,
#   "neutralFallbackRate": 0.00,
#   "avgResponseTime": {
#     "gemini": 3500,
#     "vision": 2200,
#     "neutral": 50
#   },
#   "dailyUsage": 150,
#   "dailyLimit": 1500
# }
```

5. **Monitor Staging for 48 Hours**

```bash
# Set up monitoring alerts
# - Error rate >5%
# - Response time >10s
# - Quota >80%

# Review logs daily
tail -f /var/log/salvage-staging/app.log | grep -i "gemini\|vision\|fallback"
```

### Success Criteria

- [ ] Real Gemini API tests pass
- [ ] Fallback chain works correctly
- [ ] Rate limiting enforced properly
- [ ] Monitoring dashboard shows accurate data
- [ ] Logging captures all required information
- [ ] No critical errors in 48-hour monitoring period
- [ ] Response times within acceptable range (<10s)

### Issues to Watch For

- Gemini API timeouts
- Rate limit violations
- Fallback chain failures
- Inaccurate damage scores
- Missing logs or metrics

---

## Task 29: Deploy to Production with Feature Flag

### Objective
Deploy to production with Gemini disabled by default, allowing controlled enablement.

### Steps

1. **Prepare Production Deployment**

```bash
# Final code review
git diff staging production

# Run full test suite
npm run test:all

# Verify all tests pass
```

2. **Configure Production Environment**

```bash
# Add to production .env
GEMINI_API_KEY=your_production_api_key_here
GEMINI_ENABLED=false  # Disabled by default

# Verify other variables
GOOGLE_APPLICATION_CREDENTIALS=/path/to/prod-credentials.json
```

3. **Deploy to Production**

```bash
# Build for production
NODE_ENV=production npm run build

# Deploy (adjust for your platform)
vercel --prod --env GEMINI_API_KEY=your_key --env GEMINI_ENABLED=false

# Or for custom server:
pm2 restart salvage-production
```

4. **Verify Production Configuration**

```bash
# Test that Gemini is disabled
curl -X POST https://api.example.com/api/cases/assess-damage \
  -H "Content-Type: application/json" \
  -d '{"photos": [...], "estimatedValue": 1000000}'

# Verify response has method='vision' (not 'gemini')
```

5. **Test Feature Flag Toggle**

```typescript
// Enable Gemini for testing
process.env.GEMINI_ENABLED = 'true';

// Make test request
const result = await assessDamage(photos, value, context);

// Verify method='gemini'
console.log(result.method); // Should be 'gemini'

// Disable again
process.env.GEMINI_ENABLED = 'false';
```

### Success Criteria

- [ ] Production deployment successful
- [ ] GEMINI_API_KEY configured
- [ ] Gemini disabled by default (GEMINI_ENABLED=false)
- [ ] Feature flag toggle works correctly
- [ ] All requests use Vision API initially
- [ ] No production errors

### Rollback

If issues arise:

```bash
# Disable Gemini immediately
export GEMINI_ENABLED=false

# Or remove API key
unset GEMINI_API_KEY

# System automatically falls back to Vision
```

---

## Task 30: Execute Gradual Rollout

### Objective
Gradually enable Gemini for increasing percentages of traffic while monitoring metrics.

### 30.1: Enable for 10% of Requests

**Steps:**

1. **Configure 10% Rollout**

```typescript
// Update feature flag logic
const GEMINI_ROLLOUT_PERCENTAGE = 10;

function shouldUseGemini(): boolean {
  if (!process.env.GEMINI_ENABLED) return false;
  return Math.random() * 100 < GEMINI_ROLLOUT_PERCENTAGE;
}
```

2. **Enable Rollout**

```bash
# Set environment variable
export GEMINI_ENABLED=true
export GEMINI_ROLLOUT_PERCENTAGE=10

# Restart application
pm2 restart salvage-production
```

3. **Monitor for 24 Hours**

```bash
# Check metrics every hour
curl https://api.example.com/api/admin/gemini-metrics

# Watch for:
# - Error rates
# - Response times
# - Accuracy (manual review)
# - Daily quota usage
```

4. **Validate Metrics**

Expected after 24 hours:
- Gemini success rate: >85%
- Error rate: <5%
- Average response time: <5s
- Daily quota usage: <150 requests (10% of 1500)
- No user complaints

**Success Criteria:**
- [ ] 10% of requests use Gemini
- [ ] Error rate <5%
- [ ] Response time <10s (95th percentile)
- [ ] No critical issues
- [ ] Quota usage within limits
- [ ] User feedback positive

**Rollback if:**
- Error rate >10%
- Response time >15s
- Critical bugs reported
- Quota violations

### 30.2: Increase to 50% of Requests

**Prerequisites:**
- 10% rollout successful for 24 hours
- All metrics within acceptable range
- No critical issues

**Steps:**

1. **Increase Rollout Percentage**

```bash
# Update environment variable
export GEMINI_ROLLOUT_PERCENTAGE=50

# Restart application
pm2 restart salvage-production
```

2. **Monitor for 24 Hours**

```bash
# Increased monitoring frequency (every 30 minutes)
watch -n 1800 'curl https://api.example.com/api/admin/gemini-metrics'

# Watch for:
# - Increased load on Gemini API
# - Fallback chain under load
# - Daily quota usage patterns
```

3. **Validate Fallback Chain Under Load**

Expected behavior:
- Some requests hit rate limits (10/min)
- Automatic fallback to Vision
- No failed requests
- Smooth degradation

4. **Check Daily Quota Usage**

```bash
# Monitor quota throughout day
# Expected: ~750 requests/day (50% of 1500)

# Check at different times:
# - Morning: ~200 requests
# - Afternoon: ~500 requests
# - Evening: ~750 requests
```

**Success Criteria:**
- [ ] 50% of requests use Gemini
- [ ] Fallback chain handles load correctly
- [ ] Error rate <5%
- [ ] Response time <10s (95th percentile)
- [ ] Daily quota <1200 (80% threshold)
- [ ] No critical issues

**Rollback if:**
- Error rate >10%
- Quota exhausted before end of day
- Performance degradation
- User complaints increase

### 30.3: Increase to 100% of Requests

**Prerequisites:**
- 50% rollout successful for 24 hours
- All metrics within acceptable range
- Quota usage sustainable

**Steps:**

1. **Enable Full Rollout**

```bash
# Set to 100%
export GEMINI_ROLLOUT_PERCENTAGE=100

# Restart application
pm2 restart salvage-production
```

2. **Monitor for 1 Week**

```bash
# Daily monitoring
# - Check metrics dashboard
# - Review error logs
# - Validate quota usage
# - Monitor user feedback
```

3. **Validate All Success Metrics**

After 1 week:
- Gemini accuracy >85% on test dataset
- False positive rate <10%
- False negative rate <5%
- Error rate <5%
- Response time <10s (95th percentile)
- Daily quota <1500 (no violations)
- Zero breaking changes

4. **Document Final Production Metrics**

```markdown
# Production Metrics (Week 1)

## Gemini Performance
- Success rate: 87%
- Average response time: 3.8s
- Accuracy: 89%
- False positives: 7%
- False negatives: 3%

## Fallback Usage
- Vision fallback: 12%
- Neutral fallback: 1%

## Quota Usage
- Average daily: 1,245 requests
- Peak daily: 1,450 requests
- No violations

## User Feedback
- Positive: 92%
- Neutral: 6%
- Negative: 2%
```

**Success Criteria:**
- [ ] 100% of requests use Gemini (when available)
- [ ] All success metrics met
- [ ] Stable operation for 1 week
- [ ] No critical issues
- [ ] User satisfaction maintained
- [ ] Documentation complete

---

## Task 31: Final Validation and Migration Completion

### Objective
Verify all requirements are met and declare migration complete.

### Final Validation Checklist

#### Requirements Implementation

- [ ] **Requirement 1**: Gemini SDK installed and configured
- [ ] **Requirement 2**: Environment variables set up
- [ ] **Requirement 3**: Gemini API client initialized
- [ ] **Requirement 4**: Damage assessment with 5 categories
- [ ] **Requirement 5**: Fallback chain implemented
- [ ] **Requirement 6**: Rate limiting enforced
- [ ] **Requirement 7**: Backward compatibility maintained
- [ ] **Requirement 8**: Accuracy validation passed
- [ ] **Requirement 9**: Error handling comprehensive
- [ ] **Requirement 10**: Monitoring and logging complete
- [ ] **Requirement 11**: API contracts unchanged
- [ ] **Requirement 12**: Photo handling robust
- [ ] **Requirement 13**: Error messages descriptive
- [ ] **Requirement 14**: Prompt construction complete
- [ ] **Requirement 15**: Response parsing validated

#### Testing Validation

- [ ] All unit tests pass (100% pass rate)
- [ ] All 13 property-based tests pass (100+ iterations each)
- [ ] All integration tests pass (100% pass rate)
- [ ] Gemini accuracy >85% on real vehicle photos
- [ ] False positive rate <10%
- [ ] False negative rate <5%

#### Performance Validation

- [ ] Rate limits respected (zero quota violations)
- [ ] API response times <10 seconds (95th percentile)
- [ ] Fallback chain operates correctly in all scenarios
- [ ] Total processing time <30 seconds

#### Compatibility Validation

- [ ] Existing downstream systems function without modification
- [ ] Zero breaking changes to existing API contracts
- [ ] All existing fields present in responses
- [ ] New fields are optional

#### Production Validation

- [ ] Production monitoring shows successful Gemini usage
- [ ] Within free tier limits (1,500 requests/day)
- [ ] Stable operation for 1 week
- [ ] No critical incidents

#### Documentation Validation

- [ ] Migration guide complete
- [ ] Troubleshooting guide complete
- [ ] Deployment guide complete
- [ ] API documentation updated
- [ ] Team training materials ready

### Migration Completion Steps

1. **Final Metrics Review**

```bash
# Generate final report
npm run ts-node scripts/generate-migration-report.ts

# Review all metrics
# - Success rates
# - Performance
# - Accuracy
# - User feedback
```

2. **Stakeholder Sign-off**

- [ ] Engineering team approval
- [ ] Product team approval
- [ ] QA team approval
- [ ] Operations team approval

3. **Documentation Archive**

```bash
# Archive all migration documents
mkdir -p docs/migrations/gemini-2024
cp .kiro/specs/gemini-damage-detection-migration/* docs/migrations/gemini-2024/

# Commit to repository
git add docs/migrations/gemini-2024
git commit -m "Archive Gemini migration documentation"
```

4. **Declare Migration Complete**

```markdown
# Migration Status: COMPLETE

Date: [Current Date]
Duration: [Start Date] to [End Date]

## Summary
Successfully migrated from Google Cloud Vision API to Gemini 2.0 Flash
for damage detection with 100% backward compatibility and zero downtime.

## Final Metrics
- Gemini accuracy: 89%
- Response time: 3.8s average
- Fallback rate: 12%
- Zero breaking changes
- Zero quota violations

## Next Steps
- Continue monitoring for 30 days
- Gather user feedback
- Plan future enhancements
- Document lessons learned
```

### Post-Migration Activities

1. **Continuous Monitoring** (30 days)
   - Daily metrics review
   - Weekly team sync
   - Monthly performance report

2. **User Feedback Collection**
   - Survey adjusters on accuracy
   - Gather vendor feedback
   - Document improvement areas

3. **Future Enhancements**
   - Explore Gemini Pro features
   - Optimize prompt engineering
   - Improve photo preprocessing
   - Consider paid tier upgrade

4. **Knowledge Sharing**
   - Team presentation
   - Documentation review
   - Lessons learned session
   - Best practices documentation

### Success Declaration

The migration is officially complete when:

✅ All 31 tasks completed
✅ All validation criteria met
✅ Stakeholder sign-off received
✅ Documentation archived
✅ Production stable for 1 week
✅ Zero critical issues

---

## Emergency Contacts

- **Engineering Lead**: [Contact Info]
- **DevOps Team**: [Contact Info]
- **Google Cloud Support**: https://cloud.google.com/support
- **On-Call Engineer**: [Contact Info]

## Additional Resources

- [Migration Guide](./MIGRATION_GUIDE.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [Requirements Document](./requirements.md)
- [Design Document](./design.md)
- [API Documentation](../../src/lib/integrations/README.md)
