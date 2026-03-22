import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function refreshVendorSession(email: string) {
  try {
    console.log('Refreshing session for vendor:', email);
    
    // Find user
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (!user) {
      console.error('✗ User not found:', email);
      return;
    }
    
    console.log('✓ User found:', user.fullName);
    
    // Update last login to force session refresh
    await db
      .update(users)
      .set({ 
        lastLoginAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.id, user.id));
    
    console.log('✓ Session refresh triggered');
    console.log('\n📝 Instructions:');
    console.log('  1. User should refresh their browser or navigate to a new page');
    console.log('  2. The vendorId should now be included in their session');
    console.log('  3. All vendor-specific features should work properly');
    
  } catch (error) {
    console.error('\n✗ Error refreshing session:', error);
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.error('Usage: npx tsx scripts/refresh-vendor-session.ts <email>');
  console.error('Example: npx tsx scripts/refresh-vendor-session.ts skyneo502@gmail.com');
  process.exit(1);
}

refreshVendorSession(email);