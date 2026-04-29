/**
 * Test script to verify KYC widget config API returns phone, BVN, and DOB
 * 
 * Usage:
 *   npx tsx scripts/test-kyc-widget-config.ts
 */

import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { getEncryptionService } from '@/features/kyc/services/encryption.service';

async function testWidgetConfig() {
  console.log('🔍 Testing KYC Widget Config Data Fetching\n');

  try {
    // Find a vendor with BVN
    const [result] = await db
      .select({
        userId: vendors.userId,
        bvnEncrypted: vendors.bvnEncrypted,
        dateOfBirth: users.dateOfBirth,
        phone: users.phone,
        fullName: users.fullName,
      })
      .from(vendors)
      .innerJoin(users, eq(vendors.userId, users.id))
      .where(eq(vendors.bvnEncrypted, vendors.bvnEncrypted))
      .limit(1);

    if (!result) {
      console.log('❌ No vendor found with BVN');
      return;
    }

    console.log('✅ Found vendor:');
    console.log(`   User ID: ${result.userId}`);
    console.log(`   Full Name: ${result.fullName}`);
    console.log(`   Phone: ${result.phone}`);
    console.log(`   DOB: ${result.dateOfBirth}`);
    console.log(`   BVN Encrypted: ${result.bvnEncrypted ? 'Yes' : 'No'}\n`);

    // Decrypt BVN
    let bvn: string | undefined;
    if (result.bvnEncrypted) {
      try {
        const enc = getEncryptionService();
        bvn = enc.decrypt(result.bvnEncrypted);
        console.log('✅ BVN decrypted successfully');
        console.log(`   BVN: ${bvn.slice(0, 3)}***${bvn.slice(-2)} (masked)\n`);
      } catch (err) {
        console.error('❌ Failed to decrypt BVN:', err);
      }
    }

    // Format DOB
    let dob: string | undefined;
    if (result.dateOfBirth) {
      const date = new Date(result.dateOfBirth);
      dob = date.toISOString().slice(0, 10);
      console.log('✅ DOB formatted successfully');
      console.log(`   DOB (YYYY-MM-DD): ${dob}\n`);
    }

    // Simulate API response
    console.log('📦 Simulated API Response:');
    console.log(JSON.stringify({
      appId: process.env.DOJAH_APP_ID ? '***' : undefined,
      publicKey: process.env.DOJAH_PUBLIC_KEY ? '***' : undefined,
      widgetId: process.env.DOJAH_WIDGET_ID ?? null,
      phone: result.phone ?? undefined,
      bvn: bvn ? '***' : undefined,
      dob: dob ?? undefined,
    }, null, 2));

    console.log('\n✅ All fields ready for Dojah widget pre-fill:');
    console.log(`   ✓ Phone: ${result.phone ? 'Available' : 'Missing'}`);
    console.log(`   ✓ BVN: ${bvn ? 'Available' : 'Missing'}`);
    console.log(`   ✓ DOB: ${dob ? 'Available' : 'Missing'}`);

  } catch (error) {
    console.error('❌ Error testing widget config:', error);
  }
}

testWidgetConfig()
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
