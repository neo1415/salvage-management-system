import 'dotenv/config';
import { db } from '../src/lib/db/drizzle';
import { users } from '../src/lib/db/schema/users';

async function listUsers() {
  try {
    const allUsers = await db.select().from(users);

    if (allUsers.length === 0) {
      console.log('📭 No users found in database');
    } else {
      console.log(`📊 Found ${allUsers.length} users:\n`);
      allUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Phone: ${user.phone}`);
        console.log(`   Name: ${user.fullName}`);
        console.log(`   Status: ${user.status}`);
        console.log(`   Created: ${user.createdAt}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('Error listing users:', error);
  }
  
  process.exit(0);
}

listUsers();
