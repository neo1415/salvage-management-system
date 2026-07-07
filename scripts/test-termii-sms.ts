import 'dotenv/config';

/**
 * Test Termii SMS Integration
 * 
 * This script tests if Termii API is working correctly
 * Usage: npx tsx scripts/test-termii-sms.ts +2348141252812
 */

async function testTermiiSMS(phone: string) {
  const apiKey = process.env.TERMII_API_KEY;
  const configuredSenderId = process.env.TERMII_DEFAULT_SENDER_ID || process.env.TERMII_SENDER_ID || 'NEM';
  const senderId = ['NEMSAR', 'NEMSAL'].includes(configuredSenderId.toUpperCase())
    ? 'NEM'
    : configuredSenderId;
  const normalizedPhone = normalizeNigerianPhone(phone);
  const channel = resolveTermiiChannel(process.env.TERMII_CHANNEL);
  
  if (!apiKey) {
    console.error('❌ TERMII_API_KEY not found in .env');
    process.exit(1);
  }

  console.log('📱 Testing Termii SMS Integration...');
  console.log(`   Phone: ${normalizedPhone}`);
  console.log(`   Sender ID: ${senderId}`);
  console.log(`   Channel: ${channel}`);
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
        to: normalizedPhone,
        from: senderId,
        sms: message,
        type: 'plain',
        channel,
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

function normalizeNigerianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('234')) return digits;
  if (digits.startsWith('0')) return `234${digits.slice(1)}`;
  if (digits.length === 10) return `234${digits}`;
  return digits;
}

function resolveTermiiChannel(channel?: string): string {
  const normalized = (channel || 'dnd').trim().toLowerCase();
  return normalized === 'generic' ? 'dnd' : normalized;
}

// Get phone number from command line argument
const phone = process.argv[2];

if (!phone) {
  console.error('Usage: npx tsx scripts/test-termii-sms.ts <phone_number>');
  console.error('Example: npx tsx scripts/test-termii-sms.ts +2348141252812');
  process.exit(1);
}

testTermiiSMS(phone);
