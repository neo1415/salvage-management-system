import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { otpCache } from '@/lib/redis/client';

/**
 * Diagnostic script for OTP resend issue
 * Checks:
 * 1. User exists with phone number
 * 2. OTP is stored in Redis
 * 3. User email is available for backup OTP
 */
async function diagnoseOTPResendIssue() {
  const phone = '+2347061818715';

  console.log('🔍 Diagnosing OTP Resend Issue...\n');

  // Check if user exists
  console.log('1. Checking if user exists with phone:', phone);
  const user = await db
    .select()
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);

  if (user.length === 0) {
    console.log('❌ No user found with phone:', phone);
    console.log('   This means OTP was sent but user doesn\'t exist yet (registration flow)');
  } else {
    console.log('✅ User found:');
    console.log('   - ID:', user[0].id);
    console.log('   - Email:', user[0].email);
    console.log('   - Full Name:', user[0].fullName);
    console.log('   - Status:', user[0].status);
  }

  // Check OTP in Redis
  console.log('\n2. Checking OTP in Redis...');
  const otpData = await otpCache.get(phone);

  if (!otpData) {
    console.log('❌ No OTP found in Redis for phone:', phone);
    console.log('   OTP may have expired (5 minutes) or was never created');
  } else {
    console.log('✅ OTP found in Redis:');
    console.log('   - OTP:', otpData.otp);
    console.log('   - Attempts:', otpData.attempts);
    console.log('   - Max Attempts:', 3);
    console.log('   - Remaining Attempts:', 3 - otpData.attempts);
  }

  // Check if email backup would work
  console.log('\n3. Email Backup Analysis:');
  if (user.length === 0) {
    console.log('⚠️  Email backup NOT available during registration');
    console.log('   Reason: User record doesn\'t exist yet');
    console.log('   Solution: Email backup only works AFTER user is created');
  } else if (!user[0].email) {
    console.log('❌ User has no email address');
  } else if (!user[0].fullName) {
    console.log('⚠️  User has email but no full name');
    console.log('   Email backup may fail due to missing fullName parameter');
  } else {
    console.log('✅ Email backup should work:');
    console.log('   - Email:', user[0].email);
    console.log('   - Full Name:', user[0].fullName);
  }

  console.log('\n📋 Summary:');
  console.log('===========');
  if (user.length === 0) {
    console.log('This is a REGISTRATION flow (user doesn\'t exist yet)');
    console.log('- SMS OTP: ✅ Sent via Termii');
    console.log('- Email OTP: ❌ Not available (user not created yet)');
    console.log('- Solution: Email backup only works for EXISTING users');
  } else {
    console.log('This is an EXISTING USER flow');
    console.log('- SMS OTP: ✅ Should be sent via Termii');
    console.log('- Email OTP: ' + (user[0].email && user[0].fullName ? '✅ Should be sent' : '❌ Missing email or fullName'));
  }

  process.exit(0);
}

diagnoseOTPResendIssue().catch((error) => {
  console.error('❌ Diagnostic script error:', error);
  process.exit(1);
});
