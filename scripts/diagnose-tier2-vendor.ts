import { db } from './src/lib/db/drizzle';
import { vendors } from './src/lib/db/schema/vendors';
import { users } from './src/lib/db/schema/users';
import { eq } from 'drizzle-orm';

async function diagnoseVendor() {
  console.log(' Diagnosing vendor state...\n');
  
  // Find the vendor by email
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, 'neowalker502@gmail.com'))
    .limit(1);
    
  if (!user) {
    console.log(' User not found');
    return;
  }
  
  console.log(' User:', {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
  });
  
  const [vendor] = await db
    .select()
    .from(vendors)
    .where(eq(vendors.userId, user.id))
    .limit(1);
    
  if (!vendor) {
    console.log(' Vendor not found');
    return;
  }
  
  console.log('\n Vendor:', {
    id: vendor.id,
    businessName: vendor.businessName,
    tier: vendor.tier,
    status: vendor.status,
    approvedAt: vendor.approvedAt,
    approvedBy: vendor.approvedBy,
    tier2ApprovedAt: vendor.tier2ApprovedAt,
    tier2ApprovedBy: vendor.tier2ApprovedBy,
    tier2ExpiresAt: vendor.tier2ExpiresAt,
  });
  
  process.exit(0);
}

diagnoseVendor().catch(console.error);
