/**
 * Diagnose BVN Redirect Issue in Production
 * 
 * This script helps diagnose why vendors aren't being redirected
 * to tier1 KYC after phone verification on production.
 * 
 * Usage:
 *   npx tsx scripts/diagnose-bvn-redirect-production.ts <vendor-email>
 */

import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { eq } from 'drizzle-orm';

async function diagnoseBVNRedirect(email: string) {
  console.log('🔍 Diagnosing BVN Redirect Issue\n');
  console.log(`Email: ${email}\n`);
  console.log('='.repeat(60));
  
  try {
    // 1. Check user exists
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('\n✅ User Found:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Status: ${user.status}`);
    console.log(`   Phone: ${user.phone || 'NOT SET'}`);
    console.log(`   Phone Verified: ${user.phoneVerifiedAt ? 'YES' : 'NO'}`);
    if (user.phoneVerifiedAt) {
      console.log(`   Phone Verified At: ${user.phoneVerifiedAt}`);
    }
    
    // 2. Check if vendor
    if (user.role !== 'vendor') {
      console.log('\n⚠️  User is not a vendor - BVN redirect only applies to vendors');
      return;
    }
    
    // 3. Check vendor profile
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, user.id))
      .limit(1);
    
    if (!vendor) {
      console.log('\n❌ Vendor profile not found!');
      console.log('   This is a problem - vendors should have a profile');
      return;
    }
    
    console.log('\n✅ Vendor Profile Found:');
    console.log(`   Vendor ID: ${vendor.id}`);
    console.log(`   BVN: ${vendor.bvn || 'NOT SET'}`);
    console.log(`   BVN Verified: ${vendor.bvnVerifiedAt ? 'YES' : 'NO'}`);
    if (vendor.bvnVerifiedAt) {
      console.log(`   BVN Verified At: ${vendor.bvnVerifiedAt}`);
    }
    
    // 4. Determine expected behavior
    console.log('\n' + '='.repeat(60));
    console.log('📊 Expected Behavior Analysis:');
    console.log('='.repeat(60));
    
    const phoneVerified = !!user.phoneVerifiedAt;
    const bvnVerified = !!vendor.bvnVerifiedAt;
    
    console.log(`\n1. Phone Verified: ${phoneVerified ? '✅ YES' : '❌ NO'}`);
    console.log(`2. BVN Verified: ${bvnVerified ? '✅ YES' : '❌ NO'}`);
    
    if (!phoneVerified) {
      console.log('\n⚠️  ISSUE: Phone not verified');
      console.log('   User should complete phone verification first');
      return;
    }
    
    if (bvnVerified) {
      console.log('\n✅ BVN already verified');
      console.log('   User should NOT be redirected to tier1 KYC');
      console.log('   User should access dashboard normally');
      return;
    }
    
    console.log('\n🎯 EXPECTED REDIRECT BEHAVIOR:');
    console.log('   ✅ Phone is verified');
    console.log('   ❌ BVN is NOT verified');
    console.log('   📍 Should redirect to: /vendor/kyc/tier1');
    
    // 5. Check what JWT token would contain
    console.log('\n' + '='.repeat(60));
    console.log('🔑 JWT Token Analysis:');
    console.log('='.repeat(60));
    
    console.log('\nOn login, JWT token should contain:');
    console.log(`   token.id = "${user.id}"`);
    console.log(`   token.role = "${user.role}"`);
    console.log(`   token.vendorId = "${vendor.id}"`);
    console.log(`   token.bvnVerified = ${bvnVerified}`);
    
    // 6. Check middleware logic
    console.log('\n' + '='.repeat(60));
    console.log('🛡️  Middleware Logic Check:');
    console.log('='.repeat(60));
    
    console.log('\nMiddleware checks:');
    console.log(`   1. Is dashboard route? YES (assuming /vendor/dashboard)`);
    console.log(`   2. Is KYC route? NO`);
    console.log(`   3. Is auth route? NO`);
    console.log(`   4. User role = "vendor"? YES`);
    console.log(`   5. token.bvnVerified = ${bvnVerified}? ${bvnVerified ? 'YES' : 'NO'}`);
    
    if (!bvnVerified) {
      console.log('\n✅ MIDDLEWARE SHOULD REDIRECT:');
      console.log('   From: /vendor/dashboard');
      console.log('   To: /vendor/kyc/tier1?redirect=/vendor/dashboard');
    } else {
      console.log('\n✅ MIDDLEWARE SHOULD ALLOW ACCESS');
    }
    
    // 7. Troubleshooting steps
    console.log('\n' + '='.repeat(60));
    console.log('🔧 Troubleshooting Steps:');
    console.log('='.repeat(60));
    
    if (!bvnVerified) {
      console.log('\nIf redirect is NOT happening on production:');
      console.log('\n1. Check production logs for JWT token creation:');
      console.log('   Look for: "[JWT Initial Login] Vendor BVN status"');
      console.log('   Should show: bvnVerified: false');
      
      console.log('\n2. Check if middleware is running:');
      console.log('   Look for middleware logs in production');
      console.log('   Middleware should intercept /vendor/dashboard');
      
      console.log('\n3. Verify deployment:');
      console.log('   - Check git commit hash in production');
      console.log('   - Ensure latest code is deployed');
      console.log('   - Check for build errors');
      
      console.log('\n4. Check environment variables:');
      console.log('   - NEXTAUTH_SECRET must be set');
      console.log('   - NEXTAUTH_URL must match production URL');
      console.log('   - DATABASE_URL must point to production DB');
      
      console.log('\n5. Test with fresh session:');
      console.log('   - Clear all cookies');
      console.log('   - Use incognito mode');
      console.log('   - Log in again');
      console.log('   - Should redirect immediately');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Diagnosis Complete');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ Error during diagnosis:', error);
    throw error;
  }
}

// Get email from command line
const email = process.argv[2];

if (!email) {
  console.error('❌ Please provide a vendor email address');
  console.error('Usage: npx tsx scripts/diagnose-bvn-redirect-production.ts <vendor-email>');
  process.exit(1);
}

diagnoseBVNRedirect(email)
  .then(() => {
    console.log('\n👋 Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
