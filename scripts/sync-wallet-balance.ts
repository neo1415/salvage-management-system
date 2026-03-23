import { db } from '@/lib/db/drizzle';
import { escrowWallets as wallets } from '@/lib/db/schema/escrow';
import { eq } from 'drizzle-orm';

/**
 * Sync wallet balance fields to fix inconsistency
 * balance = availableBalance + frozenAmount
 */
async function syncWalletBalance() {
  console.log('🔍 Finding wallets with balance inconsistencies...\n');

  // Get all wallets
  const allWallets = await db.select().from(wallets);

  if (allWallets.length === 0) {
    console.log('✅ No wallets found!');
    return;
  }

  console.log(`Found ${allWallets.length} wallet(s):\n`);

  for (const wallet of allWallets) {
    const availableBalance = parseFloat(wallet.availableBalance);
    const frozenAmount = parseFloat(wallet.frozenAmount);
    const currentBalance = parseFloat(wallet.balance);
    const correctBalance = availableBalance + frozenAmount;

    console.log(`📝 Wallet: ${wallet.id}`);
    console.log(`   Vendor ID: ${wallet.vendorId}`);
    console.log(`   Current balance: ₦${currentBalance.toLocaleString()}`);
    console.log(`   Available: ₦${availableBalance.toLocaleString()}`);
    console.log(`   Frozen: ₦${frozenAmount.toLocaleString()}`);
    console.log(`   Correct balance: ₦${correctBalance.toLocaleString()}`);

    if (currentBalance !== correctBalance) {
      console.log(`   ⚠️  Inconsistency detected! Fixing...`);

      // Update balance to match available + frozen
      await db
        .update(wallets)
        .set({
          balance: correctBalance.toString(),
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id));

      console.log(`   ✅ Balance synced!\n`);
    } else {
      console.log(`   ✅ Balance is correct!\n`);
    }
  }

  console.log('🎉 All wallets have been synced!');
}

// Run the script
syncWalletBalance()
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
