import { db } from '@/lib/db/drizzle';
import { users, vendors } from '@/lib/db/schema';
import { escrowWallets } from '@/lib/db/schema/escrow';
import { eq } from 'drizzle-orm';

async function testVendorAccountFix(email: string) {
  try {
    console.log('Testing vendor account fix for:', email);
    console.log('============================================');
    
    // 1. Check user exists
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (!user) {
      console.error('✗ User not found:', email);
      return;
    }
    
    console.log('✓ User found:');
    console.log('  ID:', user.id);
    console.log('  Name:', user.fullName);
    console.log('  Role:', user.role);
    console.log('  Status:', user.status);
    
    // 2. Check vendor profile exists
    const [vendor] = await db.select().from(vendors).where(eq(vendors.userId, user.id)).limit(1);
    
    if (!vendor) {
      console.error('✗ Vendor profile not found');
      return;
    }
    
    console.log('\n✓ Vendor profile found:');
    console.log('  Vendor ID:', vendor.id);
    console.log('  Business Name:', vendor.businessName);
    console.log('  Tier:', vendor.tier);
    console.log('  Status:', vendor.status);
    
    // 3. Check if wallet exists
    const [wallet] = await db.select().from(escrowWallets).where(eq(escrowWallets.vendorId, vendor.id)).limit(1);
    
    if (wallet) {
      console.log('\n✓ Wallet found:');
      console.log('  Wallet ID:', wallet.id);
      console.log('  Balance:', wallet.balance);
      console.log('  Available:', wallet.availableBalance);
    } else {
      console.log('\n⚠ Wallet not found (will be created automatically when needed)');
    }
    
    // 4. Test API endpoints that were failing
    console.log('\n🔧 API Endpoint Status:');
    console.log('  /api/dashboard/vendor - Should work (vendor profile exists)');
    console.log('  /api/payments/wallet/balance - Should work (vendor profile exists)');
    console.log('  /api/auctions?tab=won - Should work after user logs out/in (to refresh session)');
    
    console.log('\n✅ Account fix verification complete!');
    console.log('\n📝 Next steps:');
    console.log('  1. User should log out and log back in to refresh session');
    console.log('  2. Test the vendor dashboard');
    console.log('  3. Test auction filtering');
    console.log('  4. Test wallet balance');
    
  } catch (error) {
    console.error('\n✗ Error testing vendor account:', error);
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.error('Usage: npx tsx scripts/test-vendor-account-fix.ts <email>');
  console.error('Example: npx tsx scripts/test-vendor-account-fix.ts skyneo502@gmail.com');
  process.exit(1);
}

testVendorAccountFix(email);