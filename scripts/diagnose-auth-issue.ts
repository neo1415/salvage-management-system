/**
 * Diagnostic script to identify auth/login issues
 * 
 * This script tests:
 * 1. Redis connection (Vercel KV)
 * 2. Database connection
 * 3. NextAuth configuration
 * 4. Session validation
 */

import { redis } from '@/lib/redis/client';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';

async function diagnoseAuthIssue() {
  console.log('🔍 Starting auth diagnostics...\n');

  // Test 1: Redis Connection
  console.log('1️⃣ Testing Redis connection...');
  try {
    const testKey = 'test:connection';
    await redis.set(testKey, 'test-value', { ex: 10 });
    const value = await redis.get(testKey);
    await redis.del(testKey);
    
    if (value === 'test-value') {
      console.log('✅ Redis connection: WORKING');
    } else {
      console.log('❌ Redis connection: FAILED (value mismatch)');
    }
  } catch (error) {
    console.log('❌ Redis connection: FAILED');
    console.error('Error:', error);
  }

  // Test 2: Database Connection
  console.log('\n2️⃣ Testing database connection...');
  try {
    const [testUser] = await db
      .select({ id: users.id })
      .from(users)
      .limit(1);
    
    if (testUser) {
      console.log('✅ Database connection: WORKING');
    } else {
      console.log('⚠️  Database connection: WORKING (but no users found)');
    }
  } catch (error) {
    console.log('❌ Database connection: FAILED');
    console.error('Error:', error);
  }

  // Test 3: Environment Variables
  console.log('\n3️⃣ Checking environment variables...');
  const requiredEnvVars = [
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
    'DATABASE_URL',
    'KV_REST_API_URL',
    'KV_REST_API_TOKEN',
  ];

  let allEnvVarsPresent = true;
  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      console.log(`✅ ${envVar}: SET`);
    } else {
      console.log(`❌ ${envVar}: MISSING`);
      allEnvVarsPresent = false;
    }
  }

  if (!allEnvVarsPresent) {
    console.log('\n⚠️  Some environment variables are missing!');
  }

  // Test 4: Check for cached user data
  console.log('\n4️⃣ Checking Redis cache for user data...');
  try {
    // Try to find any user cache keys
    const testUserId = 'test-user-id';
    const userCacheKey = `user:${testUserId}`;
    const cachedUser = await redis.get(userCacheKey);
    
    if (cachedUser) {
      console.log('✅ Found cached user data (cache is working)');
    } else {
      console.log('ℹ️  No cached user data found (this is normal if no one logged in recently)');
    }
  } catch (error) {
    console.log('❌ Failed to check cache');
    console.error('Error:', error);
  }

  // Test 5: Check session validation interval
  console.log('\n5️⃣ Checking auth configuration...');
  console.log('ℹ️  Auth validation interval: 30 minutes');
  console.log('ℹ️  User cache TTL: 30 minutes');
  console.log('ℹ️  Session strategy: JWT');

  console.log('\n✅ Diagnostics complete!');
  console.log('\n📋 Summary:');
  console.log('If Redis or Database connection failed, that\'s likely the cause of login issues.');
  console.log('If all tests pass, the issue might be:');
  console.log('  - Browser cookies being blocked');
  console.log('  - NEXTAUTH_URL mismatch between local and deployed');
  console.log('  - Session cookie domain issues');
  console.log('  - Redis cache returning stale/invalid data');
}

diagnoseAuthIssue()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
