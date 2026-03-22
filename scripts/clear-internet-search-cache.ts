/**
 * Clear internet search cache to force fresh results
 */

import 'dotenv/config';
import { cacheIntegrationService } from '@/features/internet-search/services/cache-integration.service';

async function clearCache() {
  console.log('🗑️ Clearing internet search cache...\n');
  
  try {
    await cacheIntegrationService.clearAllCache();
    console.log('✅ Cache cleared successfully');
    
    const stats = await cacheIntegrationService.getCacheStats();
    console.log('\n📊 Cache stats after clear:');
    console.log('- Total hits:', stats.metrics.totalHits);
    console.log('- Total misses:', stats.metrics.totalMisses);
    console.log('- Hit rate:', stats.metrics.hitRate + '%');
    
  } catch (error) {
    console.error('❌ Failed to clear cache:', error);
  }
}

clearCache()
  .then(() => {
    console.log('\n✅ Complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
