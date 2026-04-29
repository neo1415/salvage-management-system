/**
 * Fix Missing Vendor Profiles
 * 
 * This script creates vendor profiles for users who registered
 * but don't have a corresponding vendor record.
 */

import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { eq, notInArray, sql } from 'drizzle-orm';

async function fixMissingVendorProfiles() {
  console.log('🔍 Finding users without vendor profiles...\n');

  try {
    // Find all vendor users who don't have a vendor profile
    const usersWithoutVendorProfile = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        phone: users.phone,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(
        sql`${users.role} = 'vendor' AND ${users.id} NOT IN (SELECT user_id FROM vendors)`
      );

    if (usersWithoutVendorProfile.length === 0) {
      console.log('✅ All vendor users have vendor profiles. Nothing to fix.');
      return;
    }

    console.log(`Found ${usersWithoutVendorProfile.length} user(s) without vendor profiles:\n`);
    
    usersWithoutVendorProfile.forEach((user, index) => {
      console.log(`${index + 1}. ${user.fullName} (${user.email})`);
      console.log(`   User ID: ${user.id}`);
      console.log(`   Phone: ${user.phone}`);
      console.log(`   Created: ${user.createdAt}`);
      console.log('');
    });

    console.log('Creating vendor profiles...\n');

    // Create vendor profiles for all users without one
    for (const user of usersWithoutVendorProfile) {
      try {
        const [newVendor] = await db
          .insert(vendors)
          .values({
            userId: user.id,
            tier: 'tier1_bvn',
            status: 'pending',
            registrationFeePaid: false,
            performanceStats: {
              totalBids: 0,
              totalWins: 0,
              winRate: 0,
              avgPaymentTimeHours: 0,
              onTimePickupRate: 0,
              fraudFlags: 0,
            },
            rating: '0.00',
          })
          .returning();

        console.log(`✅ Created vendor profile for ${user.fullName}`);
        console.log(`   Vendor ID: ${newVendor.id}`);
        console.log('');
      } catch (error) {
        console.error(`❌ Failed to create vendor profile for ${user.fullName}:`, error);
      }
    }

    console.log('\n✅ Migration complete!');
    console.log(`Created ${usersWithoutVendorProfile.length} vendor profile(s).`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
fixMissingVendorProfiles()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
