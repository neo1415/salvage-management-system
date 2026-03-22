# Google Maps 403 Error - Quick Fix Steps

## 🚨 Problem
Your Google Maps are showing 403 error: "This API is not activated on your API project"

## ✅ Root Cause Found
**Maps Embed API** is not enabled in your Google Cloud project, even though other Google APIs are working.

## 🔧 Quick Fix (5 minutes)

### Step 1: Enable Maps Embed API
1. **Go to Google Cloud Console**: https://console.cloud.google.com/apis/library
2. **Select your project**: `nem-salvage`
3. **Search for**: "Maps Embed API"
4. **Click on the result** and click **"Enable"**

### Step 2: Enable Maps JavaScript API (recommended)
1. **Search for**: "Maps JavaScript API"
2. **Click on the result** and click **"Enable"**

### Step 3: Update API Key Restrictions
1. **Go to**: https://console.cloud.google.com/apis/credentials
2. **Find your API key**: `your-google-maps-api-key-here`
3. **Click on it** to edit
4. **Under "API restrictions"**, add:
   - ✅ Maps Embed API
   - ✅ Maps JavaScript API
5. **Click "Save"**

### Step 4: Test the Fix
Run this command to verify:
```bash
npx tsx scripts/test-google-maps-apis-fix.ts
```

## 🎯 Expected Result
- Maps will display properly in auction details pages
- No more 403 errors
- GPS location will continue working (already working)

## 💰 Cost Impact
- **Maps Embed API**: FREE (unlimited usage)
- **Maps JavaScript API**: FREE tier covers typical usage

## ⚡ Quick Test
After enabling the APIs, visit any auction page - the map should now display instead of showing an error.

## 🆘 If Still Not Working
1. **Clear browser cache** (Ctrl+Shift+R)
2. **Restart your dev server** (`npm run dev`)
3. **Check browser console** for any remaining errors

## 📞 Need Help?
The issue is specifically that **Maps Embed API** needs to be enabled. All other Google APIs in your project are working correctly.