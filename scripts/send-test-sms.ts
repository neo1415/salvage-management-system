/**
 * Send Test SMS Script
 * 
 * This script sends a real SMS to your phone using the SMS service.
 * It will actually send the SMS and you'll receive it!
 * 
 * Usage:
 * npx tsx scripts/send-test-sms.ts
 */

import { smsService } from '../src/features/notifications/services/sms.service';

async function sendTestSMS() {
  console.log('🚀 Sending test SMS...\n');

  // Your phone number (change this to your number)
  const phoneNumber = '2348141252812'; // Change to your number!
  
  console.log(`📱 Sending to: ${phoneNumber}`);
  console.log(`⏰ Time: ${new Date().toLocaleString()}\n`);

  try {
    // Send a test SMS
    const result = await smsService.sendSMS({
      to: phoneNumber,
      message: '🎉 Test SMS from Salvage Management System! This is a real SMS. If you received this, the service is working perfectly! ✅',
    });

    console.log('\n📊 Result:');
    console.log('─'.repeat(50));
    console.log(`Success: ${result.success ? '✅ YES' : '❌ NO'}`);
    console.log(`Message ID: ${result.messageId || 'N/A'}`);
    console.log(`Error: ${result.error || 'None'}`);
    console.log('─'.repeat(50));

    if (result.success) {
      console.log('\n✅ SMS SENT SUCCESSFULLY!');
      console.log('📱 Check your phone - you should receive the SMS shortly!');
      console.log('\n💡 Note: It may take 5-30 seconds to arrive.');
    } else {
      console.log('\n❌ SMS FAILED TO SEND');
      console.log(`Error: ${result.error}`);
      console.log('\n🔍 Troubleshooting:');
      console.log('1. Check your TERMII_API_KEY in .env');
      console.log('2. Verify your Termii account has credits');
      console.log('3. Make sure the phone number is in the verified list');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error);
  }
}

// Run the script
sendTestSMS();
