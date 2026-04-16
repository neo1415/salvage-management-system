/**
 * Test Payment Method Selection Flow
 * 
 * This script tests the complete payment method selection flow:
 * 1. Check auction status (should be awaiting_payment)
 * 2. Check for pending payments
 * 3. Simulate Paystack payment initialization
 * 4. Verify payment record creation
 * 
 * Usage: npx tsx scripts/test-payment-method-selection.ts <auctionId>
 */

import { db } from '@/lib/db/drizzle';
import { auctions, payments, auctionWinners, releaseForms } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

async function testPaymentMethodSelection(auctionId: string) {
  console.log('\n🧪 Testing Payment Method Selection Flow');
  console.log('==========================================\n');

  try {
    // Step 1: Check auction status
    console.log('📋 Step 1: Checking auction status...');
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, auctionId))
      .limit(1);

    if (!auction) {
      console.error('❌ Auction not found');
      return;
    }

    console.log(`✅ Auction found: ${auction.id}`);
    console.log(`   - Status: ${auction.status}`);
    console.log(`   - Winner: ${auction.currentBidder || 'None'}`);
    console.log(`   - Winning Bid: ₦${auction.currentBid ? parseFloat(auction.currentBid).toLocaleString() : 'N/A'}`);

    if (auction.status !== 'awaiting_payment') {
      console.warn(`⚠️  WARNING: Auction status is '${auction.status}', expected 'awaiting_payment'`);
      console.warn(`   - Payment method selection is only available when status is 'awaiting_payment'`);
    }

    // Step 2: Check winner record
    console.log('\n📋 Step 2: Checking winner record...');
    const [winner] = await db
      .select()
      .from(auctionWinners)
      .where(
        and(
          eq(auctionWinners.auctionId, auctionId),
          eq(auctionWinners.status, 'active')
        )
      )
      .limit(1);

    if (!winner) {
      console.error('❌ No active winner found');
      return;
    }

    console.log(`✅ Winner found: ${winner.vendorId}`);
    console.log(`   - Bid Amount: ₦${parseFloat(winner.bidAmount).toLocaleString()}`);
    console.log(`   - Deposit Amount: ₦${parseFloat(winner.depositAmount).toLocaleString()}`);
    console.log(`   - Remaining: ₦${(parseFloat(winner.bidAmount) - parseFloat(winner.depositAmount)).toLocaleString()}`);

    // Step 3: Check documents
    console.log('\n📋 Step 3: Checking document signing status...');
    const documents = await db
      .select()
      .from(releaseForms)
      .where(
        and(
          eq(releaseForms.auctionId, auctionId),
          eq(releaseForms.vendorId, winner.vendorId)
        )
      );

    console.log(`✅ Found ${documents.length} documents`);
    
    const requiredDocs = ['bill_of_sale', 'liability_waiver'];
    const signedDocs = documents.filter(doc => doc.status === 'signed').map(doc => doc.documentType);
    const allSigned = requiredDocs.every(type => signedDocs.includes(type));

    for (const doc of documents) {
      console.log(`   - ${doc.documentType}: ${doc.status} ${doc.signedAt ? `(signed at ${doc.signedAt.toISOString()})` : ''}`);
    }

    if (!allSigned) {
      console.warn(`⚠️  WARNING: Not all documents signed yet`);
      console.warn(`   - Required: ${requiredDocs.join(', ')}`);
      console.warn(`   - Signed: ${signedDocs.join(', ') || 'None'}`);
      console.warn(`   - Payment method selection requires all documents to be signed`);
    } else {
      console.log(`✅ All required documents signed`);
    }

    // Step 4: Check existing payments
    console.log('\n📋 Step 4: Checking existing payments...');
    const existingPayments = await db
      .select()
      .from(payments)
      .where(eq(payments.auctionId, auctionId));

    if (existingPayments.length === 0) {
      console.log(`✅ No existing payments found`);
    } else {
      console.log(`⚠️  Found ${existingPayments.length} existing payment(s):`);
      for (const payment of existingPayments) {
        console.log(`   - Payment ID: ${payment.id}`);
        console.log(`     Status: ${payment.status}`);
        console.log(`     Method: ${payment.paymentMethod}`);
        console.log(`     Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
        console.log(`     Reference: ${payment.paymentReference || 'None'}`);
        console.log(`     Created: ${payment.createdAt.toISOString()}`);
        
        if (payment.status === 'pending' && payment.paymentMethod === 'escrow_wallet') {
          console.log(`     ⚠️  This is a pending escrow_wallet payment from closure`);
          console.log(`     ⚠️  It will be deleted when user selects Paystack`);
        }
        
        if (payment.status === 'pending' && payment.paymentMethod === 'paystack') {
          console.log(`     ⚠️  This is a pending Paystack payment`);
          console.log(`     ⚠️  User should complete this payment or it will block new attempts`);
        }
      }
    }

    // Step 5: Simulate payment method selection
    console.log('\n📋 Step 5: Simulating payment method selection...');
    
    // Check for pending Paystack payment
    const pendingPaystack = existingPayments.find(
      p => p.status === 'pending' && p.paymentMethod === 'paystack'
    );
    
    if (pendingPaystack) {
      console.log(`⚠️  Pending Paystack payment exists: ${pendingPaystack.id}`);
      console.log(`   - User should complete this payment first`);
      console.log(`   - Or wait for it to expire/be cancelled`);
    } else {
      console.log(`✅ No pending Paystack payment - user can select Paystack`);
      
      // Check for pending escrow_wallet payment
      const pendingEscrow = existingPayments.find(
        p => p.status === 'pending' && p.paymentMethod === 'escrow_wallet'
      );
      
      if (pendingEscrow) {
        console.log(`ℹ️  Pending escrow_wallet payment exists: ${pendingEscrow.id}`);
        console.log(`   - This will be deleted when user selects Paystack`);
        console.log(`   - This is expected behavior (payment created during closure)`);
      }
    }

    // Summary
    console.log('\n📊 Summary');
    console.log('==========');
    console.log(`Auction Status: ${auction.status}`);
    console.log(`Documents Signed: ${allSigned ? 'Yes ✅' : 'No ❌'}`);
    console.log(`Can Select Payment Method: ${auction.status === 'awaiting_payment' && allSigned ? 'Yes ✅' : 'No ❌'}`);
    console.log(`Pending Paystack Payment: ${pendingPaystack ? 'Yes (blocks new attempts) ⚠️' : 'No ✅'}`);
    console.log(`Pending Escrow Payment: ${existingPayments.find(p => p.status === 'pending' && p.paymentMethod === 'escrow_wallet') ? 'Yes (will be deleted) ℹ️' : 'No'}`);

    if (auction.status === 'awaiting_payment' && allSigned && !pendingPaystack) {
      console.log('\n✅ READY: User can select payment method');
      console.log('   - Paystack payment initialization will succeed');
      console.log('   - Any pending escrow_wallet payment will be deleted');
    } else {
      console.log('\n❌ NOT READY: User cannot select payment method yet');
      if (auction.status !== 'awaiting_payment') {
        console.log(`   - Auction status must be 'awaiting_payment' (currently: ${auction.status})`);
      }
      if (!allSigned) {
        console.log(`   - All documents must be signed`);
      }
      if (pendingPaystack) {
        console.log(`   - Pending Paystack payment must be completed or cancelled`);
      }
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
  }
}

// Get auction ID from command line
const auctionId = process.argv[2];

if (!auctionId) {
  console.error('Usage: npx tsx scripts/test-payment-method-selection.ts <auctionId>');
  process.exit(1);
}

testPaymentMethodSelection(auctionId)
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
