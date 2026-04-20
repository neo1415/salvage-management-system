# Production 401 Unauthorized Error - Quick Fix Guide

**Date:** April 20, 2026  
**Issue:** AI Assessment and other APIs returning 401 Unauthorized on production (nemsalvage.com)  
**Status:** Diagnosis Complete - Action Required

## Problem

After deploying to production, authenticated API endpoints are returning 401 Unauthorized:
- `/api/cases/ai-assessment` - 401
- `/api/notifications/unread-count` - 401
- Works perfectly on localhost

## Root Cause

NextAuth session is not being retrieved on production. This is typically caused by:

1. **Missing or incorrect environment variables on Vercel**
2. **NEXTAUTH_URL mismatch**
3. **NEXTAUTH_SECRET not set or different from local**
4. **Cookie domain issues**

## Required Environment Variables

Check your Vercel project settings and ensure these are set:

### Critical NextAuth Variables

```bash
# MUST match your production domain
NEXTAUTH_URL=https://nemsalvage.com

# MUST be a strong random string (same as local if you want session compatibility)
# Generate with: openssl rand -base64 32
NEXTAUTH_SECRET=your-production-secret-here

# Database connection
DATABASE_URL=your-production-database-url

# Redis (if using Vercel KV)
KV_URL=your-vercel-kv-url
KV_REST_API_URL=your-vercel-kv-rest-url
KV_REST_API_TOKEN=your-vercel-kv-token
KV_REST_API_READ_ONLY_TOKEN=your-vercel-kv-readonly-token
```

### OAuth Providers (if using)

```bash
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

FACEBOOK_CLIENT_ID=your-facebook-client-id
FACEBOOK_CLIENT_SECRET=your-facebook-client-secret
```

### AI Services

```bash
GEMINI_API_KEY=your-gemini-api-key
ANTHROPIC_API_KEY=your-claude-api-key
```

## Step-by-Step Fix

### 1. Check NEXTAUTH_URL

In Vercel Dashboard:
1. Go to your project → Settings → Environment Variables
2. Find `NEXTAUTH_URL`
3. **MUST be:** `https://nemsalvage.com` (no trailing slash)
4. **NOT:** `https://www.nemsalvage.com` or `http://nemsalvage.com`

### 2. Check NEXTAUTH_SECRET

1. Verify `NEXTAUTH_SECRET` exists in Vercel
2. If missing, generate a new one:
   ```bash
   openssl rand -base64 32
   ```
3. Add it to Vercel environment variables
4. **Important:** Set it for Production, Preview, and Development environments

### 3. Verify Database Connection

1. Check `DATABASE_URL` is set correctly
2. Ensure your production database is accessible from Vercel
3. Test connection from Vercel logs

### 4. Check Redis/KV Configuration

If using Vercel KV for session storage:
1. Verify all KV environment variables are set
2. Check KV dashboard for connection issues

### 5. Redeploy

After updating environment variables:
1. Go to Deployments tab
2. Click "..." on latest deployment
3. Click "Redeploy"
4. **Important:** Check "Use existing Build Cache" is UNCHECKED

## Additional CSP Issue

You also have a Content Security Policy violation for Google Geolocation API. To fix this, update your CSP headers in `next.config.ts`:

```typescript
// In your Content-Security-Policy header
connect-src 'self' 
  https://api.paystack.co 
  https://checkout.paystack.com 
  https://*.paystack.com 
  https://api.flutterwave.com 
  https://api.cloudinary.com 
  https://res.cloudinary.com 
  https://*.cloudinary.com 
  https://nominatim.openstreetmap.org 
  https://widget.dojah.io 
  https://identity.dojah.io 
  https://api.dojah.io 
  https://*.dojah.io
  https://www.googleapis.com  // ADD THIS LINE
```

## Verification Steps

After redeploying:

1. **Clear browser cache and cookies** for nemsalvage.com
2. **Log out and log back in**
3. **Try creating a case with AI assessment**
4. **Check browser console** for any remaining errors
5. **Check Vercel logs** for server-side errors

## Common Mistakes

❌ **Wrong:** `NEXTAUTH_URL=http://nemsalvage.com` (http instead of https)  
✅ **Correct:** `NEXTAUTH_URL=https://nemsalvage.com`

❌ **Wrong:** `NEXTAUTH_URL=https://nemsalvage.com/` (trailing slash)  
✅ **Correct:** `NEXTAUTH_URL=https://nemsalvage.com`

❌ **Wrong:** Missing `NEXTAUTH_SECRET`  
✅ **Correct:** `NEXTAUTH_SECRET=<32+ character random string>`

❌ **Wrong:** Environment variables only set for "Production"  
✅ **Correct:** Set for "Production", "Preview", AND "Development"

## Debug Commands

If issues persist, check Vercel logs:

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# View logs
vercel logs <your-deployment-url>
```

Look for:
- "Unauthorized" errors
- "Session not found" errors
- Database connection errors
- Redis/KV connection errors

## Quick Test

To verify your environment variables are loaded:

1. Add a test API route temporarily:
   ```typescript
   // src/app/api/test-env/route.ts
   export async function GET() {
     return Response.json({
       hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
       hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
       hasDatabaseUrl: !!process.env.DATABASE_URL,
       nextAuthUrl: process.env.NEXTAUTH_URL, // Remove after testing
     });
   }
   ```

2. Visit `https://nemsalvage.com/api/test-env`
3. Verify all values are `true` and URL is correct
4. **Delete this test route after verification**

## Still Not Working?

If the issue persists after checking all the above:

1. **Check Vercel deployment logs** for specific errors
2. **Verify your domain DNS** is pointing correctly to Vercel
3. **Check if you have a custom domain** - ensure it's properly configured in Vercel
4. **Try incognito mode** to rule out browser cache issues
5. **Check if other authenticated routes work** (e.g., `/api/auth/session`)

## Contact Support

If none of the above works, you may need to:
1. Check Vercel support for deployment issues
2. Verify your database provider allows connections from Vercel IPs
3. Check if there are any firewall rules blocking Vercel

---

**Last Updated:** April 20, 2026
