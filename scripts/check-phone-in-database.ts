import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';

const phoneNumber = process.argv[2];

if (!phoneNumber) {
  console.error('❌ Please provide a phone number');
  console.log('Usage: npx tsx scripts/check-phone-in-database.ts +2348012345678');
  process.exit(1);
}

async function checkPhone() {
  console.log(`🔍 Checking for phone: ${phoneNumber}`);
  
  try {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.phone, phoneNumber));

    console.log(`\n📊 Results: ${result.length} user(s) found`);
    
    if (result.length > 0) {
      result.forEach((user, index) => {
        console.log(`\n👤 User ${index + 1}:`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Phone: ${user.phone}`);
        console.log(`   Full Name: ${user.fullName}`);
        console.log(`   Status: ${user.status}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Created At: ${user.createdAt}`);
        console.log(`   Deleted At: ${user.deletedAt || 'Not deleted'}`);
      });
    } else {
      console.log('✅ No users found with this phone number - registration should work!');
    }
  } catch (error) {
    console.error('❌ Error checking phone:', error);
  } finally {
    process.exit(0);
  }
}

checkPhone();
