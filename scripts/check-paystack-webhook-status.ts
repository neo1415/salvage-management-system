/**
 * Check Paystack webhook configuration status
 * 
 * This script helps diagnose why webhooks aren't being received
 */

async function checkPaystackWebhookStatus() {
  console.log('🔍 Checking Paystack Webhook Configuration\n');

  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
  
  if (!PAYSTACK_SECRET_KEY) {
    console.error('❌ PAYSTACK_SECRET_KEY not found');
    return;
  }

  console.log('✅ PAYSTACK_SECRET_KEY is set');
  console.log(`   Key: ${PAYSTACK_SECRET_KEY.substring(0, 10)}...`);
  console.log('');

  // Check if it's test or live key
  if (PAYSTACK_SECRET_KEY.startsWith('sk_test_')) {
    console.log('📝 Using TEST mode');
    console.log('');
    console.log('⚠️  IMPORTANT: Paystack TEST mode webhook behavior:');
    console.log('   - Webhooks ARE sent for test transactions');
    console.log('   - But they must be configured in Paystack Dashboard');
    console.log('   - Go to: https://dashboard.paystack.com/#/settings/developer');
    console.log('   - Check "Webhook URL" field');
    console.log('');
  } else if (PAYSTACK_SECRET_KEY.startsWith('sk_live_')) {
    console.log('📝 Using LIVE mode');
    console.log('⚠️  Be careful with live transactions!');
    console.log('');
  }

  console.log('🔧 Current Configuration:');
  console.log(`   NEXT_PUBLIC_APP_URL: ${process.env.NEXT_PUBLIC_APP_URL}`);
  console.log(`   Expected webhook URL: ${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/paystack`);
  console.log('');

  console.log('📋 Troubleshooting Steps:');
  console.log('');
  console.log('1. Check Paystack Dashboard:');
  console.log('   - Go to: https://dashboard.paystack.com/#/settings/developer');
  console.log('   - Verify "Webhook URL" matches your ngrok URL');
  console.log('   - Should be: https://4ba6-102-88-115-225.ngrok-free.app/api/webhooks/paystack');
  console.log('');
  console.log('2. Test webhook delivery:');
  console.log('   - In Paystack Dashboard, go to "Webhooks" tab');
  console.log('   - Find recent transactions');
  console.log('   - Click "Resend" to manually trigger webhook');
  console.log('');
  console.log('3. Check ngrok:');
  console.log('   - Open: http://127.0.0.1:4040');
  console.log('   - Look for POST requests to /api/webhooks/paystack');
  console.log('   - If you see them, check the response status');
  console.log('');
  console.log('4. Common issues:');
  console.log('   ❌ Webhook URL in Paystack still points to old URL');
  console.log('   ❌ ngrok session expired (free tier has 2-hour limit)');
  console.log('   ❌ Firewall blocking Paystack IPs');
  console.log('   ❌ Webhook signature verification failing');
  console.log('');
  console.log('5. Manual test:');
  console.log('   Run: npx tsx scripts/test-wallet-funding-webhook.ts');
  console.log('   This simulates a webhook locally to test the handler');
  console.log('');
}

checkPaystackWebhookStatus()
  .then(() => {
    console.log('✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
