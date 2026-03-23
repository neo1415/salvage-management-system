# Gemini 2.0 Flash Damage Detection Migration Guide

## Overview

This guide documents the migration from Google Cloud Vision API with keyword matching to Gemini 2.0 Flash multimodal AI for damage detection in the salvage management system.

## Migration Summary

- **From**: Google Cloud Vision API + keyword matching
- **To**: Gemini 2.0 Flash multimodal AI
- **Fallback Chain**: Gemini → Vision → Neutral
- **Backward Compatibility**: 100% maintained
- **Breaking Changes**: None

## What Changed

### New Features

1. **Enhanced Damage Assessment**
   - Five damage categories (structural, mechanical, cosmetic, electrical, interior)
   - Airbag deployment detection
   - Total loss determination
   - Detailed damage summaries

2. **Vehicle Context Integration**
   - Make, model, and year included in assessment
   - More accurate damage scoring based on vehicle type

3. **Intelligent Fallback Chain**
   - Automatic fallback to Vision API if Gemini fails
   - Neutral response if all AI methods fail
   - Zero downtime during failures

4. **Rate Limiting**
   - 10 requests per minute (sliding window)
   - 1,500 requests per day (free tier)
   - Automatic fallback when limits reached

### New Optional Fields

The damage assessment response now includes optional fields when using Gemini:

```typescript
{
  // Existing fields (always present)
  damagePercentage: number;
  confidenceScore: number;
  severity: 'minor' | 'moderate' | 'severe';
  
  // New optional fields (present when using Gemini)
  method?: 'gemini' | 'vision' | 'neutral';
  detailedScores?: {
    structural: number;
    mechanical: number;
    cosmetic: number;
    electrical: number;
    interior: number;
  };
  airbagDeployed?: boolean;
  totalLoss?: boolean;
  summary?: string;
}
```

## Setup Instructions

### 1. Environment Configuration

Add the Gemini API key to your environment:

```bash
# .env
GEMINI_API_KEY=your_gemini_api_key_here
```

Get your API key from: https://aistudio.google.com/app/apikey

### 2. Verify Configuration

Run the validation script:

```bash
npm run ts-node scripts/validate-gemini-config.ts
```

### 3. Monitor Quota Usage

Check your daily quota at: https://aistudio.google.com/usage

## API Changes

### Backward Compatible

All existing API endpoints maintain the same request/response format:

```typescript
// Before (still works)
const result = await assessDamage(imageUrls, estimatedValue);

// After (with vehicle context - optional)
const result = await assessDamage(imageUrls, estimatedValue, {
  make: 'Toyota',
  model: 'Camry',
  year: 2021
});
```

### Response Format

The response format is backward compatible. New fields are optional:

```typescript
// Existing clients see familiar format
{
  damagePercentage: 65,
  confidenceScore: 0.85,
  severity: 'moderate'
}

// New clients can access additional fields
{
  damagePercentage: 65,
  confidenceScore: 0.85,
  severity: 'moderate',
  method: 'gemini',
  detailedScores: {
    structural: 70,
    mechanical: 60,
    cosmetic: 65,
    electrical: 50,
    interior: 55
  },
  airbagDeployed: false,
  totalLoss: false,
  summary: 'Moderate front-end damage with intact airbags...'
}
```

## Fallback Chain

The system uses a three-tier fallback chain:

1. **Gemini 2.0 Flash** (Primary)
   - Multimodal AI with vehicle context
   - Most accurate damage assessment
   - Rate limited (10/min, 1500/day)

2. **Google Cloud Vision API** (Fallback)
   - Keyword matching algorithm
   - Proven reliability
   - No rate limits

3. **Neutral Response** (Last Resort)
   - Returns moderate scores (50 for all categories)
   - Ensures system never fails completely
   - Logged for investigation

### Fallback Triggers

Gemini falls back to Vision when:
- API key is missing or invalid
- Rate limit exceeded (10/min or 1500/day)
- Network timeout (>10 seconds)
- API error (5xx responses)

