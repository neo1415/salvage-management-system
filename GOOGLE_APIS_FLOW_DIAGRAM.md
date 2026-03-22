# Google APIs Integration Flow

## Current Configuration Status

```
┌─────────────────────────────────────────────────────────────┐
│                     CONFIGURATION STATUS                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ✅ MOCK_AI_ASSESSMENT = false                              │
│     (Real Google Cloud Vision API enabled)                  │
│                                                              │
│  ⚠️  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = (empty)              │
│     (Needs your API key)                                    │
│                                                              │
│  ✅ GOOGLE_APPLICATION_CREDENTIALS = configured             │
│     (Service account ready)                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Case Creation Flow - Before vs After

### BEFORE (Mock Mode)

```
┌──────────────────────────────────────────────────────────────┐
│                    CASE CREATION (MOCK)                       │
└──────────────────────────────────────────────────────────────┘

User uploads photos
        │
        ▼
┌───────────────────┐
│  Browser detects  │  ← Less accurate (50-100m)
│  GPS location     │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Mock AI service  │  ← Generates fake labels:
│  generates fake   │    "Vehicle", "Damage", "Dent"
│  assessment       │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Case created     │
│  with mock data   │
└───────────────────┘
```

### AFTER (Real APIs)

```
┌──────────────────────────────────────────────────────────────┐
│                   CASE CREATION (REAL)                        │
└──────────────────────────────────────────────────────────────┘

User uploads photos
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│  Google Geolocation API                                       │
│  ✓ More accurate (10-30m)                                     │
│  ✓ Works indoors                                              │
│  ✓ Uses WiFi + Cell towers + GPS                             │
└─────────────────────────┬─────────────────────────────────────┘
                          │
                          ▼
┌───────────────────────────────────────────────────────────────┐
│  Google Cloud Vision API                                      │
│  ✓ Real AI analysis                                           │
│  ✓ Accurate damage detection                                  │
│  ✓ Confidence scores                                          │
│  ✓ Detailed labels                                            │
└─────────────────────────┬─────────────────────────────────────┘
                          │
                          ▼
┌───────────────────────────────────────────────────────────────┐
│  Reverse Geocoding (OpenStreetMap)                           │
│  ✓ Converts coordinates to address                           │
│  ✓ Free, no API key needed                                   │
└─────────────────────────┬─────────────────────────────────────┘
                          │
                          ▼
┌───────────────────────────────────────────────────────────────┐
│  Case created with real data                                  │
│  ✓ Accurate location                                          │
│  ✓ Real AI assessment                                         │
│  ✓ Reliable cost estimation                                   │
└───────────────────────────────────────────────────────────────┘
```

---

## API Request Flow

### Geolocation API Request

```
┌─────────────────────────────────────────────────────────────┐
│                    GEOLOCATION REQUEST                       │
└─────────────────────────────────────────────────────────────┘

Frontend (Browser)
        │
        │ POST https://googleapis.com/geolocation/v1/geolocate
        │ Headers: { Content-Type: application/json }
        │ Body: { considerIp: true }
        │ Query: ?key=YOUR_API_KEY
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│  Google Geolocation API                                       │
│  • Analyzes IP address                                        │
│  • Checks WiFi access points                                  │
│  • Uses cell tower data                                       │
│  • Combines with GPS if available                             │
└─────────────────────────┬─────────────────────────────────────┘
                          │
                          │ Response:
                          │ {
                          │   location: { lat: 6.5244, lng: 3.3792 },
                          │   accuracy: 20
                          │ }
                          │
                          ▼
┌───────────────────────────────────────────────────────────────┐
│  Reverse Geocoding (OpenStreetMap)                           │
│  GET nominatim.openstreetmap.org/reverse                     │
│  ?lat=6.5244&lon=3.3792                                      │
└─────────────────────────┬─────────────────────────────────────┘
                          │
                          │ Response:
                          │ {
                          │   display_name: "Lagos, Nigeria"
                          │ }
                          │
                          ▼
┌───────────────────────────────────────────────────────────────┐
│  Final Result                                                 │
│  {                                                            │
│    latitude: 6.5244,                                          │
│    longitude: 3.3792,                                         │
│    accuracy: 20,                                              │
│    locationName: "Lagos, Nigeria",                            │
│    source: "google-api"                                       │
│  }                                                            │
└───────────────────────────────────────────────────────────────┘
```

### Cloud Vision API Request

```
┌─────────────────────────────────────────────────────────────┐
│                   VISION API REQUEST                         │
└─────────────────────────────────────────────────────────────┘

Frontend uploads photos
        │
        │ Base64 encoded images
        │
        ▼
Backend API (/api/cases/ai-assessment)
        │
        │ For each photo:
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│  Google Cloud Vision API                                      │
│  • Label Detection                                            │
│  • Object Detection                                           │
│  • Damage Analysis                                            │
│  • Confidence Scoring                                         │
└─────────────────────────┬─────────────────────────────────────┘
                          │
                          │ Response per image:
                          │ {
                          │   labelAnnotations: [
                          │     { description: "Car", score: 0.95 },
                          │     { description: "Collision", score: 0.88 },
                          │     { description: "Broken glass", score: 0.82 }
                          │   ]
                          │ }
                          │
                          ▼
