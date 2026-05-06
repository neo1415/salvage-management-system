import { db } from '../src/lib/db/index.js';
import { vendors } from '../src/lib/db/schema/vendors.js';
import { users } from '../src/lib/db/schema/users.js';
import { eq } from 'drizzle-orm';

async function checkVendorTier() {
  try {
    const result = await db
      .select({
        vendorId: vendors.id,
        businessName: vendors.businessName,
        tier: vendors.tier,
        tier2ApprovedAt: vendors.tier2ApprovedAt,
        tier2ApprovedBy: vendors.tier2ApprovedBy,
        userEmail: users.email,
      })
      .from(vendors)
      .innerJoin(users, eq(vendors.userId, users.id))
      .where(eq(users.email, 'neowalker502@gmail.com'))
      .limit(1);

    if (result.length === 0) {
      console.log('❌ Vendor not found');
      return;
    }

    console.log('✅ Vendor found:');
    console.log('   - Email:', result[0].userEmail);
    console.log('   - Business Name:', result[0].businessName);
    console.log('   - Tier:', result[0].tier);
    console.log('   - Tier 2 Approved At:', result[0].tier2ApprovedAt);
    console.log('   - Tier 2 Approved By:', result[0].tier2ApprovedBy);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkVendorTier();
