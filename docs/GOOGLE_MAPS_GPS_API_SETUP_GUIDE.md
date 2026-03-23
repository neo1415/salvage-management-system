# Google Maps & GPS API Setup Guide

## Overview

Your application uses two Google services:
1. **Google Maps Embed API** - For displaying maps
2. **Google Geolocation API** - For getting GPS coordinates

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name: "Salvage Management System"
4. Click "Create"

## Step 2: Enable Required APIs

### Enable Maps Embed API
1. In Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Maps Embed API"
3. Click on it and click "Enable"

### Enable Geolocation API
1. In the API Library, search for "Geolocation API"
2. Click on it and click "Enable"

### Enable Maps JavaScript API (Optional - for advanced features)
1. Search for "Maps JavaScript API"
2. Click "Enable"

## Step 3: Create API Key

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "API Key"
3. Copy the API key (looks like: `AIzaSyD...`)
4. Click "Restrict Key" (IMPORTANT for security)

## Step 4: Restrict API Key

### Application Restrictions
1. Choose "HTTP referrers (web sites)"
2. Add your domains:
   ```
   http://localhost:3000/*
   https://yourdomain.com/*
   https://*.yourdomain.com/*
   ```

### API Restrictions
1. Choose "Restrict key"
2. Select these APIs:
   - Maps Embed API
   - Geolocation API
   - Maps JavaScript API (if enabled)

3. Click "Save"

## Step 5: Add to Environment Variables

Add to your `.env` file:

```env
# Google Maps & Geolocation
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyD...your-key-here
GOOGLE_GEOLOCATION_API_KEY=AIzaSyD...your-key-here

# Note: You can use the same key for both, or create separate keys
```

## Step 6: Update Your Code

### For Map Display (Already implemented)

Your auction details page already uses Google Maps Embed:

```typescript
<iframe
  src={`https://www.google.com/maps?q=${lat},${lng}&output=embed`}
  // ...
/>
```

**No API key needed for basic embed!** But for advanced features, you can add:

```typescript
<iframe
  src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${lat},${lng}`}
  // ...
/>
```

### For GPS Geolocation (Already implemented)

Your code already uses the Geolocation API in `src/lib/integrations/google-geolocation.ts`:

```typescript
const response = await fetch(
  `https://www.googleapis.com/geolocation/v1/geolocate?key=${process.env.GOOGLE_GEOLOCATION_API_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  }
);
```

## Step 7: Test the APIs

### Test Geolocation API
```bash
curl -X POST \
  "https://www.googleapis.com/geolocation/v1/geolocate?key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response**:
```json
{
  "location": {
    "lat": 6.5244,
    "lng": 3.3792
  },
  "accuracy": 1000.0
}
```

### Test in Your App
1. Go to case creation page
2. Click "Get GPS Location"
3. Allow location access
4. Should see coordinates captured

## Pricing

### Free Tier (Monthly)
- **Maps Embed API**: Unlimited (Free)
- **Geolocation API**: $5 credit = ~1,000 requests
- **Maps JavaScript API**: $200 credit = ~28,000 map loads

### After Free Tier
- **Geolocation API**: $5 per 1,000 requests
- **Maps JavaScript API**: $7 per 1,000 map loads

### Set Billing Alerts
1. Go to "Billing" in Google Cloud Console
2. Click "Budgets & alerts"
3. Create budget: $10/month
4. Set alert at 50%, 90%, 100%

## Security Best Practices

### 1. Restrict API Keys
✅ Always restrict by:
- HTTP referrers (domains)
- Specific APIs only

### 2. Use Different Keys
- **Frontend key** (NEXT_PUBLIC_*): Restricted to your domain
- **Backend key**: Restricted to Geolocation API only

### 3. Monitor Usage
- Check Google Cloud Console → APIs & Services → Dashboard
- Set up billing alerts
- Review usage weekly

### 4. Rotate Keys
- Rotate API keys every 90 days
- Keep old key active for 24 hours during rotation

## Alternative: Browser Geolocation API

For basic GPS, you can use the browser's built-in API (FREE):

```typescript
// Get user's current location (no API key needed)
navigator.geolocation.getCurrentPosition(
  (position) => {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const accuracy = position.coords.accuracy;
    console.log({ lat, lng, accuracy });
  },
  (error) => {
    console.error('Geolocation error:', error);
  },
  {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
  }
);
```

**Your app already uses this!** Check `src/app/(dashboard)/adjuster/cases/new/page.tsx`

## Troubleshooting

### Error: "This API key is not authorized"
**Solution**: Check API key restrictions match your domain

### Error: "API key not found"
**Solution**: Verify environment variable is set correctly

### Error: "Quota exceeded"
**Solution**: 
1. Check usage in Google Cloud Console
2. Enable billing if needed
3. Increase quota limits

### Maps not loading
**Solution**:
1. Check browser console for errors
2. Verify API key is correct
3. Check domain restrictions
4. Ensure Maps Embed API is enabled

## Current Implementation Status

✅ **Already Implemented**:
- Browser Geolocation API (FREE)
- Google Maps Embed (FREE)
- Reverse geocoding with Google Geolocation API
- GPS accuracy validation
- Offline GPS caching

❌ **Not Implemented** (Optional):
- Interactive maps (draggable markers)
- Route planning
- Places autocomplete
- Street View

## Recommendations

### For Development
Use **Browser Geolocation API** (FREE) - Already implemented!

### For Production
1. **Option A**: Continue using Browser Geolocation (FREE)
   - Pros: Free, works well, already implemented
   - Cons: Requires user permission, less accurate indoors

2. **Option B**: Add Google Geolocation API (Paid)
   - Pros: Works without GPS, more accurate
   - Cons: Costs $5 per 1,000 requests
   - Use case: Backup when browser geolocation fails

### Recommended Setup
```env
# Use browser geolocation as primary
# Use Google Geolocation as fallback (optional)
GOOGLE_GEOLOCATION_API_KEY=your-key-here  # Optional
```

## Quick Start Checklist

- [ ] Create Google Cloud Project
- [ ] Enable Maps Embed API
- [ ] Enable Geolocation API (optional)
- [ ] Create API Key
- [ ] Restrict API Key (domain + APIs)
- [ ] Add to `.env` file
- [ ] Test geolocation in app
- [ ] Set billing alerts
- [ ] Monitor usage

## Need Help?

- [Google Maps Platform Documentation](https://developers.google.com/maps/documentation)
- [Geolocation API Documentation](https://developers.google.com/maps/documentation/geolocation/overview)
- [Pricing Calculator](https://mapsplatformtransition.withgoogle.com/calculator)

---

**Note**: Your app already works with FREE browser geolocation! Google APIs are optional enhancements.
