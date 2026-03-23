import { db } from '../src/lib/db/drizzle';
import { escrowWallets } from '../src/lib/db/schema/escrow';
import { eq } from 'drizzle-orm';
import { kv } from '@vercel/kv';

/**
 * Fix wallet balance field to match availableBalance + frozenAmount
 * This ensures the invariant: balance = availableBalance + frozenAmount
 */
async function fixWalletBalanceField() {
  try {
    console.log('🔧 Fixing wallet balance fields...\n');
    
    // Get all wallets
    const wallets = await db.select().from(escrowWallets);
    
    if (wallets.length === 0) {
      console.log('✅ No wallets found');
      return;
    }
    
    console.log(`📊 Found ${wallets.length} wallet(s)\n`);
    
    for (const wallet of wallets) {
      const currentBalance = parseFloat(wallet.balance);
      const availableBalance = parseFloat(wallet.availableBalance);
      const frozenAmount = parseFloat(wallet.frozenAmount);
      
      // Calculate what the balance should be
      const correctBalance = availableBalance + frozenAmount;
      
      console.log(`💼 Wallet: ${wallet.id}`);
      console.log(`   Current Balance:     ₦${currentBalance.toLocaleString()}`);
      console.log(`   Available Balance:   ₦${availableBalance.toLocaleString()}`);
      console.log(`   Frozen Amount:       ₦${frozenAmount.toLocaleString()}`);
      console.log(`   Correct Balance:     ₦${correctBalance.toLocaleString()}`);
      
      if (Math.abs(currentBalance - correctBalance) > 0.01) {
        console.log(`   ⚠️  Balance mismatch detected! Fixing...`);
        
        // Update the balance field
        await db
          .update(escrowWallets)
          .set({
            balance: correctBalance.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(escrowWallets.id, wallet.id));
        
        // Clear Redis cache
        await kv.del(`wallet:${wallet.id}`);
        
        console.log(`   ✅ Fixed! New balance: ₦${correctBalance.toLocaleString()}`);
      } else {
        console.log(`   ✅ Balance is correct`);
      }
      
      console.log('');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ All wallet balances fixed!');
    console.log('💡 Redis cache cleared - next API call will fetch fresh data');
    
  } catch (error) {
    console.error('❌ Error fixing wallet balances:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

fixWalletBalanceField();
