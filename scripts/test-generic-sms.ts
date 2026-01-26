import 'dotenv/config';

/**
 * Test SMS with Generic Sender ID
 * Generic sender ID has higher delivery rates but shows as random number
 */

async function testGenericSMS(phone: string) {
  const apiKey = process.env.TERMII_API_KEY;
  
  if (!apiKey) {
    console.error('❌ TERMII_API_KEY not found in .env');
    process.exit(1);
  }

  console.log('📱 Testing SMS with GENERIC sender ID...');
  console.log(`   Phone: ${phone}`);
  console.log(`   Sender: generic (will show as random number)`);
  console.log('');

  const testOTP = Math.floor(100000 + Math.random() * 900000).toString();
  const message = `Your NEM Salvage OTP is: ${testOTP}. Valid for 5 minutes.`;

  try {
    const response = await fetch('https://api.ng.termii.com/api/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: phone,
        from: 'generic', // Generic sender ID
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

    console.log('✅ SMS sent with generic sender ID!');
    console.log('');
    console.log('Response:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');
    console.log(`📱 Check your phone (${phone}) for SMS from a random number`);
    console.log(`   OTP: ${testOTP}`);
    console.log('');
    console.log('💡 Generic sender ID has 99% delivery rate but shows as random number');
    console.log('   For production, you can use your approved sender ID: NEMSAL');
  } catch (error) {
    console.error('❌ Error sending SMS:', error);
    process.exit(1);
  }
}

const phone = process.argv[2];

if (!phone) {
  console.error('Usage: npx tsx scripts/test-generic-sms.ts <phone_number>');
  console.error('Example: npx tsx scripts/test-generic-sms.ts +2348141252812');
  process.exit(1);
}

testGenericSMS(phone);
