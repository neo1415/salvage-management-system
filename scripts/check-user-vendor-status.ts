import { db } from '@/lib/db/drizzle';
import { users, vendors } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function checkUserVendorStatus(email: string) {
  try {
    console.log('Checking user and vendor status for:', email);
    console.log('='.repeat(60));
    
    // Find user
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (!user) {
      console.error('\n✗ User not found with email:', email);
      process.exit(1);
    }
    
    console.log('\n✓ User Found:');
    console.log('  ID:', user.id);
    console.log('  Email:', user.email);
    console.log('  Name:', user.fullName);
    console.log('  Role:', user.role);
    console.log('  Status:', user.status);
    console.log('  Phone:', user.phone || 'Not set');
    console.log('  Last Login:', user.lastLoginAt || 'Never');
    
    // Check if vendor profile exists
    const [vendor] = await db.select().from(vendors).where(eq(vendors.userId, user.id)).limit(1);
    
    if (!vendor) {
      console.log('\n✗ Vendor Profile: NOT FOUND');
      console.log('\nThis user does not have a vendor profile.');
      console.log('To create one, run:');
      console.log(`  npx tsx scripts/create-vendor-profile.ts ${email}`);
      process.exit(1);
    }
    
    console.log('\n✓ Vendor Profile Found:');
    console.log('  Vendor ID:', vendor.id);
    console.log('  Business Name:', vendor.businessName);
    console.log('  Tier:', vendor.tier);
    console.log('  Status:', vendor.status);
    console.log('  Rating:', vendor.rating);
    console.log('  Created:', vendor.createdAt);
    
    // Check if user can access dashboard
    console.log('\n✓ Dashboard Access Check:');
    if (user.role !== 'vendor') {
      console.log('  ✗ User role is not "vendor" (current:', user.role + ')');
      console.log('  Dashboard access will be DENIED');
    } else if (!vendor) {
      console.log('  ✗ No vendor profile exists');
      console.log('  Dashboard access will be DENIED (404)');
    } else {
      console.log('  ✓ User has vendor role');
      console.log('  ✓ Vendor profile exists');
      console.log('  ✓ Dashboard access should work!');
    }
    
    console.log('\n' + '='.repeat(60));
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Error checking user status:', error);
    process.exit(1);
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.error('Usage: npx tsx scripts/check-user-vendor-status.ts <email>');
  console.error('Example: npx tsx scripts/check-user-vendor-status.ts user@example.com');
  process.exit(1);
}

checkUserVendorStatus(email);
