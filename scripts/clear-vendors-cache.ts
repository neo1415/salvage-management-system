import 'dotenv/config';
import { cache } from '@/lib/redis/client';

async function clearVendorsCache() {
  try {
    console.log('🔍 Clearing Vendors API Cache...\n');

    // Clear specific vendor list cache keys
    const cacheKeys = [
      'vendors:list:null:tier1_bvn::1:50',
      'vendors:list:null:tier2_full::1:50',
      'vendors:list:pending:tier1_bvn::1:50',
      'vendors:list:approved:tier1_bvn::1:50',
      'vendors:list:rejected:tier1_bvn::1:50',
    ];

    for (const key of cacheKeys) {
      console.log(`🗑️  Deleting cache key: ${key}`);
      await cache.del(key);
      console.log(`   ✓ Deleted`);
    }

    console.log('\n✅ Cache cleared successfully');
    console.log('💡 Refresh the /manager/vendors page to see updated status');
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
  } finally {
    process.exit(0);
  }
}

clearVendorsCache();
