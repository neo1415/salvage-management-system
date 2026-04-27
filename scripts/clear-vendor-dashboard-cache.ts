/**
 * Clear Vendor Dashboard Cache
 * 
 * This script clears the cached dashboard data for all vendors
 * so they can see updated win counts immediately.
 */

import { cache } from '@/lib/redis/client';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema';

async function clearVendorDashboardCache() {
  console.log('🧹 Clearing vendor dashboard cache...\n');

  try {
    // Get all vendor IDs
    const allVendors = await db.select({ id: vendors.id }).from(vendors);

    console.log(`Found ${allVendors.length} vendors\n`);

    let clearedCount = 0;
    let errorCount = 0;

    for (const vendor of allVendors) {
      const cacheKey = `dashboard:vendor:${vendor.id}`;
      
      try {
        await cache.del(cacheKey);
        clearedCount++;
        console.log(`✅ Cleared cache for vendor ${vendor.id}`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Failed to clear cache for vendor ${vendor.id}:`, error);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   - Total vendors: ${allVendors.length}`);
    console.log(`   - Cache cleared: ${clearedCount}`);
    console.log(`   - Errors: ${errorCount}\n`);

    if (clearedCount > 0) {
      console.log('✅ Cache cleared successfully!');
      console.log('💡 Vendors will see updated win counts on their next dashboard visit.\n');
    }

  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    throw error;
  }
}

// Run cache clearing
clearVendorDashboardCache()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
