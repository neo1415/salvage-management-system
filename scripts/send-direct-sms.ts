/**
 * Direct SMS Test Script
 * 
 * This script sends SMS directly to Termii API without any dependencies.
 * It will actually send the SMS and you'll receive it!
 * 
 * Usage:
 * npx tsx scripts/send-direct-sms.ts
 */

import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Configuration
const TERMII_API_URL = 'https://api.ng.termii.com/api/sms/send';
const TERMII_API_KEY = process.env.TERMII_API_KEY || '';
const TERMII_SENDER_ID = 'NEM'; // Using NEM instead of NEMSAL (both are ACTIVE)

// Your phone number
const PHONE_NUMBER = '2348141252812'; // Change this to your number if different

async function sendDirectSMS() {
  console.log('🚀 Sending SMS directly to Termii API...\n');
  console.log('─'.repeat(60));
  console.log(`📱 Phone Number: ${PHONE_NUMBER}`);
  console.log(`📤 Sender ID: ${TERMII_SENDER_ID}`);
  console.log(`⏰ Time: ${new Date().toLocaleString()}`);
  console.log('─'.repeat(60));

  // Check API key
  if (!TERMII_API_KEY) {
    console.error('\n❌ ERROR: TERMII_API_KEY is not set in .env file');
    console.log('\n💡 Please add your Termii API key to .env:');
    console.log('   TERMII_API_KEY=your-api-key-here');
    process.exit(1);
  }

  console.log(`\n🔑 API Key: ${TERMII_API_KEY.substring(0, 10)}...${TERMII_API_KEY.substring(TERMII_API_KEY.length - 5)}`);

  // Keep message under 160 characters to avoid multi-page charges
  const message = `Test SMS from NEM Salvage at ${new Date().toLocaleTimeString()}. If you got this, it works! Reply OK.`;

  console.log('\n📝 Message:');
  console.log('─'.repeat(60));
  console.log(message);
  console.log('─'.repeat(60));

  try {
    console.log('\n⏳ Sending SMS...');

    const response = await axios.post(
      TERMII_API_URL,
      {
        to: PHONE_NUMBER,
        from: TERMII_SENDER_ID,
        sms: message,
        type: 'plain',
        channel: 'generic', // Back to generic since sender ID is ACTIVE
        api_key: TERMII_API_KEY,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 15000, // 15 second timeout
      }
    );

    console.log('\n✅ SUCCESS! SMS sent successfully!');
    console.log('─'.repeat(60));
    console.log('📊 Response from Termii:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('─'.repeat(60));

    if (response.data.message_id) {
      console.log(`\n✅ Message ID: ${response.data.message_id}`);
      console.log(`💰 Balance: ${response.data.balance || 'N/A'}`);
      console.log(`👤 User: ${response.data.user || 'N/A'}`);
    }

    console.log('\n📱 CHECK YOUR PHONE NOW!');
    console.log('💡 The SMS should arrive within 5-30 seconds.');
    console.log('\n🎉 If you received it, your SMS service is working perfectly!');

  } catch (error) {
    console.error('\n❌ ERROR: Failed to send SMS');
    console.log('─'.repeat(60));

    if (axios.isAxiosError(error)) {
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Response:', JSON.stringify(error.response.data, null, 2));
        
        // Specific error messages
        if (error.response.status === 401) {
          console.log('\n💡 Authentication Error:');
          console.log('   - Check that your TERMII_API_KEY is correct');
          console.log('   - Verify the API key is active in your Termii dashboard');
        } else if (error.response.status === 400) {
          console.log('\n💡 Bad Request:');
          console.log('   - Check that your phone number is correct');
          console.log('   - Verify your sender ID is approved');
          console.log('   - Make sure you have sufficient balance');
        }
      } else if (error.request) {
        console.error('No response received from Termii API');
        console.log('\n💡 Network Error:');
        console.log('   - Check your internet connection');
        console.log('   - Verify Termii API is accessible');
      } else {
        console.error('Error:', error.message);
      }
    } else {
      console.error('Error:', error);
    }

    console.log('\n🔍 Troubleshooting Steps:');
    console.log('1. Verify TERMII_API_KEY in .env file');
    console.log('2. Check Termii account balance at https://termii.com');
    console.log('3. Verify sender ID is approved');
    console.log('4. Check phone number format (234XXXXXXXXXX)');
    console.log('5. Try the Termii dashboard to send a test SMS');

    process.exit(1);
  }
}

// Run the script
sendDirectSMS().catch(console.error);