Vision falls back to Neutral when:
- Vision API fails
- Network issues
- Invalid response format

## Rate Limiting

### Free Tier Limits

- **Per Minute**: 10 requests (sliding window)
- **Per Day**: 1,500 requests (resets at UTC midnight)

### Quota Warnings

The system logs warnings at:
- **80% usage**: 1,200 requests/day
- **90% usage**: 1,350 requests/day
- **100% usage**: 1,500 requests/day (fallback to Vision)

### Monitoring Quota

Check quota usage:

```typescript
import { getGeminiRateLimiter } from '@/lib/integrations/gemini-rate-limiter';

const rateLimiter = getGeminiRateLimiter();
const status = rateLimiter.getStatus();

console.log(`Daily usage: ${status.dailyUsage}/${status.dailyLimit}`);
console.log(`Minute usage: ${status.minuteUsage}/${status.minuteLimit}`);
```

## Testing

### Unit Tests

Run all unit tests:

```bash
npm run test:unit
```

### Integration Tests

Run integration tests:

```bash
npm run test:integration
```

### Property-Based Tests

All 13 correctness properties are tested with 100+ iterations each.

### Real Photo Testing

Test with real vehicle photos:

```bash
npm run ts-node scripts/test-gemini-with-real-photos.ts
```

## Monitoring

### Metrics Dashboard

Access metrics at: `/api/admin/gemini-metrics`

Metrics tracked:
- Gemini success rate
- Vision fallback rate
- Neutral fallback rate
- Average response time by method
- Daily API usage
- Error rates by type

### Logging

All assessment requests are logged with:
- Method used (gemini/vision/neutral)
- Duration
- Photo count
- Vehicle context
- Quota usage
- Fallback reasons (if applicable)

## Rollback Procedure

If issues arise, you can disable Gemini by:

1. **Remove API Key**
   ```bash
   # Remove from .env
   # GEMINI_API_KEY=...
   ```

2. **System automatically falls back to Vision API**
   - No code changes required
   - Zero downtime
   - All requests use Vision API

3. **Verify Fallback**
   ```bash
   # Check logs for "Gemini service not enabled"
   # All requests should show method='vision'
   ```

## Performance

### Response Times

- **Gemini**: ~3-5 seconds (with vehicle context)
- **Vision**: ~2-3 seconds (keyword matching)
- **Neutral**: <100ms (immediate response)

### Timeout Guarantee

Total assessment time never exceeds 30 seconds across all fallback levels.

## Security

### API Key Protection

- API key stored in environment variables
- Never exposed in client-side code
- Only last 4 characters logged
- Validated at initialization

### Rate Limit Enforcement

- Strict enforcement of free tier limits
- Automatic fallback prevents quota violations
- Daily reset at UTC midnight

## Support

### Common Issues

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for solutions to common issues.

### Monitoring Dashboard

Access at: `/api/admin/gemini-metrics`

### Quota Monitoring

Check usage at: https://aistudio.google.com/usage

## Migration Checklist

- [ ] Add GEMINI_API_KEY to environment
- [ ] Run validation script
- [ ] Verify all tests pass
- [ ] Deploy to staging
- [ ] Test with real photos
- [ ] Monitor for 48 hours
- [ ] Deploy to production
- [ ] Enable gradual rollout (10% → 50% → 100%)
- [ ] Monitor production metrics
- [ ] Verify zero breaking changes

## Success Criteria

Migration is successful when:
- All tests pass (100% pass rate)
- Gemini accuracy >85% on real photos
- False positive rate <10%
- False negative rate <5%
- Rate limits respected (zero violations)
- API response times <10 seconds (95th percentile)
- Zero breaking changes to existing API contracts
- Production monitoring shows stable operation

## Next Steps

1. Review [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
2. Set up monitoring dashboard
3. Configure alerting thresholds
4. Plan gradual rollout schedule
5. Document team training materials
