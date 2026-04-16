import { db } from '@/lib/db/drizzle';
import { walletTransactions, escrowWallets } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

const VENDOR_ID = '5e4eaa5f-7438-4c4f-bc8a-59db91d4a8c3';
const AUCTION_ID = '8dbeba4b-6b2f-4f02-ba88-fd954e397a70';

async function main() {
  console.log('🔍 Checking wallet transactions for vendor:', VENDOR_ID);
  console.log('');

  // Get wallet
  const [wallet] = await db
    .select()
    .from(escrowWallets)
    .where(eq(escrowWallets.vendorId, VENDOR_ID))
    .limit(1);

  if (!wallet) {
    console.error('❌ Wallet not found');
    process.exit(1);
  }

  console.log('💰 Wallet State:');
  console.log(`   - Balance: ₦${parseFloat(wallet.balance).toLocaleString()}`);
  console.log(`   - Available: ₦${parseFloat(wallet.availableBalance).toLocaleString()}`);
  console.log(`   - Frozen: ₦${parseFloat(wallet.frozenAmount).toLocaleString()}`);
  console.log('');

  // Get recent transactions
  const txs = await db
    .select()
    .from(walletTransactions)
    .where(eq(walletTransactions.walletId, wallet.id))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(15);

  console.log('📜 Recent Transactions (last 15):');
  console.log('');

  // Filter for auction-related transactions
  const auctionTxs = txs.filter(tx => 
    tx.reference.includes(AUCTION_ID.substring(0, 8)) ||
    tx.description.includes(AUCTION_ID.substring(0, 8))
  );

  if (auctionTxs.length > 0) {
    console.log(`🎯 Auction ${AUCTION_ID.substring(0, 8)} Transactions:`);
    auctionTxs.forEach(tx => {
      console.log(`   ${tx.type.toUpperCase().padEnd(10)} ₦${parseFloat(tx.amount).toLocaleString().padEnd(12)} - ${tx.description}`);
      console.log(`      Reference: ${tx.reference}`);
      console.log(`      Created: ${tx.createdAt.toLocaleString()}`);
      console.log('');
    });
  } else {
    console.log('⚠️  No auction-specific transactions found');
    console.log('');
  }

  console.log('📊 All Recent Transactions:');
  txs.forEach(tx => {
    console.log(`   ${tx.type.toUpperCase().padEnd(10)} ₦${parseFloat(tx.amount).toLocaleString().padEnd(12)} - ${tx.description.substring(0, 60)}`);
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
