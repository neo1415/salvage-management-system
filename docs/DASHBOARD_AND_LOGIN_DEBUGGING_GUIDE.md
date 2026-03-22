# Dashboard and Login Debugging Guide

## Issues Identified

### 1. Dashboard "Failed to fetch dashboard data" Error
**Symptoms:**
- Browser console shows: "Failed to fetch dashboard data"
- Dashboard page shows error state
- User is logged in but cannot see dashboard data

**Potential Causes:**
1. **No vendor profile exists** for the logged-in user
2. **Redis connection issues** preventing cache operations
3. **Database query timeouts** or connection issues
4. **Session not properly established** after login

### 2. Production Login Keeps Spinning
**Symptoms:**
- Login page shows loading spinner indefinitely
- No error messages displayed
- Login never completes

**Potential Causes:**
1. **Missing or incorrect environment variables** in production
2. **NextAuth configuration issues** (NEXTAUTH_URL, NEXTAUTH_SECRET)
3. **Database connection issues** in production
4. **Redis/Vercel KV connection issues**
5. **CORS or API route configuration** problems

### 3. Test Data Showing in Dashboard
**Symptoms:**
- Dashboard shows "Leaderboard Position #17 of 33 vendors"
- User only created one account but sees many vendors

**Cause:**
- Integration tests create test data in the database
- This is **EXPECTED BEHAVIOR** in development
- Test data includes 33 vendors from the test suite

---

## Debugging Steps

### Step 1: Check Browser Console and Network Tab

1. **Open Browser DevTools** (F12)
2. **Go to Network tab**
3. **Try to access the dashboard**
4. **Look for the `/api/dashboard/vendor` request**
5. **Check the response:**
   - Status code (200, 401, 403, 404, 500)
   - Response body (error message)
   - Request headers (cookies, authorization)

**What to look for:**
- **401 Unauthorized**: Session not established or expired
- **403 Forbidden**: User is not a vendor
- **404 Not Found**: No vendor profile exists for user
- **500 Internal Server Error**: Database or Redis error

### Step 2: Check Server Logs

**Development:**
```bash
# Check the terminal where you ran `npm run dev`
# Look for logs starting with [Dashboard API]
```

**Production (Vercel):**
1. Go to Vercel Dashboard
2. Select your project
3. Go to "Logs" tab
4. Filter by "Runtime Logs"
5. Look for errors during login or dashboard access

**What to look for:**
- `[Dashboard API] No session found` → Session issue
- `[Dashboard API] No vendor profile found` → Missing vendor record
- `Cache read error` or `Cache write error` → Redis issues
- Database connection errors → Database issues

### Step 3: Verify User Has Vendor Profile

**Check if logged-in user has a vendor record:**

```sql
-- Connect to your database and run:
SELECT u.id, u.email, u.role, v.id as vendor_id, v.tier
FROM users u
LEFT JOIN vendors v ON v.user_id = u.id
WHERE u.email = 'your-email@example.com';
```

**Expected result:**
- User should have `role = 'vendor'`
- User should have a corresponding vendor record (vendor_id should not be NULL)

**If vendor record is missing:**
```sql
-- Create vendor record manually:
INSERT INTO vendors (user_id, business_name, tier, rating, status)
VALUES (
  'user-id-here',
  'Test Vendor',
  'unverified_tier_0',
  '0',
  'active'
);
```

### Step 4: Verify Environment Variables

**Development (.env file):**
```bash
# Required for authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<your-secret>

# Required for database
DATABASE_URL=<your-database-url>

# Required for Redis/session management
KV_REST_API_URL=<your-redis-url>
KV_REST_API_TOKEN=<your-redis-token>
```

