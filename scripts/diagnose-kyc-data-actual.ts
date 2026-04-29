/**
 * Diagnostic script to check actual KYC data in database
 * Run: npx tsx scripts/diagnose-kyc-data-actual.ts
 */

import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { getEncryptionService } from '@/features/kyc/services/encryption.service';

async function diagnose() {
  console.log('🔍 Diagnosing KYC Data in Database\n');

  try {
    // Find all vendors with their user data
    const results = await db
      .select({
        vendorId: vendors.id,
        userId: vendors.userId,
        fullName: users.fullName,
        phone: users.phone,
        dateOfBirth: users.dateOfBirth,
        bvnEncrypted: vendors.bvnEncrypted,
        bvnVerifiedAt: vendors.bvnVerifiedAt,
      })
      .from(vendors)
      .innerJoin(users, eq(vendors.userId, users.id))
      .limit(5);

    if (results.length === 0) {
      console.log('❌ No vendors found in database');
      return;
    }

    console.log(`Found ${results.length} vendor(s)\n`);

    for (const result of results) {
      console.log('─'.repeat(60));
      console.log(`Vendor ID: ${result.vendorId}`);
      console.log(`User ID: ${result.userId}`);
      console.log(`Full Name: ${result.fullName}`);
      console.log(`Phone: ${result.phone}`);
      console.log(`Date of Birth: ${result.dateOfBirth}`);
      console.log(`BVN Encrypted: ${result.bvnEncrypted ? 'Yes' : 'No'}`);
      console.log(`BVN Verified At: ${result.bvnVerifiedAt || 'Not verified'}`);

      // Try to decrypt BVN
      if (result.bvnEncrypted) {
        try {
          const enc = getEncryptionService();
          const bvn = enc.decrypt(result.bvnEncrypted);
          console.log(`BVN (decrypted): ${bvn.slice(0, 3)}***${bvn.slice(-2)}`);
        } catch (err) {
          console.log(`BVN (decryption failed): ${err}`);
        }
      }

      // Format DOB
      if (result.dateOfBirth) {
        const date = new Date(result.dateOfBirth);
        const formatted = date.toISOString().slice(0, 10);
        console.log(`DOB (formatted): ${formatted}`);
      }

      console.log('');
    }

    console.log('─'.repeat(60));
    console.log('\n✅ Diagnosis complete');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

diagnose()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
