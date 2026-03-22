# AI Damage Detection - Gemini Integration Fix

## Issue Summary

Totaled cars were being assessed as "minor" damage with salvage values equal to 100% of market value (e.g., ₦35.2M salvage value for a ₦35.2M Mercedes-Benz GLE350).

### Root Cause #1: Vision API Used Instead of Gemini

The system was using Google Vision API (fallback) instead of Gemini 2.0 Flash for damage detection, despite the Gemini migration being marked as complete.

**Why Vision API Failed:**
- Vision API returns generic labels like "Vehicle", "Car", "Motor vehicle"
- It cannot detect actual damage - only identifies objects in photos
- The log showed: "✅ No damage keywords detected - vehicle appears to be in good condition" for a totaled car

**Why This Happened:**
- The Gemini migration (`.kiro/specs/gemini-damage-detection-migration/`) was completed with all tasks marked done
- However, `ai-assessment-enhanced.service.ts` was never updated to use the Gemini fallback chain
- It was still calling `analyzePhotosWithVision()` directly, bypassing Gemini entirely

### Root Cause #2: Base64 Data URL Format Validation Failing

After fixing the fallback chain, a new issue was discovered: image format validation was failing for base64 data URLs with JPEG format.

**The Problem:**
- Error: "Invalid image format. Supported formats: JPEG, PNG, WebP. Received URL: data:image/jpeg;base64,..."
- The validation function `isValidImageFormat()` only checked for file extensions (`.jpg`, `.jpeg`, `.png`, `.webp`) in URLs
- Base64 data URLs don't have file extensions - they have MIME types in format: `data:image/jpeg;base64,...`
- The validation was rejecting valid JPEG images in base64 format

**Why This Matters:**
- Case creation uploads photos as base64 data URLs (not regular URLs)
- Format: `data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...`
- Without this fix, Gemini would never receive the photos

## The Fix

### Part 1: Implement Gemini Fallback Chain

**File: `src/features/cases/services/ai-assessment-enhanced.service.ts`**

1. **Added Gemini imports:**
   ```typescript
   import { assessDamageWithGemini } from '@/lib/integrations/gemini-damage-detection';
   import { assessDamageWithVision } from '@/lib/integrations/vision-damage-detection';
   import { isGeminiEnabled } from '@/lib/integrations/gemini-damage-detection';
   import { getGeminiRateLimiter } from '@/lib/integrations/gemini-rate-limiter';
   ```

2. **Replaced direct Vision API call with fallback chain:**
   - Old: `analyzePhotosWithVision(photos)` - called Vision API directly
   - New: `analyzePhotosWithFallback(photos, vehicleInfo)` - implements Gemini → Vision → Neutral chain

3. **Implemented `analyzePhotosWithFallback()` function:**
   - **Attempt 1:** Try Gemini 2.0 Flash (if enabled, rate limit allows, and vehicle context provided)
   - **Attempt 2:** Fall back to Vision API if Gemini fails or unavailable
   - **Attempt 3:** Return neutral scores (50 for all categories) if both fail

4. **Removed duplicate Vision API implementation:**
   - Deleted the old `analyzePhotosWithVision()` function
   - Now uses the Vision service directly from `@/lib/integrations/vision-damage-detection`

### Part 2: Fix Base64 Data URL Validation

**File: `src/lib/integrations/gemini-damage-detection.ts`**

1. **Updated `isValidImageFormat()` function:**
   - Old: Only checked for file extensions (`.jpg`, `.jpeg`, `.png`, `.webp`)
   - New: Handles both regular URLs and base64 data URLs
   - For base64 data URLs: Extracts MIME type from `data:image/jpeg;base64,...` format
   - Validates MIME type is one of: `image/jpeg`, `image/png`, `image/webp`
   - For regular URLs: Still checks file extensions as before

2. **Updated `getMimeTypeFromUrl()` function:**
   - Old: Only inferred MIME type from file extension
   - New: Extracts MIME type from base64 data URL if present
   - Falls back to extension-based inference for regular URLs

3. **Updated `convertImageToBase64()` function:**
   - Old: Always fetched image from URL and converted to base64
   - New: Detects if URL is already a base64 data URL
   - For base64 data URLs: Extracts the base64 data directly (no fetch needed)
   - For regular URLs: Fetches and converts as before
   - Handles both formats seamlessly

### Fallback Chain Logic

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Check if Gemini is enabled                              │
│    - GEMINI_API_KEY configured?                            │
│    - Vehicle context provided (make/model/year)?           │
│    - Rate limit allows (10/min, 1,500/day)?                │
└─────────────────────────────────────────────────────────────┘
                          │
                          ├─ YES → Try Gemini
                          │         │
                          │         ├─ SUCCESS → Return Gemini scores
                          │         │
                          │         └─ FAIL → Fall back to Vision
                          │
                          └─ NO → Use Vision API
                                    │
                                    ├─ SUCCESS → Return Vision scores
                                    │
                                    └─ FAIL → Return neutral scores (50)
```

## Verification

### Check Gemini Configuration

1. **Verify API key is set:**
   ```bash
   # Check .env file
   grep GEMINI_API_KEY .env
   ```
   
   Expected: `GEMINI_API_KEY=your-gemini-api-key-here`

2. **Check Gemini service status:**
   - Gemini auto-initializes on module load
   - Check logs for: `[Gemini Service] Initialized successfully`
   - If you see warnings about missing API key, Gemini is disabled

### Test the Fix

Run the test script:
```bash
npx tsx scripts/test-gemini-fix.ts
```

**Expected output:**
- Should see: `🤖 Attempting Gemini damage detection...`
- Should see: `✅ Gemini assessment successful`
- Analysis method should NOT be 'google-vision'

### Monitor Production Logs

When creating a case with photos, look for these log messages:

**Good (Gemini working):**
```
🤖 Attempting Gemini damage detection...
   Quota: 10/minute, 1500/day
