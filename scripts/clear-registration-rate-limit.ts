import 'dotenv/config';
import { Redis } from '@upstash/redis';

/**
 * Emergency script to clear registration rate limit
 * Use this when you're locked out of registration due to rate limiting
 * 
 * The Upstash Ratelimit library uses multiple keys for sliding window:
 * - ratelimit:register:{ip} (main counter)
 * - ratelimit:register:{ip}:{timestamp} (window buckets)
 */
async function clearRegistrationRateLimit() {
  console.log('🔓 Clearing Registration Rate Limit...\n');

  const ipAddress = '::1'; // localhost IPv6
  const prefix = 'ratelimit:register';

  try {
    // Create Redis client directly with environment variables
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;

    if (!url || !token) {
      throw new Error('Missing KV_REST_API_URL or KV_REST_API_TOKEN environment variables');
    }

    const redis = new Redis({
      url,
      token,
    });

    console.log('🔍 Scanning for rate limit keys...');
    
    // Try to get all keys matching the pattern
    // Note: Upstash Redis supports SCAN command
    let cursor = 0;
    let deletedCount = 0;
    const keysToDelete: string[] = [];

    do {
      try {
        // Scan for keys matching the pattern
        const result = await redis.scan(cursor, {
          match: `${prefix}:${ipAddress}*`,
          count: 100,
        });
        
        cursor = result[0];
        const keys = result[1] as string[];
        
        if (keys.length > 0) {
          keysToDelete.push(...keys);
          console.log(`   Found ${keys.length} keys:`, keys);
        }
      } catch (scanError) {
        console.warn('   SCAN not supported, trying direct key deletion...');
        // If SCAN is not supported, try deleting common key patterns
        keysToDelete.push(
          `${prefix}:${ipAddress}`,
          `${prefix}:${ipAddress}:*`
        );
        break;
      }
    } while (cursor !== 0);

    // Delete all found keys
    if (keysToDelete.length > 0) {
      console.log(`\n🗑️  Deleting ${keysToDelete.length} keys...`);
      
      for (const key of keysToDelete) {
        try {
          await redis.del(key);
          deletedCount++;
          console.log(`   ✓ Deleted: ${key}`);
        } catch (delError) {
          console.warn(`   ✗ Failed to delete: ${key}`, delError);
        }
      }
    } else {
      // Fallback: try deleting the main key directly
      console.log('\n🗑️  No keys found via SCAN, trying direct deletion...');
      const mainKey = `${prefix}:${ipAddress}`;
      await redis.del(mainKey);
      deletedCount = 1;
      console.log(`   ✓ Deleted: ${mainKey}`);
    }
    
    console.log('\n✅ Rate limit cleared successfully!');
    console.log(`   IP Address: ${ipAddress}`);
    console.log(`   Keys Deleted: ${deletedCount}`);
    console.log('\n💡 You can now register again');
    console.log('   Rate Limit: 3 attempts per 1 hour');
    console.log('\n⚠️  Note: If you still see rate limit errors, the Upstash');
    console.log('   Ratelimit library may be using additional internal keys.');
    console.log('   Consider adding a development bypass in the code instead.');
  } catch (error) {
    console.error('\n❌ Failed to clear rate limit:', error);
    console.log('\n⚠️  Alternatives:');
    console.log('   1. Wait until the rate limit resets (1 hour from last attempt)');
    console.log('   2. Add a development bypass in src/app/api/auth/register/route.ts');
    console.log('   3. Use a different IP address (e.g., mobile hotspot)');
  }

  process.exit(0);
}

clearRegistrationRateLimit().catch((error) => {
  console.error('❌ Script error:', error);
  process.exit(1);
});
