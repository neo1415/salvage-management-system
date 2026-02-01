/**
 * Check OTP Status Script
 * Checks if an OTP exists in Redis for a given phone number
 */

import { config } from 'dotenv';
config();

import { otpCache } from '../src/lib/redis/client';

async function checkOTPStatus() {
  const phone = process.argv[2];

  if (!phone) {
    console.error('❌ Please provide a phone number');
    console.log('Usage: npx tsx scripts/check-otp-status.ts +2348141252812');
    process.exit(1);
  }

  console.log(`\n🔍 Checking OTP status for: ${phone}\n`);

  try {
    // Check if OTP exists
    const otpData = await otpCache.get(phone);

    if (!otpData) {
      console.log('❌ No OTP found in Redis for this phone number');
      console.log('   This could mean:');
      console.log('   1. OTP has expired (5 minutes)');
      console.log('   2. OTP was never sent');
      console.log('   3. OTP was already verified');
      process.exit(0);
    }

    console.log('✅ OTP found in Redis!');
    console.log(`\n📋 OTP Details:`);
    console.log(`   OTP Code: ${otpData.otp}`);
    console.log(`   Attempts: ${otpData.attempts}/${3}`);
    console.log(`   Remaining Attempts: ${3 - otpData.attempts}`);
    console.log(`\n💡 You can use this OTP to verify your phone number`);
    
  } catch (error) {
    console.error('❌ Error checking OTP status:', error);
    process.exit(1);
  }

  process.exit(0);
}

checkOTPStatus();
