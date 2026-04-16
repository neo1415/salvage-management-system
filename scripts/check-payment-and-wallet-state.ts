import { db } from '@/lib/db/drizzle';
import { payments, escrowWallets, depositEvents, walletTransactions, auctionWinners } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * Check the state of a specific payment and related wallet/deposit data
 */

async function checkPaymentAndWalletState() {
  console.log('🔍 Checking Payment and Wallet State\n');

  const auctionId = 'afc83589-d6cb-4cff-b2c3-ef542a085e8a';
  const vendorId = '5e4eaa5f-7438-4c4f-bc8a-59db91d4a8c3';

  // Check payment
  console.log('💳 Payment Status:');
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.auctionId, auctionId))
    .limit(1);

  if (payment) {
    console.log(`  Status: ${payment.status}`);
    console.log(`  Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
    console.log(`  Method: ${payment.paymentMethod}`);
    console.log(`  Reference: ${payment.paymentReference}`);
    console.log(`  Verified: ${payment.verifiedAt?.toISOString() || 'Not verified'}`);
  } else {
    console.log('  ❌ Payment not found');
  }
  console.log('');

  // Check winner record
  console.log('🏆 Winner Record:');
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

  if (winner) {
    console.log(`  Deposit Amount: ₦${parseFloat(winner.depositAmount).toLocaleString()}`);
    console.log(`  Status: ${winner.status}`);
  } else {
    console.log('  ❌ Winner record not found');
  }
  console.log('');

  // Check wallet
  console.log('💰 Wallet State:');
  const [wallet] = await db
    .select()
    .from(escrowWallets)
    .where(eq(escrowWallets.vendorId, vendorId))
    .limit(1);

  if (wallet) {
    console.log(`  Balance: ₦${parseFloat(wallet.balance).toLocaleString()}`);
    console.log(`  Available: ₦${parseFloat(wallet.availableBalance).toLocaleString()}`);
    console.log(`  Frozen: ₦${parseFloat(wallet.frozenAmount).toLocaleString()}`);
  } else {
    console.log('  ❌ Wallet not found');
  }
  console.log('');

  // Check deposit events
  console.log('📋 Recent Deposit Events:');
  const events = await db
    .select()
    .from(depositEvents)
    .where(eq(depositEvents.auctionId, auctionId))
    .orderBy(desc(depositEvents.createdAt))
    .limit(5);

  if (events.length > 0) {
    events.forEach((event) => {
      console.log(`  ${event.eventType.toUpperCase()}: ₦${parseFloat(event.amount).toLocaleString()}`);
      console.log(`    Balance: ${event.balanceBefore} → ${event.balanceAfter}`);
      console.log(`    Frozen: ${event.frozenBefore} → ${event.frozenAfter}`);
      console.log(`    Time: ${event.createdAt.toISOString()}`);
      console.log('');
    });
  } else {
    console.log('  No deposit events found');
  }

  // Check wallet transactions
  console.log('💸 Recent Wallet Transactions:');
  const transactions = await db
    .select()
    .from(walletTransactions)
    .where(eq(walletTransactions.walletId, wallet?.id || ''))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(5);

  if (transactions.length > 0) {
    transactions.forEach((tx) => {
      console.log(`  ${tx.type.toUpperCase()}: ₦${parseFloat(tx.amount).toLocaleString()}`);
      console.log(`    Reference: ${tx.reference}`);
      console.log(`    Description: ${tx.description}`);
      console.log(`    Time: ${tx.createdAt.toISOString()}`);
      console.log('');
    });
  } else {
    console.log('  No wallet transactions found');
  }

  // Summary
  console.log('📊 Summary:');
  if (winner && wallet) {
    const depositAmount = parseFloat(winner.depositAmount);
    const frozenAmount = parseFloat(wallet.frozenAmount);
    
    console.log(`  Deposit Amount: ₦${depositAmount.toLocaleString()}`);
    console.log(`  Currently Frozen: ₦${frozenAmount.toLocaleString()}`);
    
    if (frozenAmount === 0) {
      console.log('  ✅ Deposit has been unfrozen');
      
      // Check if debit transaction exists
      const debitTx = transactions.find(tx => 
        tx.type === 'debit' && 
        tx.reference.includes(auctionId.substring(0, 8))
      );
      
      if (debitTx) {
        console.log('  ✅ Debit transaction exists (funds released to finance)');
      } else {
        console.log('  ❌ Debit transaction MISSING (funds NOT released to finance)');
        console.log('  ⚠️  Need to manually release funds');
      }
    } else if (frozenAmount === depositAmount) {
      console.log('  ⚠️  Deposit is still frozen (payment not processed)');
    } else {
      console.log('  ⚠️  Frozen amount mismatch - possible issue');
    }
  }
}

checkPaymentAndWalletState()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
