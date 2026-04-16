import { db } from '@/lib/db/drizzle';
import { walletTransactions, escrowWallets, auctionWinners } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Manually create debit transaction for a payment where deposit was unfrozen
 * but funds were not released to finance
 */

async function manuallyCreateDebitTransaction() {
  console.log('🔧 Manually creating debit transaction\n');

  const auctionId = 'afc83589-d6cb-4cff-b2c3-ef542a085e8a';
  const vendorId = '5e4eaa5f-7438-4c4f-bc8a-59db91d4a8c3';

  // Get winner record to get deposit amount
  const [winner] = await db
    .select()
    .from(auctionWinners)
    .where(
      and(
        eq(auctionWinners.auctionId, auctionId),
        eq(auctionWinners.vendorId, vendorId)
      )
    )
    .limit(1);

  if (!winner) {
    console.error('❌ Winner record not found');
    return;
  }

  const depositAmount = parseFloat(winner.depositAmount);
  console.log(`Deposit Amount: ₦${depositAmount.toLocaleString()}`);

  // Get wallet
  const [wallet] = await db
    .select()
    .from(escrowWallets)
    .where(eq(escrowWallets.vendorId, vendorId))
    .limit(1);

  if (!wallet) {
    console.error('❌ Wallet not found');
    return;
  }

  console.log(`Current Balance: ₦${parseFloat(wallet.balance).toLocaleString()}`);
  console.log('');

  // Check if debit transaction already exists
  const [existingDebit] = await db
    .select()
    .from(walletTransactions)
    .where(
      and(
        eq(walletTransactions.walletId, wallet.id),
        eq(walletTransactions.type, 'debit'),
        eq(walletTransactions.reference, `TRANSFER_${auctionId.substring(0, 8)}`)
      )
    )
    .limit(1);

  if (existingDebit) {
    console.log('✅ Debit transaction already exists');
    console.log(`   Reference: ${existingDebit.reference}`);
    console.log(`   Amount: ₦${parseFloat(existingDebit.amount).toLocaleString()}`);
    console.log(`   Created: ${existingDebit.createdAt.toISOString()}`);
    return;
  }

  console.log('Creating debit transaction...');

  // Create debit transaction
  const transferReference = `TRANSFER_${auctionId.substring(0, 8)}_${Date.now()}`;
  const currentBalance = parseFloat(wallet.balance);

  await db.insert(walletTransactions).values({
    walletId: wallet.id,
    type: 'debit',
    amount: depositAmount.toString(),
    balanceAfter: currentBalance.toFixed(2), // Balance stays same (already unfrozen)
    reference: transferReference,
    description: `Funds released for auction ${auctionId.substring(0, 8)} - Transferred to NEM Insurance (Manual correction)`,
  });

  console.log('');
  console.log('✅ Debit transaction created successfully!');
  console.log(`   Reference: ${transferReference}`);
  console.log(`   Amount: ₦${depositAmount.toLocaleString()}`);
  console.log('');
  console.log('📝 Note: This transaction shows the deposit was sent to finance');
  console.log('   The actual transfer to NEM Insurance should be done manually via Paystack dashboard');
}

manuallyCreateDebitTransaction()
  .then(() => {
    console.log('\n✅ Script complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
