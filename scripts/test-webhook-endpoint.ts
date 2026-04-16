/**
 * Test Webhook Endpoint Accessibility
 * 
 * This script tests if the Paystack webhook endpoint is accessible and working
 */

import crypto from 'crypto';

async function testWebhookEndpoint() {
  console.log('🧪 Testing Paystack Webhook Endpoint\n');

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
  
  if (!PAYSTACK_SECRET_KEY) {
    console.error('❌ PAYSTACK_SECRET_KEY not found in environment');
    return;
  }

  const webhookUrl = `${APP_URL}/api/webhooks/paystack-auction`;
  console.log(`📍 Webhook URL: ${webhookUrl}\n`);

  // Create a test webhook payload
  const testPayload = {
    event: 'charge.success',
    data: {
      reference: 'TEST_REFERENCE_123',
      amount: 10000000, // ₦100,000 in kobo
      status: 'success',
      paid_at: new Date().toISOString(),
      customer: {
        email: 'test@example.com'
      }
    }
  };

  const payloadString = JSON.stringify(testPayload);
  
  // Generate signature
  const signature = crypto
    .createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(payloadString)
    .digest('hex');

  console.log('📦 Test Payload:');
  console.log(JSON.stringify(testPayload, null, 2));
  console.log('\n🔐 Generated Signature:', signature.substring(0, 20) + '...\n');

  try {
    console.log('📡 Sending POST request to webhook endpoint...\n');
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-paystack-signature': signature,
      },
      body: payloadString,
    });

    console.log(`📊 Response Status: ${response.status} ${response.statusText}`);
    
    const responseText = await response.text();
    console.log('📄 Response Body:', responseText);

    if (response.ok) {
      console.log('\n✅ Webhook endpoint is accessible and responding');
    } else {
      console.log('\n❌ Webhook endpoint returned error status');
    }

    // Try to parse as JSON
    try {
      const responseJson = JSON.parse(responseText);
      console.log('\n📋 Parsed Response:');
      console.log(JSON.stringify(responseJson, null, 2));
    } catch (e) {
      console.log('\n⚠️  Response is not valid JSON');
    }

  } catch (error) {
    console.error('\n❌ Failed to reach webhook endpoint:', error);
    console.error('\n💡 Make sure your dev server is running: npm run dev');
  }
}

// Run the test
testWebhookEndpoint()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
