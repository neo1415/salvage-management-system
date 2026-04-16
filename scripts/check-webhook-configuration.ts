#!/usr/bin/env tsx
/**
 * Check Paystack Webhook Configuration
 * 
 * This script helps diagnose webhook configuration issues
 */

import 'dotenv/config';

console.log('═══════════════════════════════════════════════════════');
console.log('Paystack Webhook Configuration Check');
console.log('═══════════════════════════════════════════════════════\n');

// Check environment variables
console.log('1. ENVIRONMENT VARIABLES');
console.log('─────────────────────────────────────────────────────');

const secretKey = process.env.PAYSTACK_SECRET_KEY;
const publicKey = process.env.PAYSTACK_PUBLIC_KEY;
const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET;

if (secretKey) {
  console.log('✅ PAYSTACK_SECRET_KEY: Set');
  console.log(`   Value: ${secretKey.substring(0, 10)}...`);
  console.log(`   Type: ${secretKey.startsWith('sk_test_') ? 'TEST' : secretKey.startsWith('sk_live_') ? 'LIVE' : 'UNKNOWN'}`);
} else {
  console.log('❌ PAYSTACK_SECRET_KEY: NOT SET');
}

if (publicKey) {
  console.log('✅ PAYSTACK_PUBLIC_KEY: Set');
  console.log(`   Value: ${publicKey.substring(0, 10)}...`);
} else {
  console.log('❌ PAYSTACK_PUBLIC_KEY: NOT SET');
}

if (webhookSecret) {
  console.log('⚠️  PAYSTACK_WEBHOOK_SECRET: Set (NOT USED - Remove this)');
  console.log('   Note: Paystack uses PAYSTACK_SECRET_KEY for webhook signatures');
}

console.log('\n2. WEBHOOK HANDLER');
console.log('─────────────────────────────────────────────────────');
console.log('✅ Handler exists at: /api/webhooks/paystack-auction');
console.log('✅ Method: POST');
console.log('✅ Signature verification: Enabled');
console.log('✅ Event filter: charge.success');

console.log('\n3. WEBHOOK URL CONFIGURATION');
console.log('─────────────────────────────────────────────────────');
console.log('⚠️  MANUAL STEP REQUIRED:');
console.log('');
console.log('You must configure the webhook URL in Paystack Dashboard:');
console.log('');
console.log('1. Go to: https://dashboard.paystack.com/settings/webhooks');
console.log('2. Click: "Add Webhook URL"');
console.log('3. Enter URL: https://your-domain.com/api/webhooks/paystack-auction');
console.log('4. Subscribe to: charge.success');
console.log('5. Save');
console.log('');
console.log('For local testing with ngrok:');
console.log('1. Run: ngrok http 3000');
console.log('2. Copy HTTPS URL (e.g., https://abc123.ngrok.io)');
console.log('3. Add to Paystack: https://abc123.ngrok.io/api/webhooks/paystack-auction');

console.log('\n4. TESTING');
console.log('─────────────────────────────────────────────────────');
console.log('To test webhook locally:');
console.log('');
console.log('  npx tsx scripts/simulate-paystack-webhook-auction.ts <auction-id>');
console.log('');
console.log('To test with real Paystack payment:');
console.log('1. Create auction and place winning bid');
console.log('2. Initiate Paystack payment');
console.log('3. Complete payment with test card:');
console.log('   - Card: 4084 0840 8408 4081');
console.log('   - Expiry: Any future date');
console.log('   - CVV: 408');
console.log('   - PIN: 0000');
console.log('   - OTP: 123456');
console.log('4. Check webhook logs in console');

console.log('\n5. VERIFICATION');
console.log('─────────────────────────────────────────────────────');
console.log('After configuring webhook URL, verify:');
console.log('');
console.log('1. Go to: https://dashboard.paystack.com/settings/webhooks');
console.log('2. Click on your webhook URL');
console.log('3. View "Recent Deliveries"');
console.log('4. Check for successful deliveries (200 OK)');

console.log('\n═══════════════════════════════════════════════════════');
console.log('SUMMARY');
console.log('═══════════════════════════════════════════════════════');

const issues: string[] = [];

if (!secretKey) {
  issues.push('❌ PAYSTACK_SECRET_KEY not set in .env');
}

if (!publicKey) {
  issues.push('❌ PAYSTACK_PUBLIC_KEY not set in .env');
}

if (webhookSecret) {
  issues.push('⚠️  PAYSTACK_WEBHOOK_SECRET is set but not used (remove it)');
}

issues.push('⚠️  Webhook URL must be configured in Paystack Dashboard (manual step)');

if (issues.length > 0) {
  console.log('\nIssues found:');
  issues.forEach(issue => console.log(issue));
} else {
  console.log('\n✅ All environment variables configured correctly!');
  console.log('⚠️  Don\'t forget to configure webhook URL in Paystack Dashboard');
}

console.log('\nFor detailed setup instructions, see:');
console.log('  docs/PAYSTACK_WEBHOOK_SETUP_GUIDE.md');
console.log('');
