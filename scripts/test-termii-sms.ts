import 'dotenv/config';

/**
 * Test Termii SMS Integration
 * 
 * This script tests if Termii API is working correctly
 * Usage: npx tsx scripts/test-termii-sms.ts +2348141252812
 */

async function testTermiiSMS(phone: string) {
  const apiKey = process.env.TERMII_API_KEY;
  const senderId = process.env.TERMII_SENDER_ID || 'NEM-SMS';
  
  if (!apiKey) {
    console.error('❌ TERMII_API_KEY not found in .env');
    process.exit(1);
  }

  console.log('📱 Testing Termii SMS Integration...');
  console.log(`   Phone: ${phone}`);
  console.log(`   Sender ID: ${senderId}`);
  console.log(`   API Key: ${apiKey.substring(0, 10)}...`);
  console.log('');

  const testOTP = Math.floor(100000 + Math.random() * 900000).toString();
  const message = `Your NEM Salvage test OTP is: ${testOTP}. This is a test message.`;

  try {
    const response = await fetch('https://api.ng.termii.com/api/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: phone,
        from: senderId,
        sms: message,
        type: 'plain',
        channel: 'generic',
        api_key: apiKey,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Termii API Error:');
      console.error(JSON.stringify(result, null, 2));
      process.exit(1);
    }

    console.log('✅ SMS sent successfully!');
    console.log('');
    console.log('Response:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');
    console.log(`📱 Check your phone (${phone}) for the test OTP: ${testOTP}`);
  } catch (error) {
    console.error('❌ Error sending SMS:', error);
    process.exit(1);
  }
}

// Get phone number from command line argument
const phone = process.argv[2];

if (!phone) {
  console.error('Usage: npx tsx scripts/test-termii-sms.ts <phone_number>');
  console.error('Example: npx tsx scripts/test-termii-sms.ts +2348141252812');
  process.exit(1);
}

testTermiiSMS(phone);
