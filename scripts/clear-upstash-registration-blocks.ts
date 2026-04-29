import 'dotenv/config';
import { Redis } from '@upstash/redis';

/**
 * Clear all Upstash Redis blocks preventing registration
 * This includes:
 * 1. Rate limit keys
 * 2. Deleted user cache
 * 3. Any other registration-related cache
 */
async function clearRegistrationBlocks() {
  console.log('🧹 Clearing Upstash Registration Blocks...\n');

  const phoneNumber = process.argv[2] || '+2348012345678';
  console.log(`📱 Phone Number: ${phoneNumber}\n`);

  try {
    // Create Redis client
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;

    if (!url || !token) {
      throw new Error('❌ Missing KV_REST_API_URL or KV_REST_API_TOKEN in .env');
    }

    const redis = new Redis({ url, token });

    console.log('🔗 Connected to Upstash Redis\n');

    // List of possible keys that might block registration
    const keysToCheck = [
      // Rate limit keys for different IP addresses
      'ratelimit:register:::1',           // localhost IPv6
      'ratelimit:register:127.0.0.1',     // localhost IPv4
      'ratelimit:register:unknown',        // fallback IP
      
      // Deleted user cache keys (if any)
      `deleted_user:phone:${phoneNumber}`,
      `deleted_user:${phoneNumber}`,
      `user:deleted:${phoneNumber}`,
      
      // Registration attempt cache
      `registration:attempt:${phoneNumber}`,
      `registration:blocked:${phoneNumber}`,
    ];

    console.log('🔍 Checking and clearing keys...\n');

    let deletedCount = 0;
    let notFoundCount = 0;

    for (const key of keysToCheck) {
      try {
        // Check if key exists
        const exists = await redis.exists(key);
        
        if (exists) {
          // Delete the key
          await redis.del(key);
          console.log(`   ✅ Deleted: ${key}`);
          deletedCount++;
        } else {
          console.log(`   ⚪ Not found: ${key}`);
          notFoundCount++;
        }
      } catch (error) {
        console.log(`   ⚠️  Error checking ${key}:`, error);
      }
    }

    // Try to clear all rate limit keys with wildcard (if supported)
    console.log('\n🔍 Attempting wildcard deletion for rate limit keys...');
    try {
      const patterns = [
        'ratelimit:register:*',
        'deleted_user:*',
        'user:deleted:*',
      ];

      for (const pattern of patterns) {
        try {
          // Try KEYS command (may not be supported on all Upstash plans)
          const keys = await redis.keys(pattern) as string[];
          if (keys && keys.length > 0) {
            console.log(`   Found ${keys.length} keys matching ${pattern}`);
            for (const key of keys) {
              await redis.del(key);
              console.log(`   ✅ Deleted: ${key}`);
              deletedCount++;
            }
          }
        } catch (error) {
          // KEYS command not supported, skip
          console.log(`   ⚪ Pattern ${pattern} - KEYS command not supported`);
        }
      }
    } catch (error) {
      console.log('   ⚪ Wildcard deletion not supported on this Redis instance');
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log(`   Keys Deleted: ${deletedCount}`);
    console.log(`   Keys Not Found: ${notFoundCount}`);
    console.log('='.repeat(60));

    if (deletedCount > 0) {
      console.log('\n✅ Successfully cleared registration blocks!');
    } else {
      console.log('\n✅ No blocking keys found in Upstash Redis');
      console.log('   The issue might be elsewhere (database, code logic, etc.)');
    }

    console.log('\n💡 Next Steps:');
    console.log('   1. Try registering again with the phone number');
    console.log('   2. If still blocked, check the database for deleted users');
    console.log('   3. Verify DISABLE_REGISTRATION_RATE_LIMIT=true in .env');
    console.log('   4. Restart your dev server to pick up .env changes');

  } catch (error) {
    console.error('\n❌ Failed to clear registration blocks:', error);
    console.log('\n⚠️  Troubleshooting:');
    console.log('   1. Check your Upstash credentials in .env');
    console.log('   2. Verify network connectivity to Upstash');
    console.log('   3. Try restarting your development server');
    process.exit(1);
  }

  process.exit(0);
}

clearRegistrationBlocks();
