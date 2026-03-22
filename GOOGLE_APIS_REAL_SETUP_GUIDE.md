# Google APIs Real Setup Guide

## Overview
This guide will help you enable real Google APIs for:
1. **Google Geolocation API** - For accurate GPS location in case creation
2. **Google Cloud Vision API** - For AI damage assessment and cost estimation

You now have Google Cloud billing enabled with $300 in free credits (66 days trial).

---

## Step 1: Enable Required APIs

Go to Google Cloud Console: https://console.cloud.google.com/

### 1.1 Enable Geolocation API
1. Navigate to: https://console.cloud.google.com/apis/library/geolocation.googleapis.com
2. Select your project: `nem-salvage`
3. Click **"Enable"**

### 1.2 Enable Cloud Vision API
1. Navigate to: https://console.cloud.google.com/apis/library/vision.googleapis.com
2. Select your project: `nem-salvage`
3. Click **"Enable"**

### 1.3 Enable Geocoding API (for reverse geocoding)
1. Navigate to: https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com
2. Select your project: `nem-salvage`
3. Click **"Enable"**

---

## Step 2: Create API Key for Geolocation

### 2.1 Create the API Key
1. Go to: https://console.cloud.google.com/apis/credentials
2. Click **"+ CREATE CREDENTIALS"** → **"API key"**
3. Copy the generated API key

### 2.2 Restrict the API Key (Important for Security)
1. Click on the newly created API key to edit it
2. Under **"API restrictions"**:
   - Select **"Restrict key"**
   - Check these APIs:
     - ✅ Geolocation API
     - ✅ Geocoding API
3. Under **"Application restrictions"** (optional but recommended):
   - Select **"HTTP referrers (web sites)"**
   - Add your domains:
     - `http://localhost:3000/*` (for development)
     - `https://yourdomain.com/*` (for production)
4. Click **"Save"**

### 2.3 Add API Key to .env
Open your `.env` file and replace the empty value:

```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_API_KEY_HERE
```

---

## Step 3: Verify Cloud Vision API Setup

Your Cloud Vision API should already be configured with the service account credentials.

### 3.1 Check Service Account Credentials
1. Verify the file exists: `google-cloud-credentials.json`
2. Check your `.env` has:
   ```bash
   GOOGLE_CLOUD_PROJECT_ID=nem-salvage
   GOOGLE_APPLICATION_CREDENTIALS=./google-cloud-credentials.json
   ```

### 3.2 Verify Service Account Permissions
1. Go to: https://console.cloud.google.com/iam-admin/iam
2. Find your service account (should end with `@nem-salvage.iam.gserviceaccount.com`)
3. Ensure it has the role: **"Cloud Vision API User"** or **"Editor"**

If the service account doesn't have the right permissions:
1. Click the pencil icon to edit
2. Click **"ADD ANOTHER ROLE"**
3. Select **"Cloud Vision"** → **"Cloud Vision API User"**
4. Click **"Save"**

---

## Step 4: Verify Mock Mode is Disabled

I've already updated your `.env` file:

```bash
# AI Assessment Mock Mode (set to true for testing without Google Cloud billing)
MOCK_AI_ASSESSMENT=false
```

This means the system will now use real Google Cloud Vision API for damage assessment.

---

## Step 5: Test the APIs

### 5.1 Restart Your Development Server
```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

### 5.2 Test Geolocation
1. Go to: http://localhost:3000/adjuster/cases/new
2. Click **"Get Current Location"**
3. You should see:
   - Real GPS coordinates
   - Accurate location name
   - Source: `google-api` (not `browser`)

### 5.3 Test AI Assessment
1. On the same case creation page
2. Upload 3+ photos of a damaged vehicle
3. The AI assessment should show:
   - Real damage labels from Google Vision API
   - Confidence scores
   - Estimated salvage value
   - Reserve price

---

## Cost Estimates

### Geolocation API
- **Cost**: $5 per 1,000 requests
- **Free tier**: First $200/month free (40,000 requests)
- **Your usage**: ~3,000 cases/month = ~$15/month (covered by free tier)

### Cloud Vision API
- **Cost**: $1.50 per 1,000 images (Label Detection)
- **Free tier**: First 1,000 images/month free
- **Your usage**: 
  - 3,000 cases × 5 photos average = 15,000 images/month
  - Cost: ~$21/month after free tier

### Total Monthly Cost
- **Estimated**: ~$21-36/month
- **Your credits**: $300 (covers ~8-14 months)

---

## Monitoring Usage

### Check API Usage
1. Go to: https://console.cloud.google.com/apis/dashboard
2. Select your project: `nem-salvage`
3. View usage graphs for:
   - Geolocation API
   - Cloud Vision API

### Set Budget Alerts
1. Go to: https://console.cloud.google.com/billing/budgets
2. Click **"CREATE BUDGET"**
3. Set alert at: $50/month
4. Add your email for notifications

---

## Troubleshooting

### Geolocation API Returns Error
**Error**: "API key not valid"
- Solution: Make sure you enabled Geolocation API and Geocoding API
- Check API key restrictions aren't blocking your domain

**Error**: "This API project is not authorized"
- Solution: Enable billing on your Google Cloud project
- Go to: https://console.cloud.google.com/billing

### Cloud Vision API Returns Error
**Error**: "The caller does not have permission"
- Solution: Check service account has "Cloud Vision API User" role
- Verify `google-cloud-credentials.json` is in the project root

**Error**: "Cloud Vision API has not been used in project"
- Solution: Enable Cloud Vision API (see Step 1.2)

### Still Seeing Mock Data
**Issue**: AI assessment shows fake data
- Solution: 
  1. Check `.env` has `MOCK_AI_ASSESSMENT=false`
  2. Restart your dev server
  3. Clear browser cache

---

## Security Best Practices

### API Key Security
✅ **DO**:
- Restrict API keys to specific APIs
- Add HTTP referrer restrictions
- Use different keys for dev/production
- Rotate keys periodically

❌ **DON'T**:
- Commit API keys to Git (use .env)
- Share API keys publicly
- Use the same key for all services

### Service Account Security
✅ **DO**:
- Use least privilege (only Vision API User role)
- Keep credentials file secure
- Add to .gitignore

❌ **DON'T**:
- Commit service account JSON to Git
- Give Editor/Owner roles unless necessary

---

## Next Steps

1. ✅ Enable APIs in Google Cloud Console (Step 1)
2. ✅ Create and configure API key (Step 2)
3. ✅ Add API key to `.env` file (Step 2.3)
4. ✅ Verify service account permissions (Step 3)
5. ✅ Restart dev server (Step 5.1)
6. ✅ Test geolocation and AI assessment (Step 5.2-5.3)
7. ✅ Set up budget alerts (Monitoring section)

---

## Support

If you encounter issues:
1. Check the Troubleshooting section above
2. Review Google Cloud Console error logs
3. Check browser console for client-side errors
4. Verify all environment variables are set correctly

---

**Status**: Ready to switch to real APIs! 🚀
**Credits Available**: $300 (66 days free trial)
**Estimated Monthly Cost**: $21-36