✅ Gemini assessment successful
   Severity: severe
   Structural: 85, Mechanical: 75
   Cosmetic: 90, Electrical: 60, Interior: 70
```

**Fallback (Gemini unavailable):**
```
⚠️ Gemini rate limit exceeded: Daily quota exhausted. Falling back to Vision API.
👁️ Using Vision API for damage detection...
✅ Vision API assessment successful
```

**Problem (Gemini not enabled):**
```
ℹ️ Gemini not enabled. Using Vision API.
👁️ Using Vision API for damage detection...
```

## Impact

### Before Fix
- **Method:** Vision API only
- **Totaled car result:** "minor" damage, ₦35.2M salvage (100% of value)
- **Reason:** Vision API cannot detect damage, only identifies objects
- **Image format issue:** Base64 data URLs with JPEG format were rejected

### After Fix
- **Method:** Gemini 2.0 Flash (primary) → Vision API (fallback)
- **Expected totaled car result:** "severe" damage, realistic salvage value
- **Reason:** Gemini can analyze actual damage from photos
- **Image format support:** Both regular URLs and base64 data URLs (JPEG, PNG, WebP) are supported

### Technical Improvements

1. **Proper fallback chain:** Gemini → Vision → Neutral scores
2. **Base64 data URL support:** Case creation photos (data:image/jpeg;base64,...) now work
3. **MIME type extraction:** Correctly identifies image format from data URLs
4. **No unnecessary fetching:** Base64 data is extracted directly, not re-fetched
5. **Better error messages:** Truncates long data URLs in error messages for readability

## Gemini Benefits

1. **Multimodal AI:** Analyzes photos with understanding of vehicle damage
2. **Structured output:** Returns scores for 5 damage categories (structural, mechanical, cosmetic, electrical, interior)
3. **Severity classification:** Accurately classifies as minor/moderate/severe
4. **Airbag detection:** Can detect deployed airbags (indicator of severe damage)
5. **Total loss determination:** Can identify when repair cost > 75% of value

## Rate Limits (Free Tier)

- **Per minute:** 10 requests
- **Per day:** 1,500 requests
- **Fallback:** Automatically uses Vision API when limit exceeded

## Troubleshooting

### Issue: "Invalid image format" error for JPEG photos

**Symptoms:**
- Error message: "Invalid image format. Supported formats: JPEG, PNG, WebP. Received URL: data:image/jpeg;base64,..."
- Photos are in JPEG format but validation fails
- Gemini is never called because validation happens first

**Root Cause:**
- Photos are uploaded as base64 data URLs (data:image/jpeg;base64,...)
- Old validation only checked for file extensions (.jpg, .jpeg)
- Base64 data URLs don't have file extensions

**Solution:**
- ✅ Fixed in this update
- Validation now extracts MIME type from data URLs
- Supports both regular URLs and base64 data URLs

### Issue: Still seeing "minor" damage for totaled cars

**Check:**
1. Is GEMINI_API_KEY set in .env?
2. Is the API key valid? (Check logs for authentication errors)
3. Is vehicle context provided? (make, model, year required)
4. Is rate limit exceeded? (Check logs for quota warnings)

**Solution:**
- If API key missing: Add to .env and restart server
- If API key invalid: Get new key from https://aistudio.google.com/apikey
- If vehicle context missing: Ensure make/model/year are provided in case creation
- If rate limit exceeded: Wait for quota to reset (1 minute for per-minute, midnight UTC for daily)

### Issue: Gemini always falls back to Vision

**Check logs for:**
- `[Gemini Service] GEMINI_API_KEY not configured` → Add API key
- `[Gemini Service] Connection validation failed` → Check API key validity
- `[Gemini Service] Rate limit exceeded` → Wait for quota reset
- `ℹ️ Vehicle context incomplete` → Provide make/model/year

## Related Files

- `src/features/cases/services/ai-assessment-enhanced.service.ts` - Enhanced assessment with Gemini fallback
- `src/features/cases/services/ai-assessment.service.ts` - Basic assessment with fallback chain
- `src/lib/integrations/gemini-damage-detection.ts` - Gemini 2.0 Flash integration
- `src/lib/integrations/vision-damage-detection.ts` - Vision API fallback
- `src/lib/integrations/gemini-rate-limiter.ts` - Rate limiting for free tier
- `.kiro/specs/gemini-damage-detection-migration/` - Original migration spec

## Next Steps

1. **Test with real photos:** Upload photos of damaged vehicles and verify Gemini is used
2. **Monitor logs:** Check that Gemini is being called successfully
3. **Verify accuracy:** Confirm totaled cars are now assessed as "severe" with realistic salvage values
4. **Check rate limits:** Monitor daily usage to ensure staying within free tier

## Seed Script Consistency (Separate Issue)

The user also asked about seed script consistency across vehicle makes. This is a separate concern:

**Current seed scripts:**
- Mercedes, Toyota, Audi, Lexus, Hyundai, Kia, Nissan

**Recommendation:**
- Create an audit script to verify all makes have consistent seed data
- Ensure all use standard condition categories (poor, fair, good, excellent)
- Verify no duplicate or conflicting data
- This should be addressed in a separate task/spec

---

**Status:** ✅ Fix applied - Ready for testing
**Date:** 2026-03-07
**Priority:** High (affects damage assessment accuracy)
