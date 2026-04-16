/**
 * Test Paystack Payment Flow
 * 
 * This script tests the Paystack payment initialization to help debug silent failures
 */

import { db } from '@/lib/db/drizzle';
import { auctions, auctionWinners, vendors, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

async function testPaystackPaymentFlow() {
  console.log('🔍 Testing Paystack Payment Flow...\n');

  try {
    // Step 1: Find an auction with an active winner
    console.log('Step 1: Finding auction with active winner...');
    const winner = await db.query.auctionWinners.findFirst({
      where: eq(auctionWinners.status, 'active'),
      with: {
        auction: true,
        vendor: {
          with: {
            user: true,
          },
        },
      },
    });

    if (!winner) {
      console.log('❌ No active winners found. Create a closed auction with a winner first.');
      return;
    }

    console.log('✅ Found winner:', {
      auctionId: winner.auctionId,
      vendorId: winner.vendorId,
      bidAmount: winner.bidAmount,
      depositAmount: winner.depositAmount,
    });

    // Step 2: Check vendor and user details
    console.log('\nStep 2: Checking vendor and user details...');
    const vendor = winner.vendor;
    const user = vendor?.user;

    if (!vendor) {
      console.log('❌ Vendor not found');
      return;
    }

    if (!user || !user.email) {
      console.log('❌ User or email not found');
      return;
    }

    console.log('✅ Vendor details:', {
      vendorId: vendor.id,
      userId: vendor.userId,
      email: user.email,
    });

    // Step 3: Calculate payment amounts
    console.log('\nStep 3: Calculating payment amounts...');
    const finalBid = parseFloat(winner.bidAmount);
    const depositAmount = parseFloat(winner.depositAmount);
    const remainingAmount = finalBid - depositAmount;
    const amountInKobo = Math.round(remainingAmount * 100);

    console.log('✅ Payment calculation:', {
      finalBid: `₦${finalBid.toLocaleString()}`,
      depositAmount: `₦${depositAmount.toLocaleString()}`,
      remainingAmount: `₦${remainingAmount.toLocaleString()}`,
      amountInKobo: `${amountInKobo} kobo`,
    });

    // Step 4: Check environment variables
    console.log('\nStep 4: Checking environment variables...');
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

    if (!PAYSTACK_SECRET_KEY) {
      console.log('❌ PAYSTACK_SECRET_KEY not configured in .env');
      return;
    }

    console.log('✅ Environment variables:', {
      hasSecretKey: true,
      secretKeyPrefix: PAYSTACK_SECRET_KEY.substring(0, 10) + '...',
      appUrl: APP_URL || 'http://localhost:3000',
    });

    // Step 5: Validate Paystack requirements
    console.log('\nStep 5: Validating Paystack requirements...');
    const validations = {
      emailValid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email),
      amountValid: remainingAmount >= 100, // Minimum ₦100
      amountInKoboValid: amountInKobo >= 10000, // Minimum 10,000 kobo
    };

    console.log('Validations:', validations);

    if (!validations.emailValid) {
      console.log('❌ Invalid email format:', user.email);
      return;
    }

    if (!validations.amountValid) {
      console.log('❌ Amount too small. Minimum is ₦100, got:', remainingAmount);
      return;
    }

    console.log('✅ All validations passed');

    // Step 6: Test Paystack API call (dry run)
    console.log('\nStep 6: Testing Paystack API call...');
    const paymentReference = `TEST-${winner.auctionId}-${Date.now()}`;
    const payload = {
      email: user.email,
      amount: amountInKobo,
      reference: paymentReference,
      callback_url: `${APP_URL || 'http://localhost:3000'}/vendor/auctions/${winner.auctionId}?payment=success`,
      metadata: {
        auctionId: winner.auctionId,
        vendorId: vendor.id,
        depositAmount: depositAmount.toFixed(2),
        finalBid: finalBid.toFixed(2),
        remainingAmount: remainingAmount.toFixed(2),
      },
    };

    console.log('Payload to send to Paystack:', JSON.stringify(payload, null, 2));

    console.log('\n🔄 Making actual API call to Paystack...');
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('Paystack API response status:', response.status);
    console.log('Paystack API response ok:', response.ok);

    const responseData = await response.json();
    console.log('Paystack API response:', JSON.stringify(responseData, null, 2));

    if (response.ok && responseData.status && responseData.data) {
      console.log('\n✅ SUCCESS! Paystack payment initialized');
      console.log('Authorization URL:', responseData.data.authorization_url);
      console.log('Access Code:', responseData.data.access_code);
      console.log('Reference:', responseData.data.reference);
    } else {
      console.log('\n❌ FAILED! Paystack returned error');
      console.log('Error:', responseData.message || 'Unknown error');
    }

  } catch (error) {
    console.error('\n❌ Error during test:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  }
}

// Run the test
testPaystackPaymentFlow()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
