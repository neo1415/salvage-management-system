/**
 * Test script to demonstrate the releaseFunds function with Paystack Transfers API
 * 
 * This script shows how the releaseFunds function works:
 * 1. Without PAYSTACK_NEM_RECIPIENT_CODE (development mode - skips transfer)
 * 2. With PAYSTACK_NEM_RECIPIENT_CODE (production mode - actual transfer)
 * 
 * Usage:
 *   npx tsx scripts/test-escrow-release-funds.ts
 */

import { config } from 'dotenv';
config();

console.log('🔍 Testing Escrow Release Funds with Paystack Transfers API\n');

// Check environment variables
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_NEM_RECIPIENT_CODE = process.env.PAYSTACK_NEM_RECIPIENT_CODE;

console.log('📋 Environment Configuration:');
console.log(`   PAYSTACK_SECRET_KEY: ${PAYSTACK_SECRET_KEY ? '✅ Set' : '❌ Not set'}`);
console.log(`   PAYSTACK_NEM_RECIPIENT_CODE: ${PAYSTACK_NEM_RECIPIENT_CODE ? '✅ Set' : '❌ Not set'}\n`);

if (!PAYSTACK_SECRET_KEY) {
  console.error('❌ Error: PAYSTACK_SECRET_KEY not found in .env');
  console.log('   Please add your Paystack secret key to .env file');
  process.exit(1);
}

// Simulate the releaseFunds logic
async function simulateReleaseFunds() {
  console.log('🎬 Simulating releaseFunds() function...\n');

  const amount = 100000; // ₦100,000
  const auctionId = 'test-auction-123';
  const amountInKobo = Math.round(amount * 100);
  const transferReference = `TRANSFER_${auctionId.substring(0, 8)}_${Date.now()}`;

  console.log('📊 Transaction Details:');
  console.log(`   Amount: ₦${amount.toLocaleString()}`);
  console.log(`   Auction ID: ${auctionId}`);
  console.log(`   Transfer Reference: ${transferReference}\n`);

  // Check if recipient code is configured
  if (!PAYSTACK_NEM_RECIPIENT_CODE) {
    console.log('⚠️  Development Mode Detected');
    console.log('   PAYSTACK_NEM_RECIPIENT_CODE not configured');
    console.log('   Skipping actual Paystack transfer');
    console.log('   Database records would still be updated');
    console.log('   Audit logs would still be created\n');
    
    console.log('💡 To enable real transfers:');
    console.log('   1. Create a transfer recipient in Paystack Dashboard');
    console.log('   2. Add PAYSTACK_NEM_RECIPIENT_CODE to .env');
    console.log('   3. See PAYSTACK_TRANSFERS_SETUP_GUIDE.md for instructions\n');
    
    return;
  }

  // Production mode - attempt actual transfer
  console.log('🚀 Production Mode Detected');
  console.log('   Initiating real Paystack transfer...\n');

  try {
    const transferResponse = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount: amountInKobo,
        recipient: PAYSTACK_NEM_RECIPIENT_CODE,
        reason: `Test: Auction payment for auction ${auctionId.substring(0, 8)}`,
        reference: transferReference,
      }),
    });

    const transferData = await transferResponse.json();

    if (transferResponse.ok) {
      console.log('✅ Transfer Initiated Successfully!\n');
      console.log('📋 Transfer Details:');
      console.log(`   Transfer Code: ${transferData.data.transfer_code}`);
      console.log(`   Status: ${transferData.data.status}`);
      console.log(`   Amount: ₦${(transferData.data.amount / 100).toLocaleString()}`);
      console.log(`   Recipient: ${transferData.data.recipient}`);
      console.log(`   Reference: ${transferData.data.reference}`);
      console.log(`   Created At: ${transferData.data.createdAt}\n`);

      console.log('🎉 Real money transfer completed!');
      console.log('   Check your Paystack dashboard to see the transfer');
      console.log('   The funds will be sent to NEM Insurance\'s bank account\n');
    } else {
      console.error('❌ Transfer Failed!\n');
      console.error('Error Details:');
      console.error(`   Status: ${transferResponse.status}`);
      console.error(`   Message: ${transferData.message}\n`);

      if (transferData.message?.includes('Insufficient balance')) {
        console.log('💡 Tip: Fund your Paystack balance via the dashboard');
      } else if (transferData.message?.includes('Invalid recipient')) {
        console.log('💡 Tip: Verify the recipient code is correct and active');
      }
    }
  } catch (error) {
    console.error('❌ Error occurred during transfer:\n');
    console.error(error);
  }
}

// Run the simulation
simulateReleaseFunds();
