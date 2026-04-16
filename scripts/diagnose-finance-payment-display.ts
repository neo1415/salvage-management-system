import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { auctions } from '@/lib/db/schema/auctions';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { salvageCases } from '@/lib/db/schema/cases';
import { eq } from 'drizzle-orm';

/**
 * Diagnostic script to check what data the Finance Payments API is returning
 * for the specific payment the user is seeing issues with
 */

async function diagnoseFinancePaymentDisplay() {
  console.log('🔍 Diagnosing Finance Payment Display Issue...\n');

  try {
    // Find the payment with reference PAY-ea06c5e4-6b98-46b7-a10b-c3a6b876fdd5-1776077176140
    const paymentReference = 'PAY-ea06c5e4-6b98-46b7-a10b-c3a6b876fdd5-1776077176140';
    
    console.log(`Looking for payment with reference: ${paymentReference}\n`);

    const result = await db
      .select({
        payment: payments,
        auction: auctions,
        vendor: vendors,
        user: users,
        case: salvageCases,
      })
      .from(payments)
      .innerJoin(auctions, eq(payments.auctionId, auctions.id))
      .innerJoin(vendors, eq(payments.vendorId, vendors.id))
      .innerJoin(users, eq(vendors.userId, users.id))
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .where(eq(payments.paymentReference, paymentReference))
      .limit(1);

    if (result.length === 0) {
      console.log('❌ Payment not found!');
      return;
    }

    const { payment, auction, vendor, user, case: caseData } = result[0];

    console.log('✅ Payment Found!\n');
    console.log('📊 Payment Details:');
    console.log(`   - ID: ${payment.id}`);
    console.log(`   - Reference: ${payment.paymentReference}`);
    console.log(`   - Status: ${payment.status}`);
    console.log(`   - Payment Method: ${payment.paymentMethod}`);
    console.log(`   - Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
    console.log(`   - Created: ${payment.createdAt.toISOString()}`);
    console.log(`   - Escrow Status: ${payment.escrowStatus || 'N/A'}`);
    console.log('');

    console.log('🎯 Auction Details:');
    console.log(`   - ID: ${auction.id}`);
    console.log(`   - Status: ${auction.status}`);
    console.log(`   - Claim Reference: ${caseData.claimReference}`);
    console.log('');

    console.log('👤 Vendor Details:');
    console.log(`   - Business Name: ${vendor.businessName || 'N/A'}`);
    console.log(`   - Contact Person: ${user.fullName}`);
    console.log(`   - Email: ${user.email}`);
    console.log('');

    console.log('🔍 Button Display Logic Analysis:');
    console.log('');
    console.log('Condition 1: payment.status === "pending"');
    console.log(`   Result: ${payment.status === 'pending'} (status is "${payment.status}")`);
    console.log('');

    console.log('Condition 2: !(payment.paymentMethod === "escrow_wallet" && payment.escrowStatus === "frozen")');
    const isEscrowFrozen = payment.paymentMethod === 'escrow_wallet' && payment.escrowStatus === 'frozen';
    console.log(`   Result: ${!isEscrowFrozen} (NOT escrow frozen)`);
    console.log(`   - Payment Method: ${payment.paymentMethod}`);
    console.log(`   - Escrow Status: ${payment.escrowStatus || 'N/A'}`);
    console.log('');

    console.log('Condition 3: !(payment.paymentMethod === "paystack" && payment.auctionStatus === "awaiting_payment")');
    const isPaystackAwaiting = payment.paymentMethod === 'paystack' && auction.status === 'awaiting_payment';
    console.log(`   Result: ${!isPaystackAwaiting} (NOT Paystack awaiting payment)`);
    console.log(`   - Payment Method: ${payment.paymentMethod}`);
    console.log(`   - Auction Status: ${auction.status}`);
    console.log('');

    console.log('🎯 FINAL DECISION:');
    const shouldShowButtons = 
      payment.status === 'pending' && 
      !isEscrowFrozen && 
      !isPaystackAwaiting;

    if (shouldShowButtons) {
      console.log('❌ BUTTONS WILL BE SHOWN (This is the problem!)');
      console.log('');
      console.log('Why buttons are showing:');
      if (payment.status === 'pending') {
        console.log('   ✓ Payment status is pending');
      }
      if (!isEscrowFrozen) {
        console.log('   ✓ Not an escrow frozen payment');
      }
      if (!isPaystackAwaiting) {
        console.log('   ✓ Not a Paystack payment awaiting payment');
        console.log('');
        console.log('🔍 Root Cause Analysis:');
        if (payment.paymentMethod === 'paystack') {
          console.log(`   - Payment method IS Paystack`);
          console.log(`   - Auction status is "${auction.status}" (expected "awaiting_payment")`);
          console.log('');
          console.log('💡 ISSUE IDENTIFIED:');
          console.log(`   The auction status is "${auction.status}" instead of "awaiting_payment"`);
          console.log('   This means the auction status changed after the payment was created.');
          console.log('   The UI logic expects auction status to be "awaiting_payment" for Paystack payments.');
        }
      }
    } else {
      console.log('✅ BUTTONS WILL BE HIDDEN (Correct behavior)');
      console.log('');
      if (isEscrowFrozen) {
        console.log('   Reason: Escrow wallet payment with frozen status');
        console.log('   Message shown: "⏳ Waiting for Documents"');
      } else if (isPaystackAwaiting) {
        console.log('   Reason: Paystack payment with auction status "awaiting_payment"');
        console.log('   Message shown: "⏳ Awaiting Payment"');
      }
    }

    console.log('');
    console.log('📋 What the API returns (auctionStatus field):');
    console.log(`   auctionStatus: "${auction.status}"`);
    console.log('');

    console.log('🔧 Expected Behavior:');
    console.log('   For Paystack payments where vendor hasn\'t paid yet:');
    console.log('   - Auction status should be: "awaiting_payment"');
    console.log('   - UI should show: "⏳ Awaiting Payment - Vendor must complete Paystack payment"');
    console.log('   - Approve/Reject buttons should be: HIDDEN');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the diagnostic
diagnoseFinancePaymentDisplay()
  .then(() => {
    console.log('\n✅ Diagnostic complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Diagnostic failed:', error);
    process.exit(1);
  });