**Production (Vercel):**
1. Go to Vercel Dashboard
2. Select your project
3. Go to "Settings" → "Environment Variables"
4. Verify ALL environment variables are set:
   - `NEXTAUTH_URL` (should be your production URL, e.g., https://yourdomain.com)
   - `NEXTAUTH_SECRET` (same as development)
   - `DATABASE_URL` (production database)
   - `KV_REST_API_URL`, `KV_REST_API_TOKEN` (Vercel KV credentials)

**Common mistakes:**
- `NEXTAUTH_URL` set to `http://localhost:3000` in production
- Missing `NEXTAUTH_SECRET` in production
- Wrong database URL (pointing to development instead of production)

### Step 5: Test Redis Connection

**Create a test script:**
```typescript
// scripts/test-redis-connection.ts
import { redis } from '@/lib/redis/client';

async function testRedis() {
  try {
    console.log('Testing Redis connection...');
    
    // Test set
    await redis.set('test-key', 'test-value', { ex: 60 });
    console.log('✓ Set test key');
    
    // Test get
    const value = await redis.get('test-key');
    console.log('✓ Get test key:', value);
    
    // Test delete
    await redis.del('test-key');
    console.log('✓ Delete test key');
    
    console.log('✓ Redis connection successful!');
  } catch (error) {
    console.error('✗ Redis connection failed:', error);
  }
}

testRedis();
```

**Run the test:**
```bash
npx tsx scripts/test-redis-connection.ts
```

### Step 6: Test Database Connection

**Create a test script:**
```typescript
// scripts/test-database-connection.ts
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

async function testDatabase() {
  try {
    console.log('Testing database connection...');
    
    // Test simple query
    const result = await db.execute(sql`SELECT 1 as test`);
    console.log('✓ Simple query successful:', result);
    
    // Test users table
    const userCount = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    console.log('✓ Users table accessible, count:', userCount[0].count);
    
    console.log('✓ Database connection successful!');
  } catch (error) {
    console.error('✗ Database connection failed:', error);
  }
}

testDatabase();
```

**Run the test:**
```bash
npx tsx scripts/test-database-connection.ts
```

---

## Solutions

### Solution 1: Create Missing Vendor Profile

If the user doesn't have a vendor profile:

```typescript
// scripts/create-vendor-profile.ts
import { db } from '@/lib/db/drizzle';
import { users, vendors } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function createVendorProfile(email: string) {
  try {
    // Find user
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (!user) {
      console.error('User not found:', email);
      return;
    }
    
    // Check if vendor profile exists
    const [existingVendor] = await db.select().from(vendors).where(eq(vendors.userId, user.id)).limit(1);
    
    if (existingVendor) {
      console.log('Vendor profile already exists:', existingVendor.id);
      return;
    }
    
    // Create vendor profile
    const [newVendor] = await db.insert(vendors).values({
      userId: user.id,
      businessName: user.fullName || 'Vendor Business',
      tier: 'unverified_tier_0',
      rating: '0',
      status: 'active',
    }).returning();
    
    console.log('✓ Vendor profile created:', newVendor.id);
  } catch (error) {
    console.error('Error creating vendor profile:', error);
  }
}

// Usage: Replace with your email
createVendorProfile('your-email@example.com');
```

**Run the script:**
```bash
npx tsx scripts/create-vendor-profile.ts
```

### Solution 2: Fix Production Environment Variables

**Vercel Production Setup:**

1. **Go to Vercel Dashboard** → Your Project → Settings → Environment Variables

2. **Add/Update these variables:**
   ```
   NEXTAUTH_URL=https://your-production-domain.com
   NEXTAUTH_SECRET=<same-as-development>
   DATABASE_URL=<production-database-url>
   KV_REST_API_URL=<vercel-kv-url>
   KV_REST_API_TOKEN=<vercel-kv-token>
   ```

3. **Redeploy your application:**
   ```bash
   git push origin main
   # Or trigger manual deployment in Vercel Dashboard
   ```

### Solution 3: Clear Test Data (Optional)

If you want to remove test data from development database:

```sql
-- WARNING: This will delete ALL data!
-- Only run in development environment

-- Delete test vendors (keep your real vendor)
DELETE FROM vendors WHERE business_name LIKE 'Test Vendor%';

-- Delete test users (keep your real user)
DELETE FROM users WHERE email LIKE 'test%@example.com';

-- Delete test auctions
DELETE FROM auctions WHERE created_at < NOW() - INTERVAL '1 day';

-- Delete test bids
DELETE FROM bids WHERE created_at < NOW() - INTERVAL '1 day';
```

**Better approach:** Use separate databases for development and testing:
- Development: Your main development database
- Testing: Separate test database that gets reset after tests

### Solution 4: Disable Redis Cache (Temporary)

If Redis is causing issues, you can temporarily disable caching:

**Modify `src/app/api/dashboard/vendor/route.ts`:**
```typescript
// Comment out cache operations
// const cachedData = await cache.get<VendorDashboardData>(cacheKey);
// if (cachedData) {
//   return NextResponse.json(cachedData);
// }

// ... calculate data ...

// await cache.set(cacheKey, dashboardData, 300);
```

This will help identify if Redis is the problem.

### Solution 5: Add Session Provider

Make sure your app has the SessionProvider wrapper:

**Check `src/app/layout.tsx`:**
```typescript
import { SessionProvider } from 'next-auth/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
```

---

## Quick Fixes Checklist

### For "Failed to fetch dashboard data":
- [ ] Check browser Network tab for actual error
- [ ] Check server logs for detailed error messages
- [ ] Verify user has vendor profile in database
- [ ] Test Redis connection
- [ ] Test database connection
- [ ] Try disabling cache temporarily

### For "Production login keeps spinning":
- [ ] Verify `NEXTAUTH_URL` is set to production URL
- [ ] Verify `NEXTAUTH_SECRET` is set in production
- [ ] Verify `DATABASE_URL` points to production database
- [ ] Verify Redis credentials are set in production
- [ ] Check production server logs for errors
- [ ] Test login in development first

### For "Test data showing":
- [ ] This is expected in development
- [ ] Use separate test database if needed
- [ ] Clear test data manually if desired
- [ ] In production, only real data will show

---

## Contact Points

If issues persist after trying all solutions:

1. **Check server logs** for detailed error messages
2. **Share the exact error message** from browser console
3. **Share the API response** from Network tab
4. **Share relevant server logs** from production
5. **Verify environment variables** are correctly set

---

## Improvements Made

### 1. Enhanced Error Logging
- Added detailed console logs to dashboard API
- Added error details to API responses
- Added try-catch around cache operations

### 2. Better Error Handling
- Graceful fallback if Redis fails
- Detailed error messages for debugging
- Proper error status codes

### 3. Login API Improvements
- Better error handling for authentication
- Proper error propagation from NextAuth
- Clearer error messages

---

## Next Steps

1. **Check browser console** and share the exact error
2. **Check server logs** and share relevant log entries
3. **Verify environment variables** in production
4. **Test Redis and database connections**
5. **Create vendor profile** if missing

Once you provide the specific error messages, I can help with more targeted solutions.
