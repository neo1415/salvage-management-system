/**
 * Clear Prediction Cache
 * 
 * This script clears the Redis cache for predictions and deletes old predictions from the database
 */

import { db } from '@/lib/db/drizzle';
import { predictions } from '@/lib/db/schema/intelligence';
import { eq } from 'drizzle-orm';

async function clearPredictionCache() {
  console.log('🧹 Clearing prediction cache and old predictions...\n');

  try {
    const auctionId = '41e76732-2aec-462d-9950-8a700546629c';

    // Delete old predictions for this auction
    console.log(`Deleting old predictions for auction ${auctionId}...`);
    const deleted = await db
      .delete(predictions)
      .where(eq(predictions.auctionId, auctionId));

    console.log(`✅ Deleted old predictions\n`);

    console.log('Note: Redis cache will auto-expire or you can restart the server to clear it.');
    console.log('\nNow try refreshing the auction page to get a fresh prediction!');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the script
clearPredictionCache()
  .then(() => {
    console.log('\n✅ Cache cleared');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
