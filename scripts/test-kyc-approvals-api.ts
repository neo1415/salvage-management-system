import 'dotenv/config';
import { db } from '@/lib/db/drizzle';
import { vendors, users } from '@/lib/db/schema';
import { eq, and, isNotNull, sql } from 'drizzle-orm';

async function testKYCApprovalsAPI() {
  console.log('🧪 Testing KYC Approvals API Query\n');

  try {
    // Test the exact query used by getPendingApprovals()
    console.log('Test: Fetching pending KYC approvals...');
    const rows = await db
      .select({
        id: vendors.id,
        businessName: vendors.businessName,
        tier2SubmittedAt: vendors.tier2SubmittedAt,
        amlRiskLevel: vendors.amlRiskLevel,
        fraudRiskScore: vendors.fraudRiskScore,
        fraudFlags: vendors.fraudFlags,
        selfieUrl: vendors.selfieUrl,
        photoIdUrl: vendors.photoIdUrl,
        photoIdType: vendors.photoIdType,
        addressProofUrl: vendors.addressProofUrl,
        ninVerificationData: vendors.ninVerificationData,
        livenessScore: vendors.livenessScore,
        biometricMatchScore: vendors.biometricMatchScore,
        amlScreeningData: vendors.amlScreeningData,
        userEmail: users.email,
        userPhone: users.phone,
      })
      .from(vendors)
      .innerJoin(users, eq(vendors.userId, users.id))
      .where(
        and(
          isNotNull(vendors.tier2SubmittedAt),
          sql`${vendors.tier2ApprovedAt} IS NULL`,
          sql`${vendors.tier2RejectionReason} IS NULL`
        )
      )
      .orderBy(vendors.tier2SubmittedAt);

    console.log(`✅ Found ${rows.length} pending KYC approvals\n`);

    if (rows.length > 0) {
      rows.forEach((row) => {
        console.log(`  - ${row.businessName} (${row.id})`);
        console.log(`    Email: ${row.userEmail}`);
        console.log(`    Phone: ${row.userPhone}`);
        console.log(`    Submitted: ${row.tier2SubmittedAt}`);
        console.log(`    AML Risk: ${row.amlRiskLevel || 'N/A'}`);
        console.log(`    Fraud Score: ${row.fraudRiskScore || 'N/A'}`);
        console.log(`    Has AI Verification: ${row.ninVerificationData ? 'Yes' : 'No'}`);
        console.log('');
      });
    } else {
      console.log('  No pending approvals found.');
    }

    console.log('✅ Test complete!\n');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

testKYCApprovalsAPI();
