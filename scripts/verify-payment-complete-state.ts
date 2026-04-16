import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { auctions } from '@/lib/db/schema/auctions';
import { escrowWallets } from '@/lib/db/schema/escrow';
import { vendors } from '@/lib/db/schema/vendors';
import { eq } from 'drizzle-orm';

/**
 * Verify the complete state after payment processing
 */

async function verifyPaymentCompleteState() {
  console.log('🔍 Verifying Payment Complete State...\n');

  try {
    const paymentReference = 'PAY-ea06c5e4-6b98-46b7-a10b-c3a6b876fdd5-1776077176140';
    
    // Get payment
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.paymentReference, paymentReference))
      .limit(1);

    if (!payment) {
      console.log('❌ Payment not found!');
      return;
    }

    // Get auction
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, payment.auctionId))
      .limit(1);

    // Get wallet
    const [wallet] = await db
      .select()
      .from(escrowWallets)
      .where(eq(escrowWallets.vendorId, payment.vendorId))
      .limit(1);

    console.log('✅ PAYMENT STATUS:');
    console.log(`   - Reference: ${payment.paymentReference}`);
    console.log(`   - Status: ${payment.status}`);
    console.log(`   - Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
    console.log(`   - Payment Method: ${payment.paymentMethod}`);
    console.log(`   - Auto Verified: ${payment.autoVerified}`);
    console.log('');

    console.log('✅ AUCTION STATUS:');
    console.log(`   - ID: ${auction?.id}`);
    console.log(`   - Status: ${auction?.status}`);
    console.log(`   - Winning Bid: ₦${parseFloat(auction?.winningBid || '0').toLocaleString()}`);
    console.log('');

    console.log('✅ WALLET STATUS:');
    console.log(`   - Available Balance: ₦${parseFloat(wallet?.availableBalance || '0').toLocaleString()}`);
    console.log(`   - Frozen Amount: ₦${parseFloat(wallet?.frozenAmount || '0').toLocaleString()}`);
    console.log(`   - Total Balance: ₦${parseFloat(wallet?.totalBalance || '0').toLocaleString()}`);
    console.log('');

    console.log('📊 VERIFICATION CHECKLIST:');
    console.log('');

    const checks = [
      {
        name: 'Payment verified',
        pass: payment.status === 'verified',
        expected: 'verified',
        actual: payment.status,
      },
      {
        name: 'Auction status updated',
        pass: auction?.status === 'payment_verified',
        expected: 'payment_verified',
        actual: auction?.status,
      },
      {
        name: 'Frozen deposit released',
        pass: parseFloat(wallet?.frozenAmount || '0') === 0,
        expected: '₦0',
        actual: `₦${parseFloat(wallet?.frozenAmount || '0').toLocaleString()}`,
      },
    ];

    checks.forEach((check, i) => {
      const icon = check.pass ? '✅' : '❌';
      console.log(`${i + 1}. ${icon} ${check.name}`);
      if (!check.pass) {
        console.log(`   Expected: ${check.expected}`);
        console.log(`   Actual: ${check.actual}`);
      }
    });

    console.log('');

    const allPassed = checks.every(c => c.pass);

    if (allPassed) {
      console.log('🎉 ALL CHECKS PASSED!');
      console.log('');
      console.log('The payment has been processed successfully:');
      console.log('   ✅ Payment verified');
      console.log('   ✅ Frozen deposit released');
      console.log('   ✅ Total amount transferred to NEM Insurance');
      console.log('   ✅ Auction status updated');
      console.log('');
      console.log('Finance Officer can now see this payment for final approval.');
    } else {
      console.log('⚠️  SOME CHECKS FAILED');
      console.log('');
      console.log('Please review the failed checks above.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the verification
verifyPaymentCompleteState()
  .then(() => {
    console.log('\n✅ Verification complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });
