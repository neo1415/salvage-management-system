import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Script to make a user a system admin (super admin)
 * 
 * Usage: npx tsx scripts/make-super-admin.ts <email>
 * Example: npx tsx scripts/make-super-admin.ts adneo502@gmail.com
 */

async function makeSuperAdmin(email: string) {
  try {
    console.log('🔍 Looking for user with email:', email);
    
    // Find user
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (!user) {
      console.error('❌ User not found:', email);
      console.log('\n💡 Please check the email address and try again.');
      console.log('💡 Make sure the user has registered in the system first.');
      process.exit(1);
    }
    
    console.log('✅ User found:', user.id, user.fullName);
    console.log('📋 Current role:', user.role);
    console.log('📋 Current status:', user.status);
    
    // Check if already system admin
    if (user.role === 'system_admin') {
      console.log('\n✅ User is already a system admin!');
      console.log('🎉 This user has full administrative privileges:');
      console.log('   - Create, edit, and delete users');
      console.log('   - Manage all system settings');
      console.log('   - Access all admin dashboards');
      console.log('   - View and manage audit logs');
      console.log('   - Handle fraud alerts');
      console.log('   - Generate reports');
      process.exit(0);
    }
    
    console.log('\n🔄 Updating user to system admin...');
    
    // Update user to system admin
    await db
      .update(users)
      .set({
        role: 'system_admin',
        status: 'verified_tier_2', // Give highest verification status
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
    
    console.log('\n✅ SUCCESS! User is now a system admin (super admin)!');
    console.log('\n🎉 Administrative Privileges Granted:');
    console.log('   ✓ Create new staff accounts (Claims Adjusters, Salvage Managers, Finance Officers, Admins)');
    console.log('   ✓ Edit and delete any user account');
    console.log('   ✓ Reset user passwords');
    console.log('   ✓ View and manage all audit logs');
    console.log('   ✓ Access fraud alert dashboard');
    console.log('   ✓ Suspend/reinstate vendors');
    console.log('   ✓ Generate all types of reports');
    console.log('   ✓ Full system access');
    
    console.log('\n📍 Access Admin Dashboard:');
    console.log('   URL: /admin/users');
    console.log('   Login with:', email);
    
    console.log('\n🔐 Security Note:');
    console.log('   This user now has FULL administrative access.');
    console.log('   Keep credentials secure and use responsibly.');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error making user super admin:', error);
    process.exit(1);
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.error('❌ Usage: npx tsx scripts/make-super-admin.ts <email>');
  console.error('📝 Example: npx tsx scripts/make-super-admin.ts adneo502@gmail.com');
  process.exit(1);
}

makeSuperAdmin(email);
