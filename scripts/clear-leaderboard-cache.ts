/**
 * Clear Leaderboard Cache Script
 * 
 * This script clears the cached leaderboard data to force a refresh with real data.
 * Run this script if the leaderboard is showing stale or test data.
 * 
 * Usage:
 *   npx tsx scripts/clear-leaderboard-cache.ts
 */

import { cache } from '@/lib/redis/client';

const LEADERBOARD_CACHE_KEY = 'leaderboard:monthly';

async function clearLeaderboardCache() {
  try {
    console.log('🔄 Clearing leaderboard cache...');
    
    // Delete the cached leaderboard
    await cache.del(LEADERBOARD_CACHE_KEY);
    
    console.log('✅ Leaderboard cache cleared successfully!');
    console.log('📊 The leaderboard will be recalculated on the next request with fresh data from the database.');
    console.log('');
    console.log('Next steps:');
    console.log('1. Visit /vendor/leaderboard to see the updated leaderboard');
    console.log('2. The leaderboard will be cached for 7 days (until next Monday)');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing leaderboard cache:', error);
    process.exit(1);
  }
}

clearLeaderboardCache();
