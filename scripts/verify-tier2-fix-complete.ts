import { db } from '@/lib/db/drizzle';
import { vendors, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Verification Script for Tier 2 KYC Fix
 * 
 * This script verifies that all Tier 2 KYC fixes are working correctly.
 * Run with: npx tsx scripts/verify-tier2-fix-complete.ts
 */

async function verify() {
  try {
    const vendorEmail = 'neowalker502@gmail.com';
    
    console.log('🔍 Verifying Tier 2 KYC Fix...\n');
    console.log('=' .repeat(60));
    console.log('');

    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, vendorEmail))
      .limit(1);

    if (!user) {
      console.log('❌ FAIL: User not found');
      return;
    }

    // Find vendor
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, user.id))
      .limit(1);

    if (!vendor) {
      console.log('❌ FAIL: Vendor not found');
      return;
    }

    console.log('📊 VERIFICATION RESULTS\n');

    // Test 1: Tier is tier2_full
    const test1 = vendor.tier === 'tier2_full';
    console.log(`${test1 ? '✅' : '❌'} Test 1: Tier is tier2_full`);
    console.log(`   Current: ${vendor.tier}`);
    console.log('');

    // Test 2: Status is approved
    const test2 = vendor.status === 'approved';
    console.log(`${test2 ? '✅' : '❌'} Test 2: Status is approved`);
    console.log(`   Current: ${vendor.status}`);
    console.log('');

    // Test 3: tier2ApprovedAt is set
    const test3 = vendor.tier2ApprovedAt !== null;
    console.log(`${test3 ? '✅' : '❌'} Test 3: tier2ApprovedAt is set`);
    console.log(`   Current: ${vendor.tier2ApprovedAt || 'null'}`);
    console.log('');

    // Test 4: tier2ExpiresAt is set
    const test4 = vendor.tier2ExpiresAt !== null;
    console.log(`${test4 ? '✅' : '❌'} Test 4: tier2ExpiresAt is set`);
    console.log(`   Current: ${vendor.tier2ExpiresAt || 'null'}`);
    console.log('');

    // Test 5: tier2ApprovedBy is set
    const test5 = vendor.tier2ApprovedBy !== null;
    console.log(`${test5 ? '✅' : '❌'} Test 5: tier2ApprovedBy is set`);
    console.log(`   Current: ${vendor.tier2ApprovedBy || 'null'}`);
    console.log('');

    // Test 6: tier2RejectionReason is null
    const test6 = vendor.tier2RejectionReason === null;
    console.log(`${test6 ? '✅' : '❌'} Test 6: tier2RejectionReason is null`);
    console.log(`   Current: ${vendor.tier2RejectionReason || 'null'}`);
    console.log('');

    // Test 7: Business details exist
    const test7 = vendor.businessName !== null && vendor.businessType !== null;
    console.log(`${test7 ? '✅' : '❌'} Test 7: Business details exist`);
    console.log(`   Business Name: ${vendor.businessName || 'null'}`);
    console.log(`   Business Type: ${vendor.businessType || 'null'}`);
    console.log('');

    // Test 8: CAC Number exists
    const test8 = vendor.cacNumber !== null;
    console.log(`${test8 ? '✅' : '❌'} Test 8: CAC Number exists`);
    console.log(`   CAC Number: ${vendor.cacNumber || 'null'}`);
    console.log('');

    // Test 9: Registration fee paid
    const test9 = vendor.registrationFeePaid === true;
    console.log(`${test9 ? '✅' : '❌'} Test 9: Registration fee paid`);
    console.log(`   Paid: ${vendor.registrationFeePaid}`);
    console.log(`   Amount: ₦${vendor.registrationFeeAmount?.toLocaleString() || '0'}`);
    console.log('');

    // Test 10: Expiry date is in the future
    const test10 = vendor.tier2ExpiresAt ? new Date(vendor.tier2ExpiresAt) > new Date() : false;
    console.log(`${test10 ? '✅' : '❌'} Test 10: Expiry date is in the future`);
    if (vendor.tier2ExpiresAt) {
      const daysLeft = Math.ceil((new Date(vendor.tier2ExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      console.log(`   Expires: ${new Date(vendor.tier2ExpiresAt).toLocaleDateString()}`);
      console.log(`   Days left: ${daysLeft}`);
    }
    console.log('');

    // Overall result
    const allTests = [test1, test2, test3, test4, test5, test6, test7, test8, test9, test10];
    const passedTests = allTests.filter(t => t).length;
    const totalTests = allTests.length;

    console.log('=' .repeat(60));
    console.log('');
    console.log(`📈 OVERALL RESULT: ${passedTests}/${totalTests} tests passed`);
    console.log('');

    if (passedTests === totalTests) {
      console.log('🎉 SUCCESS! All Tier 2 KYC fixes are working correctly!');
      console.log('');
      console.log('✅ Vendor Benefits:');
      console.log('   • Unlimited bidding (no ₦500k limit)');
      console.log('   • Access to leaderboard');
      console.log('   • Priority support');
      console.log('   • Tier 2 verified badge');
      console.log('');
    } else {
      console.log('⚠️  WARNING: Some tests failed. Please review the results above.');
      console.log('');
    }

    // Warnings
    console.log('⚠️  WARNINGS:');
    if (!vendor.bankName || !vendor.bankAccountNumber) {
      console.log('   • Bank account details are missing');
      console.log('     Vendor should add: Bank Name, Account Name, Account Number');
    }
    if (!vendor.tin) {
      console.log('   • TIN (Tax Identification Number) is missing');
    }
    if (!vendor.address) {
      console.log('   • Business address is missing');
    }
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

verify();
