# Quick Start: Enable Real Google APIs

## 🎯 Goal
Switch from mock data to real Google APIs for geolocation and AI damage assessment.

---

## ⚡ Quick Steps (5 minutes)

### 1. Enable APIs (2 min)
Go to Google Cloud Console and click "Enable" for each:

- ✅ **Geolocation API**: https://console.cloud.google.com/apis/library/geolocation.googleapis.com
- ✅ **Cloud Vision API**: https://console.cloud.google.com/apis/library/vision.googleapis.com  
- ✅ **Geocoding API**: https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com

### 2. Create API Key (2 min)
1. Go to: https://console.cloud.google.com/apis/credentials
2. Click **"+ CREATE CREDENTIALS"** → **"API key"**
3. Copy the key
4. Click the key name to edit → **"API restrictions"** → Select:
   - Geolocation API
   - Geocoding API
5. Save

### 3. Add to .env (30 sec)
Open `.env` and paste your key:
```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_KEY_HERE
```

### 4. Verify & Test (30 sec)
```bash
# Test configuration
npx tsx scripts/verify-google-apis.ts

# Restart server
npm run dev
```

---

## ✅ Verification

### Test Geolocation
1. Go to: http://localhost:3000/adjuster/cases/new
2. Click "Get Current Location"
3. Should show: `source: 'google-api'` (not `browser`)

### Test AI Assessment
1. Upload 3+ photos
2. Should show real damage labels from Google Vision
3. No more mock data like "Vehicle", "Damage", "Dent"

---

## 💰 Cost
- **Geolocation**: FREE (within $200/month free tier)
- **Vision API**: ~$21/month (after 1,000 free images)
- **Your credits**: $300 = ~14 months free

---

## 🆘 Troubleshooting

**"API key not valid"**
→ Make sure you enabled all 3 APIs above

**"Permission denied"**  
→ Check service account has "Cloud Vision API User" role at:
https://console.cloud.google.com/iam-admin/iam

**Still seeing mock data**
→ Verify `.env` has `MOCK_AI_ASSESSMENT=false` and restart server

---

## 📚 Full Documentation
- **Complete guide**: `GOOGLE_APIS_REAL_SETUP_GUIDE.md`
- **Summary**: `GOOGLE_APIS_SWITCH_TO_REAL_SUMMARY.md`

---

**Current Status**: ✅ `.env` configured, ready for API key!
