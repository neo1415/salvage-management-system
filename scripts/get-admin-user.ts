/**
 * Get or create admin user for data imports
 */

import { config } from 'dotenv';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';

config();

async function getAdminUser() {
  try {
    // Try to find an existing admin user
    const adminUser = await db.query.users.findFirst({
      where: eq(users.role, 'system_admin'),
    });

    if (adminUser) {
      console.log('✅ Found admin user:', adminUser.id);
      console.log('   Email:', adminUser.email);
      console.log('   Name:', adminUser.name);
      return adminUser.id;
    }

    console.log('❌ No admin user found');
    console.log('💡 Please create an admin user first using:');
    console.log('   npx tsx scripts/make-super-admin.ts <email>');
    process.exit(1);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

getAdminUser();
