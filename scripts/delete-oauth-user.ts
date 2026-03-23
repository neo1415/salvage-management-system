import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users } from '../src/lib/db/schema/users';
import { eq } from 'drizzle-orm';

async function deleteUser(email: string) {
  // Create a new connection just for this script
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL not found in environment');
    process.exit(1);
  }

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  try {
    console.log(`🔍 Looking for user: ${email}`);
    
    const result = await db
      .delete(users)
      .where(eq(users.email, email))
      .returning();

    if (result.length > 0) {
      console.log(`✅ Successfully deleted user: ${email}`);
      console.log(`   User ID: ${result[0].id}`);
      console.log(`   Name: ${result[0].fullName}`);
      console.log(`   Phone: ${result[0].phone}`);
    } else {
      console.log(`❌ User not found: ${email}`);
    }
  } catch (error) {
    console.error('❌ Error deleting user:', error);
  } finally {
    // Close the connection
    await client.end();
  }
}

// Get email from command line argument
const email = process.argv[2] || 'neowalker502@gmail.com';

console.log(`🗑️  Deleting user: ${email}\n`);
deleteUser(email);
