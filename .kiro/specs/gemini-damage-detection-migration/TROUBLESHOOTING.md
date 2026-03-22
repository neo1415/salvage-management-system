# Gemini Damage Detection Troubleshooting Guide

## Common Issues and Solutions

### 1. Gemini Always Falls Back to Vision

**Symptoms:**
- All requests show `method='vision'` in logs
- No Gemini assessments being performed
- Warning: "Gemini service not enabled"

**Possible Causes:**

#### A. Missing API Key

**Check:**
```bash
# Verify GEMINI_API_KEY is set
echo $GEMINI_API_KEY
```

**Solution:**
```bash
# Add to .env file
GEMINI_API_KEY=your_api_key_here

# Restart application
npm run dev
```

#### B. Invalid API Key

**Check logs for:**
```
[Gemini Service] Initialization failed
Error: Invalid API key
```

**Solution:**
1. Get new API key from https://aistudio.google.com/app/apikey
2. Update .env file
3. Restart application

#### C. Rate Limit Exceeded

**Check logs for:**
```
[Gemini Rate Limiter] Daily quota exhausted (1500/1500 requests)
```

**Solution:**
- Wait for UTC midnight reset
- Monitor quota at https://aistudio.google.com/usage
- Consider upgrading to paid tier if needed

**Temporary Workaround:**
```typescript
// Reset rate limiter (development only)
import { resetGeminiRateLimiter } from '@/lib/integrations/gemini-rate-limiter';
resetGeminiRateLimiter();
```

### 2. Slow Response Times

**Symptoms:**
- Assessments taking >10 seconds
- Timeout errors in logs
- Poor user experience

**Possible Causes:**

#### A. Network Latency

**Check:**
```bash
# Test network connectivity
curl -I https://generativelanguage.googleapis.com
```

**Solution:**
- Check internet connection
- Verify firewall rules
- Consider CDN or edge deployment

#### B. Large Photo Files

**Check logs for:**
```
[Gemini Service] Processing 6 photos, total size: 15MB
```

**Solution:**
- Compress images before upload
- Use TinyPNG integration
- Limit photo count to 6 maximum

#### C. Timeout Configuration

**Check:**
```typescript
// Current timeout: 10 seconds
const TIMEOUT_MS = 10000;
```

**Solution:**
- Increase timeout if needed (not recommended)
- Optimize photo processing
- Use fallback chain (automatic)

### 3. Inaccurate Damage Scores

**Symptoms:**
- Scores don't match visual damage
- Inconsistent assessments
- False positives/negatives

**Possible Causes:**

#### A. Poor Photo Quality

**Check:**
- Photo resolution <800px
- Poor lighting conditions
- Blurry or out-of-focus images

**Solution:**
- Use high-resolution photos (1920x1080 recommended)
- Ensure good lighting
- Take multiple angles
- Include close-ups of damage

#### B. Missing Vehicle Context

**Check:**
```typescript
// Without context (less accurate)
await assessDamage(imageUrls, estimatedValue);

// With context (more accurate)
await assessDamage(imageUrls, estimatedValue, {
  make: 'Toyota',
  model: 'Camry',
  year: 2021
});
```

**Solution:**
- Always provide vehicle context
- Verify make/model/year accuracy
- Use standardized vehicle names

#### C. Insufficient Photos

**Check logs for:**
```
[Gemini Service] Received 1 photo (minimum recommended: 3)
```

**Solution:**
- Provide 3-6 photos minimum
- Include multiple angles:
  - Front
  - Rear
  - Both sides
  - Interior (if applicable)
  - Close-ups of damage

### 4. Quota Exhausted

**Symptoms:**
- All requests fall back to Vision
- Error: "Daily quota exhausted"
- Quota warnings in logs

**Immediate Actions:**

1. **Check Current Usage:**
```typescript
import { getGeminiRateLimiter } from '@/lib/integrations/gemini-rate-limiter';

const status = getGeminiRateLimiter().getStatus();
console.log(`Usage: ${status.dailyUsage}/${status.dailyLimit}`);
```

2. **Wait for Reset:**
- Daily quota resets at UTC midnight
- Monitor at https://aistudio.google.com/usage

3. **Temporary Fallback:**
- System automatically uses Vision API
- No action required
- Zero downtime

**Long-term Solutions:**

1. **Optimize Usage:**
   - Batch similar requests
   - Cache results when possible
   - Use Vision API for simple cases

2. **Upgrade Plan:**
   - Consider paid tier for higher limits
   - Contact Google Cloud support

3. **Implement Request Throttling:**
   - Limit requests per user
   - Queue non-urgent assessments
   - Prioritize critical cases

### 5. Fallback Chain Not Working

**Symptoms:**
- System fails completely
- No fallback to Vision
- Errors not handled gracefully

**Diagnostic Steps:**

1. **Check Fallback Logs:**
```bash
# Search for fallback events
grep "Falling back" logs/*.log
grep "All AI methods failed" logs/*.log
```

2. **Verify Vision API:**
```bash
# Test Vision API directly
npm run ts-node scripts/test-vision-api.ts
```

3. **Check Service Status:**
```typescript
import { assessDamage } from '@/features/cases/services/ai-assessment.service';

// Should never throw - always returns result
const result = await assessDamage(imageUrls, estimatedValue);
console.log(`Method used: ${result.method}`);
```

**Solutions:**

#### A. Vision API Credentials Missing

**Check:**
```bash
# Verify Google Cloud credentials
echo $GOOGLE_APPLICATION_CREDENTIALS
```

**Solution:**
```bash
# Set credentials path
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
```

#### B. Network Issues

