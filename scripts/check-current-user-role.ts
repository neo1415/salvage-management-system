import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema';

async function checkCurrentUserRole() {
  try {
    console.log('🔍 Checking all users and their roles...\n');

    const allUsers = await db.select().from(users);

    console.log('📋 All Users:');
    console.log('─'.repeat(80));
    
    allUsers.forEach((user) => {
      console.log(`
Name:  ${user.name || 'N/A'}
Email: ${user.email}
Role:  ${user.role}
ID:    ${user.id}
      `);
    });

    console.log('─'.repeat(80));
    console.log('\n✅ To access admin config, you need role: "admin" or "manager"');
    console.log('\n💡 If you need to update a user role, use:');
    console.log('   UPDATE users SET role = \'admin\' WHERE email = \'your@email.com\';');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkCurrentUserRole();
