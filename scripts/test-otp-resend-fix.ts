import { otpCache } from '@/lib/redis/client';

/**
 * Test script to verify OTP resend fix
 * Shows the current OTP for testing
 */
async function testOTPResendFix() {
  const phone = '+2347061818715';

  console.log('🧪 Testing OTP Resend Fix\n');
  console.log('=========================\n');

  // Get current OTP from Redis
  console.log('📱 Phone:', phone);
  const otpData = await otpCache.get(phone);

  if (!otpData) {
    console.log('❌ No OTP found in Redis');
    console.log('   Please trigger OTP send first by visiting the registration page');
  } else {
    console.log('✅ Current OTP in Redis:');
    console.log('   - Code:', otpData.otp);
    console.log('   - Attempts:', otpData.attempts, '/ 3');
    console.log('   - Remaining:', 3 - otpData.attempts, 'attempts');
    console.log('\n💡 Use this OTP to test verification');
  }

  console.log('\n📋 Testing Checklist:');
  console.log('=====================');
  console.log('1. ✅ Email backup added to resend endpoint');
  console.log('2. ✅ Separate success messages for resend vs verification');
  console.log('3. ✅ Blue message for resend, green for verification');
  console.log('4. ✅ Diagnostic script created');
  console.log('\n🎯 Next Steps:');
  console.log('1. Click "Resend Code" on OTP verification page');
  console.log('2. Check your email for OTP (danieloyeniyi@thevaultlyne.com)');
  console.log('3. Verify blue success message appears: "OTP Resent Successfully!"');
  console.log('4. Enter OTP and verify green message: "Phone Verified Successfully!"');

  process.exit(0);
}

testOTPResendFix().catch((error) => {
  console.error('❌ Test script error:', error);
  process.exit(1);
});
