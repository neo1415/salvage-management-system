# Phase 5: Testing and Validation with Real Data - Implementation Guide

## Overview

Phase 5 validates the Gemini damage detection system using real vehicle photos from the test gallery. This phase ensures accuracy targets are met before production deployment.

## Test Dataset

**Location**: `.kiro/specs/gemini-damage-detection-migration/vehicle-test-gallery/`

**Total Photos**: 21 organized photos
- 4 undamaged vehicles
- 3 light severity damage
- 3 moderate severity damage
- 5 high severity damage
- 3 airbag deployed
- 3 total loss

See `REAL_VEHICLE_PHOTO_DATASET.md` for complete catalog.

## Task 17: ✅ COMPLETE - Collect Real Vehicle Photo Test Dataset

**Status**: Complete

**Deliverables**:
- ✅ 17 damaged vehicle photos (exceeds requirement of 10+)
- ✅ 4 undamaged vehicle photos (exceeds requirement of 3+)
- ✅ 3 airbag deployment photos (exceeds requirement of 2+)
- ✅ 3 total loss photos (exceeds requirement of 2+)
- ✅ Various angles and lighting conditions
- ✅ Different damage severity levels
- ✅ Dataset catalog document created

## Task 18: Testing with Real Photos

### Prerequisites

Before running tests with real photos, you need to:

