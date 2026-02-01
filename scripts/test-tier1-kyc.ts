import 'dotenv/config';

/**
 * Test Tier 1 KYC API
 * 
 * This script demonstrates the Tier 1 KYC verification flow
 * Usage: npx tsx scripts/test-tier1-kyc.ts
 */

async function testTier1KYC() {
  console.log('🔐 Testing Tier 1 KYC API...');
  console.log('');

  // Test BVN validation
  console.log('1. Testing BVN format validation:');
  const testBVNs = [
    { bvn: '12345678901', valid: true, description: 'Valid 11-digit BVN' },
    { bvn: '123', valid: false, description: 'Too short' },
    { bvn: '123456789012', valid: false, description: 'Too long' },
    { bvn: 'abcdefghijk', valid: false, description: 'Non-numeric' },
    { bvn: '', valid: false, description: 'Empty' },
  ];

  for (const test of testBVNs) {
    const isValid = /^\d{11}$/.test(test.bvn);
    const status = isValid === test.valid ? '✅' : '❌';
    console.log(`   ${status} ${test.description}: ${test.bvn || '(empty)'} - ${isValid ? 'VALID' : 'INVALID'}`);
  }

  console.log('');

  // Test BVN encryption
  console.log('2. Testing BVN encryption:');
  const { encryptBVN, decryptBVN, maskBVN } = await import('../src/features/vendors/services/bvn-verification.service');
  
  const testBVN = '12345678901';
  const encrypted = encryptBVN(testBVN);
  const decrypted = decryptBVN(encrypted);
  const masked = maskBVN(testBVN);

  console.log(`   Original BVN: ${testBVN}`);
  console.log(`   Encrypted: ${encrypted.substring(0, 50)}...`);
  console.log(`   Decrypted: ${decrypted}`);
  console.log(`   Masked: ${masked}`);
  console.log(`   ${decrypted === testBVN ? '✅' : '❌'} Encryption/Decryption round-trip successful`);
  console.log('');

  // Test BVN verification (test mode)
  console.log('3. Testing BVN verification (test mode):');
  const { verifyBVN } = await import('../src/features/vendors/services/bvn-verification.service');
  
  const verificationResult = await verifyBVN({
    bvn: '12345678901', // Test BVN
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: '1990-01-01',
    phone: '+2348012345678',
  });

  console.log(`   Success: ${verificationResult.success}`);
  console.log(`   Verified: ${verificationResult.verified}`);
  console.log(`   Match Score: ${verificationResult.matchScore}%`);
  
  if (verificationResult.verified) {
    console.log('   ✅ BVN verification successful (test mode)');
  } else {
    console.log('   ❌ BVN verification failed');
    if (verificationResult.mismatches) {
      console.log('   Mismatches:', verificationResult.mismatches);
    }
  }
  console.log('');

  // Test SMS service configuration
  console.log('4. Testing SMS service configuration:');
  const { smsService } = await import('../src/features/notifications/services/sms.service');
  
  if (smsService.isConfigured()) {
    console.log('   ✅ SMS service is configured');
  } else {
    console.log('   ⚠️  SMS service is not configured (TERMII_API_KEY missing)');
  }
  console.log('');

  // Test email service configuration
  console.log('5. Testing email service configuration:');
  const { emailService } = await import('../src/features/notifications/services/email.service');
  
  if (emailService.isConfigured()) {
    console.log('   ✅ Email service is configured');
  } else {
    console.log('   ⚠️  Email service is not configured (RESEND_API_KEY missing)');
  }
  console.log('');

  console.log('✅ All Tier 1 KYC tests completed!');
  console.log('');
  console.log('📝 API Endpoint: POST /api/vendors/verify-bvn');
  console.log('   Required: Authentication (session)');
  console.log('   Body: { "bvn": "12345678901" }');
  console.log('   Response: { "success": true, "message": "...", "data": {...} }');
}

testTier1KYC().catch(console.error);
