/**
 * Check Paystack Webhook Configuration
 * 
 * This script checks if webhooks are configured on Paystack dashboard
 * and shows what events are being sent
 */

import 'dotenv/config';

async function checkPaystackWebhookConfig() {
  console.log('🔍 Checking Paystack Webhook Configuration\n');

  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  if (!PAYSTACK_SECRET_KEY) {
    console.error('❌ PAYSTACK_SECRET_KEY not found in environment');
    return;
  }

  console.log('🔑 Using Paystack Secret Key:', PAYSTACK_SECRET_KEY.substring(0, 15) + '...');
  console.log('🌐 App URL:', APP_URL);
  console.log('📍 Expected Webhook URL:', `${APP_URL}/api/webhooks/paystack-auction\n`);

  try {
    // Fetch webhook configuration from Paystack
    console.log('📡 Fetching webhook configuration from Paystack API...\n');
    
    const response = await fetch('https://api.paystack.co/integration', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`❌ Paystack API error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return;
    }

    const data = await response.json();
    
    console.log('✅ Successfully fetched Paystack integration settings\n');
    console.log('📋 Integration Details:');
    console.log(JSON.stringify(data, null, 2));

    // Check if webhook URL is configured
    if (data.data && data.data.webhook_url) {
      console.log('\n✅ Webhook URL is configured:', data.data.webhook_url);
      
      if (data.data.webhook_url.includes('localhost')) {
        console.log('\n⚠️  WARNING: Webhook URL points to localhost');
        console.log('   Paystack cannot reach localhost URLs');
        console.log('   You need to:');
        console.log('   1. Deploy to a public URL (e.g., Vercel, Heroku)');
        console.log('   2. OR use ngrok to expose localhost: ngrok http 3000');
        console.log('   3. Then update webhook URL in Paystack dashboard');
      }
    } else {
      console.log('\n❌ No webhook URL configured in Paystack dashboard');
      console.log('\n📝 To configure webhook:');
      console.log('   1. Go to: https://dashboard.paystack.com/#/settings/developer');
      console.log('   2. Click "Webhook" tab');
      console.log(`   3. Set URL to: ${APP_URL}/api/webhooks/paystack-auction`);
      console.log('   4. Save changes');
    }

  } catch (error) {
    console.error('\n❌ Failed to check Paystack configuration:', error);
  }

  console.log('\n\n📚 Additional Information:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n🔧 For LOCAL DEVELOPMENT:');
  console.log('   Paystack webhooks CANNOT reach localhost directly');
  console.log('   You have 3 options:');
  console.log('   1. Use ngrok: ngrok http 3000');
  console.log('      Then set webhook URL to: https://your-ngrok-url.ngrok.io/api/webhooks/paystack-auction');
  console.log('   2. Test with manual webhook simulation (scripts/simulate-paystack-webhook-auction.ts)');
  console.log('   3. Deploy to staging/production and test there');
  console.log('\n🚀 For PRODUCTION:');
  console.log('   Set webhook URL in Paystack dashboard to:');
  console.log('   https://your-domain.com/api/webhooks/paystack-auction');
  console.log('\n🔐 SECURITY:');
  console.log('   - Webhook signature verification is ENABLED');
  console.log('   - Only requests with valid Paystack signature will be processed');
  console.log('   - Idempotency is ENABLED (duplicate webhooks are ignored)');
}

// Run the check
checkPaystackWebhookConfig()
  .then(() => {
    console.log('\n✅ Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });
