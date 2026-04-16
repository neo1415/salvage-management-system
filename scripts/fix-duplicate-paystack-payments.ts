/**
 * Fix Duplicate Paystack Payments Script
 * 
 * This script:
 * 1. Identifies duplicate pending Paystack payments for the same auction
 * 2. Keeps only the most recent one
 * 3. Deletes the older duplicates
 * 4. Fixes the payment amount to be remaining amount instead of full bid
 */

import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { auctionWinners } from '@/lib/db/schema/auction-deposit';
import { eq, and, desc } from 'drizzle-orm';

const AUCTION_ID = '7340f16e-4689-4795-98f4-be9a7731efe4';

async function fixDuplicatePayments() {
  console.log('🔧 Fixing Duplicate Paystack Payments\n');
  
  try {
    // Step 1: Get all pending Paystack payments for this auction
    console.log('Step 1: Finding pending Paystack payments...');
    const allPayments = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.auctionId, AUCTION_ID),
          eq(payments.paymentMethod, 'paystack'),
          eq(payments.status, 'pending')
        )
      )
      .orderBy(desc(payments.createdAt));
    
    console.log(`Found ${allPayments.length} pending Paystack payments\n`);
    
    if (allPayments.length === 0) {
      console.log('✅ No pending payments to fix');
      return;
    }
    
    // Step 2: Get winner record to calculate correct amount
    console.log('Step 2: Getting winner record...');
    const [winner] = await db
      .select()
      .from(auctionWinners)
      .where(
        and(
          eq(auctionWinners.auctionId, AUCTION_ID),
          eq(auctionWinners.status, 'active')
        )
      )
      .limit(1);
    
    if (!winner) {
      console.error('❌ Winner record not found');
      return;
    }
    
    const finalBid = parseFloat(winner.bidAmount);
    const depositAmount = parseFloat(winner.depositAmount);
    const remainingAmount = finalBid - depositAmount;
    
    console.log(`Final Bid: ₦${finalBid.toLocaleString()}`);
    console.log(`Deposit: ₦${depositAmount.toLocaleString()}`);
    console.log(`Remaining Amount: ₦${remainingAmount.toLocaleString()}\n`);
    
    // Step 3: Keep the most recent payment, delete the rest
    const [mostRecent, ...duplicates] = allPayments;
    
    console.log('Step 3: Cleaning up duplicates...');
    console.log(`Keeping payment: ${mostRecent.id} (${mostRecent.createdAt})`);
    console.log(`Deleting ${duplicates.length} duplicate(s)\n`);
    
    for (const duplicate of duplicates) {
      console.log(`  Deleting: ${duplicate.id} (${duplicate.createdAt})`);
      await db
        .delete(payments)
        .where(eq(payments.id, duplicate.id));
    }
    
    // Step 4: Fix the amount on the remaining payment
    console.log('\nStep 4: Fixing payment amount...');
    const currentAmount = parseFloat(mostRecent.amount);
    
    if (currentAmount !== remainingAmount) {
      console.log(`  Current amount: ₦${currentAmount.toLocaleString()}`);
      console.log(`  Correct amount: ₦${remainingAmount.toLocaleString()}`);
      
      await db
        .update(payments)
        .set({
          amount: remainingAmount.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(payments.id, mostRecent.id));
      
      console.log('  ✅ Amount updated');
    } else {
      console.log('  ✅ Amount is already correct');
    }
    
    // Step 5: Verify the fix
    console.log('\nStep 5: Verifying fix...');
    const remainingPayments = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.auctionId, AUCTION_ID),
          eq(payments.paymentMethod, 'paystack'),
          eq(payments.status, 'pending')
        )
      );
    
    console.log(`\n✅ Fix complete!`);
    console.log(`Remaining pending Paystack payments: ${remainingPayments.length}`);
    
    if (remainingPayments.length === 1) {
      const payment = remainingPayments[0];
      console.log(`\nFinal payment record:`);
      console.log(`  ID: ${payment.id}`);
      console.log(`  Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
      console.log(`  Reference: ${payment.paymentReference}`);
      console.log(`  Status: ${payment.status}`);
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

fixDuplicatePayments()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