┌───────────────────────────────────────────────────────────────┐
│  AI Assessment Service                                        │
│  • Aggregates labels from all photos                          │
│  • Calculates damage percentage                               │
│  • Determines severity (minor/moderate/severe)                │
│  • Estimates salvage value                                    │
│  • Calculates reserve price                                   │
└─────────────────────────┬─────────────────────────────────────┘
                          │
                          │ Final Assessment:
                          │ {
                          │   damageSeverity: "moderate",
                          │   confidenceScore: 87,
                          │   labels: ["Car", "Collision", "Broken glass"],
                          │   estimatedSalvageValue: 450000,
                          │   reservePrice: 315000
                          │ }
                          │
                          ▼
┌───────────────────────────────────────────────────────────────┐
│  Display to User                                              │
│  ✓ Real damage assessment                                     │
│  ✓ Accurate cost estimation                                   │
│  ✓ Confidence scores                                          │
└───────────────────────────────────────────────────────────────┘
```

---

## Authentication Flow

### Geolocation API (API Key)

```
┌─────────────────────────────────────────────────────────────┐
│              GEOLOCATION AUTHENTICATION                      │
└─────────────────────────────────────────────────────────────┘

.env file
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
        │
        │ (Public - exposed to browser)
        │
        ▼
Frontend JavaScript
  fetch(`https://googleapis.com/geolocation/v1/geolocate?key=${apiKey}`)
        │
        ▼
Google Cloud
  ✓ Validates API key
  ✓ Checks restrictions (APIs, domains)
  ✓ Tracks usage for billing
        │
        ▼
Response
```

### Cloud Vision API (Service Account)

```
┌─────────────────────────────────────────────────────────────┐
│              VISION API AUTHENTICATION                       │
└─────────────────────────────────────────────────────────────┘

google-cloud-credentials.json
  {
    "type": "service_account",
    "project_id": "nem-salvage",
    "private_key": "...",
    ...
  }
        │
        │ (Private - server-side only)
        │
        ▼
Backend API
  new ImageAnnotatorClient({
    keyFilename: './google-cloud-credentials.json'
  })
        │
        ▼
Google Cloud
  ✓ Validates service account
  ✓ Checks IAM permissions
  ✓ Tracks usage for billing
        │
        ▼
Response
```

---

## Cost Tracking Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      BILLING FLOW                            │
└─────────────────────────────────────────────────────────────┘

API Request
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│  Google Cloud Billing                                         │
│  • Tracks API usage                                           │
│  • Applies free tier                                          │
│  • Calculates charges                                         │
└─────────────────────────┬─────────────────────────────────────┘
                          │
                          ▼
┌───────────────────────────────────────────────────────────────┐
│  Your Billing Account                                         │
│  • $300 free credits                                          │
│  • 66 days trial                                              │
│  • ~$21/month usage                                           │
│  • Credits last ~14 months                                    │
└───────────────────────────────────────────────────────────────┘
```

---

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    ERROR HANDLING                            │
└─────────────────────────────────────────────────────────────┘

API Request
        │
        ▼
Try Google Geolocation API
        │
        ├─ Success ──────────────────────┐
        │                                 │
        └─ Error                          │
           │                              │
           ▼                              │
    Fallback to Browser Geolocation      │
           │                              │
           ├─ Success ─────────────────┐  │
           │                           │  │
           └─ Error                    │  │
              │                        │  │
              ▼                        │  │
       Show error message              │  │
       "Location unavailable"          │  │
                                       │  │
                                       ▼  ▼
                              Return location data
                                       │
                                       ▼
                              Continue case creation
```

---

## Setup Checklist

```
┌─────────────────────────────────────────────────────────────┐
│                    SETUP PROGRESS                            │
└─────────────────────────────────────────────────────────────┘

Configuration:
  ✅ MOCK_AI_ASSESSMENT = false
  ⚠️  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = (needs your key)
  ✅ GOOGLE_APPLICATION_CREDENTIALS = configured

Google Cloud Console:
  ⬜ Enable Geolocation API
  ⬜ Enable Cloud Vision API
  ⬜ Enable Geocoding API
  ⬜ Create API key
  ⬜ Restrict API key
  ⬜ Verify service account permissions

Testing:
  ⬜ Run verification script
  ⬜ Test geolocation
  ⬜ Test AI assessment
  ⬜ Verify real data (not mock)

Monitoring:
  ⬜ Set up budget alerts
  ⬜ Monitor API usage
  ⬜ Track costs
```

---

## Next Steps

1. **Enable APIs** (2 min): Click the links in QUICK_START_REAL_APIS.md
2. **Create API key** (2 min): Follow Step 2 in the quick start
3. **Add to .env** (30 sec): Paste your key
4. **Test** (30 sec): Run `npx tsx scripts/verify-google-apis.ts`

**Total time**: ~5 minutes to go live with real APIs! 🚀
