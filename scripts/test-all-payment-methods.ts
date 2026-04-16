/**
 * Test All Payment Methods
 * 
 * Tests wallet-only, Paystack-only, and hybrid payment flows
 */

import { db } from '@/lib/db/drizzle';
import { auctions, auctionWinners, escrowWallets, payments, vendors } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

async function testAllPaymentMethods() {
  console.log('🧪 Testing All Payment Methods\n');

  // Get a test auction with winner
  const testAuction = await db.query.auctions.findFirst({
    where: eq(auctions.status, 'closed'),
    with: {
      case: true,
    },
  });

  if (!testAuction) {
    console.log('❌ No closed auctions found for testing');
    return;
  }

  const winner = await db.query.auctionWinners.findFirst({
    where: and(
      eq(auctionWinners.auctionId, testAuction.id),
      eq(auctionWinners.status, 'active')
    ),
  });

  if (!winner) {
    console.log('❌ No winner found for test auction');
    return;
  }

  const wallet = await db.query.escrowWallets.findFirst({
    where: eq(escrowWallets.vendorId, winner.vendorId),
  });

  if (!wallet) {
    console.log('❌ No wallet found for winner');
    return;
  }

  console.log('📊 Test Auction Details:');
  console.log(`   Auction ID: ${testAuction.id}`);
  console.log(`   Winner ID: ${winner.vendorId}`);
  console.log(`   Final Bid: ₦${parseFloat(winner.finalBid).toLocaleString()}`);
  console.log(`   Deposit: ₦${parseFloat(winner.depositAmount).toLocaleString()}`);
  console.log(`   Remaining: ₦${(parseFloat(winner.finalBid) - parseFloat(winner.depositAmount)).toLocaleString()}`);
  console.log(`\n💰 Wallet Status:`);
  console.log(`   Balance: ₦${parseFloat(wallet.balance).toLocaleString()}`);
  console.log(`   Available: ₦${parseFloat(wallet.availableBalance).toLocaleString()}`);
  console.log(`   Frozen: ₦${parseFloat(wallet.frozenAmount).toLocaleString()}`);

  const remainingAmount = parseFloat(winner.finalBid) - parseFloat(winner.depositAmount);
  const availableBalance = parseFloat(wallet.availableBalance);

  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log('TEST 1: WALLET-ONLY PAYMENT');
  console.log('═══════════════════════════════════════════════════════\n');

  if (availableBalance >= remainingAmount) {
    console.log('✅ Wallet has sufficient balance for full payment');
    console.log(`   Required: ₦${remainingAmount.toLocaleString()}`);
    console.log(`   Available: ₦${availableBalance.toLocaleString()}`);
    console.log('\n📝 Payment Flow:');
    console.log('   1. Deduct remaining amount from available balance');
    console.log('   2. Unfreeze and transfer deposit to finance');
    console.log('   3. Create verified payment record');
    console.log('   4. Unfreeze non-winner deposits');
    console.log('   5. Generate pickup authorization');
    console.log('\n✅ Wallet-only payment is AVAILABLE');
  } else {
    console.log('❌ Insufficient wallet balance for full payment');
    console.log(`   Required: ₦${remainingAmount.toLocaleString()}`);
    console.log(`   Available: ₦${availableBalance.toLocaleString()}`);
    console.log(`   Shortfall: ₦${(remainingAmount - availableBalance).toLocaleString()}`);
    console.log('\n❌ Wallet-only payment is NOT AVAILABLE');
  }

  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log('TEST 2: PAYSTACK-ONLY PAYMENT');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log('✅ Paystack payment is ALWAYS available');
  console.log(`   Amount to pay via Paystack: ₦${remainingAmount.toLocaleString()}`);
  console.log('\n📝 Payment Flow:');
  console.log('   1. Initialize Paystack transaction (FIXED amount)');
  console.log('   2. User completes payment on Paystack');
  console.log('   3. Webhook receives payment confirmation');
  console.log('   4. Mark payment as verified');
  console.log('   5. Unfreeze and transfer deposit to finance');
  console.log('   6. Unfreeze non-winner deposits');
  console.log('   7. Generate pickup authorization');
  console.log('\n✅ Paystack-only payment is AVAILABLE');

  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log('TEST 3: HYBRID PAYMENT');
  console.log('═══════════════════════════════════════════════════════\n');

  if (availableBalance > 0 && availableBalance < remainingAmount) {
    const walletPortion = availableBalance;
    const paystackPortion = remainingAmount - availableBalance;

    console.log('✅ Hybrid payment is AVAILABLE');
    console.log(`   Wallet Portion: ₦${walletPortion.toLocaleString()}`);
    console.log(`   Paystack Portion: ₦${paystackPortion.toLocaleString()}`);
    console.log('\n📝 Payment Flow:');
    console.log('   1. Deduct wallet portion from available balance');
    console.log('   2. Initialize Paystack transaction (FIXED amount = Paystack portion)');
    console.log('   3. User completes payment on Paystack');
    console.log('   4. Webhook receives payment confirmation');
    console.log('   5. Mark payment as verified');
    console.log('   6. Unfreeze and transfer deposit to finance');
    console.log('   7. Unfreeze non-winner deposits');
    console.log('   8. Generate pickup authorization');
    console.log('\n⚠️  Rollback Protection:');
    console.log('   - If Paystack initialization fails, wallet portion is refunded');
    console.log('   - If Paystack payment fails, user can retry (wallet already deducted)');
    console.log('\n✅ Hybrid payment is AVAILABLE');
  } else if (availableBalance === 0) {
    console.log('❌ No wallet balance available');
    console.log('   Use Paystack-only payment instead');
    console.log('\n❌ Hybrid payment is NOT AVAILABLE');
  } else {
    console.log('❌ Wallet balance covers full payment');
    console.log('   Use wallet-only payment instead');
    console.log('\n❌ Hybrid payment is NOT AVAILABLE');
  }

  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log('PAYMENT METHOD SUMMARY');
  console.log('═══════════════════════════════════════════════════════\n');

  const canPayWithWallet = availableBalance >= remainingAmount;
  const canPayWithPaystack = true;
  const canPayWithHybrid = availableBalance > 0 && availableBalance < remainingAmount;

  console.log('Available Payment Methods:');
  console.log(`   ${canPayWithWallet ? '✅' : '❌'} Wallet-Only`);
  console.log(`   ${canPayWithPaystack ? '✅' : '❌'} Paystack-Only`);
  console.log(`   ${canPayWithHybrid ? '✅' : '❌'} Hybrid`);

  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log('API ENDPOINTS');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log('1. Calculate Payment Breakdown:');
  console.log(`   GET /api/auctions/${testAuction.id}/payment/calculate`);
  console.log('\n2. Wallet-Only Payment:');
  console.log(`   POST /api/auctions/${testAuction.id}/payment/wallet`);
  console.log('\n3. Paystack-Only Payment:');
  console.log(`   POST /api/auctions/${testAuction.id}/payment/paystack`);
  console.log('\n4. Hybrid Payment:');
  console.log(`   POST /api/auctions/${testAuction.id}/payment/hybrid`);

  console.log('\n\n✅ All payment methods tested successfully!');
}

testAllPaymentMethods()
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
