import { db } from '@/lib/db/drizzle';
import { users, vendors } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function createVendorProfile(email: string) {
  try {
    console.log('Looking for user with email:', email);
    
    // Find user
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (!user) {
      console.error('✗ User not found:', email);
      console.log('\nPlease check the email address and try again.');
      process.exit(1);
    }
    
    console.log('✓ User found:', user.id, user.fullName);
    
    // Check if vendor profile exists
    const [existingVendor] = await db.select().from(vendors).where(eq(vendors.userId, user.id)).limit(1);
    
    if (existingVendor) {
      console.log('✓ Vendor profile already exists:', existingVendor.id);
      console.log('  Business Name:', existingVendor.businessName);
      console.log('  Tier:', existingVendor.tier);
      console.log('  Status:', existingVendor.status);
      process.exit(0);
    }
    
    console.log('Creating vendor profile...');
    
    // Create vendor profile
    const [newVendor] = await db.insert(vendors).values({
      userId: user.id,
      businessName: user.fullName || 'Vendor Business',
      tier: 'tier1_bvn',
      rating: '0',
      status: 'pending',
    }).returning();
    
    console.log('\n✓ Vendor profile created successfully!');
    console.log('  Vendor ID:', newVendor.id);
    console.log('  Business Name:', newVendor.businessName);
    console.log('  Tier:', newVendor.tier);
    console.log('  Status:', newVendor.status);
    
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Error creating vendor profile:', error);
    process.exit(1);
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.error('Usage: npx tsx scripts/create-vendor-profile.ts <email>');
  console.error('Example: npx tsx scripts/create-vendor-profile.ts user@example.com');
  process.exit(1);
}

createVendorProfile(email);
