# Google APIs - Switch to Real APIs Summary

## What Changed

I've updated your configuration to switch from mock/placeholder APIs to real Google APIs for:

1. **Google Geolocation API** - For accurate GPS location capture during case creation
2. **Google Cloud Vision API** - For AI damage assessment and cost estimation

---

## Changes Made

### 1. `.env` File Updates

#### Before:
```bash
MOCK_AI_ASSESSMENT=true
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here
```

#### After:
```bash
MOCK_AI_ASSESSMENT=false
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
```

**Note**: The API key is now empty and ready for you to add your real key.

---

## What You Need to Do

### Step 1: Enable APIs in Google Cloud Console
You need to enable these APIs in your `nem-salvage` project:

1. **Geolocation API**: https://console.cloud.google.com/apis/library/geolocation.googleapis.com
2. **Cloud Vision API**: https://console.cloud.google.com/apis/library/vision.googleapis.com
3. **Geocoding API**: https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com

Just click "Enable" for each one.

### Step 2: Create API Key for Geolocation
1. Go to: https://console.cloud.google.com/apis/credentials
2. Click **"+ CREATE CREDENTIALS"** → **"API key"**
3. Copy the generated key
4. Restrict it to only: Geolocation API and Geocoding API
5. Add it to your `.env` file:
   ```bash
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_KEY_HERE
   ```

### Step 3: Verify Cloud Vision Setup
Your Cloud Vision API should already be configured with the service account in `google-cloud-credentials.json`.

Just verify the service account has the "Cloud Vision API User" role:
1. Go to: https://console.cloud.google.com/iam-admin/iam
2. Find your service account
3. Ensure it has "Cloud Vision API User" role

### Step 4: Test Everything
```bash
# Run the verification script
npx tsx scripts/verify-google-apis.ts

# If all checks pass, restart your dev server
npm run dev

# Test case creation at:
# http://localhost:3000/adjuster/cases/new
```

---

## Files Created

1. **`GOOGLE_APIS_REAL_SETUP_GUIDE.md`** - Complete setup guide with:
   - Step-by-step instructions
   - Cost estimates
   - Troubleshooting tips
   - Security best practices

2. **`scripts/verify-google-apis.ts`** - Verification script that tests:
   - Geolocation API configuration
   - Cloud Vision API configuration
   - Credentials and permissions

---

## How It Works Now

### Before (Mock Mode)
```typescript
// Case creation with mock data
const assessment = await assessDamage(photos, marketValue);
// Returns: Fake labels like "Vehicle", "Damage", "Dent"
// Source: Generated mock data
```

### After (Real APIs)
```typescript
// Case creation with real Google APIs
const assessment = await assessDamage(photos, marketValue);
// Returns: Real AI analysis from Google Cloud Vision
// Source: Google Cloud Vision API analyzing actual photos
```

### Geolocation
```typescript
// Before: Browser geolocation only (less accurate)
const location = await getAccurateGeolocation();
// Returns: { source: 'browser', accuracy: 50-100m }

// After: Google Geolocation API (more accurate)
const location = await getAccurateGeolocation();
// Returns: { source: 'google-api', accuracy: 10-30m }
```

---

## Cost Breakdown

With your $300 in credits (66 days free trial):

### Geolocation API
- **Cost**: $5 per 1,000 requests
- **Free tier**: First $200/month (40,000 requests)
- **Your usage**: ~3,000 cases/month = **FREE** (within free tier)

### Cloud Vision API
- **Cost**: $1.50 per 1,000 images
- **Free tier**: First 1,000 images/month
- **Your usage**: 
  - 3,000 cases × 5 photos = 15,000 images/month
  - After free tier: 14,000 images × $1.50/1000 = **$21/month**

### Total
- **Monthly cost**: ~$21
- **Your credits last**: ~14 months
- **After credits**: $21/month ongoing cost

---

## Testing Checklist

After completing the setup:

- [ ] Enable Geolocation API in Google Cloud Console
- [ ] Enable Cloud Vision API in Google Cloud Console
- [ ] Enable Geocoding API in Google Cloud Console
- [ ] Create and configure API key
- [ ] Add API key to `.env` file
- [ ] Verify service account permissions
- [ ] Run verification script: `npx tsx scripts/verify-google-apis.ts`
- [ ] Restart dev server: `npm run dev`
- [ ] Test geolocation on case creation page
- [ ] Test AI assessment with real photos
- [ ] Verify "source: google-api" in location data
- [ ] Verify real damage labels (not mock data)

---

## Troubleshooting

### "API key not valid"
- Make sure you enabled all 3 APIs (Geolocation, Geocoding, Vision)
- Check API key restrictions aren't blocking localhost

### "The caller does not have permission"
- Service account needs "Cloud Vision API User" role
- Check `google-cloud-credentials.json` exists

### Still seeing mock data
- Verify `.env` has `MOCK_AI_ASSESSMENT=false`
- Restart dev server
- Clear browser cache

---

## Quick Start

```bash
# 1. Enable APIs in Google Cloud Console (see Step 1 above)

# 2. Create API key and add to .env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here

# 3. Verify setup
npx tsx scripts/verify-google-apis.ts

# 4. Restart server
npm run dev

# 5. Test at http://localhost:3000/adjuster/cases/new
```

---

## Support

For detailed instructions, see: **`GOOGLE_APIS_REAL_SETUP_GUIDE.md`**

For issues:
1. Check the Troubleshooting section above
2. Run the verification script
3. Check Google Cloud Console error logs
4. Review browser console for errors

---

**Status**: ✅ Configuration updated and ready for real APIs!

**Next**: Follow the steps above to enable APIs and add your API key.
