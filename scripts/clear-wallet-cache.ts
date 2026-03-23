import { kv } from '@vercel/kv';
import { db } from '../src/lib/db/drizzle';
import { escrowWallets } from '../src/lib/db/schema/escrow';

/**
 * Clear Redis cache for all wallets
 * Run this after manually modifying wallet balances in the database
 */
async function clearWalletCache() {
  try {
    console.log('🔍 Fetching all wallets...');
    
    // Get all wallets
    const wallets = await db.select().from(escrowWallets);
    
    console.log(`📊 Found ${wallets.length} wallet(s)`);
    
    if (wallets.length === 0) {
      console.log('✅ No wallets found. Nothing to clear.');
      return;
    }
    
    // Clear cache for each wallet
    let clearedCount = 0;
    for (const wallet of wallets) {
      const cacheKey = `wallet:${wallet.id}`;
      await kv.del(cacheKey);
      clearedCount++;
      console.log(`🗑️  Cleared cache for wallet ${wallet.id}`);
    }
    
    console.log(`\n✅ Successfully cleared cache for ${clearedCount} wallet(s)`);
    console.log('💡 The next API call will fetch fresh data from the database');
    
  } catch (error) {
    console.error('❌ Error clearing wallet cache:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

clearWalletCache();
