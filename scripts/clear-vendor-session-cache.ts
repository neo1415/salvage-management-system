/**
 * Clear Vendor Session Cache
 * 
 * This script clears Redis cache for all vendor users to force
 * BVN verification status refresh on their next request.
 * 
 * Use this after deploying the BVN redirect fix to immediately
 * apply the fix to existing sessions.
 * 
 * Usage:
 *   npx tsx scripts/clear-vendor-session-cache.ts
 */

import { redis } from '@/lib/redis/client';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';

async function clearVendorSessions() {
  console.log('🔍 Finding all vendor users...\n');
  
  try {
    // Get all vendors
    const vendors = await db
      .select({ 
        id: users.id, 
        email: users.email,
        fullName: users.fullName,
        status: users.status,
      })
      .from(users)
      .where(eq(users.role, 'vendor'));
    
    console.log(`📊 Found ${vendors.length} vendor accounts\n`);
    
    if (vendors.length === 0) {
      console.log('✅ No vendors to process');
      return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const vendor of vendors) {
      try {
        const keysCleared: string[] = [];
        
        // Clear user cache
        const userCacheKey = `user:${vendor.id}`;
        const userCacheDeleted = await redis.del(userCacheKey);
        if (userCacheDeleted) keysCleared.push('user_cache');
        
        // Clear session mapping and session data
        const sessionId = await redis.get(`user:${vendor.id}:session`);
        if (sessionId) {
          const sessionDeleted = await redis.del(`session:${sessionId}`);
          if (sessionDeleted) keysCleared.push('session_data');
        }
        
        const sessionMappingDeleted = await redis.del(`user:${vendor.id}:session`);
        if (sessionMappingDeleted) keysCleared.push('session_mapping');
        
        // Clear old-style session key (backwards compatibility)
        const oldSessionDeleted = await redis.del(`session:${vendor.id}`);
        if (oldSessionDeleted) keysCleared.push('old_session');
        
        if (keysCleared.length > 0) {
          console.log(`✅ ${vendor.email} (${vendor.fullName})`);
          console.log(`   Cleared: ${keysCleared.join(', ')}`);
          successCount++;
        } else {
          console.log(`⏭️  ${vendor.email} - No cached data found`);
        }
      } catch (error) {
        console.error(`❌ ${vendor.email} - Error:`, error instanceof Error ? error.message : error);
        errorCount++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📈 Summary:');
    console.log(`   Total vendors: ${vendors.length}`);
    console.log(`   ✅ Successfully cleared: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   ⏭️  No cache: ${vendors.length - successCount - errorCount}`);
    console.log('='.repeat(60));
    
    console.log('\n✨ Done! Vendor sessions will refresh on next request.');
    console.log('💡 BVN verification status will be checked within 5 minutes.');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
clearVendorSessions()
  .then(() => {
    console.log('\n👋 Exiting...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Unhandled error:', error);
    process.exit(1);
  });