1. **Upload photos to Cloudinary** (or use file:// URLs for local testing)
2. **Ensure GEMINI_API_KEY is configured** in .env
3. **Initialize Gemini service** before running tests

### Task 18.1: Test with Damaged Vehicle Photos

**Test Script**: `scripts/test-gemini-with-real-photos.ts`

**Usage**:
```bash
tsx scripts/test-gemini-with-real-photos.ts
```

**What it tests**:
- 17 damaged vehicle photos across all severity levels
- Damage score accuracy (scores should be > 30 for damaged vehicles)
- Severity classification (minor/moderate/severe)
- Airbag deployment detection
- Total loss identification

**Expected Results**:
- All damaged vehicles should have at least one damage score > 30
- Severity classification should match visual assessment
- Airbag deployment should be detected in relevant photos
- Total loss should be identified for severely damaged vehicles

### Task 18.2: Test with Undamaged Vehicle Photos

**Included in**: `scripts/test-gemini-with-real-photos.ts`

**What it tests**:
- 4 undamaged Toyota Camry 2021 photos
- All damage scores should be < 30
- Severity should be 'minor'
- No airbag deployment
- Not total loss

**Expected Results**:
- False positive rate < 10%
- All undamaged vehicles correctly identified
- Consistent results across multiple photos of same vehicle

### Task 18.3: Property-Based Accuracy Tests

**Test File**: `tests/unit/integrations/gemini-damage-detection-accuracy.property.test.ts`

**Usage**:
```bash
npm run test:unit -- tests/unit/integrations/gemini-damage-detection-accuracy.property.test.ts
```

**What it tests**:
- Property 13: Damage Detection Accuracy Bounds
- Requirement 8.2: Damaged vehicle detection (scores > 30)
- Requirement 8.4: Undamaged vehicle detection (scores < 30)
- False positive rate < 10%
- False negative rate < 5%
- Accuracy across damage severity spectrum

**Expected Results**:
- All property tests pass
- Accuracy bounds maintained across all test cases
- Low false positive/negative rates

## Task 19: Load and Performance Tests

### Rate Limiting Tests

**What to test**:
- Burst requests (20 requests in 1 minute)
- Rate limiting kicks in at 10 requests/minute
- Daily quota exhaustion (1,500+ requests)
- Fallback to Vision API when rate limited

**Test Commands**:
```bash
# Run rate limiter tests
npm run test:unit -- tests/unit/integrations/gemini-rate-limiter.test.ts
npm run test:unit -- tests/unit/integrations/gemini-rate-limiter.property.test.ts
```

### Performance Tests

**What to test**:
- Fallback latency (Gemini → Vision → Neutral)
- 30-second total timeout under load
- Average response time by method
- Gemini: < 10 seconds
- Vision: < 8 seconds
- Neutral: < 1 second

**Test Commands**:
```bash
# Run timeout tests
npm run test:unit -- tests/unit/cases/ai-assessment-timeout.property.test.ts

# Run fallback integration tests
npm run test:integration -- tests/integration/cases/ai-assessment-fallback-integration.test.ts
```

## Task 20: Logging Completeness Tests

**Test File**: Already implemented in property tests

**What to test**:
- Property 10: Logging Completeness
- Method used is logged for all assessments
- Timestamp, photo count, quota usage logged for Gemini
- Fallback reasons logged
- Error context logged

**Test Commands**:
```bash
# Logging is validated in existing tests
npm run test:unit -- tests/unit/cases/ai-assessment-fallback-orchestration.test.ts
```

## Task 21: Error Message Descriptiveness Tests

**Test File**: Already implemented in property tests

**What to test**:
- Property 11: Error Message Descriptiveness
- Rate limit errors include retry time
- Invalid photo format errors include supported formats
- Authentication errors indicate API key issue
- All errors clearly describe the problem

**Test Commands**:
```bash
# Error handling is validated in existing tests
npm run test:unit -- tests/unit/integrations/gemini-service.test.ts
npm run test:unit -- tests/unit/integrations/gemini-retry-logic.test.ts
```

## Task 22: Checkpoint - Ensure All Tests Pass

### Test Execution Checklist

Run all tests to ensure 100% pass rate:

```bash
# 1. Unit tests
npm run test:unit

# 2. Integration tests
npm run test:integration

# 3. Property-based tests (specific)
npm run test:unit -- tests/unit/integrations/gemini-*.property.test.ts
npm run test:unit -- tests/unit/cases/*-property.test.ts

# 4. Real photo tests (requires Gemini API key)
tsx scripts/test-gemini-with-real-photos.ts
```

### Success Criteria

- ✅ All unit tests pass (100% pass rate)
- ✅ All property-based tests pass (100+ iterations each)
- ✅ All integration tests pass (100% pass rate)
- ✅ Accuracy validation meets targets:
  - Overall accuracy > 85%
  - False positive rate < 10%
  - False negative rate < 5%
- ✅ All 13 correctness properties passing
- ✅ Rate limiting respected (zero quota violations)
- ✅ Fallback chain operates correctly
- ✅ API response times < 10 seconds (95th percentile)

### If Tests Fail

1. **Review failure details** - Check which specific test failed
2. **Check Gemini API key** - Ensure it's valid and has quota
3. **Verify photo access** - Ensure test photos are accessible
4. **Check rate limits** - May need to wait if quota exceeded
5. **Review logs** - Check console output for error details
6. **Adjust expectations** - Some photos may be edge cases

## Running Tests with Real Gemini API

### Setup

1. **Configure API Key**:
```bash
# Add to .env
GEMINI_API_KEY=your-actual-api-key-here
```

2. **Upload Test Photos** (Optional - for production-like testing):
```bash
# Upload photos to Cloudinary and update test scripts with URLs
# Or use file:// URLs for local testing
```

3. **Initialize Service**:
```typescript
import { initializeGeminiService } from '@/lib/integrations/gemini-damage-detection';
await initializeGeminiService();
```

### Rate Limit Considerations

- **Free tier limits**: 10 requests/minute, 1,500 requests/day
- **Test execution**: Run tests in batches to avoid rate limiting
- **Delays**: Add 1-second delays between requests
- **Monitoring**: Check quota at https://aistudio.google.com/usage

### Local Testing with file:// URLs

For quick testing without uploading to Cloudinary:

```typescript
const fileUrl = `file://${join(process.cwd(), photoPath)}`;
const result = await assessDamage([fileUrl], marketValue, vehicleContext);
```

**Note**: file:// URLs work for local testing but won't work in production. Production must use Cloudinary URLs.

## Accuracy Targets

Based on requirements, the system must achieve:

- **Overall Accuracy**: > 85% correct assessments
- **False Positive Rate**: < 10% (undamaged vehicles incorrectly flagged as damaged)
- **False Negative Rate**: < 5% (damaged vehicles incorrectly flagged as undamaged)
- **Severity Classification**: Correct severity level for > 80% of cases
- **Airbag Detection**: > 90% accuracy for airbag deployment
- **Total Loss Detection**: > 85% accuracy for total loss identification

## Next Steps After Phase 5

Once all Phase 5 tests pass:

1. **Proceed to Phase 6**: Monitoring, Documentation, and Observability
2. **Update integration documentation**
3. **Create monitoring dashboards**
4. **Configure alerting thresholds**
5. **Prepare for Phase 7**: Deployment and Gradual Rollout

## Troubleshooting

### Common Issues

**Issue**: Tests fail with "GEMINI_API_KEY not configured"
**Solution**: Add GEMINI_API_KEY to .env file

**Issue**: Tests fail with rate limit exceeded
**Solution**: Wait for rate limit window to reset (1 minute or 24 hours)

**Issue**: Photos not found
**Solution**: Verify photo paths are correct relative to project root

**Issue**: Low accuracy on specific photos
**Solution**: Review photo quality, lighting, and damage visibility

**Issue**: Gemini returns unexpected results
**Solution**: Check prompt construction and response validation logic

## Documentation

- **Dataset Catalog**: `REAL_VEHICLE_PHOTO_DATASET.md`
- **Test Script**: `scripts/test-gemini-with-real-photos.ts`
- **Property Tests**: `tests/unit/integrations/gemini-damage-detection-accuracy.property.test.ts`
- **Requirements**: `requirements.md` (Requirements 8.1-8.7)
- **Design**: `design.md` (Testing Strategy section)
