import 'dotenv/config';
import { db } from '../src/lib/db/drizzle';
import { users } from '../src/lib/db/schema/users';
import { eq } from 'drizzle-orm';

async function deleteUser(email: string) {
  try {
    const result = await db
      .delete(users)
      .where(eq(users.email, email))
      .returning();

    if (result.length > 0) {
      console.log(`✅ Deleted user: ${email}`);
      console.log(result[0]);
    } else {
      console.log(`❌ User not found: ${email}`);
    }
  } catch (error) {
    console.error('Error deleting user:', error);
  }
  
  process.exit(0);
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.error('Usage: tsx scripts/delete-user.ts <email>');
  process.exit(1);
}

deleteUser(email);
