import { autocompleteCache } from '../src/lib/cache/autocomplete-cache.ts';

async function clearCache() {
  console.log('🧹 Clearing autocomplete cache...');
  
  try {
    // Clear all cache keys
    await autocompleteCache.clearAll();
    console.log('✅ Cache cleared successfully');
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
  }
}

clearCache().catch(console.error);