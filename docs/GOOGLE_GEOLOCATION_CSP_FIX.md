# Google Geolocation CSP Fix

## Issue
Content Security Policy (CSP) violation was blocking Google Geolocation API calls:
```
Connecting to 'https://www.googleapis.com/geolocation/v1/geolocate?key=your-google-maps-api-key-here' 
violates the following Content Security Policy directive
```

## Root Causes
1. **Missing CSP Header**: Middleware didn't have a Content-Security-Policy header allowing `googleapis.com`
2. **Placeholder API Key**: `.env` file had placeholder `your-google-maps-api-key-here` instead of real API key

## Fixes Applied

### 1. Added CSP Header to Middleware
**File**: `src/middleware.ts`

Added comprehensive Content-Security-Policy header that allows:
- `https://www.googleapis.com` - Google Geolocation API
- `https://nominatim.openstreetmap.org` - Reverse geocoding (OpenStreetMap)
- `https://api.paystack.co` - Paystack payment API
- `https://api.flutterwave.com` - Flutterwave payment API
- `https://api.cloudinary.com` - Cloudinary upload API
- `https://res.cloudinary.com` - Cloudinary image delivery
- `https://js.paystack.co` - Paystack iframe
- `https://checkout.flutterwave.com` - Flutterwave iframe

The CSP header includes:
```typescript
response.headers.set(
  'Content-Security-Policy',
  [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://www.googleapis.com https://nominatim.openstreetmap.org https://api.paystack.co https://api.flutterwave.com https://api.cloudinary.com https://res.cloudinary.com",
    "frame-src 'self' https://js.paystack.co https://checkout.flutterwave.com",
    "worker-src 'self' blob:",
  ].join('; ')
);
```

### 2. Updated .env.example
**File**: `.env.example`

Added Google Maps API key configuration with instructions:
```bash
# Google Maps (for accurate geolocation)
# Get API key from: https://console.cloud.google.com/apis/credentials
# Enable: Maps JavaScript API, Geolocation API, Geocoding API
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

## Understanding Google Cloud Authentication

You already have Google Cloud set up for AI features! But you need a different type of key for geolocation:

### Two Types of Google Authentication

**1. Service Account (Already Working ✅)**
- File: `google-cloud-credentials.json`
- Used for: Vision API (AI damage assessment)
- Runs on: Server-side (Node.js)
- Authentication: OAuth2 with private key

**2. API Key (Needed for Geolocation ❌)**
- Environment variable: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- Used for: Geolocation API (GPS accuracy)
- Runs on: Client-side (browser)
- Authentication: Simple API key

### Why You Need Both
- **Service Account**: Secure server-side APIs (AI, Document processing)
- **API Key**: Browser-based APIs (Geolocation, Maps display)

The service account credentials can't be used in the browser for security reasons (they contain private keys).

## Next Steps for User

### Get a Google Maps API Key (Same Project!)
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select your existing project: **nem-salvage** (same as AI)
3. Click "Create Credentials" → "API Key"
4. Enable these APIs in the same project:
   - **Geolocation API** (required)
   - **Geocoding API** (optional, for reverse geocoding)
   - **Maps JavaScript API** (optional, for map display)

### Update .env File
Replace the placeholder in your `.env` file:
```bash
# Before
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here

# After (example - get from Google Cloud Console)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Restart Development Server
After updating `.env`, restart your dev server:
```bash
npm run dev
```

## How It Works

### Geolocation Flow
1. **Primary**: Google Geolocation API (10-50m accuracy)
   - Uses WiFi, cell towers, and GPS
   - Requires internet connection
   - Requires API key
   - Cost: ~$5 per 1000 requests

2. **Fallback**: Browser Geolocation API (100-5000m accuracy)
   - Uses device GPS only
   - Works offline
   - Free
   - Less accurate, especially indoors

### Code Location
**File**: `src/lib/integrations/google-geolocation.ts`

```typescript
export async function getAccurateGeolocation(): Promise<GeolocationResult> {
  // Try Google API first if online and API key is available
  if (navigator.onLine && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    try {
      const googleLocation = await getGoogleGeolocation();
      return googleLocation;
    } catch (error) {
      console.warn('Google Geolocation API failed, falling back to browser geolocation:', error);
    }
  }

  // Fallback to browser geolocation
  return await getBrowserGeolocation();
}
```

## Testing

### Without API Key (Fallback Mode)
- System will use browser geolocation
- Accuracy: 100-5000m
- Works offline
- No CSP errors

### With API Key (Google API Mode)
- System will use Google Geolocation API
- Accuracy: 10-50m
- Requires internet
- No CSP errors (after this fix)

### Verify CSP Fix
1. Open browser DevTools (F12)
2. Go to Console tab
3. Create a new case with location
4. Should see no CSP violation errors
5. Check Network tab for successful call to `googleapis.com`

## Cost Estimation

### Google Geolocation API Pricing
- **Free tier**: $200 credit per month (~40,000 requests)
- **Paid tier**: $5 per 1000 requests after free tier

### Expected Usage (NEM Salvage)
- ~3000 cases per month
- ~1 geolocation request per case
- **Cost**: FREE (well within free tier)

## Security Considerations

### CSP Benefits
- Prevents XSS attacks
- Restricts resource loading to trusted domains
- Protects against data exfiltration
- Maintains security while allowing necessary APIs

### API Key Security
- `NEXT_PUBLIC_*` prefix means key is exposed to browser
- Google allows API key restrictions:
  - HTTP referrer restrictions (recommended)
  - IP address restrictions
  - API restrictions (enable only Geolocation API)

### Recommended API Key Restrictions
1. Go to [API Credentials](https://console.cloud.google.com/apis/credentials)
2. Click on your API key
3. Under "Application restrictions":
   - Select "HTTP referrers (web sites)"
   - Add: `http://localhost:3000/*` (development)
   - Add: `https://yourdomain.com/*` (production)
4. Under "API restrictions":
   - Select "Restrict key"
   - Enable only: "Geolocation API"

## Files Modified
1. `src/middleware.ts` - Added CSP header
2. `.env.example` - Added Google Maps API key documentation

## Related Documentation
- [GPS_ACCURACY_FIX_COMPLETE.md](./GPS_ACCURACY_FIX_COMPLETE.md) - Original GPS accuracy improvement
- [PHASE_4_OFFLINE_MODE_POLISH_COMPLETE.md](./PHASE_4_OFFLINE_MODE_POLISH_COMPLETE.md) - Offline mode implementation
- [tests/unit/integrations/google-geolocation.test.ts](./tests/unit/integrations/google-geolocation.test.ts) - Unit tests

## Status
✅ **CSP Fix Complete** - No more CSP violations
⚠️ **API Key Required** - User needs to add real Google Maps API key to `.env`
✅ **Fallback Working** - Browser geolocation works without API key
