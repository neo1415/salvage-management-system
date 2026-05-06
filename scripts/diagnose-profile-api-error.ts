/**
 * Diagnose Profile API Error
 * 
 * Investigate the "Cannot convert undefined or null to object at Object.entries" error
 * when accessing /api/vendor/settings/profile
 */

import { db } from '@/lib/db/drizzle';
import { users, vendors } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function diagnoseProfileError() {
  console.log('🔍 Diagnosing Profile API Error\n');

  const testEmail = 'neowalker502@gmail.com';

  try {
    // 1. Find the user
    console.log('1️⃣ Finding user...');
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, testEmail))
      .limit(1);

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('✅ User found:', {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      status: user.status,
    });

    // 2. Find the vendor
    console.log('\n2️⃣ Finding vendor...');
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, user.id))
      .limit(1);

    if (!vendor) {
      console.log('❌ Vendor not found');
      return;
    }

    console.log('✅ Vendor found');

    // 3. Check for null/undefined fields
    console.log('\n3️⃣ Checking vendor fields for null/undefined values:');
    const vendorFields = Object.entries(vendor);
    
    for (const [key, value] of vendorFields) {
      if (value === null) {
        console.log(`   ⚠️  ${key}: null`);
      } else if (value === undefined) {
        console.log(`   ⚠️  ${key}: undefined`);
      } else if (typeof value === 'object') {
        console.log(`   📦 ${key}: ${JSON.stringify(value)}`);
      } else {
        console.log(`   ✅ ${key}: ${value}`);
      }
    }

    // 4. Simulate the API response
    console.log('\n4️⃣ Simulating API response structure:');
    const apiResponse = {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        status: user.status,
        createdAt: user.createdAt,
      },
      vendor: vendor ? {
        businessName: vendor.businessName,
        businessType: vendor.businessType,
        address: vendor.address,
        city: vendor.city,
        state: vendor.state,
        cacNumber: vendor.cacNumber,
        tin: vendor.tin,
        bankAccountNumber: vendor.bankAccountNumber,
        bankAccountName: vendor.bankAccountName,
        bankName: vendor.bankName,
        tier: vendor.tier,
        status: vendor.status,
        tier2ApprovedAt: vendor.tier2ApprovedAt,
        tier2ExpiresAt: vendor.tier2ExpiresAt,
      } : null,
    };

    console.log(JSON.stringify(apiResponse, null, 2));

    // 5. Check if any fields that might be used with Object.entries are null
    console.log('\n5️⃣ Checking for potential Object.entries issues:');
    
    const potentialIssues = [];
    
    if (vendor.businessType === null) {
      potentialIssues.push('businessType is null');
    }
    if (vendor.address === null) {
      potentialIssues.push('address is null');
    }
    
    if (potentialIssues.length > 0) {
      console.log('⚠️  Potential issues found:');
      potentialIssues.forEach(issue => console.log(`   - ${issue}`));
    } else {
      console.log('✅ No obvious issues found');
    }

    // 6. Test JSON serialization
    console.log('\n6️⃣ Testing JSON serialization:');
    try {
      const jsonString = JSON.stringify(apiResponse);
      console.log('✅ JSON serialization successful');
      console.log(`   Length: ${jsonString.length} characters`);
    } catch (err) {
      console.log('❌ JSON serialization failed:', err);
    }

  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
  }
}

diagnoseProfileError()
  .then(() => {
    console.log('\n✅ Diagnosis complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
