/**
 * Test script to verify KYC widget config API response
 * This will help diagnose why phone and BVN are not being pre-filled
 */

import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { getEncryptionService } from '@/features/kyc/services/encryption.service';

async function testKYCAPIResponse() {
  console.log('=== Testing KYC Widget Config API Response ===\n');

  try {
    // Get a vendor user (first one in the database)
    const [vendor] = await db
      .select({
        userId: vendors.userId,
        bvnEncrypted: vendors.bvnEncrypted,
        phone: users.phone,
        email: users.email,
        fullName: users.fullName,
        dateOfBirth: users.dateOfBirth,
      })
      .from(vendors)
      .innerJoin(users, eq(vendors.userId, users.id))
      .limit(1);

    if (!vendor) {
      console.log('❌ No vendor found in database');
      return;
    }

    console.log('📋 Raw Database Data:');
    console.log('  User ID:', vendor.userId);
    console.log('  Full Name:', vendor.fullName);
    console.log('  Email:', vendor.email);
    console.log('  Phone:', vendor.phone);
    console.log('  Phone Type:', typeof vendor.phone);
    console.log('  Phone Length:', vendor.phone?.length);
    console.log('  BVN Encrypted:', vendor.bvnEncrypted ? '✅ Present' : '❌ Missing');
    console.log('  DOB:', vendor.dateOfBirth);
    console.log('  DOB Type:', typeof vendor.dateOfBirth);
    console.log();

    // Decrypt BVN
    let bvn: string | undefined;
    if (vendor.bvnEncrypted) {
      try {
        const enc = getEncryptionService();
        bvn = enc.decrypt(vendor.bvnEncrypted);
        console.log('🔓 BVN Decryption:');
        console.log('  Status: ✅ Success');
        console.log('  BVN:', bvn);
        console.log('  BVN Type:', typeof bvn);
        console.log('  BVN Length:', bvn?.length);
      } catch (err) {
        console.log('🔓 BVN Decryption:');
        console.log('  Status: ❌ Failed');
        console.log('  Error:', err);
      }
    } else {
      console.log('🔓 BVN Decryption:');
      console.log('  Status: ⚠️  No encrypted BVN found');
    }
    console.log();

    // Format DOB
    let dob: string | undefined;
    if (vendor.dateOfBirth) {
      const date = new Date(vendor.dateOfBirth);
      dob = date.toISOString().slice(0, 10);
      console.log('📅 DOB Formatting:');
      console.log('  Raw DOB:', vendor.dateOfBirth);
      console.log('  Formatted DOB:', dob);
      console.log('  Format:', 'YYYY-MM-DD');
    } else {
      console.log('📅 DOB Formatting:');
      console.log('  Status: ⚠️  No DOB found');
    }
    console.log();

    // Simulate API response
    const apiResponse = {
      appId: process.env.DOJAH_APP_ID || 'NOT_SET',
      publicKey: process.env.DOJAH_PUBLIC_KEY || 'NOT_SET',
      widgetId: process.env.DOJAH_WIDGET_ID || null,
      phone: vendor.phone ?? undefined,
      bvn: bvn ?? undefined,
      dob: dob ?? undefined,
    };

    console.log('📤 Simulated API Response:');
    console.log(JSON.stringify(apiResponse, null, 2));
    console.log();

    // Check what would be passed to Dojah widget
    console.log('🎯 What Frontend Would Receive:');
    console.log('  widgetConfig.phone:', apiResponse.phone);
    console.log('  widgetConfig.bvn:', apiResponse.bvn);
    console.log('  widgetConfig.dob:', apiResponse.dob);
    console.log();

    // Simulate widget initialization
    console.log('🔧 Simulated Widget Initialization:');
    
    const govData: any = {};
    if (apiResponse.phone) {
      govData.mobile = apiResponse.phone;
      console.log('  ✅ gov_data.mobile =', apiResponse.phone);
    } else {
      console.log('  ❌ gov_data.mobile = undefined (phone not set)');
    }
    
    if (apiResponse.bvn) {
      govData.bvn = apiResponse.bvn;
      console.log('  ✅ gov_data.bvn =', apiResponse.bvn);
    } else {
      console.log('  ❌ gov_data.bvn = undefined (BVN not set)');
    }

    const userData: any = {};
    if (apiResponse.dob) {
      userData.dob = apiResponse.dob;
      console.log('  ✅ user_data.dob =', apiResponse.dob);
    } else {
      console.log('  ❌ user_data.dob = undefined (DOB not set)');
    }
    console.log();

    console.log('📊 Summary:');
    console.log('  Phone pre-fill:', apiResponse.phone ? '✅ Should work' : '❌ Will not work');
    console.log('  BVN pre-fill:', apiResponse.bvn ? '✅ Should work' : '❌ Will not work');
    console.log('  DOB pre-fill:', apiResponse.dob ? '✅ Should work' : '❌ Will not work');
    console.log();

    // Check for common issues
    console.log('🔍 Common Issues Check:');
    
    if (!apiResponse.phone) {
      console.log('  ⚠️  Phone is undefined - check users.phone column');
    } else if (!apiResponse.phone.startsWith('+')) {
      console.log('  ⚠️  Phone does not start with + - Dojah might expect international format');
    }
    
    if (!apiResponse.bvn) {
      console.log('  ⚠️  BVN is undefined - check vendors.bvnEncrypted and decryption');
    } else if (apiResponse.bvn.length !== 11) {
      console.log('  ⚠️  BVN length is not 11 digits - might be invalid');
    }
    
    if (!apiResponse.dob) {
      console.log('  ⚠️  DOB is undefined - check users.dateOfBirth column');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testKYCAPIResponse()
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Test failed:', err);
    process.exit(1);
  });
