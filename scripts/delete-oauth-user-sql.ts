import 'dotenv/config';
import postgres from 'postgres';

async function deleteUser(email: string) {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL not found in environment');
    process.exit(1);
  }

  // Create a single connection
  const sql = postgres(connectionString, { 
    max: 1,
    idle_timeout: 20,
    max_lifetime: 60 * 30
  });

  try {
    console.log(`🔍 Looking for user: ${email}`);
    
    // First, check if user exists
    const existingUser = await sql`
      SELECT id, email, full_name, phone FROM users WHERE email = ${email}
    `;

    if (existingUser.length === 0) {
      console.log(`❌ User not found: ${email}`);
      return;
    }

    console.log(`\n📋 Found user:`);
    console.log(`   ID: ${existingUser[0].id}`);
    console.log(`   Email: ${existingUser[0].email}`);
    console.log(`   Name: ${existingUser[0].full_name}`);
    console.log(`   Phone: ${existingUser[0].phone}`);
    
    // Delete the user
    const result = await sql`
      DELETE FROM users WHERE email = ${email} RETURNING id, email
    `;

    if (result.length > 0) {
      console.log(`\n✅ Successfully deleted user: ${email}`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sql.end();
  }
}

const email = process.argv[2] || 'neowalker502@gmail.com';
console.log(`🗑️  Deleting user: ${email}\n`);
deleteUser(email);
