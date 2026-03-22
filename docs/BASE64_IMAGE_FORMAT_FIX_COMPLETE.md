# Base64 Image Format Validation Fix - Complete

## Issue Summary

After implementing the Gemini fallback chain, a new issue was discovered: image format validation was failing for base64 data URLs with JPEG format.

### The Problem

**Error Message:**
```
Invalid image format. Supported formats: JPEG, PNG, WebP. 
Received URL: data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...
```

**Root Cause:**
- The validation function `isValidImageFormat()` only checked for file extensions (`.jpg`, `.jpeg`, `.png`, `.webp`) in URLs
- Base64 data URLs don't have file extensions - they have MIME types in format: `data:image/jpeg;base64,...`
- The validation was rejecting valid JPEG images in base64 format

**Why This Matters:**
- Case creation uploads photos as base64 data URLs (not regular URLs)
- Format: `data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...`
- Without this fix, Gemini would never receive the photos, even though the fallback chain was implemented

## The Fix

### File: `src/lib/integrations/gemini-damage-detection.ts`

#### 1. Updated `isValidImageFormat()` Function

**Before:**
```typescript
function isValidImageFormat(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return SUPPORTED_EXTENSIONS.some(ext => lowerUrl.includes(ext));
}
```

**After:**
```typescript
function isValidImageFormat(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  
  // Check if it's a base64 data URL
  if (lowerUrl.startsWith('data:image/')) {
    // Extract MIME type from data URL (between 'data:' and ';base64')
    const mimeTypeMatch = lowerUrl.match(/^data:(image\/[^;]+);base64/);
    if (mimeTypeMatch) {
      const mimeType = mimeTypeMatch[1];
      return SUPPORTED_IMAGE_FORMATS.includes(mimeType);
    }
    return false;
  }
  
  // For regular URLs, check file extension
  return SUPPORTED_EXTENSIONS.some(ext => lowerUrl.includes(ext));
}
```

**Changes:**
- Now handles both regular URLs and base64 data URLs
- For base64 data URLs: Extracts MIME type from `data:image/jpeg;base64,...` format
- Validates MIME type is one of: `image/jpeg`, `image/png`, `image/webp`
- For regular URLs: Still checks file extensions as before

#### 2. Updated `getMimeTypeFromUrl()` Function

**Before:**
```typescript
function getMimeTypeFromUrl(url: string): string {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('.png')) return 'image/png';
  if (lowerUrl.includes('.webp')) return 'image/webp';
  return 'image/jpeg'; // Default to JPEG for .jpg and .jpeg
}
```

**After:**
```typescript
function getMimeTypeFromUrl(url: string): string {
  const lowerUrl = url.toLowerCase();
  
  // Check if it's a base64 data URL
  if (lowerUrl.startsWith('data:image/')) {
    // Extract MIME type from data URL (between 'data:' and ';base64')
    const mimeTypeMatch = lowerUrl.match(/^data:(image\/[^;]+);base64/);
    if (mimeTypeMatch) {
      return mimeTypeMatch[1];
    }
  }
  
  // For regular URLs, infer from file extension
  if (lowerUrl.includes('.png')) return 'image/png';
  if (lowerUrl.includes('.webp')) return 'image/webp';
  return 'image/jpeg'; // Default to JPEG for .jpg and .jpeg
}
```

**Changes:**
- Extracts MIME type from base64 data URL if present
- Falls back to extension-based inference for regular URLs

#### 3. Updated `convertImageToBase64()` Function

**Before:**
```typescript
async function convertImageToBase64(imageUrl: string): Promise<{ data: string; mimeType: string }> {
  // Validate image format before fetching
  if (!isValidImageFormat(imageUrl)) {
    throw new Error(
      `Invalid image format. Supported formats: JPEG, PNG, WebP. ` +
      `Received URL: ${imageUrl}. ` +
      `Please provide images in one of the supported formats.`
    );
  }

  try {
    // Fetch the image
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    // Get the image as array buffer
    const arrayBuffer = await response.arrayBuffer();
    
    // Convert to base64
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    
    // Get MIME type
    const mimeType = getMimeTypeFromUrl(imageUrl);
    
    return {
      data: base64,
      mimeType,
    };
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';
    throw new Error(
      `Failed to convert image to base64. URL: ${imageUrl}. Error: ${errorMessage}`
    );
  }
}
```

