import { db } from '../src/lib/db/drizzle';
import { escrowWallets, walletTransactions } from '../src/lib/db/schema/escrow';
import { vendors } from '../src/lib/db/schema/vendors';
import { users } from '../src/lib/db/schema/users';
import { eq } from 'drizzle-orm';

/**
 * Check current wallet status
 */
async function checkWalletStatus() {
  try {
    console.log('🔍 Checking wallet status...\n');
    
    // Get all wallets with vendor and user info
    const wallets = await db
      .select({
        wallet: escrowWallets,
        vendor: vendors,
        user: users,
      })
      .from(escrowWallets)
      .leftJoin(vendors, eq(escrowWallets.vendorId, vendors.id))
      .leftJoin(users, eq(vendors.userId, users.id));
    
    if (wallets.length === 0) {
      console.log('❌ No wallets found');
      return;
    }
    
    for (const { wallet, vendor, user } of wallets) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`👤 User: ${user?.email || 'Unknown'}`);
      console.log(`🏢 Vendor: ${vendor?.businessName || 'Unknown'}`);
      console.log(`💼 Wallet ID: ${wallet.id}`);
      console.log(`\n💰 Balances:`);
      console.log(`   Total Balance:     ₦${parseFloat(wallet.balance).toLocaleString()}`);
      console.log(`   Available Balance: ₦${parseFloat(wallet.availableBalance).toLocaleString()}`);
      console.log(`   Frozen Amount:     ₦${parseFloat(wallet.frozenAmount).toLocaleString()}`);
      
      // Get transaction count
      const transactions = await db
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.walletId, wallet.id));
      
      console.log(`\n📊 Transactions: ${transactions.length}`);
      
      if (transactions.length > 0) {
        console.log(`\n📝 Recent Transactions:`);
        transactions.slice(0, 5).forEach((tx, idx) => {
          console.log(`   ${idx + 1}. ${tx.type.toUpperCase()} - ₦${parseFloat(tx.amount).toLocaleString()}`);
          console.log(`      Balance After: ₦${parseFloat(tx.balanceAfter).toLocaleString()}`);
          console.log(`      ${tx.description}`);
        });
      }
      
      console.log('');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('✅ Wallet status check complete');
    
  } catch (error) {
    console.error('❌ Error checking wallet status:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

checkWalletStatus();