**Check:**
```bash
# Test connectivity
curl -I https://vision.googleapis.com
```

**Solution:**
- Verify firewall rules
- Check DNS resolution
- Test from different network

#### C. Code Error

**Check logs for:**
```
[AI Assessment] Unexpected error in fallback chain
```

**Solution:**
- Review error stack trace
- Check for code changes
- Rollback if necessary

### 6. Rate Limit Warnings Not Appearing

**Symptoms:**
- No warnings at 80% or 90% usage
- Quota exhausted without warning
- Monitoring gaps

**Diagnostic Steps:**

1. **Check Logging Configuration:**
```typescript
// Verify console.warn is not suppressed
console.warn('[Test] Warning test');
```

2. **Verify Rate Limiter:**
```typescript
import { getGeminiRateLimiter } from '@/lib/integrations/gemini-rate-limiter';

const rateLimiter = getGeminiRateLimiter();

// Manually trigger warning
for (let i = 0; i < 1200; i++) {
  rateLimiter.recordRequest();
}
// Should log: "80% of daily quota used"
```

**Solutions:**

- Check log aggregation settings
- Verify console output not filtered
- Review monitoring dashboard configuration

### 7. Photo Count Exceeds Maximum

**Symptoms:**
- Warning: "Received 10 photos, maximum is 6"
- Only first 6 photos processed
- Incomplete damage assessment

**Solution:**

**Client-side validation:**
```typescript
// Validate before upload
if (photos.length > 6) {
  alert('Maximum 6 photos allowed. Please select fewer photos.');
  return;
}
```

**Server-side handling:**
```typescript
// Automatic truncation (already implemented)
// First 6 photos processed, warning logged
```

**Best Practice:**
- Educate users on 6-photo limit
- Provide clear UI feedback
- Allow photo reordering (most important first)

## Monitoring and Debugging

### Enable Debug Logging

```typescript
// Add to .env
DEBUG=gemini:*,vision:*,ai-assessment:*

// Restart application
npm run dev
```

### Check Metrics Dashboard

Access at: `/api/admin/gemini-metrics`

Key metrics:
- Success rate by method
- Average response time
- Daily quota usage
- Error rates
- Fallback frequency

### Review Logs

```bash
# Search for errors
grep "ERROR" logs/*.log

# Search for fallbacks
grep "Falling back" logs/*.log

# Search for quota warnings
grep "quota" logs/*.log -i
```

### Test Individual Components

```bash
# Test Gemini service
npm run ts-node scripts/test-gemini-with-real-photos.ts

# Test Vision service
npm run ts-node scripts/test-vision-api.ts

# Test rate limiter
npm test tests/unit/integrations/gemini-rate-limiter.test.ts

# Test fallback chain
npm test tests/unit/cases/ai-assessment-fallback-orchestration.test.ts
```

## Performance Optimization

### 1. Reduce Photo Size

```typescript
// Compress before upload
import { compressImage } from '@/lib/utils/image-compression';

const compressed = await compressImage(photo, {
  maxWidth: 1920,
  maxHeight: 1080,
  quality: 0.85
});
```

### 2. Cache Results

```typescript
// Cache damage assessments
import { cacheAssessment } from '@/lib/cache/assessment-cache';

const cacheKey = `assessment:${vehicleId}:${photoHash}`;
const cached = await getCachedAssessment(cacheKey);

if (cached) {
  return cached;
}

const result = await assessDamage(photos, value, context);
await cacheAssessment(cacheKey, result, 3600); // 1 hour TTL
```

### 3. Batch Processing

```typescript
// Process multiple assessments in parallel
const results = await Promise.all(
  cases.map(c => assessDamage(c.photos, c.value, c.context))
);
```

## Getting Help

### 1. Check Documentation

- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)
- [Integration README](../../src/lib/integrations/README.md)
- [Design Document](./design.md)

### 2. Review Test Cases

- Unit tests: `tests/unit/integrations/gemini-*.test.ts`
- Integration tests: `tests/integration/cases/ai-assessment-*.test.ts`
- Property tests: `tests/unit/integrations/gemini-*.property.test.ts`

### 3. Contact Support

- Internal: Check team documentation
- Google Cloud: https://cloud.google.com/support
- Gemini API: https://ai.google.dev/support

## Emergency Procedures

### Complete Gemini Failure

1. **Immediate Action:**
   ```bash
   # Remove API key to force Vision fallback
   unset GEMINI_API_KEY
   # or comment out in .env
   ```

2. **Verify Fallback:**
   ```bash
   # All requests should use Vision
   grep "method.*vision" logs/*.log
   ```

3. **Monitor:**
   - Check error rates
   - Verify Vision API working
   - Monitor user complaints

### System-Wide Outage

1. **Check Status:**
   - Google Cloud Status: https://status.cloud.google.com
   - Gemini API Status: https://ai.google.dev/status

2. **Enable Maintenance Mode:**
   ```typescript
   // Return cached results or neutral responses
   const MAINTENANCE_MODE = true;
   ```

3. **Communicate:**
   - Notify users of degraded service
   - Provide ETA for resolution
   - Document incident

## Prevention

### 1. Monitoring

- Set up alerts for quota warnings
- Monitor error rates
- Track response times
- Review logs daily

### 2. Testing

- Run integration tests before deployment
- Test with real photos regularly
- Validate fallback chain monthly
- Load test before traffic spikes

### 3. Capacity Planning

- Monitor daily quota trends
- Plan for traffic growth
- Consider paid tier upgrade
- Implement request throttling

### 4. Documentation

- Keep troubleshooting guide updated
- Document all incidents
- Share learnings with team
- Update runbooks regularly
