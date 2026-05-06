import { db } from '@/lib/db';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';

async function checkNavigationRole() {
  console.log('🔍 Checking Reconciliation Navigation Role Configuration...\n');

  try {
    // Check all users with finance_officer or system_admin roles
    const financeUsers = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        fullName: users.fullName,
      })
      .from(users)
      .where(eq(users.role, 'finance_officer'));

    const adminUsers = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        fullName: users.fullName,
      })
      .from(users)
      .where(eq(users.role, 'system_admin'));

    console.log('📊 Finance Officers in Database:');
    if (financeUsers.length === 0) {
      console.log('  ❌ No finance officers found!');
    } else {
      financeUsers.forEach((user) => {
        console.log(`  ✅ ${user.fullName} (${user.email}) - Role: ${user.role}`);
      });
    }

    console.log('\n📊 System Admins in Database:');
    if (adminUsers.length === 0) {
      console.log('  ❌ No system admins found!');
    } else {
      adminUsers.forEach((user) => {
        console.log(`  ✅ ${user.fullName} (${user.email}) - Role: ${user.role}`);
      });
    }

    console.log('\n📍 Navigation Configuration:');
    console.log('  Label: Reconciliation');
    console.log('  Path: /finance/reconciliation');
    console.log('  Authorized Roles: finance_officer, system_admin');
    console.log('  Icon: Database');

    console.log('\n🔍 Troubleshooting Steps:');
    console.log('  1. Verify you are logged in as one of the users listed above');
    console.log('  2. Check browser console for any JavaScript errors');
    console.log('  3. Try logging out and logging back in');
    console.log('  4. Clear browser cache and cookies');
    console.log('  5. Check if session.user.role is being set correctly in NextAuth');

    console.log('\n💡 Quick Test:');
    console.log('  Open browser console and run:');
    console.log('  fetch("/api/auth/session").then(r => r.json()).then(console.log)');
    console.log('  Check if the "role" field matches one of: finance_officer, system_admin');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkNavigationRole();
