# Google Maps API 403 Error Fix

## Problem Identified ✅

**Issue**: Google Maps Platform rejected your request with 403 error: "This API is not activated on your API project"

**Root Cause**: Your Google Cloud project has many APIs enabled (Cloud Vision, BigQuery, etc.) but is **missing the Maps Embed API** which is required for displaying maps in your application.

## Current API Status

✅ **Working APIs** (tested successfully):
- **Geolocation API** - Used for GPS location detection
- **Geocoding API** - Used for reverse geocoding (coordinates to address)
- **Places API** - Used for location autocomplete

❌ **Missing API** (causing 403 error):
- **Maps Embed API** - Required for displaying Google Maps iframes

## APIs Your Application Uses

Based on code analysis, your application uses these Google Maps APIs:

1. **Maps Embed API** - For displaying maps in auction details
   - Used in: `src/app/(dashboard)/vendor/auctions/[id]/page.tsx`
   - URL pattern: `https://www.google.com/maps/embed/v1/place?key=...`

2. **Geolocation API** - For accurate GPS positioning
   - Used in: `src/lib/integrations/google-geolocation.ts`
   - URL pattern: `https://www.googleapis.com/geolocation/v1/geolocate?key=...`

3. **Geocoding API** - For converting coordinates to addresses
   - Used for reverse geocoding in geolocation service
   - URL pattern: `https://maps.googleapis.com/maps/api/geocode/json?latlng=...`

## Solution: Enable Maps Embed API

### Step 1: Enable Maps Embed API in Google Cloud Console

1. **Go to Google Cloud Console**:
   - Visit: https://console.cloud.google.com/
   - Select your project: `nem-salvage`

2. **Navigate to APIs & Services**:
   - Click on "APIs & Services" → "Library"

3. **Enable Maps Embed API**:
   - Search for "Maps Embed API"
   - Click on the result
   - Click **"Enable"** button

4. **Enable Maps JavaScript API** (recommended for future features):
   - Search for "Maps JavaScript API"
   - Click on the result
   - Click **"Enable"** button

### Step 2: Verify API Key Restrictions

Your current API key: `AIzaSyBpNs3iZUa16V03YfhypvmXgkxbKXcmKkM`

1. **Go to Credentials**:
   - Visit: https://console.cloud.google.com/apis/credentials
   - Find your API key and click on it

2. **Update API Restrictions**:
   - Under "API restrictions", select "Restrict key"
   - Ensure these APIs are checked:
     - ✅ Geolocation API (already working)
     - ✅ Geocoding API (already working)
     - ✅ Places API (already working)
     - ✅ **Maps Embed API** (add this one)
     - ✅ **Maps JavaScript API** (add this one)

3. **Update Application Restrictions** (optional but recommended):
   - Select "HTTP referrers (web sites)"
   - Add your domains:
     ```
     http://localhost:3000/*
     https://yourdomain.com/*
     https://*.vercel.app/*
     ```

4. **Save Changes**

### Step 3: Test the Fix

After enabling the APIs, test the Maps Embed functionality:

```bash
# Test Maps Embed API (should work after enabling)
curl -I "https://www.google.com/maps/embed/v1/place?key=AIzaSyBpNs3iZUa16V03YfhypvmXgkxbKXcmKkM&q=Igbogbo,Ikorodu,Lagos"
```

Expected result: HTTP 200 OK (instead of 403 Forbidden)

### Step 4: Verify in Your Application

1. **Restart your development server**:
   ```bash
   npm run dev
   ```

2. **Test Maps Display**:
   - Navigate to any auction details page
   - Look for the Google Maps iframe
   - It should now display the map instead of showing an error

3. **Test GPS Location**:
   - Go to case creation page
   - Click "Get Current Location"
   - Should work (this was already working)

## Additional Recommendations

### 1. Enable Places API (New) for Enhanced Location Search

Consider enabling the **Places API (New)** for better location autocomplete:

1. Go to: https://console.cloud.google.com/apis/library/places-backend.googleapis.com
2. Click "Enable"
3. Add to your API key restrictions

### 2. Set Up Billing Alerts

To monitor API usage costs:

1. Go to: https://console.cloud.google.com/billing/budgets
2. Create a budget alert for $50/month
3. Set notifications at 50%, 90%, 100%

### 3. API Usage Monitoring

Monitor your API usage at:
- https://console.cloud.google.com/apis/dashboard

## Cost Impact

**Maps Embed API**: FREE (unlimited usage)
**Maps JavaScript API**: $7 per 1,000 map loads (after free tier)

Your current usage should remain within free tiers.

## Security Best Practices

✅ **Already Implemented**:
- API key is properly restricted to specific APIs
- Using environment variables for API keys

🔒 **Additional Security**:
- Consider rotating API keys every 90 days
- Monitor usage for unusual spikes
- Use different keys for development and production

## Troubleshooting

### If Maps Still Don't Load After Enabling APIs

1. **Clear Browser Cache**:
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

2. **Check Browser Console**:
   - Open Developer Tools (F12)
   - Look for any JavaScript errors
   - Check Network tab for failed requests

3. **Verify Environment Variables**:
   ```bash
   # Check your .env file has the correct API key
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyBpNs3iZUa16V03YfhypvmXgkxbKXcmKkM
   ```

4. **Test API Key Directly**:
   ```bash
   # This should return HTML content (not 403 error)
   curl "https://www.google.com/maps/embed/v1/place?key=YOUR_API_KEY&q=Lagos,Nigeria"
   ```

### Common Error Messages

**"This API project is not authorized to use this API"**
- Solution: Enable the specific API in Google Cloud Console

**"API key not valid"**
- Solution: Check API key restrictions and ensure the API is enabled

**"Quota exceeded"**
- Solution: Check usage limits and enable billing if needed

## Summary

**Root Cause**: Maps Embed API not enabled in Google Cloud Console
**Solution**: Enable Maps Embed API and Maps JavaScript API
**Impact**: Maps will display properly in auction details pages
**Cost**: No additional cost (Maps Embed API is free)

**Next Steps**:
1. ✅ Enable Maps Embed API in Google Cloud Console
2. ✅ Update API key restrictions to include new APIs
3. ✅ Test maps display in your application
4. ✅ Set up billing alerts for monitoring

This should resolve the 403 error and allow Google Maps to display properly in your application.