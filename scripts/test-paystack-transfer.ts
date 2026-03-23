/**
 * Test script to verify Paystack Transfers API setup
 * 
 * This script tests the transfer configuration by initiating a small test transfer
 * to the configured NEM Insurance recipient.
 * 
 * Usage:
 *   npx tsx scripts/test-paystack-transfer.ts
 * 
 * Prerequisites:
 *   1. PAYSTACK_SECRET_KEY must be set in .env
 *   2. PAYSTACK_NEM_RECIPIENT_CODE must be set in .env
 *   3. Paystack account must have sufficient balance (at least ₦100)
 */

import { config } from 'dotenv';
config();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_NEM_RECIPIENT_CODE = process.env.PAYSTACK_NEM_RECIPIENT_CODE;

async function testTransfer() {
  console.log('🔍 Testing Paystack Transfers API Configuration...\n');

  // Validate environment variables
  if (!PAYSTACK_SECRET_KEY) {
    console.error('❌ Error: PAYSTACK_SECRET_KEY not found in .env');
    console.log('   Please add your Paystack secret key to .env file');
    process.exit(1);
  }

  if (!PAYSTACK_NEM_RECIPIENT_CODE) {
    console.error('❌ Error: PAYSTACK_NEM_RECIPIENT_CODE not found in .env');
    console.log('   Please create a transfer recipient and add the code to .env');
    console.log('   See PAYSTACK_TRANSFERS_SETUP_GUIDE.md for instructions');
    process.exit(1);
  }

  console.log('✅ Environment variables found');
  console.log(`   Secret Key: ${PAYSTACK_SECRET_KEY.substring(0, 10)}...`);
  console.log(`   Recipient Code: ${PAYSTACK_NEM_RECIPIENT_CODE}\n`);

  try {
    // Test with ₦100 (10,000 kobo)
    const testAmount = 10000; // ₦100 in kobo
    const reference = `TEST_${Date.now()}`;

    console.log('📤 Initiating test transfer...');
    console.log(`   Amount: ₦${(testAmount / 100).toLocaleString()}`);
    console.log(`   Reference: ${reference}\n`);

    const response = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount: testAmount,
        recipient: PAYSTACK_NEM_RECIPIENT_CODE,
        reason: 'Test transfer - Escrow wallet setup verification',
        reference,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Transfer initiated successfully!\n');
      console.log('📋 Transfer Details:');
      console.log(`   Transfer Code: ${data.data.transfer_code}`);
      console.log(`   Status: ${data.data.status}`);
      console.log(`   Amount: ₦${(data.data.amount / 100).toLocaleString()}`);
      console.log(`   Recipient: ${data.data.recipient}`);
      console.log(`   Reference: ${data.data.reference}`);
      console.log(`   Created At: ${data.data.createdAt}\n`);

      console.log('🎉 Configuration is correct!');
      console.log('   You can now use the escrow wallet system in production.');
      console.log('   Check your Paystack dashboard to see the transfer.');
    } else {
      console.error('❌ Transfer failed!\n');
      console.error('Error Details:');
      console.error(`   Status: ${response.status}`);
      console.error(`   Message: ${data.message}`);
      
      if (data.message?.includes('Insufficient balance')) {
        console.log('\n💡 Tip: Fund your Paystack balance via the dashboard');
      } else if (data.message?.includes('Invalid recipient')) {
        console.log('\n💡 Tip: Verify the recipient code is correct and active');
      } else if (data.message?.includes('not found')) {
        console.log('\n💡 Tip: Ensure you\'re using the correct API key (test vs live)');
      }

      console.log('\n📖 See PAYSTACK_TRANSFERS_SETUP_GUIDE.md for troubleshooting');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error occurred during test:\n');
    console.error(error);
    console.log('\n📖 See PAYSTACK_TRANSFERS_SETUP_GUIDE.md for troubleshooting');
    process.exit(1);
  }
}

// Run the test
testTransfer();
