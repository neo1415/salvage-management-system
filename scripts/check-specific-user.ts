import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { eq } from 'drizzle-orm';

async function checkUser() {
  const userId = '21835051-7459-4f43-abc0-856c081cf6e4';
  
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  const [vendor] = await db.select().from(vendors).where(eq(vendors.userId, userId));
  
  console.log('User:', user ? {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: user.status
  } : 'Not found');
  
  console.log('\nVendor:', vendor ? {
    id: vendor.id,
    userId: vendor.userId,
    tier: vendor.tier,
    status: vendor.status,
    registrationFeePaid: vendor.registrationFeePaid
  } : 'Not found');
}

checkUser()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
