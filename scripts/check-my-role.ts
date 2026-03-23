import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { desc, eq } from 'drizzle-orm';

async function checkRecentAdmins() {
  try {
    console.log('Checking recent admin users...\n');
    
    // Get the 5 most recent admin users
    const adminUsers = await db
      .select()
      .from(users)
      .where(eq(users.role, 'system_admin'))
      .orderBy(desc(users.lastLoginAt))
      .limit(5);
    
    if (adminUsers.length === 0) {
      console.log('No admin users found with system_admin role.');
      console.log('\nChecking for recent users (any role)...\n');
      
      const altAdminUsers = await db
        .select()
        .from(users)
        .orderBy(desc(users.lastLoginAt))
        .limit(10);
      
      console.log('Recent users (any role):');
      altAdminUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Last Login: ${user.lastLoginAt || 'Never'}`);
        console.log('');
      });
      
      return;
    }
    
    console.log('Recent admin users:');
    adminUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Name: ${user.fullName}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Status: ${user.status}`);
      console.log(`   Last Login: ${user.lastLoginAt || 'Never'}`);
      console.log('');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkRecentAdmins();
