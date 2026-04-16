import crypto from 'crypto';

/**
 * Test wallet funding webhook locally
 * 
 * This script simulates a Paystack webhook for wallet funding
 * to test if the webhook handler is working correctly.
 */

async function testWalletFundingWebhook() {
  console.log('🧪 Testing Wallet Funding Webhook\n');

  // Use one of the pending wallet funding references from the database
  const testReference = 'WALLET_f5711bb4_1776159509189';
  const testAmount = 10000000; // ₦100,000 in kobo

  const payload = {
    event: 'charge.success',
    data: {
      reference: testReference,
      amount: testAmount,
      status: 'success',
      paid_at: new Date().toISOString(),
      customer: {
        email: 'test@example.com',
        phone: '+2348012345678',
      },
      metadata: {
        walletId: 'f5711bb4-1234-5678-9abc-def012345678',
        vendorId: 'vendor-id-here',
        type: 'wallet_funding',
      },
    },
  };

  const payloadString = JSON.stringify(payload);

  // Generate signature
  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
  if (!PAYSTACK_SECRET_KEY) {
    console.error('❌ PAYSTACK_SECRET_KEY not found in environment');
    return;
  }

  const signature = crypto
    .createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(payloadString)
    .digest('hex');

  console.log('📋 Test Payload:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('');
  console.log('🔐 Signature:', signature.substring(0, 20) + '...');
  console.log('');

  // Make request to local webhook endpoint
  const webhookUrl = 'http://localhost:3000/api/webhooks/paystack';
  console.log(`📤 Sending POST request to: ${webhookUrl}\n`);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-paystack-signature': signature,
      },
      body: payloadString,
    });

    const responseData = await response.json();

    console.log(`📥 Response Status: ${response.status}`);
    console.log('📥 Response Body:');
    console.log(JSON.stringify(responseData, null, 2));
    console.log('');

    if (response.ok) {
      console.log('✅ Webhook processed successfully!');
      console.log('');
      console.log('🔍 Now check:');
      console.log('1. Run: npx tsx scripts/diagnose-wallet-funding-ngrok.ts');
      console.log('2. Check if the pending transaction is now confirmed');
      console.log('3. Check wallet balance');
    } else {
      console.log('❌ Webhook processing failed');
      console.log('Check the error message above for details');
    }
  } catch (error) {
    console.error('❌ Error sending webhook request:', error);
    console.log('');
    console.log('Make sure your dev server is running on http://localhost:3000');
  }
}

testWalletFundingWebhook()
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