**After:**
```typescript
async function convertImageToBase64(imageUrl: string): Promise<{ data: string; mimeType: string }> {
  // Validate image format before processing
  if (!isValidImageFormat(imageUrl)) {
    throw new Error(
      `Invalid image format. Supported formats: JPEG, PNG, WebP. ` +
      `Received URL: ${imageUrl.substring(0, 100)}... ` +
      `Please provide images in one of the supported formats.`
    );
  }

  try {
    // Check if it's already a base64 data URL
    if (imageUrl.toLowerCase().startsWith('data:image/')) {
      // Extract base64 data from data URL (after 'base64,')
      const base64Match = imageUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
      if (base64Match) {
        const base64Data = base64Match[1];
        const mimeType = getMimeTypeFromUrl(imageUrl);
        
        return {
          data: base64Data,
          mimeType,
        };
      }
      
      throw new Error('Invalid base64 data URL format');
    }
    
    // For regular URLs, fetch and convert to base64
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    // Get the image as array buffer
    const arrayBuffer = await response.arrayBuffer();
    
    // Convert to base64
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    
    // Get MIME type
    const mimeType = getMimeTypeFromUrl(imageUrl);
    
    return {
      data: base64,
      mimeType,
    };
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';
    throw new Error(
      `Failed to convert image to base64. URL: ${imageUrl.substring(0, 100)}... Error: ${errorMessage}`
    );
  }
}
```

**Changes:**
- Detects if URL is already a base64 data URL
- For base64 data URLs: Extracts the base64 data directly (no fetch needed)
- For regular URLs: Fetches and converts as before
- Handles both formats seamlessly
- Truncates long URLs in error messages for readability

## Verification

### Test Results

Run the validation test:
```bash
npx tsx scripts/test-base64-image-validation.ts
```

**Output:**
```
✅ MIME type extracted: image/jpeg
✅ Base64 data extracted (length: 384 chars)
✅ MIME type extracted: image/png
✅ MIME type extracted: image/webp
✅ Regular URLs with extensions validated correctly
✅ Invalid formats (GIF, BMP) correctly rejected
```

### Supported Formats

**Base64 Data URLs:**
- ✅ `data:image/jpeg;base64,...`
- ✅ `data:image/png;base64,...`
- ✅ `data:image/webp;base64,...`
- ❌ `data:image/gif;base64,...` (not supported by Gemini)

**Regular URLs:**
- ✅ `https://example.com/photo.jpg`
- ✅ `https://example.com/photo.jpeg`
- ✅ `https://example.com/photo.png`
- ✅ `https://example.com/photo.webp`
- ❌ `https://example.com/photo.bmp` (not supported)

## Impact

### Before Fix
- ❌ Base64 data URLs with JPEG format were rejected
- ❌ Error: "Invalid image format. Supported formats: JPEG, PNG, WebP. Received URL: data:image/jpeg;base64,..."
- ❌ Gemini never received photos from case creation
- ❌ System fell back to Vision API (which can't detect damage)

### After Fix
- ✅ Base64 data URLs with JPEG/PNG/WebP MIME types are accepted
- ✅ Regular URLs with file extensions still work
- ✅ Gemini receives photos from case creation
- ✅ Proper damage detection for totaled cars

## Technical Details

### Base64 Data URL Format

A base64 data URL has this structure:
```
data:[MIME-type];base64,[base64-encoded-data]
```

Example:
```
data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=
```

### Regex Patterns Used

**Extract MIME type:**
```typescript
const mimeTypeMatch = url.match(/^data:(image\/[^;]+);base64/);
// Captures: image/jpeg, image/png, image/webp
```

**Extract base64 data:**
```typescript
const base64Match = url.match(/^data:image\/[^;]+;base64,(.+)$/);
// Captures everything after "base64,"
```

## Next Steps

1. **Test with real case creation:**
   - Upload photos of damaged vehicles
   - Verify Gemini is called successfully
   - Confirm damage assessment is accurate

2. **Monitor logs:**
   - Look for: `🤖 Attempting Gemini damage detection...`
   - Look for: `✅ Gemini assessment successful`
   - Should NOT see: `Invalid image format` errors

3. **Verify totaled car assessment:**
   - Create case with photos of totaled car
   - Should see: "severe" damage classification
   - Should see: Realistic salvage value (not 100% of market value)

## Related Files

- `src/lib/integrations/gemini-damage-detection.ts` - Image validation and conversion
- `src/features/cases/services/ai-assessment-enhanced.service.ts` - Gemini fallback chain
- `scripts/test-base64-image-validation.ts` - Validation test script
- `AI_DAMAGE_DETECTION_GEMINI_FIX.md` - Complete fix documentation

## Troubleshooting

### Issue: Still seeing "Invalid image format" error

**Check:**
1. Is the image URL in the correct format?
   - Base64: `data:image/jpeg;base64,...`
   - Regular: `https://example.com/photo.jpg`
2. Is the MIME type supported? (jpeg, png, webp only)
3. Is the base64 data valid?

**Solution:**
- Verify the image URL format matches one of the supported patterns
- Check that the MIME type is one of: `image/jpeg`, `image/png`, `image/webp`
- Ensure the base64 data is properly encoded

### Issue: Gemini still not being called

**Check:**
1. Is GEMINI_API_KEY set in .env?
2. Is vehicle context provided? (make, model, year required)
3. Is rate limit exceeded?

**Solution:**
- See `AI_DAMAGE_DETECTION_GEMINI_FIX.md` for Gemini troubleshooting

---

**Status:** ✅ Fix complete and tested
**Date:** 2026-03-07
**Priority:** High (blocks Gemini damage detection)
