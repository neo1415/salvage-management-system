# Registration Rate Limit Fix

## Problem
You're locked out of registration due to rate limiting (3 attempts per hour). The clear script reports success but doesn't actually clear the rate limit.

## Root Cause
The `@upstash/ratelimit` library uses multiple Redis keys for its sliding window algorithm, not just a single key. The original clear script only deleted one key, leaving the rate limit active.

## Solutions

### Solution 1: Development Bypass (RECOMMENDED for Development)

Add this to your `.env` file:

```env
DISABLE_REGISTRATION_RATE_LIMIT=true
```

Then restart your development server:

```bash
npm run dev
```

**⚠️ WARNING**: NEVER use this in production! This removes protection against spam registrations.

### Solution 2: Updated Clear Script

Run the updated clear script that properly scans and deletes all rate limit keys:

```bash
npx tsx scripts/clear-registration-rate-limit.ts
```

The updated script:
- Uses Redis SCAN to find all rate limit keys
- Deletes all keys associated with your IP address
- Provides better error messages and fallback options

### Solution 3: Wait It Out

The rate limit resets automatically after 1 hour from your last attempt. Check the error message for the exact reset time.

### Solution 4: Use Different IP

If you need to test immediately:
- Use your mobile hotspot
- Use a VPN
- Test from a different network

## How Rate Limiting Works

The registration endpoint uses Upstash Ratelimit with a sliding window:

```typescript
Ratelimit.slidingWindow(3, '1 h')
```

This means:
- **3 attempts** allowed per **1 hour** per IP address
- The window slides, so it's not a fixed 1-hour period
- Multiple Redis keys are used internally to track the sliding window

## For Production

In production, keep rate limiting enabled to prevent:
- Spam registrations
- Brute force attacks
- Resource exhaustion
- Abuse of the registration system

If you need to adjust the limits for production, modify:

```typescript
// src/app/api/auth/register/route.ts
const registerRateLimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'), // Increase to 10 attempts
  analytics: true,
  prefix: 'ratelimit:register',
});
```

## Testing Registration Flow

For development testing, use Solution 1 (development bypass) to avoid rate limit issues while testing multiple registration scenarios.

## Files Modified

1. `scripts/clear-registration-rate-limit.ts` - Updated to properly scan and delete all rate limit keys
2. `src/app/api/auth/register/route.ts` - Added development bypass option
3. `.env.example` - Documented the new `DISABLE_REGISTRATION_RATE_LIMIT` option

## Quick Start

1. Add `DISABLE_REGISTRATION_RATE_LIMIT=true` to your `.env` file
2. Restart your dev server
3. Test registration as many times as needed
4. Remove the env var before deploying to production
