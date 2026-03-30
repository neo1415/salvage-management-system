# PWA Splash Screen Fix Guide

## Problem
Your splash screen appears blurry because:
1. Using JPG format (poor for logos, no transparency)
2. Using same small image for all icon sizes (causes upscaling blur)
3. Missing proper splash screen icon sizes

## Required Icon Sizes for Crisp Display

### Android
- 192x192px (minimum)
- 512x512px (standard)
- 1024x1024px (recommended for splash)

### iOS
- 180x180px (iPhone)
- 1024x1024px (iPad)
- 2048x2048px (splash screen - CRITICAL for crisp display)

## Step-by-Step Fix

### Step 1: Get High-Resolution Logo
You need a PNG version of your NEM logo at **minimum 1024x1024px**, ideally **2048x2048px**.

**Where to get it:**
- Ask your design team for the original vector/high-res file
- If you only have the current JPG, use an AI upscaler:
  - https://www.upscale.media/ (free, good quality)
  - https://bigjpg.com/ (free, AI-based)
  - Convert to PNG after upscaling

### Step 2: Generate All Required Sizes

**Option A: Online Tool (Easiest)**
1. Go to https://www.pwabuilder.com/imageGenerator
2. Upload your high-res PNG (1024x1024 or larger)
3. Download the generated icon pack
4. Extract to `public/icons/`

**Option B: Manual (Using ImageMagick or Photoshop)**
Generate these sizes from your high-res PNG:
```bash
# Using ImageMagick (if installed)
convert logo-2048.png -resize 192x192 icon-192.png
convert logo-2048.png -resize 512x512 icon-512.png
convert logo-2048.png -resize 1024x1024 icon-1024.png
convert logo-2048.png -resize 2048x2048 icon-2048.png
```

### Step 3: Update File Structure
Place these files in `public/icons/`:
```
public/icons/
├── icon-192.png      (192x192px)
├── icon-512.png      (512x512px)
├── icon-1024.png     (1024x1024px)
├── icon-2048.png     (2048x2048px) ← CRITICAL for splash
└── apple-touch-icon.png (180x180px for iOS)
```

### Step 4: Update manifest.json
Replace your current manifest.json with the updated version (see below).

### Step 5: Add iOS Splash Screen Meta Tags
Add to your `src/app/layout.tsx` in the `<head>` section:
```tsx
{/* iOS Splash Screens */}
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
<link rel="apple-touch-startup-image" href="/icons/icon-2048.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

### Step 6: Test
1. Clear browser cache
2. Uninstall PWA if already installed
3. Reinstall PWA
4. Check splash screen on app launch

## Why This Fixes the Blur

**Before:**
- Small JPG (maybe 200x200) stretched to 2048x2048 for splash = BLURRY

**After:**
- Native 2048x2048 PNG for splash = CRISP
- Proper sizes for each use case = No upscaling needed

## Additional Tips

### Logo Design Best Practices
- Use PNG with transparent background
- Keep logo centered with padding (safe area)
- Test on both light and dark backgrounds
- Minimum 20% padding around logo edges

### Background Color
Your manifest uses `#800020` (burgundy) - make sure your logo looks good on this background.

### Testing Checklist
- [ ] Logo is crisp on Android splash screen
- [ ] Logo is crisp on iOS splash screen
- [ ] Logo is crisp in app icon
- [ ] Logo is crisp in browser tab
- [ ] Logo looks good on burgundy background
- [ ] No pixelation or blur visible

## Quick Fix (Temporary)
If you can't get a high-res logo immediately:
1. Use a solid color splash screen with text
2. Update manifest background_color to your brand color
3. Remove icon from splash (will show solid color only)

This is better than a blurry logo!
